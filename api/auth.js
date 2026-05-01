import crypto from "crypto";
import { getSession } from "../lib/session.js";
import { buildShopifyAuthUrl, normalizeQueryValue, validateShopDomain, buildCallbackUrl } from "../lib/shopify.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const shop = normalizeQueryValue(req.query.shop);
  if (!validateShopDomain(shop)) {
    res.status(400).send("Invalid shop domain. Use your-shop.myshopify.com");
    return;
  }

  const session = await getSession(req, res);
  const state = crypto.randomBytes(16).toString("hex");
  session.state = state;
  await session.save();

  const authUrl = buildShopifyAuthUrl({
    shop,
    redirectUri: buildCallbackUrl(),
    state
  });

  res.writeHead(302, {Location: authUrl});
  res.end();
}
