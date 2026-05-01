import { Redis } from "@upstash/redis";
import fs from "fs/promises";
import path from "path";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);
const redis = useRedis
  ? new Redis({
      url: redisUrl,
      token: redisToken
    })
  : null;
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

function ensureStorageAvailable() {
  if (!useRedis && process.env.NODE_ENV === "production") {
    throw new Error(
      "Vercel production deployment requires Redis token storage. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN."
    );
  }
}

export async function getShopToken(shop) {
  if (useRedis && redis) {
    return await redis.get(tokenKey(shop));
  }

  ensureStorageAvailable();
  const store = await readLocal();
  return store[shop] || null;
}

export async function saveShopToken(shop, token) {
  if (useUpstash && redis) {
    await redis.set(tokenKey(shop), token);
    return;
  }

  ensureStorageAvailable();
  const store = await readLocal();
  store[shop] = token;
  await writeLocal(store);
}
