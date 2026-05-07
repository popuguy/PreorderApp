const statusEl = document.getElementById("status");
const productListEl = document.getElementById("product-list");

async function fetchProducts() {
  statusEl.textContent = "Loading products…";
  try {
    const response = await fetch("/api/products");
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    const payload = await response.json();
    renderProducts(payload.products);
  } catch (error) {
    statusEl.textContent = "Unable to load products. Refresh the page.";
    console.error(error);
  }
}

async function ensureScriptTag() {
  try {
    await fetch('/api/setup-script', {method: 'POST'});
    console.log('Preorder storefront script tag ensured.');
  } catch (error) {
    console.error('Unable to ensure preorder script tag:', error);
  }
}

function renderProducts(products) {
  if (!products || products.length === 0) {
    statusEl.textContent = "No products found in this shop.";
    return;
  }

  statusEl.textContent = `${products.length} products loaded.`;
  productListEl.innerHTML = products
    .map(
      (product) => `
      <div class="card product-card">
        <div>
          <h2>${product.title}</h2>
          <p class="meta">handle: ${product.handle}</p>
          <p class="meta">tags: ${product.tags.join(", ") || "none"}</p>
        </div>
        <button class="button ${product.preorder ? "secondary" : "primary"}" data-id="${product.id}" data-preorder="${!product.preorder}">
          ${product.preorder ? "Remove preorder" : "Mark preorder"}
        </button>
      </div>`
    )
    .join("");

  productListEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.id;
      const preorder = button.dataset.preorder === "true";
      button.disabled = true;
      button.textContent = preorder ? "Updating…" : "Updating…";

      try {
        await fetch(`/api/products/${productId}/preorder`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({preorder})
        });
        await fetchProducts();
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = preorder ? "Set preorder" : "Remove preorder";
        statusEl.textContent = "Unable to update product. Try again.";
      }
    });
  });
}

fetchProducts().then(() => {
  ensureScriptTag();
});
