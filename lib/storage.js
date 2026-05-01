import { kv } from "@vercel/kv";
import fs from "fs/promises";
import path from "path";

const useKv = Boolean(process.env.VERCEL_KV_URL);
const localFile = path.join(process.cwd(), ".data", "tokens.json");

async function readLocal() {
  try {
    const contents = await fs.readFile(localFile, "utf8");
    return JSON.parse(contents);
  } catch {
    return {};
  }
}

async function writeLocal(data) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  await fs.writeFile(localFile, JSON.stringify(data, null, 2), "utf8");
}

function tokenKey(shop) {
  return `shopify_token:${shop}`;
}

export async function getShopToken(shop) {
  if (useKv) {
    return await kv.get(tokenKey(shop));
  }

  const store = await readLocal();
  return store[shop] || null;
}

export async function saveShopToken(shop, token) {
  if (useKv) {
    await kv.set(tokenKey(shop), token);
    return;
  }

  const store = await readLocal();
  store[shop] = token;
  await writeLocal(store);
}
