const fallbackProducts = [
  {
    id: 1,
    title: "Wireless Bluetooth Earbuds TWS Noise Cancelling Headphones",
    snippet: "High-quality wireless earbuds with active noise cancellation, 30-hour battery life, and premium sound quality.",
    price: 299000,
    originalPrice: 599000,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop",
    link: "https://shopee.co.id/product-link-here",
    platform: "Shopee",
    category: "electronics",
    badge: "hot",
    sold: 1250,
    rating: 4.8,
    date: "2026-02-03"
  },
  {
    id: 2,
    title: "Smartwatch Sport Fitness Tracker IP68",
    snippet: "Track heart rate, sleep, and steps with a bright display and 10-day battery.",
    price: 259000,
    originalPrice: 499000,
    image: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=400&h=400&fit=crop",
    link: "https://shopee.co.id/product-link-here",
    platform: "Shopee",
    category: "electronics",
    badge: "new",
    sold: 980,
    rating: 4.7,
    date: "2026-02-02"
  }
];

const perPage = 8;
let currentPage = 1;
let activeCategory = "all";
let searchQuery = "";
let sortMode = "newest";
let products = [];

const SHEET_URL = "https://script.google.com/macros/s/AKfycbxcyeZ8h9iXFZjqWI2z_NG0pepAADK8atbEzHUu2AelGHr8zvq-BMYrxsg5gWWZhj0BhQ/exec";

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const gridEl = document.getElementById('product-grid');
const loadMoreBtn = document.getElementById('load-more');
const chipWrap = document.getElementById('category-chips');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const navCategoryMenu = document.getElementById('nav-category-menu');
const navCategoryToggle = document.querySelector('#nav-category .nav-toggle');

const debounce = (fn, delay = 250) => {
  let timerId;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), delay);
  };
};

const formatPrice = (value) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

const normalizeProducts = (rows) => {
  return rows.map((item, index) => {
    const categoryRaw = (item.category || "general").toString().trim();
    const categoryKey = categoryRaw.toLowerCase();
    const singlePageLink =
      item["singlepage.link"] ||
      item.singlepage_link ||
      item.singlepageLink ||
      item.singlepagelink ||
      "";
    return {
      id: item.id || index + 1,
      title: item.title || "",
      snippet: item.snippet || "",
      price: Number(item.price) || 0,
      originalPrice: Number(item.originalPrice) || 0,
      image: item.image || "",
      link: item.link || "#",
      singlePageLink,
      platform: item.platform || "",
      category: categoryKey,
      categoryLabel: categoryRaw || "general",
      badge: (item.badge || "deal").toLowerCase(),
      sold: Number(item.sold) || 0,
      rating: Number(item.rating) || 0,
      date: item.date || ""
    };
  });
};

const getCategoryList = () => {
  const categoryMap = new Map();
  products.forEach((item) => {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, item.categoryLabel || item.category);
    }
  });
  const entries = Array.from(categoryMap.entries()).map(([key, label]) => ({ key, label }));
  entries.sort((a, b) => a.label.localeCompare(b.label));
  return [{ key: "all", label: "Semua" }, ...entries];
};

const renderChips = () => {
  if (!chipWrap) return;
  const categories = getCategoryList();
  chipWrap.innerHTML = categories
    .map((category) => {
      return `<button class="chip${category.key === activeCategory ? " is-active" : ""}" data-category="${category.key}" type="button">${category.label}</button>`;
    })
    .join('');

  chipWrap.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCategory = chip.dataset.category;
      currentPage = 1;
      renderProducts();
      renderChips();
      renderCategoryMenu();
    });
  });
};

const closeCategoryMenu = () => {
  if (!navCategoryMenu || !navCategoryToggle) return;
  navCategoryMenu.classList.remove('is-open');
  navCategoryToggle.classList.remove('is-open');
  navCategoryToggle.setAttribute('aria-expanded', 'false');
};

const renderCategoryMenu = () => {
  if (!navCategoryMenu || !navCategoryToggle) return;
  const categories = getCategoryList();
  navCategoryMenu.innerHTML = categories
    .map((category) => {
      return `<button class="nav-menu-item${category.key === activeCategory ? " is-active" : ""}" data-category="${category.key}" type="button">${category.label}</button>`;
    })
    .join('');

  navCategoryMenu.querySelectorAll('.nav-menu-item').forEach((item) => {
    item.addEventListener('click', () => {
      activeCategory = item.dataset.category;
      currentPage = 1;
      renderProducts();
      renderChips();
      renderCategoryMenu();
      closeCategoryMenu();
    });
  });
};

const getFilteredProducts = () => {
  let result = products;
  if (activeCategory !== "all") {
    result = result.filter((item) => item.category === activeCategory);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q) ||
        item.platform.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }
  return result;
};

const sortProducts = (items) => {
  const sorted = [...items];
  switch (sortMode) {
    case "sold":
      sorted.sort((a, b) => b.sold - a.sold);
      break;
    case "rating":
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case "price_low":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price_high":
      sorted.sort((a, b) => b.price - a.price);
      break;
    default:
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return sorted;
};

const renderProducts = () => {
  if (!gridEl) return;
  const filtered = sortProducts(getFilteredProducts());
  const slice = filtered.slice(0, currentPage * perPage);

  gridEl.innerHTML = slice
    .map((product) => {
      const discount = product.originalPrice > product.price
        ? Math.round((1 - product.price / product.originalPrice) * 100)
        : 0;
      return `
      <article class="card" itemscope itemtype="https://schema.org/BlogPosting">
        <div class="thumb-wrap">
          <a href="${product.link}" target="_blank" rel="noopener" aria-label="${product.title}">
            <img class="thumb" src="${product.image}" alt="${product.title}" itemprop="image" loading="lazy" />
          </a>
        </div>
        <div class="card-body">
          <a class="card-title" href="${product.link}" target="_blank" rel="noopener" itemprop="url">
            <span itemprop="headline">${product.title}</span>
          </a>
          <a class="card-snippet" href="${product.singlePageLink || product.link}" target="_blank" rel="noopener" itemprop="description">
            ${product.snippet}
          </a>
          <div class="price-row">
            Rp ${formatPrice(product.price)}
            <span>Rp ${formatPrice(product.originalPrice)}</span>
          </div>
          <div class="rating">
            ${product.rating} · ${product.sold} terjual
          </div>
          <div class="card-meta">
            <span class="badge">${product.badge}</span>
            ${discount > 0 ? `<span class="discount">-${discount}%</span>` : ""}
          </div>
        </div>
      </article>
      `;
    })
    .join('');

  if (loadMoreBtn) {
    loadMoreBtn.style.display = slice.length < filtered.length ? 'inline-flex' : 'none';
  }
};

const setupBurger = () => {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('site-nav');
  if (!burger || !nav) return;
  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    burger.classList.toggle('is-open', isOpen);
    if (!isOpen) {
      closeCategoryMenu();
    }
  });
  nav.querySelectorAll('a, .nav-menu-item').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      closeCategoryMenu();
    });
  });
};

if (navCategoryToggle && navCategoryMenu) {
  navCategoryToggle.addEventListener('click', () => {
    const isOpen = navCategoryMenu.classList.toggle('is-open');
    navCategoryToggle.classList.toggle('is-open', isOpen);
    navCategoryToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!navCategoryMenu.contains(target) && !navCategoryToggle.contains(target)) {
      closeCategoryMenu();
    }
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    currentPage += 1;
    renderProducts();
  });
}

if (searchInput) {
  const onSearch = debounce((value) => {
    searchQuery = value;
    currentPage = 1;
    renderProducts();
  }, 300);
  searchInput.addEventListener('input', (event) => {
    onSearch(event.target.value);
  });
}

if (sortSelect) {
  sortSelect.addEventListener('change', (event) => {
    sortMode = event.target.value;
    currentPage = 1;
    renderProducts();
  });
}

const initProducts = async () => {
  try {
    const response = await fetch(SHEET_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    const data = await response.json();
    products = normalizeProducts(data);
  } catch (error) {
    products = fallbackProducts;
  }
  renderChips();
  renderCategoryMenu();
  renderProducts();
  setupBurger();
};

initProducts();
