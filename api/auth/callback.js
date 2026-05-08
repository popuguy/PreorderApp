import { getSession } from "../../lib/session.js";
import { normalizeQueryValue, verifyShopifyHmac, exchangeTemporaryCode, shopifyRequest } from "../../lib/shopify.js";
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
    const accessToken = tokenResponse.access_token;
    await saveShopToken(shop, accessToken);
    session.shop = shop;
    await session.save();

    // Setup preorder script tag directly after auth using the new token
    try {
      const rawHost = process.env.HOST || req.headers['x-forwarded-host'] || req.headers.host;
      const appOrigin = rawHost
        ? rawHost.replace(/\/+$/g, "").replace(/^(https?:)?\/\//, "https://")
        : null;

      if (appOrigin) {
        const scriptSrc = `${appOrigin}/preorder-script.js?shop=${encodeURIComponent(shop)}`;
        const existingTagsResponse = await shopifyRequest({
          shop,
          accessToken,
          path: '/script_tags.json'
        });

        const existingTag = existingTagsResponse.script_tags.find((tag) => {
          return tag.src === scriptSrc || tag.src?.includes('/preorder-script.js');
        });

        const scriptTagPayload = {
          script_tag: {
            event: 'oninstantload',
            src: scriptSrc,
            display_scope: 'online_store'
          }
        };

        if (existingTag) {
          await shopifyRequest({
            shop,
            accessToken,
            method: 'PUT',
            path: `/script_tags/${existingTag.id}.json`,
            body: scriptTagPayload
          });
        } else {
          await shopifyRequest({
            shop,
            accessToken,
            method: 'POST',
            path: '/script_tags.json',
            body: scriptTagPayload
          });
        }
      }
    } catch (scriptError) {
      console.error('Direct script tag setup failed:', scriptError);
      // Don't fail auth if script setup fails
    }

    res.writeHead(302, {Location: "/app.html"});
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send(`Unable to complete Shopify authorization: ${error.message}`);
  }
}
