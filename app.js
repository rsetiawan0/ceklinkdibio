// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
// 
// HOW TO SET UP GOOGLE SHEETS AS DATABASE:
// 
// 1. Create a new Google Sheet with these columns (in this exact order):
//    A: id | B: title | C: snippet | D: price | E: originalPrice | F: image | G: link | H: platform | I: category | J: badge | K: sold | L: rating
//
// 2. Fill in your product data starting from row 2 (row 1 is headers)
//    Example row:
//    1 | Wireless Earbuds | Great sound quality | 299000 | 599000 | https://image-url.jpg | https://shopee.co.id/link | Shopee | electronics | hot | 1250 | 4.8
//
// 3. Go to File > Share > Publish to the web
//    - Select the sheet tab you want to publish
//    - Choose "Comma-separated values (.csv)" format
//    - Click Publish
//    - Copy the URL provided
//
// 4. Replace the GOOGLE_SHEET_CSV_URL below with your published CSV URL
//
// ============================================

// REPLACE THIS URL with your published Google Sheet CSV URL
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT37kQtyrDnvM9l6XPRyvaCp3N7OsIAO2urZGeHCQZ9RYhJCtqyJX5f-940IVYvPdur7sZET_lPofck/pub?gid=0&single=true&output=csv';

// Example URL format:
// const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vXXXXXXX/pub?gid=0&single=true&output=csv';

// Fallback sample data (used when Google Sheet is not configured or fails to load)
const sampleProductsData = [
   {
        id: 15,
        title: "Retinol Anti-Aging Night Cream with Peptides",
        snippet: "Advanced night cream that reduces wrinkles, firms skin, and promotes cell renewal while you sleep.",
        price: 145000,
        originalPrice: 290000,
        image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop",
        link: "https://www.tiktok.com/@shop/retinol",
        platform: "TikTok Shop",
        category: "beauty",
        badge: "hot",
        sold: 3200,
        rating: 4.7
    },
    {
        id: 16,
        title: "Floating Wall Shelves Set Wood Storage Display",
        snippet: "Modern floating shelves perfect for displaying books, plants, and decor items in any room.",
        price: 159000,
        originalPrice: 320000,
        image: "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=400&h=400&fit=crop",
        link: "https://shopee.co.id/wall-shelf-link",
        platform: "Shopee",
        category: "home",
        badge: "sale",
        sold: 890,
        rating: 4.5
    }
];

// State
let productsData = [];
let currentProducts = [];
let displayedProducts = [];
let currentPage = 1;
const productsPerPage = 8;
let activeCategory = 'all';
let activeFilter = 'all';
let searchQuery = '';
let sortBy = 'newest';
let isLoading = true;

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const filterTags = document.querySelectorAll('.filter-tag');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupEventListeners();
});

// CORS Proxy URLs (fallback options if direct fetch fails)
const CORS_PROXIES = [
    '', // Try direct fetch first
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

// Load Products from Google Sheets or Fallback
async function loadProducts() {
    showLoadingState();
    
    try {
        if (GOOGLE_SHEET_CSV_URL && GOOGLE_SHEET_CSV_URL !== 'YOUR_GOOGLE_SHEET_CSV_URL_HERE') {
            let csvText = null;
            let lastError = null;
            
            // Try each CORS proxy until one works
            for (const proxy of CORS_PROXIES) {
                try {
                    const url = proxy ? proxy + encodeURIComponent(GOOGLE_SHEET_CSV_URL) : GOOGLE_SHEET_CSV_URL;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    csvText = await response.text();
                    
                    // Verify we got CSV data (not an error page)
                    if (csvText && csvText.includes(',') && !csvText.includes('<!DOCTYPE')) {
                        break;
                    } else {
                        throw new Error('Invalid CSV response');
                    }
                } catch (err) {
                    lastError = err;
                }
            }
            
            if (!csvText) {
                throw lastError || new Error('All fetch methods failed');
            }
            
            productsData = parseCSV(csvText);
            
            if (productsData.length === 0) {
                throw new Error('No data in sheet');
            }
        } else {
            // Use fallback sample data
            productsData = sampleProductsData;
        }
    } catch (error) {
        productsData = sampleProductsData;
    }
    
    isLoading = false;
    currentProducts = [...productsData];
    renderProducts();
}

// Parse number from CSV (handles Indonesian format where . is thousands separator)
function parseNumber(value) {
    if (!value) return 0;
    let str = String(value).trim();
    
    // Indonesian format uses . as thousands separator (e.g., "184.200" = 184200)
    // Check if it looks like Indonesian format: has dots but no comma for decimals
    // or ends with .000 pattern (thousands)
    if (str.includes('.') && !str.includes(',')) {
        // Count dots - if multiple dots or pattern like "184.200", it's thousands separator
        const dotCount = (str.match(/\./g) || []).length;
        const afterDot = str.split('.').pop();
        
        // If ends with 3 digits after dot (like .200, .000) or multiple dots, treat dots as thousands
        if (dotCount > 1 || (afterDot && afterDot.length === 3)) {
            str = str.replace(/\./g, ''); // Remove all dots (thousands separators)
        }
    }
    
    // Handle comma as decimal separator (Indonesian style)
    str = str.replace(',', '.');
    
    // Remove any remaining non-numeric characters except dots and minus
    const cleaned = str.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
}

// Parse integer from CSV
function parseInteger(value) {
    if (!value) return 0;
    const cleaned = String(value).replace(/[^\d-]/g, '');
    return parseInt(cleaned) || 0;
}

// Parse CSV from Google Sheets
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const products = [];
    
    // Skip header row (index 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle CSV parsing with quotes
        const values = parseCSVLine(line);
        
        if (values.length >= 12) {
            products.push({
                id: parseInteger(values[0]) || i,
                title: values[1] || '',
                snippet: values[2] || '',
                price: parseNumber(values[3]),
                originalPrice: parseNumber(values[4]),
                image: values[5] || 'https://via.placeholder.com/400',
                link: values[6] || '#',
                platform: values[7] || 'Shopee',
                category: values[8]?.toLowerCase() || 'other',
                badge: values[9]?.toLowerCase() || '',
                sold: parseInteger(values[10]),
                rating: parseNumber(values[11])
            });
        }
    }
    
    return products;
}

// Parse a single CSV line (handles quoted values)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// Show Loading State
function showLoadingState() {
    productsGrid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'product-card skeleton-card';
        skeleton.innerHTML = `
            <div class="product-image-container skeleton" style="background: var(--color-surface-hover);"></div>
            <div class="product-content">
                <div class="skeleton" style="height: 20px; width: 80%; margin-bottom: 8px; background: var(--color-surface-hover); border-radius: 4px;"></div>
                <div class="skeleton" style="height: 14px; width: 100%; margin-bottom: 4px; background: var(--color-surface-hover); border-radius: 4px;"></div>
                <div class="skeleton" style="height: 14px; width: 60%; margin-bottom: 12px; background: var(--color-surface-hover); border-radius: 4px;"></div>
                <div class="skeleton" style="height: 24px; width: 40%; background: var(--color-surface-hover); border-radius: 4px;"></div>
            </div>
        `;
        productsGrid.appendChild(skeleton);
    }
    loadMoreBtn.style.display = 'none';
}

// Event Listeners
function setupEventListeners() {
    // Mobile nav toggle
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
    });

    // Category navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            activeCategory = link.dataset.category;
            navMenu.classList.remove('open');
            resetAndRender();
        });
    });

    // Filter tags
    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            activeFilter = tag.dataset.filter;
            resetAndRender();
        });
    });

    // Search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase();
            resetAndRender();
        }, 300);
    });

    // Sort
    sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        resetAndRender();
    });

    // Load more
    loadMoreBtn.addEventListener('click', loadMore);
}

// Filter and Sort Products
function getFilteredProducts() {
    let filtered = [...productsData];

    // Filter by category
    if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }

    // Filter by badge/type
    if (activeFilter !== 'all') {
        filtered = filtered.filter(p => p.badge === activeFilter);
    }

    // Filter by search
    if (searchQuery) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchQuery) ||
            p.snippet.toLowerCase().includes(searchQuery)
        );
    }

    // Sort
    switch (sortBy) {
        case 'price-low':
            filtered.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filtered.sort((a, b) => b.price - a.price);
            break;
        case 'popular':
            filtered.sort((a, b) => b.sold - a.sold);
            break;
        case 'newest':
        default:
            filtered.sort((a, b) => b.id - a.id);
    }

    return filtered;
}

// Reset and Render
function resetAndRender() {
    currentPage = 1;
    displayedProducts = [];
    productsGrid.innerHTML = '';
    currentProducts = getFilteredProducts();
    renderProducts();
}

// Render Products
function renderProducts() {
    if (isLoading) return;
    
    // Clear skeleton cards on first render
    if (currentPage === 1) {
        productsGrid.innerHTML = '';
    }
    
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToRender = currentProducts.slice(startIndex, endIndex);

    productsToRender.forEach(product => {
        displayedProducts.push(product);
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });

    // Update load more button
    if (displayedProducts.length >= currentProducts.length) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }

    // Show message if no products
    if (currentProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-results" style="text-align: center; padding: 3rem; color: var(--color-text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem; opacity: 0.5;">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>No products found</h3>
                <p>Try adjusting your filters or search query</p>
            </div>
        `;
        loadMoreBtn.style.display = 'none';
    }
}

// Create Product Card
function createProductCard(product) {
    const discount = Math.round((1 - product.price / product.originalPrice) * 100);
    
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('data-product-id', product.id);
    
    // Create Schema.org Product structured data
    const productSchema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.title,
        "description": product.snippet,
        "image": product.image,
        "brand": {
            "@type": "Brand",
            "name": product.platform
        },
        "offers": {
            "@type": "Offer",
            "url": product.link,
            "priceCurrency": "IDR",
            "price": product.price.toString(),
            "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            "itemCondition": "https://schema.org/NewCondition",
            "availability": "https://schema.org/InStock",
            "seller": {
                "@type": "Organization",
                "name": product.platform
            }
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": product.rating,
            "bestRating": "5",
            "worstRating": "1",
            "ratingCount": product.sold
        }
    };
    
    card.innerHTML = `
        <a href="${product.link}" class="product-link" target="_blank" rel="noopener noreferrer nofollow sponsored">
            <div class="product-image-container">
                <img src="${product.image}" alt="${product.title}" class="product-image" loading="lazy" decoding="async">
                ${product.badge ? `<span class="product-badge ${product.badge}">${product.badge}</span>` : ''}
                <span class="product-platform">${product.platform}</span>
            </div>
            <div class="product-content">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-snippet">${product.snippet}</p>
                <div class="product-meta">
                    <span class="product-price">${formatPrice(product.price)}</span>
                    <span class="product-original-price">${formatPrice(product.originalPrice)}</span>
                    <span class="product-discount">-${discount}%</span>
                </div>
                <div class="product-stats">
                    <span class="product-stat">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                        ${product.rating}
                    </span>
                    <span class="product-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 2L3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6L18 2H6Z"/>
                            <path d="M3 6H21"/>
                            <path d="M16 10C16 12.21 14.21 14 12 14C9.79 14 8 12.21 8 10"/>
                        </svg>
                        ${formatSold(product.sold)} sold
                    </span>
                </div>
            </div>
        </a>
        <script type="application/ld+json">
            ${JSON.stringify(productSchema)}
        </script>
    `;
    
    return card;
}

// Load More
function loadMore() {
    currentPage++;
    renderProducts();
}

// Format Price (Indonesian Rupiah)
function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Format Sold Count
function formatSold(sold) {
    if (sold >= 1000) {
        return (sold / 1000).toFixed(1) + 'k';
    }
    return sold.toString();
}

// Lazy Load Images with Intersection Observer
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('skeleton');
            observer.unobserve(img);
        }
    });
}, {
    rootMargin: '50px 0px',
    threshold: 0.01
});

// Observe images when they're added
const observeImages = () => {
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
};

