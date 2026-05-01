import { requireShopAuth } from "../lib/auth.js";

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
  return match ? match[1] : null;
}

async function fetchAllProducts(shop, accessToken) {
  const products = [];
  let url = `https://${shop}/admin/api/2025-10/products.json?fields=id,title,handle,tags&limit=250`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      }
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Shopify products request failed ${response.status}: ${payload}`);
    }

    const data = await response.json();
    products.push(...(data.products || []));

    const linkHeader = response.headers.get("link");
    url = parseNextLink(linkHeader);
  }

  return products;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const auth = await requireShopAuth(req, res);
  if (!auth) return;

  try {
    const productsResponse = await fetchAllProducts(auth.shop, auth.accessToken);

    const products = productsResponse.map((product) => {
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
