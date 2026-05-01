import { getSession } from "../../lib/session.js";
import { normalizeQueryValue, verifyShopifyHmac, exchangeTemporaryCode } from "../../lib/shopify.js";
import { saveShopToken } from "../../lib/storage.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const session = await getSession(req, res);
  const queryState = normalizeQueryValue(req.query.state);
  const shop = normalizeQueryValue(req.query.shop);
  const code = normalizeQueryValue(req.query.code);

  if (!queryState || session.state !== queryState) {
    res.status(400).send("Request origin cannot be verified.");
    return;
  }

  if (!verifyShopifyHmac(req.query)) {
    res.status(400).send("HMAC validation failed.");
    return;
  }

  try {
    const tokenResponse = await exchangeTemporaryCode({shop, code});
    await saveShopToken(shop, tokenResponse.access_token);
    session.shop = shop;
    await session.save();
    res.writeHead(302, {Location: "/app.html"});
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to complete Shopify authorization.");
  }
}
