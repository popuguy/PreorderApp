// Preorder button modification script
(function() {
  'use strict';

  // Function to check if product has preorder tag
  async function getAppOrigin() {
    const currentScript = document.currentScript || document.querySelector('script[src*="preorder-script.js"]');
    if (currentScript) {
      try {
        const scriptUrl = new URL(currentScript.src);
        return scriptUrl.origin;
      } catch (error) {
        console.warn('Unable to parse preorder script src:', error);
      }
    }
    return `${window.location.protocol}//${window.location.host}`;
  }

  function getShopFromScript() {
    const currentScript = document.currentScript || document.querySelector('script[src*="preorder-script.js"]');
    if (currentScript) {
      try {
        const scriptUrl = new URL(currentScript.src);
        const shop = scriptUrl.searchParams.get('shop');
        if (shop) return shop;
      } catch (error) {
        console.warn('Unable to parse shop from preorder script src:', error);
      }
    }
    return window.Shopify?.shop || null;
  }

  function logDebug(message, data) {
    if (window.console && window.console.log) {
      window.console.log(`[preorder-script] ${message}`, data || "");
    }
  }

  async function checkPreorderStatus(productId) {
    const appOrigin = await getAppOrigin();
    const shop = getShopFromScript();
    logDebug('Checking preorder status', {productId, appOrigin, shop});

    if (!appOrigin || !shop) {
      console.error('Missing app origin or shop in preorder script.', {appOrigin, shop});
      return false;
    }

    try {
      const response = await fetch(`${appOrigin}/api/preorder-status?id=${encodeURIComponent(productId)}&shop=${encodeURIComponent(shop)}`);
      if (!response.ok) {
        const text = await response.text();
        console.error('Preorder status fetch failed:', response.status, text);
        return false;
      }
      const data = await response.json();
      logDebug('Preorder status response', data);
      return data.preorder || false;
    } catch (error) {
      console.error('Error checking preorder status:', error);
      return false;
    }
  }

  // Function to modify add to cart buttons
  function modifyButtons() {
    const buttons = document.querySelectorAll(
      'button[name="add"], button[data-testid*="add-to-cart"], button.add-to-cart-button, button[type="submit"]'
    );
    logDebug('modifyButtons found buttons', buttons.length);

    buttons.forEach(async function(button) {
      if (button.classList.contains('preorder-modified')) return;

      const form = button.closest('form');
      let productId = null;

      const findInputValue = (selector) => {
        const input = form?.querySelector(selector) || document.querySelector(selector);
        return input?.value || input?.getAttribute('value') || null;
      };

      productId = button.getAttribute('data-product-id') ||
                  button.getAttribute('data-variant-id') ||
                  button.closest('[data-product-id]')?.getAttribute('data-product-id') ||
                  findInputValue('input[name="id"]') ||
                  findInputValue('input[name="product-id"]') ||
                  findInputValue('input[data-product-id]');

      if (!productId) {
        const productFormComponent = form?.closest('product-form-component') || document.querySelector('product-form-component[data-product-id]');
        productId = productFormComponent?.getAttribute('data-product-id') || null;
      }

      if (!productId) {
        const productData = getShopifyProductData();
        productId = productData.variantId || productData.productId || null;
      }

      if (!productId) {
        const productMeta = document.querySelector('meta[property="og:product:id"]');
        if (productMeta) {
          productId = productMeta.getAttribute('content');
        }
      }

      logDebug('button productId', {button, productId});

      if (productId) {
        const isPreorder = await checkPreorderStatus(productId);
        if (isPreorder) {
          const label = button.querySelector('.add-to-cart-text__content span span') ||
                        button.querySelector('.add-to-cart-text__content span') ||
                        button;
          if (label) {
            label.textContent = 'Preorder';
          } else {
            button.textContent = 'Preorder';
          }

          button.classList.add('preorder-button', 'preorder-modified');
          button.style.backgroundColor = '#ff6b35';
          button.style.borderColor = '#ff6b35';
          button.style.color = 'white';
        }
      }
    });
  }

  function getShopifyProductData() {
    const data = {
      productId: null,
      variantId: null
    };

    if (window.Shopify?.product?.id) {
      data.productId = window.Shopify.product.id;
    }

    if (window.Shopify?.productVariants && window.Shopify.productVariants.length > 0) {
      data.variantId = window.Shopify.productVariants[0].id;
      if (!data.productId && window.Shopify.productVariants[0].product?.id) {
        data.productId = window.Shopify.productVariants[0].product.id;
      }
    }

    const componentProductId = document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
    if (!data.productId && componentProductId) {
      data.productId = componentProductId;
    }

    return data;
  }

  // Run on page load
  document.addEventListener('DOMContentLoaded', function() {
    logDebug('DOMContentLoaded event');
    modifyButtons();
    setTimeout(modifyButtons, 500);
  });

  window.addEventListener('load', function() {
    logDebug('window load event');
    modifyButtons();
  });

  // Also run on dynamic content changes (for AJAX-loaded content)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        setTimeout(modifyButtons, 100); // Small delay for content to load
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
