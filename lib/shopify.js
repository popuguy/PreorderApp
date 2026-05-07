import crypto from "crypto";
import {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  HOST,
  ensureEnv
} from "./config.js";

export function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function validateShopDomain(shop) {
  return typeof shop === "string" && shop.endsWith(".myshopify.com");
}

export function buildShopifyAuthUrl({shop, redirectUri, state}) {
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    access_mode: "offline"
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(query) {
  const {hmac, signature, ...rest} = query;
  const message = Object.keys(rest)
    .sort()
    .map((key) => {
      const value = rest[key];
      const normalized = Array.isArray(value) ? value.join(",") : value;
      return `${key}=${normalized}`;
    })
    .join("&");

  const generated = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return generated === hmac || generated === signature;
}

export async function exchangeTemporaryCode({shop, code}) {
  const url = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
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

export function buildCallbackUrl(req) {
  if (HOST) {
    return `${HOST}/auth/callback`;
  }

  const host = req?.headers?.host;
  if (!host) {
    throw new Error("Unable to build callback URL. Set HOST or provide request host headers.");
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}/auth/callback`;
}
