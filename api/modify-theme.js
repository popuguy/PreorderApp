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
    // Get the published theme
    const themesResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: "/themes.json"
    });

    const publishedTheme = themesResponse.themes.find(theme => theme.role === 'main');
    if (!publishedTheme) {
      res.status(404).json({error: "No published theme found"});
      return;
    }

    // Get the current product template
    const templateResponse = await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      path: `/themes/${publishedTheme.id}/assets.json?asset[key]=templates/product.json`
    });

    let templateContent = templateResponse.asset?.value || '{}';
    let templateData;

    try {
      templateData = JSON.parse(templateContent);
    } catch (error) {
      // If it's not JSON, it might be Liquid - skip for now
      res.status(400).json({error: "Theme uses Liquid templates, not JSON. Theme modification not supported for this theme type."});
      return;
    }

    // Check if preorder logic is already injected
    if (templateData.sections && templateData.sections['preorder-app-integration']) {
      res.status(200).json({message: "Preorder integration already exists in theme"});
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
      shop: auth.shop,
      accessToken: auth.accessToken,
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
    const sectionContent = {
      "name": "Preorder Integration",
      "settings": [],
      "blocks": [],
      "presets": [],
      "locales": {}
    };

    await shopifyRequest({
      shop: auth.shop,
      accessToken: auth.accessToken,
      method: "PUT",
      path: `/themes/${publishedTheme.id}/assets.json`,
      body: {
        asset: {
          key: "sections/preorder-integration.liquid",
          value: `
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
.preorder-button-text::after {
  content: "Preorder";
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
          `
        }
      }
    });

    res.status(200).json({
      message: "Preorder integration added to theme",
      theme_id: publishedTheme.id,
      theme_name: publishedTheme.name
    });

  } catch (error) {
    console.error('Theme modification error:', error);
    res.status(500).json({error: error.message});
  }
}