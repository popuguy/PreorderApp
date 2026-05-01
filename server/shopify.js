import crypto from "crypto";

export function buildShopifyAuthUrl({shop, apiKey, scopes, redirectUri, state}) {
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state
  });
  params.append("grant_options[]", "per-user");
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(query) {
  const {hmac, signature, ...rest} = query;
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");
  const generated = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return generated === hmac || generated === signature;
}

export async function exchangeTemporaryCode({shop, apiKey, apiSecret, code}) {
  const url = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${details}`);
  }

  return response.json();
}

export async function shopifyRequest({shop, accessToken, method = "GET", path, body}) {
  const url = `https://${shop}/admin/api/2025-10${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Shopify request failed ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}
