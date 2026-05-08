import { getSession } from "../../lib/session.js";
import { normalizeQueryValue, verifyShopifyHmac, exchangeTemporaryCode, shopifyRequest } from "../../lib/shopify.js";
import { saveShopToken } from "../../lib/storage.js";

async function setupPreorderIntegration(shop, accessToken, req) {
  // Try theme modification first
  try {
    await modifyThemeForPreorder(shop, accessToken);
    console.log('Theme modification successful');
    return;
  } catch (themeError) {
    console.error('Theme modification failed, trying script tag fallback:', themeError);
  }

  // Fall back to script tag
  try {
    const rawHost = process.env.HOST || req.headers['x-forwarded-host'] || req.headers.host;
    const appOrigin = rawHost
      ? rawHost.replace(/\/+$/g, "").replace(/^(https?:)?\/\//, "https://")
      : null;

    if (appOrigin) {
      const scriptSrc = `${appOrigin}/preorder-script.js?shop=${encodeURIComponent(shop)}`;
      await shopifyRequest({
        shop,
        accessToken,
        method: 'POST',
        path: '/script_tags.json',
        body: {
          script_tag: {
            event: 'onload',
            src: scriptSrc,
            display_scope: 'online_store'
          }
        }
      });
      console.log('Script tag fallback successful');
    }
  } catch (scriptError) {
    console.error('Script tag fallback failed:', scriptError);
    throw scriptError;
  }
}

async function modifyThemeForPreorder(shop, accessToken) {
  // Get the published theme
  const themesResponse = await shopifyRequest({
    shop,
    accessToken,
    path: "/themes.json"
  });

  const publishedTheme = themesResponse.themes.find(theme => theme.role === 'main');
  if (!publishedTheme) {
    throw new Error("No published theme found");
  }

  // Get the current product template
  const templateResponse = await shopifyRequest({
    shop,
    accessToken,
    path: `/themes/${publishedTheme.id}/assets.json?asset[key]=templates/product.json`
  });

  let templateContent = templateResponse.asset?.value || '{}';
  let templateData;

  try {
    templateData = JSON.parse(templateContent);
  } catch (error) {
    throw new Error("Theme uses Liquid templates, not JSON. Theme modification not supported.");
  }

  // Check if preorder logic is already injected
  if (templateData.sections && templateData.sections['preorder-app-integration']) {
    console.log('Preorder integration already exists in theme');
    return;
  }

  // Inject preorder logic into the main product section
  if (!templateData.sections) {
    templateData.sections = {};
  }

  // Add preorder section that checks product tags and modifies button
  templateData.sections['preorder-app-integration'] = {
    "type": "preorder-integration",
    "settings": {}
  };

  // Update the template
  await shopifyRequest({
    shop,
    accessToken,
    method: "PUT",
    path: `/themes/${publishedTheme.id}/assets.json`,
    body: {
      asset: {
        key: "templates/product.json",
        value: JSON.stringify(templateData, null, 2)
      }
    }
  });

  // Create the preorder integration section
  const sectionContent = `
{%- assign has_preorder_tag = false -%}
{%- for tag in product.tags -%}
  {%- if tag == 'preorder' -%}
    {%- assign has_preorder_tag = true -%}
  {%- endif -%}
{%- endfor -%}

{%- if has_preorder_tag -%}
<style>
.preorder-button {
  background-color: #ff6b35 !important;
  border-color: #ff6b35 !important;
  color: white !important;
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // Find add to cart buttons and modify them for preorder
  const buttons = document.querySelectorAll('button[name="add"], button[data-testid*="add-to-cart"], .add-to-cart-button, button[type="submit"]');
  buttons.forEach(button => {
    if (button.closest('.preorder-modified')) return;

    const buttonText = button.querySelector('.add-to-cart-text__content span span') ||
                      button.querySelector('.add-to-cart-text__content span') ||
                      button;

    if (buttonText) {
      buttonText.textContent = 'Preorder';
    } else {
      button.textContent = 'Preorder';
    }

    button.classList.add('preorder-button', 'preorder-modified');
    button.style.backgroundColor = '#ff6b35';
    button.style.borderColor = '#ff6b35';
    button.style.color = 'white';
  });
});
</script>
{%- endif -%}
  `;

  await shopifyRequest({
    shop,
    accessToken,
    method: "PUT",
    path: `/themes/${publishedTheme.id}/assets.json`,
    body: {
      asset: {
        key: "sections/preorder-integration.liquid",
        value: sectionContent
      }
    }
  });
}

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

    // Setup preorder theme integration directly
    try {
      await setupPreorderIntegration(shop, accessToken, req);
    } catch (integrationError) {
      console.error('Preorder integration setup failed:', integrationError);
      // Continue anyway - user can still use the app
    }

    res.writeHead(302, {Location: "/app.html"});
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send(`Unable to complete Shopify authorization: ${error.message}`);
  }
}
