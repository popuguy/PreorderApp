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
    // Test theme access
    const themesResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: "/themes.json"
    });

    // Test script tag access
    const scriptsResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: "/script_tags.json"
    });

    res.status(200).json({
      shop: auth.shop,
      has_theme_access: !!themesResponse.themes,
      theme_count: themesResponse.themes?.length || 0,
      has_script_access: !!scriptsResponse.script_tags,
      script_count: scriptsResponse.script_tags?.length || 0,
      scopes_tested: ['read_themes', 'write_themes', 'read_script_tags', 'write_script_tags']
    });

  } catch (error) {
    console.error('Scope check error:', error);
    res.status(200).json({
      shop: auth.shop,
      error: error.message,
      has_theme_access: false,
      has_script_access: false
    });
  }
}