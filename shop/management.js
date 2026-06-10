// ============================================
// S.M DYNAMICS REPAIR PAGE JS - FULLY FUNCTIONAL
// ============================================

let repairServices = [];
let spareParts = [];
let currentCategory = 'all';
let searchTerm = '';
let selectedService = null;

// ============================================
// CART FUNCTIONS
// ============================================
function getCart() {
    return JSON.parse(localStorage.getItem('nova_cart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('nova_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
    const cartCountElem = document.getElementById('cartCount');
    if (cartCountElem) cartCountElem.textContent = count;
}

function addToCart(item) {
    const spareStore = JSON.parse(localStorage.getItem('nova_spare_parts') || '{}');
    spareStore[item.id] = {
        name: item.name,
        price: item.price,
        img: item.image || '/shop/hero-phone.jpg'
    };
    localStorage.setItem('nova_spare_parts', JSON.stringify(spareStore));
    
    const cart = getCart();
    const existing = cart.find(i => i.id === item.id);
    
    if (existing) {
        existing.qty = (existing.qty || 1) + 1;
        showToast(`✓ Added another ${item.name}`, 'success');
    } else {
        cart.push({ id: item.id, qty: 1 });
        showToast(`✓ ${item.name} added to cart`, 'success');
    }
    
    saveCart(cart);
}

// ============================================
// API CALLS
// ============================================
async function fetchServices() {
    const grid = document.getElementById('servicesGrid');
    if (grid) grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading services...</div>';
    
    try {
        const res = await fetch('/api/management/repair-services', { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
            const data = await res.json();
            repairServices = data.services || [];
        } else {
            repairServices = getDefaultServices();
        }
    } catch(e) {
        console.error('Fetch services error:', e);
        repairServices = getDefaultServices();
    }
    renderServices();
}

function getDefaultServices() {
    return [
        { id: "1", title: "Screen Replacement", category: "screen", price: 3500, description: "Professional LCD/OLED replacement with 3-month warranty", brand: "All", duration: "1-2 hours", warranty: "3 months" },
        { id: "2", title: "Battery Replacement", category: "battery", price: 2500, description: "Genuine battery with 6-month warranty", brand: "All", duration: "30-45 min", warranty: "6 months" },
        { id: "3", title: "Charging Port Repair", category: "charging", price: 1800, description: "Fix charging issues, replace port", brand: "All", duration: "1 hour", warranty: "3 months" },
        { id: "4", title: "Speaker/Mic Repair", category: "speaker", price: 1500, description: "Fix audio and microphone problems", brand: "All", duration: "1 hour", warranty: "3 months" },
        { id: "5", title: "Water Damage Repair", category: "water", price: 3000, description: "Ultrasonic cleaning and component repair", brand: "All", duration: "2-3 days", warranty: "3 months" },
        { id: "6", title: "Software Update/Reset", category: "software", price: 1000, description: "OS update, factory reset, malware removal", brand: "All", duration: "1 hour", warranty: "1 month" }
    ];
}

async function fetchParts() {
    const grid = document.getElementById('partsGrid');
    if (grid) grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading parts...</div>';
    
    try {
        const res = await fetch(`/api/spare-parts?_=${Date.now()}`, { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
            const data = await res.json();
            spareParts = data.spares || [];
        } else {
            spareParts = [];
        }
    } catch(e) {
        console.error('Fetch parts error:', e);
        spareParts = [];
    }
    renderParts();
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    
    let filtered = repairServices.filter(s => {
        if (currentCategory === 'all') return true;
        const catMap = {
            'screen': ['screen', 'display', 'lcd', 'oled'],
            'battery': ['battery', 'power'],
            'charging': ['charging', 'port', 'connector'],
            'speaker': ['speaker', 'audio', 'mic', 'microphone'],
            'software': ['software', 'os', 'update', 'reset'],
            'water': ['water', 'liquid', 'moisture']
        };
        const keywords = catMap[currentCategory] || [currentCategory];
        const titleLower = (s.title || '').toLowerCase();
        const typeLower = (s.repair_type || s.repairType || '').toLowerCase();
        return keywords.some(kw => titleLower.includes(kw) || typeLower.includes(kw));
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔧</div><h4>No services found</h4><p>Try a different category</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(s => `
        <div class="service-card" onclick="openBooking('${s.id}', '${escapeHtml(s.title)}', ${s.price})">
            <div class="service-icon"><span>${getServiceIcon(s.category || s.repair_type)}</span></div>
            <div class="service-content">
                <h3>${escapeHtml(s.title)}</h3>
                <div class="service-price">KES ${(s.price || 0).toLocaleString()}</div>
                <div class="service-desc">${escapeHtml(s.description || s.desc || 'Professional repair service')}</div>
                <div class="service-badge">⏱️ ${s.duration || '1-2 hours'} | 🔧 ${s.warranty || '3 months warranty'}</div>
            </div>
        </div>
    `).join('');
}

function renderParts() {
    const grid = document.getElementById('partsGrid');
    if (!grid) return;
    
    let filtered = spareParts.filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (p.name || '').toLowerCase().includes(term) || 
               (p.brand || '').toLowerCase().includes(term) ||
               (p.category || '').toLowerCase().includes(term);
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔩</div><h4>No spare parts found</h4><p>Try searching by name or brand</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(p => {
        const img = p.image || p.image_path || '/shop/hero-phone.jpg';
        const stock = p.stock || 0;
        const stockClass = stock < 5 ? 'low' : '';
        const stockText = stock === 0 ? 'Out of stock' : `${stock} in stock`;
        
        return `
            <div class="spare-card">
                <div class="spare-image-wrapper">
                    <img src="${img}" alt="${escapeHtml(p.name)}" class="spare-image" onerror="this.src='/shop/hero-phone.jpg'">
                    <span class="spare-stock ${stockClass}">${stockText}</span>
                </div>
                <div class="spare-info">
                    <h3>${escapeHtml(p.name.length > 30 ? p.name.substring(0, 27) + '...' : p.name)}</h3>
                    <span class="spare-brand">${escapeHtml(p.brand || 'Generic')}</span>
                    <div class="spare-price">KES ${(p.price || 0).toLocaleString()}</div>
                    <div class="spare-desc">${escapeHtml((p.description || 'Genuine replacement part').substring(0, 60))}</div>
                    ${stock > 0 ? 
                        `<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart({id:'${p.id}', name:'${escapeHtml(p.name)}', price:${p.price}, image:'${img}'})">
                            🛒 Add to Cart
                        </button>` :
                        `<button class="add-to-cart-btn" style="opacity:0.5; cursor:not-allowed;" disabled>
                            ❌ Out of Stock
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function getServiceIcon(cat) {
    const icons = { 
        screen: '📱', display: '📱', lcd: '📱', oled: '📱',
        battery: '🔋', power: '🔋',
        charging: '🔌', port: '🔌',
        speaker: '🔊', audio: '🔊', mic: '🎤',
        water: '💧', liquid: '💧',
        software: '💻', os: '💻'
    };
    const catLower = (cat || '').toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
        if (catLower.includes(key)) return icon;
    }
    return '🔧';
}

// ============================================
// BOOKING FUNCTIONS
// ============================================
function openBooking(id, title, price) {
    selectedService = { id, title, price };
    const modal = document.getElementById('bookingModal');
    const titleElem = document.getElementById('modalTitle');
    const priceElem = document.getElementById('modalPrice');
    
    if (titleElem) titleElem.textContent = title;
    if (priceElem) priceElem.textContent = `KES ${price.toLocaleString()}`;
    if (modal) modal.classList.add('open');
}

function closeBooking() {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');
    if (modal) modal.classList.remove('open');
    if (form) form.reset();
    selectedService = null;
}

async function submitBooking(e) {
    e.preventDefault();
    
    if (!selectedService) {
        showToast('Please select a service first', 'error');
        return;
    }
    
    const bookingData = {
        name: document.getElementById('customerName')?.value || '',
        phone: document.getElementById('customerPhone')?.value || '',
        email: document.getElementById('customerEmail')?.value || '',
        brand: document.getElementById('phoneBrand')?.value || '',
        model: document.getElementById('phoneModel')?.value || '',
        repairServiceId: selectedService.id,
        repairType: selectedService.title,
        description: document.getElementById('bookingNotes')?.value || '',
        pickupDropoff: 'Dropoff',
        preferredAt: new Date().toISOString().split('T')[0]
    };
    
    if (!bookingData.name || !bookingData.phone || !bookingData.brand || !bookingData.model) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/repair/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        
        if (response.ok) {
            showToast('✓ Booking request sent! We will contact you soon.', 'success');
            closeBooking();
        } else {
            const error = await response.json();
            showToast(error.error || '❌ Booking failed. Please try again.', 'error');
        }
    } catch(e) {
        console.error('Booking error:', e);
        showToast('❌ Connection error. Please try again later.', 'error');
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================
function showToast(msg, type) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ============================================
// TAB SWITCHING
// ============================================
function switchTab(tab) {
    const servicesSection = document.getElementById('servicesSection');
    const partsSection = document.getElementById('partsSection');
    const tabs = document.querySelectorAll('.repair-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'services') {
        if (servicesSection) servicesSection.classList.remove('hidden-section');
        if (partsSection) partsSection.classList.add('hidden-section');
        if (tabs[0]) tabs[0].classList.add('active');
    } else {
        if (servicesSection) servicesSection.classList.add('hidden-section');
        if (partsSection) partsSection.classList.remove('hidden-section');
        if (tabs[1]) tabs[1].classList.add('active');
        fetchParts();
    }
}

function filterServices(category) {
    currentCategory = category;
    renderServices();
}

function searchParts() {
    searchTerm = document.getElementById('partSearch')?.value.toLowerCase() || '';
    renderParts();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    fetchServices();
    fetchParts();
    updateCartCount();
    
    document.querySelectorAll('.repair-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterServices(chip.dataset.cat);
        });
    });
    
    const searchBtn = document.getElementById('searchBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const partSearch = document.getElementById('partSearch');
    
    if (searchBtn) searchBtn.addEventListener('click', searchParts);
    if (refreshBtn) refreshBtn.addEventListener('click', fetchParts);
    if (partSearch) partSearch.addEventListener('keypress', e => e.key === 'Enter' && searchParts());
    
    const bookingForm = document.getElementById('bookingForm');
    const closeModal = document.getElementById('closeModal');
    const bookingModal = document.getElementById('bookingModal');
    
    if (bookingForm) bookingForm.addEventListener('submit', submitBooking);
    if (closeModal) closeModal.addEventListener('click', closeBooking);
    if (bookingModal) bookingModal.addEventListener('click', e => e.target === bookingModal && closeBooking());
    
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) cartBtn.addEventListener('click', () => window.location.href = 'index.html');
    
    const themeBtn = document.getElementById('themeBtn');
    const html = document.documentElement;
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const curr = html.getAttribute('data-theme');
            html.setAttribute('data-theme', curr === 'dark' ? 'light' : 'dark');
            localStorage.setItem('nova_theme', html.getAttribute('data-theme'));
        });
    }
    const savedTheme = localStorage.getItem('nova_theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    
    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('open');
            mobileMenu.classList.toggle('open');
        });
    }
    
    const accountBtn = document.getElementById('accountBtn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});

window.addToCart = addToCart;
window.openBooking = openBooking;
