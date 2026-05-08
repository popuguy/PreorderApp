import { getSession } from "../../lib/session.js";
import { validateShopDomain, buildShopifyAuthUrl, buildCallbackUrl } from "../../lib/shopify.js";
import { APP_PASSWORD } from "../../lib/config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const shop = req.query.shop;
  const password = req.query.password;

  // Check password if required
  if (APP_PASSWORD && (!password || password !== APP_PASSWORD)) {
    res.status(401).json({error: "Invalid password"});
    return;
  }

  if (!shop || !validateShopDomain(shop)) {
    res.status(400).json({error: "Invalid shop domain"});
    return;
  }

  try {
    const session = await getSession(req, res);
    const state = Math.random().toString(36).substring(2);
    session.state = state;
    await session.save();

    const callbackUrl = buildCallbackUrl(req);
    const authUrl = buildShopifyAuthUrl({
      shop,
      redirectUri: callbackUrl,
      state
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Failed to initiate authentication"});
  }
}