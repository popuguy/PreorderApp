import { requireShopAuth } from "../lib/auth.js";
import { shopifyRequest } from "../lib/shopify.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const auth = await requireShopAuth(req, res);
  if (!auth) return;

  try {
    const response = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: "/products.json?fields=id,title,handle,tags&limit=50"
    });

    const products = response.products.map((product) => {
      const tags = product.tags ? product.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        tags,
        preorder: tags.includes("preorder")
      };
    });

    res.status(200).json({products});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to load products."});
  }
}
