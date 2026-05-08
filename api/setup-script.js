import { requireShopAuth } from "../lib/auth.js";
import { shopifyRequest } from "../lib/shopify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const auth = await requireShopAuth(req, res);
  if (!auth) return;

  try {
    // Create or update script tag for preorder button modification
    const rawHost = process.env.HOST || req.headers['x-forwarded-host'] || req.headers.host;
    const appOrigin = rawHost
      ? rawHost.replace(/\/+$/g, "").replace(/^(https?:)?\/\//, "https://")
      : "";
    const scriptSrc = `${appOrigin}/preorder-script.js?shop=${encodeURIComponent(auth.shop)}`;
    const scriptTagData = {
      script_tag: {
        event: "onload",
        src: scriptSrc,
        display_scope: "online_store"
      }
    };

    const existingTagsResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: "/script_tags.json"
    });

    const existingTag = existingTagsResponse.script_tags.find((tag) => {
      return tag.src === scriptSrc || tag.src?.includes('/preorder-script.js');
    });

    if (existingTag) {
      await shopifyRequest({
        shop: auth.shop,
        accessToken: auth.accessToken,
        method: "PUT",
        path: `/script_tags/${existingTag.id}.json`,
        body: scriptTagData
      });
    } else {
      await shopifyRequest({
        shop: auth.shop,
        accessToken: auth.accessToken,
        method: "POST",
        path: "/script_tags.json",
        body: scriptTagData
      });
    }

    res.status(200).json({message: "Preorder script tag updated"});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to update script tag."});
  }
}
