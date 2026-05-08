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

  function injectPreorderStyles() {
    if (document.getElementById('preorder-script-styles')) return;
    const style = document.createElement('style');
    style.id = 'preorder-script-styles';
    style.textContent = `
      .preorder-button {
        background-color: #ff6b35 !important;
        border-color: #ff6b35 !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Preload preorder status for all products on the page
  async function preloadPreorderData() {
    const appOrigin = await getAppOrigin();
    const shop = getShopFromScript();

    if (!appOrigin || !shop) return {};

    // Find all product IDs on the page
    const productIds = new Set();
    const buttons = document.querySelectorAll(
      'button[name="add"], button[data-testid*="add-to-cart"], button.add-to-cart-button, button[type="submit"]'
    );

    buttons.forEach(button => {
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

      if (productId) {
        productIds.add(productId);
      }
    });

    if (productIds.size === 0) return {};

    // Batch fetch preorder status for all products
    const preorderData = {};
    const promises = Array.from(productIds).map(async (productId) => {
      try {
        const response = await fetch(`${appOrigin}/api/preorder-status?id=${encodeURIComponent(productId)}&shop=${encodeURIComponent(shop)}`);
        if (response.ok) {
          const data = await response.json();
          preorderData[productId] = data.preorder || false;
        }
      } catch (error) {
        console.error('Error preloading preorder status for', productId, error);
      }
    });

    await Promise.all(promises);
    return preorderData;
  }

  function modifyButtons(preorderData = {}) {
    injectPreorderStyles();

    const buttons = document.querySelectorAll(
      'button[name="add"], button[data-testid*="add-to-cart"], button.add-to-cart-button, button[type="submit"]'
    );
    logDebug('modifyButtons found buttons', buttons.length);

    buttons.forEach(function(button) {
      if (button.classList.contains('preorder-processed')) return;

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

      if (productId) {
        const isPreorder = preorderData[productId];
        if (isPreorder) {
          setPreorderText(button);
        }
        button.classList.add('preorder-processed');
      }
    });
  }

  function setPreorderText(button) {
    const label = button.querySelector('.add-to-cart-text__content span span') ||
                  button.querySelector('.add-to-cart-text__content span') ||
                  button;
    if (label) {
      label.textContent = 'Preorder';
    } else {
      button.textContent = 'Preorder';
    }
    button.classList.add('preorder-button');
    button.style.backgroundColor = '#ff6b35';
    button.style.borderColor = '#ff6b35';
    button.style.color = 'white';
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

  // Run immediately and preload data
  (async function() {
    logDebug('Script starting immediately');

    // Preload preorder data as soon as possible
    const preorderData = await preloadPreorderData();
    logDebug('Preloaded preorder data', preorderData);

    // Modify buttons immediately with preloaded data
    modifyButtons(preorderData);

    // Run on page load events as backup
    document.addEventListener('DOMContentLoaded', function() {
      logDebug('DOMContentLoaded event');
      modifyButtons(preorderData);
    });

    window.addEventListener('load', function() {
      logDebug('window load event');
      modifyButtons(preorderData);
    });

    // Also run on dynamic content changes (for AJAX-loaded content)
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          setTimeout(() => modifyButtons(preorderData), 100); // Small delay for content to load
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  })();
