import { shopifyRequest } from "../lib/shopify.js";

// This endpoint is called by the preorder script from the storefront
// It needs to be accessible without auth since it's called from the browser
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const productId = req.query.id;
  const shop = req.query.shop;

  if (!productId) {
    res.status(400).json({error: "Product ID required"});
    return;
  }

  if (!shop) {
    res.status(400).json({error: "Shop domain required"});
    return;
  }

  const { normalizeQueryValue, validateShopDomain } = await import("../lib/shopify.js");
  const normalizedShop = normalizeQueryValue(shop);
  if (!validateShopDomain(normalizedShop)) {
    res.status(400).json({error: "Invalid shop domain"});
    return;
  }

  try {
    const { getShopToken } = await import("../lib/storage.js");
    const accessToken = await getShopToken(normalizedShop);

    if (!accessToken) {
      res.status(401).json({error: "Shop not authenticated"});
      return;
    }

    let response;
    try {
      response = await shopifyRequest({
        shop: normalizedShop,
        accessToken,
        path: `/products/${productId}.json?fields=tags`
      });
    } catch (productError) {
      // If the ID is a variant, try loading the variant and use its product ID
      response = null;
    }

    if (!response) {
      const variantResponse = await shopifyRequest({
        shop: normalizedShop,
        accessToken,
        path: `/variants/${productId}.json`
      });
      const variant = variantResponse.variant;
      if (!variant || !variant.product_id) {
        throw new Error('Variant not found');
      }
      response = await shopifyRequest({
        shop: normalizedShop,
        accessToken,
        path: `/products/${variant.product_id}.json?fields=tags`
      });
    }

    const tags = response.product.tags ? response.product.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
    const preorder = tags.includes("preorder");

    res.status(200).json({preorder});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to check preorder status."});
  }
}
