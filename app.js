const PRODUCTS_JSON_PATH = './products.json';

const state = {
  products: [],
  filteredProducts: [],
  searchQuery: '',
  selectedCategory: 'all',
};

const elements = {
  searchInput: document.getElementById('productSearch'),
  categoryFilter: document.getElementById('categoryFilter'),
  productsGrid: document.getElementById('productsGrid'),
  productsLoading: document.getElementById('productsLoading'),
  productsEmpty: document.getElementById('productsEmpty'),
  catalogMeta: document.getElementById('catalogMeta'),
};

const DISPLAY_LIMIT = 10;

async function initCatalog() {
  bindEvents();
  await loadProducts();
}

function bindEvents() {
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener('change', (event) => {
      state.selectedCategory = event.target.value;
      applyFilters();
    });
  }
}

async function loadProducts() {
  showLoading(true);
  showEmpty(false);

  try {
    const response = await fetch(PRODUCTS_JSON_PATH, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to load products.json (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('products.json must be an array.');
    }

    state.products = data;
    populateCategoryFilter(data);
    applyFilters();
  } catch (error) {
    console.error('Catalog load error:', error);
    elements.productsGrid.innerHTML = '';
    showEmpty(true, 'Unable to load products right now.');
    setCatalogMeta('Catalog unavailable.');
  } finally {
    showLoading(false);
  }
}

function populateCategoryFilter(products) {
  if (!elements.categoryFilter) return;

  const categories = [
    ...new Set(
      products
        .map((product) => String(product.category || '').trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  elements.categoryFilter.innerHTML = `
    <option value="all">All Categories</option>
    ${categories.map((category) => `
      <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join('')}
  `;
}

function applyFilters() {
  const query = state.searchQuery;
  const category = state.selectedCategory;

  const matched = state.products.filter((product) => {
    const matchesCategory =
      category === 'all' ||
      String(product.category || '').trim() === category;

    const text = [
      product.product_name || '',
      product.barcode || '',
      product.category || '',
      product.description || '',
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !query || text.includes(query);

    return matchesCategory && matchesSearch;
  });

  state.filteredProducts = matched;

  const finalList = buildDisplayList(matched, state.products);

  renderProducts(finalList);
  updateMeta(matched.length, state.products.length);
}

function buildDisplayList(matched, allProducts) {
  const result = [...matched];

  if (result.length >= DISPLAY_LIMIT) {
    return shuffleArray(result).slice(0, DISPLAY_LIMIT);
  }

  const needed = DISPLAY_LIMIT - result.length;

  const resultKeys = new Set(result.map(getProductKey));

  const remainingPool = allProducts.filter((product) => {
    return !resultKeys.has(getProductKey(product));
  });

  const randomFill = shuffleArray(remainingPool).slice(0, needed);

  return [...result, ...randomFill];
}

function getProductKey(product) {
  return String(
    product.barcode ||
    product.product_name ||
    product.image ||
    JSON.stringify(product)
  );
}

function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function renderProducts(products) {
  if (!elements.productsGrid) return;

  if (!products.length) {
    elements.productsGrid.innerHTML = '';
    showEmpty(true);
    return;
  }

  showEmpty(false);

  elements.productsGrid.innerHTML = products
    .map((product, index) => buildProductCard(product, index))
    .join('');

  bindProductToggleEvents();
}

function buildProductCard(product, index) {
  const safeName = escapeHtml(product.product_name || 'Unnamed Product');
  const safeDescription = escapeHtml(product.description || '');
  const imageHtml = buildProductImage(product);

  return `
    <article class="product-card" data-product-card>
      <button
        class="product-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="product-details-${index}"
      >
        <div class="product-mobile-row">
          <div class="product-mobile-image">
            ${imageHtml}
          </div>

          <div class="product-mobile-title-wrap">
            <h3 class="product-name mobile-name">${safeName}</h3>
          </div>
        </div>

        <div class="product-desktop-image">
          ${imageHtml}
        </div>

        <div class="product-body">
          <h3 class="product-name desktop-name">${safeName}</h3>

          <div id="product-details-${index}" class="product-description-wrap">
            <p class="product-description">${safeDescription}</p>
          </div>
        </div>
      </button>
    </article>
  `;
}

function bindProductToggleEvents() {
  const toggles = document.querySelectorAll('.product-toggle');

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const card = toggle.closest('[data-product-card]');
      if (!card) return;

      const isExpanded = card.classList.contains('expanded');
      card.classList.toggle('expanded');
      toggle.setAttribute('aria-expanded', String(!isExpanded));
    });
  });
}

function buildProductImage(product) {
  const imagePath = String(product.image || '').trim();
  const productName = escapeAttribute(product.product_name || 'Product image');

  if (!imagePath) {
    return `
      <div class="product-image placeholder">
        <span>No Image</span>
      </div>
    `;
  }

  return `
    <img
      src="${escapeAttribute(imagePath)}"
      alt="${productName}"
      class="product-image"
      loading="lazy"
      onerror="this.outerHTML='<div class=&quot;product-image placeholder&quot;><span>Image Unavailable</span></div>'"
    />
  `;
}

function updateMeta(shown, total) {
  if (!elements.catalogMeta) return;

  elements.catalogMeta.textContent =
    `Showing ${Math.min(shown, DISPLAY_LIMIT)} results (Total: ${total})`;
}

function setCatalogMeta(text) {
  if (!elements.catalogMeta) return;
  elements.catalogMeta.textContent = text;
}

function showLoading(isLoading) {
  if (!elements.productsLoading) return;
  elements.productsLoading.style.display = isLoading ? 'block' : 'none';
}

function showEmpty(isEmpty, customText = 'No products found.') {
  if (!elements.productsEmpty) return;
  elements.productsEmpty.style.display = isEmpty ? 'block' : 'none';
  elements.productsEmpty.textContent = customText;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

document.addEventListener('DOMContentLoaded', initCatalog);
