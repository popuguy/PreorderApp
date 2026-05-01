import { requireShopAuth } from "../../../lib/auth.js";
import { shopifyRequest } from "../../../lib/shopify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const auth = await requireShopAuth(req, res);
  if (!auth) return;

  const productId = req.query.id;
  const { preorder } = req.body;

  if (typeof preorder !== "boolean") {
    res.status(400).json({error: "Request body must contain preorder boolean."});
    return;
  }

  try {
    const productResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: `/products/${productId}.json?fields=id,tags`
    });

    const currentTags = productResponse.product.tags
      ? productResponse.product.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];
    const activeTags = new Set(currentTags);

    if (preorder) {
      activeTags.add("preorder");
    } else {
      activeTags.delete("preorder");
    }

    const updatedProps = {
      product: {
        id: Number(productId),
        tags: Array.from(activeTags).join(", ")
      }
    };

    const updateResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      method: "PUT",
      path: `/products/${productId}.json`,
      body: updatedProps
    });

    const tags = updateResponse.product.tags
      ? updateResponse.product.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    res.status(200).json({
      id: updateResponse.product.id,
      title: updateResponse.product.title,
      handle: updateResponse.product.handle,
      tags,
      preorder: tags.includes("preorder")
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to update preorder status."});
  }
}
