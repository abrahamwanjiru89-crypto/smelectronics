// ============================================
// S.M DYNAMICS REPAIR PAGE JS - FULLY FUNCTIONAL
// ============================================
(function() {
window.repairServices = window.repairServices | [];
let repairServices = [];
let spareParts = [];
let currentCategory = 'all';
let searchTerm = '';
let selectedService = null;

// ============================================
// CART FUNCTIONS (Sync with main store)
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
// API CALLS TO SERVER
// ============================================

// Fetch repair services from server (GET /api/repair/services)
async function fetchServices() {
    const grid = document.getElementById('servicesGrid');
    if (grid) {
        grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading repair services...</div>';
    }
    
    try {
        const res = await fetch('/api/repair/services', { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (res.ok) {
            const data = await res.json();
            repairServices = data.services || [];
            console.log('Loaded repair services:', repairServices.length);
        } else {
            console.warn('Failed to fetch services, using defaults');
            repairServices = getDefaultServices();
        }
    } catch(e) {
        console.error('Fetch services error:', e);
        repairServices = getDefaultServices();
    }
    renderServices();
}

// Default services if server is unreachable
function getDefaultServices() {
    return [
        { id: "1", title: "Screen Replacement", repairType: "Screen replacement", price: 3500, description: "Professional LCD/OLED replacement with 3-month warranty", duration: "1-2 hours", warranty: "3 months", brand: "All", available: true },
        { id: "2", title: "Battery Replacement", repairType: "Battery replacement", price: 2500, description: "Genuine battery with 6-month warranty", duration: "30-45 min", warranty: "6 months", brand: "All", available: true },
        { id: "3", title: "Charging Port Repair", repairType: "Charging port repair", price: 1800, description: "Fix charging issues, replace port", duration: "1 hour", warranty: "3 months", brand: "All", available: true },
        { id: "4", title: "Speaker/Mic Repair", repairType: "Speaker repair", price: 1500, description: "Fix audio and microphone problems", duration: "1 hour", warranty: "3 months", brand: "All", available: true },
        { id: "5", title: "Water Damage Repair", repairType: "Water damage repair", price: 3000, description: "Ultrasonic cleaning and component repair", duration: "2-3 days", warranty: "3 months", brand: "All", available: true },
        { id: "6", title: "Software Update/Reset", repairType: "Software / OS issues", price: 1000, description: "OS update, factory reset, malware removal", duration: "1 hour", warranty: "1 month", brand: "All", available: true }
    ];
}

// Fetch spare parts from server (GET /api/spare-parts)
async function fetchParts() {
    const grid = document.getElementById('partsGrid');
    if (grid) {
        grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading spare parts...</div>';
    }
    
    try {
        const res = await fetch(`/api/spare-parts?_=${Date.now()}`, { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (res.ok) {
            const data = await res.json();
            spareParts = data.spares || [];
            console.log('Loaded spare parts:', spareParts.length);
        } else {
            console.warn('Failed to fetch spare parts');
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
    
    // Filter by category
    let filtered = repairServices.filter(service => {
        if (currentCategory === 'all') return true;
        
        const repairType = (service.repairType || '').toLowerCase();
        const title = (service.title || '').toLowerCase();
        
        // Map filter categories to service types
        if (currentCategory === 'screen') {
            return repairType.includes('screen') || title.includes('screen') || title.includes('display');
        }
        if (currentCategory === 'battery') {
            return repairType.includes('battery') || title.includes('battery');
        }
        if (currentCategory === 'charging') {
            return repairType.includes('charging') || repairType.includes('port') || title.includes('charging') || title.includes('port');
        }
        if (currentCategory === 'speaker') {
            return repairType.includes('speaker') || repairType.includes('audio') || repairType.includes('mic') || title.includes('speaker');
        }
        if (currentCategory === 'software') {
            return repairType.includes('software') || repairType.includes('os') || title.includes('software') || title.includes('update');
        }
        if (currentCategory === 'water') {
            return repairType.includes('water') || repairType.includes('liquid') || title.includes('water');
        }
        return false;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔧</div><h4>No repair services found</h4><p>Try a different category</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(service => `
        <div class="service-card" onclick="openBooking('${service.id}', '${escapeHtml(service.title)}', ${service.price})">
            <div class="service-icon"><span>${getServiceIcon(service.repairType || service.title)}</span></div>
            <div class="service-content">
                <h3>${escapeHtml(service.title)}</h3>
                <div class="service-price">KES ${(service.price || 0).toLocaleString()}</div>
                <div class="service-desc">${escapeHtml((service.description || 'Professional repair service').substring(0, 80))}</div>
                <div class="service-badge">⏱️ ${service.duration || '1-2 hours'} | 🔧 ${service.warranty || '3 months warranty'}</div>
            </div>
        </div>
    `).join('');
}

function renderParts() {
    const grid = document.getElementById('partsGrid');
    if (!grid) return;
    
    let filtered = spareParts.filter(part => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (part.name || '').toLowerCase().includes(term) || 
               (part.brand || '').toLowerCase().includes(term) ||
               (part.category || '').toLowerCase().includes(term);
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔩</div><h4>No spare parts found</h4><p>Try searching by name or brand</p><p style="margin-top: 1rem;">✨ Spare parts can be added in the Management Portal</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(part => {
        const img = part.image || part.image_path || '/shop/hero-phone.jpg';
        const stock = part.stock || 0;
        const stockClass = stock < 5 ? 'low' : '';
        const stockText = stock === 0 ? 'Out of stock' : `${stock} in stock`;
        
        return `
            <div class="spare-card">
                <div class="spare-image-wrapper">
                    <img src="${img}" alt="${escapeHtml(part.name)}" class="spare-image" onerror="this.src='/shop/hero-phone.jpg'">
                    <span class="spare-stock ${stockClass}">${stockText}</span>
                </div>
                <div class="spare-info">
                    <h3>${escapeHtml(part.name.length > 30 ? part.name.substring(0, 27) + '...' : part.name)}</h3>
                    <span class="spare-brand">${escapeHtml(part.brand || 'Generic')}</span>
                    <div class="spare-price">KES ${(part.price || 0).toLocaleString()}</div>
                    <div class="spare-desc">${escapeHtml((part.description || 'Genuine replacement part').substring(0, 60))}</div>
                    ${stock > 0 ? 
                        `<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart({id:'${part.id}', name:'${escapeHtml(part.name)}', price:${part.price}, image:'${img}'})">
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

function getServiceIcon(repairType) {
    const type = (repairType || '').toLowerCase();
    if (type.includes('screen') || type.includes('display')) return '📱';
    if (type.includes('battery')) return '🔋';
    if (type.includes('charging') || type.includes('port')) return '🔌';
    if (type.includes('speaker') || type.includes('audio')) return '🔊';
    if (type.includes('water') || type.includes('liquid')) return '💧';
    if (type.includes('software') || type.includes('os')) return '💻';
    if (type.includes('camera')) return '📷';
    if (type.includes('motherboard')) return '🔧';
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
    
    // Validate required fields
    if (!bookingData.name || !bookingData.phone || !bookingData.brand || !bookingData.model) {
        showToast('Please fill all required fields (Name, Phone, Brand, Model)', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/repair/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        
        if (response.ok) {
            showToast('✓ Booking request sent successfully! We will contact you soon.', 'success');
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
        fetchParts(); // Refresh parts when switching to parts tab
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
    // Load data from server
    fetchServices();
    fetchParts();
    updateCartCount();
    
    // Tab listeners
    document.querySelectorAll('.repair-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Category filter listeners
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterServices(chip.dataset.cat);
        });
    });
    
    // Search functionality
    const searchBtn = document.getElementById('searchBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const partSearch = document.getElementById('partSearch');
    
    if (searchBtn) searchBtn.addEventListener('click', searchParts);
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
        searchTerm = '';
        if (partSearch) partSearch.value = '';
        fetchParts();
    });
    if (partSearch) partSearch.addEventListener('keypress', e => e.key === 'Enter' && searchParts());
    
    // Booking modal
    const bookingForm = document.getElementById('bookingForm');
    const closeModal = document.getElementById('closeModal');
    const bookingModal = document.getElementById('bookingModal');
    
    if (bookingForm) bookingForm.addEventListener('submit', submitBooking);
    if (closeModal) closeModal.addEventListener('click', closeBooking);
    if (bookingModal) bookingModal.addEventListener('click', e => e.target === bookingModal && closeBooking());
    
    // Cart button
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) cartBtn.addEventListener('click', () => window.location.href = 'index.html');
    
    // Theme toggle
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
    
    // Mobile menu
    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('open');
            mobileMenu.classList.toggle('open');
        });
    }
    
    // Account button
    const accountBtn = document.getElementById('accountBtn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    console.log('Repair page initialized. Waiting for server data...');
});

// Make functions global for onclick handlers
window.addToCart = addToCart;
window.openBooking = openBooking;

})();
