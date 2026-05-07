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
      path: "/script_tags.json"
    });

    const tags = response.script_tags || [];
    const preorderTags = tags.filter(tag => tag.src?.includes('preorder-script.js'));

    res.status(200).json({
      total_script_tags: tags.length,
      preorder_script_tags: preorderTags,
      all_script_tags: tags.map(t => ({
        id: t.id,
        src: t.src,
        event: t.event,
        display_scope: t.display_scope
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error.message});
  }
}
