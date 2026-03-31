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

  const uniqueCategories = [...new Set(
    products
      .map(product => String(product.category || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  elements.categoryFilter.innerHTML = `
    <option value="all">All Categories</option>
    ${uniqueCategories.map(category => `
      <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join('')}
  `;
}

function applyFilters() {
  const query = state.searchQuery;
  const selectedCategory = state.selectedCategory;

  state.filteredProducts = state.products.filter(product => {
    const matchesCategory =
      selectedCategory === 'all' ||
      String(product.category || '').trim() === selectedCategory;

    const searchableText = [
      product.product_name || '',
      product.barcode || '',
      product.category || '',
      product.description || '',
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !query || searchableText.includes(query);

    return matchesCategory && matchesSearch;
  });

  renderProducts(state.filteredProducts);
  updateMeta();
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
    .map(product => buildProductCard(product))
    .join('');
}

function buildProductCard(product) {
  const imageHtml = buildProductImage(product);
  const retailHtml = buildRetailBlock(product.retail);
  const wholesaleHtml = buildWholesaleBlock(product.wholesale);
  const statusHtml = buildStatusBadge(product.status);
  const barcodeHtml = product.barcode
    ? `<p class="product-barcode">Barcode: <span>${escapeHtml(product.barcode)}</span></p>`
    : '';

  const descriptionHtml = product.description
    ? `<p class="product-description">${escapeHtml(product.description)}</p>`
    : '';

  const categoryHtml = product.category
    ? `<span class="product-category">${escapeHtml(product.category)}</span>`
    : '';

  const featuredHtml = product.featured
    ? `<span class="product-featured">Featured</span>`
    : '';

  return `
    <article class="product-card">
      <div class="product-image-wrap">
        ${imageHtml}
        <div class="product-top-tags">
          ${categoryHtml}
          ${featuredHtml}
        </div>
      </div>

      <div class="product-body">
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(product.product_name || 'Unnamed Product')}</h3>
          ${statusHtml}
        </div>

        ${barcodeHtml}
        ${descriptionHtml}

        <div class="pricing-grid">
          ${retailHtml}
          ${wholesaleHtml}
        </div>

        <div class="product-stock-row">
          <span class="stock-label">Stock</span>
          <span class="stock-value">${formatStock(product.stock)}</span>
        </div>
      </div>
    </article>
  `;
}

function buildProductImage(product) {
  const imagePath = String(product.image || '').trim();

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
      alt="${escapeAttribute(product.product_name || 'Product image')}"
      class="product-image"
      loading="lazy"
      onerror="this.outerHTML='<div class=&quot;product-image placeholder&quot;><span>Image Unavailable</span></div>'"
    />
  `;
}

function buildRetailBlock(retail) {
  if (!retail || retail.price == null || retail.qty == null || !retail.unit) {
    return '';
  }

  return `
    <div class="price-card retail">
      <div class="price-label">Retail</div>
      <div class="price-value">${formatPrice(retail.price)}</div>
      <div class="price-meta">${formatQuantity(retail.qty, retail.unit)}</div>
    </div>
  `;
}

function buildWholesaleBlock(wholesale) {
  if (!wholesale || wholesale.price == null || wholesale.qty == null || !wholesale.unit) {
    return '';
  }

  return `
    <div class="price-card wholesale">
      <div class="price-label">Wholesale</div>
      <div class="price-value">${formatPrice(wholesale.price)}</div>
      <div class="price-meta">${formatQuantity(wholesale.qty, wholesale.unit)}</div>
    </div>
  `;
}

function buildStatusBadge(status) {
  const normalized = String(status || '').trim().toLowerCase();

  let className = 'status-badge in-stock';
  if (normalized === 'low stock') className = 'status-badge low-stock';
  if (normalized === 'out of stock') className = 'status-badge out-stock';

  return `<span class="${className}">${escapeHtml(status || 'Unknown')}</span>`;
}

function updateMeta() {
  const total = state.products.length;
  const shown = state.filteredProducts.length;

  if (!total) {
    setCatalogMeta('No products available.');
    return;
  }

  if (shown === total) {
    setCatalogMeta(`Showing ${shown} product${shown > 1 ? 's' : ''}.`);
    return;
  }

  setCatalogMeta(`Showing ${shown} of ${total} products.`);
}

function setCatalogMeta(text) {
  if (!elements.catalogMeta) return;
  elements.catalogMeta.textContent = text;
}

function showLoading(isLoading) {
  if (!elements.productsLoading) return;
  elements.productsLoading.style.display = isLoading ? 'block' : 'none';
}

function showEmpty(isEmpty, customText) {
  if (!elements.productsEmpty) return;
  elements.productsEmpty.style.display = isEmpty ? 'block' : 'none';
  elements.productsEmpty.textContent = customText || 'No products found.';
}

function formatPrice(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return '₱0';
  return `₱${number.toLocaleString('en-PH')}`;
}

function formatQuantity(qty, unit) {
  return `${qty} ${unit}`;
}

function formatStock(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return '0';
  return number.toLocaleString('en-PH');
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
