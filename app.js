const PRODUCTS_JSON_PATH = './products.json';

const state = {
  products: [],
  filteredProducts: [],
  searchQuery: '',
  selectedCategory: 'all',
  currentPage: 1,
};

const elements = {
  searchInput: document.getElementById('productSearch'),
  categoryFilter: document.getElementById('categoryFilter'),
  productsGrid: document.getElementById('productsGrid'),
  productsLoading: document.getElementById('productsLoading'),
  productsEmpty: document.getElementById('productsEmpty'),
  catalogMeta: document.getElementById('catalogMeta'),
  pagination: document.getElementById('pagination'),
};

const DISPLAY_LIMIT = 10;

async function initCatalog() {
  initMenuToggle();
  initStickyNav();
  bindEvents();
  await loadProducts();
}

function initStickyNav() {
  const nav = document.querySelector('.topbar');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });
}

function bindEvents() {
  elements.searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    state.currentPage = 1;
    applyFilters();
  });

  elements.categoryFilter?.addEventListener('change', (e) => {
    state.selectedCategory = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });
}

async function loadProducts() {
  showLoading(true);

  try {
    const res = await fetch(PRODUCTS_JSON_PATH, { cache: 'no-store' });
    const data = await res.json();

    state.products = data;
    populateCategoryFilter(data);
    applyFilters();
  } catch (err) {
    console.error(err);
    showEmpty(true);
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
  const matched = state.products.filter(p => {
    const text = `${p.product_name} ${p.description} ${p.category}`.toLowerCase();
    return (
      (state.selectedCategory === 'all' || p.category === state.selectedCategory) &&
      (!state.searchQuery || text.includes(state.searchQuery))
    );
  });

  state.filteredProducts = matched;

  const paginated = paginate(matched);

  renderProducts(paginated);
  renderPagination(matched.length);
  updateMeta(matched.length, state.products.length);
}

function paginate(list) {
  const start = (state.currentPage - 1) * DISPLAY_LIMIT;
  return list.slice(start, start + DISPLAY_LIMIT);
}

function renderPagination(total) {
  if (!elements.pagination) return;

  const totalPages = Math.ceil(total / DISPLAY_LIMIT);

  if (totalPages <= 1) {
    elements.pagination.innerHTML = '';
    return;
  }

  let html = '';

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="page-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  elements.pagination.innerHTML = html;

  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = Number(btn.dataset.page);
      applyFilters();
    });
  });
}

function renderProducts(products) {
  elements.productsGrid.innerHTML = products.map((p, i) => buildProductCard(p, i)).join('');
}

function buildProductCard(product, index) {
  const category = product.category || 'General';

  return `
    <article class="product-card" data-product-card>
      <div class="product-image-wrapper">

        <!-- CATEGORY BADGE -->
        <span class="product-category-badge">${category}</span>

        ${buildProductImage(product)}
      </div>

      <div class="product-body">
        <h3 class="product-name">${product.product_name}</h3>
        <p class="product-description">${product.description || ''}</p>
      </div>
    </article>
  `;
}

function buildProductImage(product) {
  if (!product.image) {
    return `<div class="product-image placeholder">No Image</div>`;
  }

  return `<img src="${product.image}" class="product-image" loading="lazy">`;
}

function updateMeta(shown, total) {
  elements.catalogMeta.textContent =
    `Showing ${Math.min(shown, DISPLAY_LIMIT)} results (Total: ${total})`;
}

function showLoading(show) {
  elements.productsLoading.style.display = show ? 'block' : 'none';
}

function showEmpty(show) {
  elements.productsEmpty.style.display = show ? 'block' : 'none';
}

initCatalog();
