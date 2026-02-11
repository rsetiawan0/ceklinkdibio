const CONFIG = {
  csvUrl: 'data/afiliate.csv',
  videosPerPage: 8,
  siteUrl: 'https://www.ceklinkdibio.com/',
  siteName: 'CekLinkdiBio.com - Rekomendasi produk marketplace'
};

const state = {
  videos: [],
  filteredVideos: [],
  categories: new Set(),
  activeCategory: 'all',
  sortOrder: 'popular',
  searchQuery: ''
};

const elements = {
  grid: document.getElementById('videoGrid'),
  pagination: document.getElementById('pagination'),
  filterToggle: document.getElementById('filterToggle'),
  filtersBody: document.getElementById('filtersBody'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortSelect: document.getElementById('sortSelect'),
  searchInput: document.getElementById('searchInput'),
  template: document.getElementById('videoCardTemplate'),
  structuredData: document.getElementById('structuredData')
};

async function init() {
  try {
    const csvText = await fetchText(CONFIG.csvUrl);
    state.videos = parseCSV(csvText);
    hydrateState();
    renderCategoryOptions();
    renderVideos();
    bindEvents();
    updateMetaAndStructuredData(state.filteredVideos[0]);
  } catch (error) {
    console.error('Failed to initialize application', error);
    elements.grid.innerHTML = `<p class="error">Gagal memuat data. Silakan coba lagi.</p>`;
  }
}

function bindEvents() {
  if (elements.filterToggle && elements.filtersBody) {
    elements.filterToggle.addEventListener('click', () => {
      const isExpanded = elements.filterToggle.getAttribute('aria-expanded') === 'true';
      elements.filterToggle.setAttribute('aria-expanded', String(!isExpanded));
      elements.filtersBody.classList.toggle('is-open', !isExpanded);
    });
  }

  elements.categoryFilter.addEventListener('change', event => {
    state.activeCategory = event.target.value;
    state.currentPage = 1;
    hydrateState();
    renderVideos();
    updateMetaAndStructuredData(state.filteredVideos[0]);
  });

  elements.sortSelect.addEventListener('change', event => {
    state.sortOrder = event.target.value;
    state.currentPage = 1;
    hydrateState();
    renderVideos();
    updateMetaAndStructuredData(state.filteredVideos[0]);
  });

  elements.searchInput.addEventListener('input', event => {
    state.searchQuery = event.target.value.toLowerCase();
    state.currentPage = 1;
    hydrateState();
    renderVideos();
    updateMetaAndStructuredData(state.filteredVideos[0]);
  });

  elements.grid.addEventListener('pointerenter', handleMediaHoverStart, true);
  elements.grid.addEventListener('pointerleave', handleMediaHoverPause, true);
}

function handleMediaHoverStart(event) {
  const mediaLink = event.target.closest('.media-link');
  if (!mediaLink || mediaLink.dataset.mediaType !== 'video') {
    return;
  }

  const video = mediaLink.querySelector('video');
  if (!video) {
    return;
  }

  if (video.readyState === 0) {
    video.load();
  }
  video.play().catch(() => {
    /* ignore autoplay errors */
  });
}

function handleMediaHoverPause(event) {
  const mediaLink = event.target.closest('.media-link');
  if (!mediaLink || mediaLink.dataset.mediaType !== 'video') {
    return;
  }

  const video = mediaLink.querySelector('video');
  if (!video) {
    return;
  }

  video.pause();
  video.currentTime = 0;
}

function hydrateState() {
  const { activeCategory, sortOrder, searchQuery } = state;

  let working = [...state.videos];

  if (activeCategory !== 'all') {
    working = working.filter(item => (item.category || '').toLowerCase() === activeCategory.toLowerCase());
  }

  if (searchQuery) {
    working = working.filter(item => `${item.title} ${item.snippet}`.toLowerCase().includes(searchQuery));
  }

  working.sort((a, b) => sortComparator(a, b, sortOrder));

  state.filteredVideos = working;
  if (!state.currentPage) {
    state.currentPage = 1;
  }
}

function renderCategoryOptions() {
  const categories = ['all', ...Array.from(state.categories).sort()];
  elements.categoryFilter.innerHTML = categories
    .map(category => `<option value="${category}">${category === 'all' ? 'Semua Kategori' : category}</option>`)
    .join('');
}

function renderVideos() {
  const { filteredVideos } = state;

  if (!filteredVideos.length) {
    elements.grid.innerHTML = `<p class="empty">Tidak ada produk ditemukan.</p>`;
    if (elements.pagination) {
      elements.pagination.innerHTML = '';
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  const totalPages = Math.ceil(filteredVideos.length / CONFIG.videosPerPage);
  const currentPage = Math.min(state.currentPage || 1, totalPages);
  const startIndex = (currentPage - 1) * CONFIG.videosPerPage;
  const visibleVideos = filteredVideos.slice(startIndex, startIndex + CONFIG.videosPerPage);

  visibleVideos.forEach((video, index) => {
    const card = renderVideoCard(video, startIndex + index);
    fragment.appendChild(card);
  });

  elements.grid.innerHTML = '';
  elements.grid.appendChild(fragment);

  if (elements.pagination) {
    renderPagination(totalPages, currentPage);
  }
}

function renderPagination(totalPages, currentPage) {
  if (!elements.pagination) return;
  const fragment = document.createDocumentFragment();

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-number';
    button.textContent = page;
    button.setAttribute('aria-label', `Halaman ${page}`);
    button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
    if (page === currentPage) {
      button.classList.add('is-active');
    }
    button.addEventListener('click', () => {
      state.currentPage = page;
      renderVideos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    fragment.appendChild(button);
  }

  elements.pagination.innerHTML = '';
  elements.pagination.appendChild(fragment);
}

function renderVideoCard(video, index) {
  const node = elements.template.content.cloneNode(true);
  const mediaWrapper = node.querySelector('.media-wrapper');
  const titleEl = node.querySelector('.video-title');
  const snippetEl = node.querySelector('.snippet');
  const priceEl = node.querySelector('.price');
  const originalEl = node.querySelector('.original-price');
  const soldEl = node.querySelector('.sold');
  const ratingEl = node.querySelector('.rating');
  const badgeEl = node.querySelector('.badge');
  const discountEl = node.querySelector('.discount');
  const affiliateUrl = getAffiliateUrl(video);
  const pageUrl = getPageUrl(video);
  const linkUrl = affiliateUrl || pageUrl;

  if (video.videolink) {
    const videoEl = document.createElement('video');
    videoEl.src = video.videolink;
    videoEl.poster = video.imagelink;
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.setAttribute('preload', 'metadata');

    const linkEl = wrapWithAffiliate(videoEl, linkUrl);
    linkEl.classList.add('media-link');
    linkEl.dataset.mediaType = 'video';
    mediaWrapper.appendChild(linkEl);

    const playButton = document.createElement('span');
    playButton.className = 'play-button';
    playButton.textContent = 'Play';
    mediaWrapper.appendChild(playButton);
  } else if (video.imagelink) {
    const imageEl = document.createElement('img');
    imageEl.src = video.imagelink;
    imageEl.alt = video.title;

    const linkEl = wrapWithAffiliate(imageEl, linkUrl);
    linkEl.classList.add('media-link');
    linkEl.dataset.mediaType = 'image';
    mediaWrapper.appendChild(linkEl);

    const playButton = document.createElement('span');
    playButton.className = 'play-button';
    playButton.textContent = 'Play';
    mediaWrapper.appendChild(playButton);
  }

  const titleLink = wrapWithAffiliate(document.createElement('span'), linkUrl);
  titleLink.classList.add('title-link');
  titleLink.textContent = video.title;
  titleEl.innerHTML = '';
  titleEl.appendChild(titleLink);

  const snippetLink = wrapWithAffiliate(document.createElement('span'), pageUrl);
  snippetLink.classList.add('snippet-link');
  snippetLink.textContent = video.snippet || '';
  snippetEl.innerHTML = '';
  snippetEl.appendChild(snippetLink);

  priceEl.textContent = formatPrice(video.price);
  priceEl.classList.remove('hidden');
  originalEl.textContent = video.originalPrice ? formatPrice(video.originalPrice) : '-';
  originalEl.classList.toggle('hidden', !video.originalPrice);
  soldEl.textContent = video.sold ? `${video.sold} terjual` : '-';
  ratingEl.textContent = video.rating ? `★ ${video.rating}` : '-';
  badgeEl.textContent = video.badge || '';
  badgeEl.classList.toggle('hidden', !video.badge);

  const discount = computeDiscount(video.price, video.originalPrice);
  discountEl.textContent = discount ? `-${discount}%` : '';
  discountEl.classList.toggle('hidden', !discount);

  return node;
}

function wrapWithAffiliate(element, url) {
  if (!url) {
    return element;
  }
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener nofollow';
  link.appendChild(element);
  return link;
}

function updateMetaAndStructuredData(video) {
  const fallback = video || {};
  const title = fallback.title || CONFIG.siteName;
  const description = fallback.snippet || 'Kurasi produk viral Shopee terbaru dengan video affiliate.';
  const image = fallback.imagelink || `${CONFIG.siteUrl}images/og-default.jpg`;
  const pageUrl = getPageUrl(fallback) || CONFIG.siteUrl;
  const affiliateUrl = getAffiliateUrl(fallback) || pageUrl;
  const url = pageUrl;
  const pageTitle = buildPageTitle(title, url);

  setMeta('title', pageTitle);
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', pageTitle);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', pageTitle);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', image);
  setMeta('meta[name="twitter:url"]', url);
  setMeta('link[rel="canonical"]', url);

  const product = {
    '@type': 'Product',
    name: title,
    description,
    image,
    url,
    offers: fallback.price ? {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: normalizePrice(fallback.price),
      availability: 'https://schema.org/InStock',
      url: affiliateUrl
    } : undefined,
    aggregateRating: fallback.rating ? {
      '@type': 'AggregateRating',
      ratingValue: fallback.rating,
      reviewCount: fallback.sold || '0'
    } : undefined
  };

  Object.keys(product).forEach(key => {
    if (product[key] === undefined) {
      delete product[key];
    }
  });

  const listItems = state.filteredVideos.slice(0, CONFIG.videosPerPage).map((item, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    url: getPageUrl(item) || CONFIG.siteUrl,
    name: item.title || CONFIG.siteName,
    image: item.imagelink || undefined
  }));

  const webSite = {
    '@type': 'WebSite',
    name: CONFIG.siteName,
    url: CONFIG.siteUrl
  };

  const collectionPage = {
    '@type': 'CollectionPage',
    name: CONFIG.siteName,
    url: CONFIG.siteUrl,
    description
  };

  const graph = [webSite, collectionPage];
  if (listItems.length) {
    graph.push({
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: listItems
    });
  }
  graph.push(product);

  const structured = {
    '@context': 'https://schema.org',
    '@graph': graph
  };

  elements.structuredData.textContent = JSON.stringify(structured, null, 2);
}

function setMeta(selector, value) {
  if (!value) return;
  if (selector === 'title') {
    document.title = value;
    return;
  }

  const element = document.querySelector(selector);
  if (element) {
    if (element.tagName.toLowerCase() === 'link') {
      element.setAttribute('href', value);
    } else {
      element.setAttribute('content', value);
    }
  }
}

function buildPageTitle(title, url) {
  if (!url) return title;
  return `${title} | ${url}`;
}

function hydrateCategories(videos) {
  state.categories.clear();
  videos.forEach(video => {
    if (video.category) {
      state.categories.add(video.category);
    }
  });
}

function hydrateStateFromVideos(videos) {
  hydrateCategories(videos);
  hydrateState();
}

function formatPrice(value) {
  if (!value) return '-';
  const numeric = normalizePrice(value);
  if (!numeric) return '-';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(numeric));
}

function normalizePrice(value) {
  if (!value) return '';
  return value.toString().replace(/[^0-9]/g, '');
}

function computeDiscount(price, original) {
  const current = Number(normalizePrice(price));
  const base = Number(normalizePrice(original));
  if (!current || !base || base <= current) return 0;
  return Math.round(((base - current) / base) * 100);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function toIsoDate(value) {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  return value;
}

function sortComparator(a, b, order) {
  switch (order) {
    case 'rating':
      return toNumber(b.rating) - toNumber(a.rating);
    case 'newest':
      return new Date(b.dateIso || b.date || 0) - new Date(a.dateIso || a.date || 0);
    case 'price-asc':
      return toNumber(normalizePrice(a.price)) - toNumber(normalizePrice(b.price));
    case 'price-desc':
      return toNumber(normalizePrice(b.price)) - toNumber(normalizePrice(a.price));
    case 'popular':
    default:
      return toNumber(b.sold) - toNumber(a.sold);
  }
}

function toNumber(value) {
  const number = normalizeNumber(value);
  return Number.isFinite(number) ? number : 0;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.text();
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCSVLine(lines.shift());

  return lines.map(line => {
    const values = splitCSVLine(line);
    const raw = headers.reduce((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
    return normalizeVideo(raw);
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeVideo(raw) {
  const singlepageurl = raw.singlepageurl || raw.singlelink || raw.afflink || '';
  const affiliateurl = raw.afflink || raw.singlelink || raw.singlepageurl || '';
  const dateIso = normalizeDateInput(raw.date);
  return {
    ...raw,
    singlepageurl,
    affiliateurl,
    dateIso
  };
}

function getAffiliateUrl(video) {
  return video.affiliateurl || video.afflink || video.singlelink || video.singlepageurl || '';
}

function getPageUrl(video) {
  return video.singlelink || video.singlepageurl || video.afflink || '';
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  let str = String(value).trim();
  if (!str) return 0;

  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    const last = parts[parts.length - 1] || '';
    if (last.length === 3) {
      str = parts.join('');
    }
  }

  const number = Number(str);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDateInput(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[\/\-.]/);
  if (parts.length === 3) {
    let [part1, part2, part3] = parts;
    if (part3.length === 2) {
      part3 = `20${part3}`;
    }

    const num1 = Number(part1);
    const num2 = Number(part2);
    let day = part1;
    let month = part2;

    if (num1 > 12 && num2 <= 12) {
      day = part1;
      month = part2;
    } else if (num2 > 12 && num1 <= 12) {
      day = part2;
      month = part1;
    } else {
      day = part1;
      month = part2;
    }

    return `${String(part3).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return trimmed;
}

document.addEventListener('DOMContentLoaded', async () => {
  const csvText = await fetchText(CONFIG.csvUrl);
  state.videos = parseCSV(csvText);
  hydrateCategories(state.videos);
  hydrateState();
  renderCategoryOptions();
  renderVideos();
  bindEvents();
  updateMetaAndStructuredData(state.filteredVideos[0]);
});
