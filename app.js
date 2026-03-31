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

const DISPLAY_LIMIT = 50;

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

    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();

    state.products = data;
    populateCategoryFilter(data);
    applyFilters();

  } catch (error) {
    console.error(error);
    showEmpty(true, 'Unable to load products.');
  } finally {
    showLoading(false);
  }
}

function populateCategoryFilter(products) {
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  elements.categoryFilter.innerHTML = `
    <option value="all">All Categories</option>
    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
  `;
}

function applyFilters() {
  const query = state.searchQuery;
  const category = state.selectedCategory;

  const matched = state.products.filter(product => {
    const matchesCategory =
      category === 'all' || product.category === category;

    const text = (
      (product.product_name || '') +
      (product.barcode || '') +
      (product.description || '')
    ).toLowerCase();

    const matchesSearch = !query || text.includes(query);

    return matchesCategory && matchesSearch;
  });

  const finalList = buildDisplayList(matched, state.products);

  renderProducts(finalList);
  updateMeta(matched.length, state.products.length);
}

function buildDisplayList(matched, allProducts) {
  let result = [...matched];

  if (result.length >= DISPLAY_LIMIT) {
    return shuffleArray(result).slice(0, DISPLAY_LIMIT);
  }

  const needed = DISPLAY_LIMIT - result.length;

  const remainingPool = allProducts.filter(p => !result.includes(p));

  const randomFill = shuffleArray(remainingPool).slice(0, needed);

  return [...result, ...randomFill];
}

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function renderProducts(products) {
  if (!products.length) {
    elements.productsGrid.innerHTML = '';
    showEmpty(true);
    return;
  }

  showEmpty(false);

  elements.productsGrid.innerHTML = products
    .map(buildProductCard)
    .join('');
}

function buildProductCard(product) {
  return `
    <div class="product-card">
      ${buildProductImage(product)}

      <div class="product-body">
        <h3>${product.product_name || 'Unnamed'}</h3>
        <p>${product.description || ''}</p>

        <div class="price">
          ₱${product?.retail?.price ?? 0}
        </div>
      </div>
    </div>
  `;
}

function buildProductImage(product) {
  if (!product.image) {
    return `<div class="product-image placeholder">No Image</div>`;
  }

  return `
    <img src="${product.image}" class="product-image" loading="lazy">
  `;
}

function updateMeta(shown, total) {
  elements.catalogMeta.textContent =
    `Showing ${Math.min(shown, DISPLAY_LIMIT)} results (Total: ${total})`;
}

function showLoading(state) {
  elements.productsLoading.style.display = state ? 'block' : 'none';
}

function showEmpty(state, text = 'No products found') {
  elements.productsEmpty.style.display = state ? 'block' : 'none';
  elements.productsEmpty.textContent = text;
}

document.addEventListener('DOMContentLoaded', initCatalog);
