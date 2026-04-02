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

/* =========================
   STICKY NAV
========================= */
function initStickyNav() {
  const nav = document.querySelector('.topbar');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

function bindEvents() {
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value.trim().toLowerCase();
      state.currentPage = 1;
      applyFilters();
    });
  }

  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener('change', (event) => {
      state.selectedCategory = event.target.value;
      state.currentPage = 1;
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
    if (elements.productsGrid) {
      elements.productsGrid.innerHTML = '';
    }
    showEmpty(true, 'Unable to load products right now.');
    setCatalogMeta('Catalog unavailable.');
    renderPagination(0);
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

  const totalPages = Math.max(1, Math.ceil(matched.length / DISPLAY_LIMIT));
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const paginatedList = getPaginatedProducts(matched);

  renderProducts(paginatedList);
  renderPagination(matched.length);
  updateMeta(matched.length, state.products.length);
}

function getPaginatedProducts(products) {
  const startIndex = (state.currentPage - 1) * DISPLAY_LIMIT;
  const endIndex = startIndex + DISPLAY_LIMIT;
  return products.slice(startIndex, endIndex);
}

function renderProducts(products) {
  if (!elements.productsGrid) return;

  if (!products.length) {
    elements.productsGrid.innerHTML = '';
    showEmpty(true);
    return;
  }

  showEmpty(false);

  const startIndex = (state.currentPage - 1) * DISPLAY_LIMIT;

  elements.productsGrid.innerHTML = products
    .map((product, index) => buildProductCard(product, startIndex + index))
    .join('');

  bindProductToggleEvents();
}

function buildProductCard(product, index) {
  const safeName = escapeHtml(product.product_name || 'Unnamed Product');
  const safeDescription = escapeHtml(product.description || '');
  const imageHtml = buildProductImage(product);
  const safeCategory = escapeHtml(
    String(product.category || 'Uncategorized').trim() || 'Uncategorized'
  );

  return `
    <article class="product-card" data-product-card>
      <button
        class="product-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="product-details-${index}"
      >
        <div class="product-mobile-row">
          <div class="product-mobile-image product-image-wrap">
            <span class="product-category-badge">${safeCategory}</span>
            ${imageHtml}
          </div>

          <div class="product-mobile-title-wrap">
            <h3 class="product-name mobile-name">${safeName}</h3>
          </div>
        </div>

        <div class="product-desktop-image product-image-wrap">
          <span class="product-category-badge">${safeCategory}</span>
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

function renderPagination(totalItems) {
  if (!elements.pagination) return;

  const totalPages = Math.ceil(totalItems / DISPLAY_LIMIT);

  if (totalPages <= 1) {
    elements.pagination.innerHTML = '';
    return;
  }

  let buttons = `
    <button
      type="button"
      class="pagination-btn pagination-nav"
      data-page="${state.currentPage - 1}"
      ${state.currentPage === 1 ? 'disabled' : ''}
    >
      Prev
    </button>
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    buttons += `
      <button
        type="button"
        class="pagination-btn ${page === state.currentPage ? 'active' : ''}"
        data-page="${page}"
        aria-current="${page === state.currentPage ? 'page' : 'false'}"
      >
        ${page}
      </button>
    `;
  }

  buttons += `
    <button
      type="button"
      class="pagination-btn pagination-nav"
      data-page="${state.currentPage + 1}"
      ${state.currentPage === totalPages ? 'disabled' : ''}
    >
      Next
    </button>
  `;

  elements.pagination.innerHTML = `<div class="pagination-inner">${buttons}</div>`;

  elements.pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = Number(button.getAttribute('data-page'));
      if (!page || page < 1 || page > totalPages || page === state.currentPage) {
        return;
      }

      state.currentPage = page;
      applyFilters();

      const catalogSection = document.getElementById('products');
      if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function updateMeta(shown, total) {
  if (!elements.catalogMeta) return;

  if (!shown) {
    elements.catalogMeta.textContent = `Showing 0 results (Total: ${total})`;
    return;
  }

  const start = (state.currentPage - 1) * DISPLAY_LIMIT + 1;
  const end = Math.min(state.currentPage * DISPLAY_LIMIT, shown);

  elements.catalogMeta.textContent =
    `Showing ${start}-${end} results (${shown} matched, Total: ${total})`;
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

function initMenuToggle() {
  const menuToggle = document.getElementById('menuToggle');
  const siteMenu = document.getElementById('siteMenu');

  if (!menuToggle || !siteMenu) return;

  menuToggle.addEventListener('click', () => {
    const isOpen = siteMenu.classList.toggle('active');
    menuToggle.classList.toggle('active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  siteMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      siteMenu.classList.remove('active');
      menuToggle.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', initCatalog);
