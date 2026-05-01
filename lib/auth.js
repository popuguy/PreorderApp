import { getSession } from "./session.js";
import { getShopToken } from "./storage.js";

export async function requireShopAuth(req, res) {
  const session = await getSession(req, res);
  const shop = session.shop;

  if (!shop) {
    res.status(401).json({error: "Authentication required. Visit / and connect your shop."});
    return null;
  }

  const accessToken = await getShopToken(shop);
  if (!accessToken) {
    res.status(401).json({error: "Authentication required. Visit / and connect your shop."});
    return null;
  }

  return {shop, accessToken};
}
