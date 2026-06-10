/* =========================================================
   S.M Dynamics Electronics — Main App (COMPLETE FIXED VERSION)
   ========================================================= */

// ----- PRODUCT DATA (Fallback) -----
let PRODUCTS = [];

// ----- STATE -----
const state = {
  cart: load('nova_cart', []),
  wish: load('nova_wish', []),
  recent: load('nova_recent', []),
  user: null,
  orders: [],
  filter: 'all',
  sort: 'featured',
};

let deliveryFee = 600;
let countySubLocations = [];

// ----- UTILITIES -----
function load(key, fallback) { 
  try { 
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch { 
    return fallback; 
  } 
}

function save(key, val) { 
  localStorage.setItem(key, JSON.stringify(val)); 
}

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

function fmt(n) { 
  return 'KES ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }); 
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return '&#39;';
  });
}

function star(rating) { 
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)); 
}

function toast(msg, type = 'info') {
  const container = $('#toasts');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ----- API FUNCTION with better error handling -----
async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      method: options.method || 'GET',
      headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: options.body,
    });
    
    if (res.status === 404) {
      console.warn(`API ${path} not found (404)`);
      return { error: true, status: 404 };
    }
    if (res.status === 403) {
      console.warn(`API ${path} forbidden (403)`);
      return { error: true, status: 403 };
    }
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    console.error(`API error ${path}:`, err);
    return { error: true, message: err.message };
  }
}

// ----- PRODUCT FUNCTIONS -----
async function loadProductsFromServer() {
  try {
    const data = await api('/api/products');
    if (data && data.products && data.products.length > 0) {
      PRODUCTS = data.products;
      localStorage.setItem('management_products', JSON.stringify(PRODUCTS));
      console.log('✅ Loaded', PRODUCTS.length, 'products from server');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to load products:', err);
    return false;
  }
}

async function refreshProducts() {
  const loaded = await loadProductsFromServer();
  if (!loaded) {
    const cached = localStorage.getItem('management_products');
    if (cached && JSON.parse(cached).length > 0) {
      PRODUCTS = JSON.parse(cached);
      console.log('⚠️ Using cached products:', PRODUCTS.length);
    } else {
      // Fallback default products
      PRODUCTS = [
        { id:'p1', name:'S.M Dynamics Phone 16 Pro', cat:'phones', price:1299, was:1499, rating:4.9, reviews:1283, badge:'hot', img:'/shop/hero-phone.jpg', desc:'A flagship redefined.', inStock: true },
        { id:'p2', name:'Aura Studio Pro', cat:'audio', price:449, was:549, rating:4.8, reviews:842, badge:'sale', img:'/shop/headphones.jpg', desc:'Reference-grade over-ear headphones.', inStock: true },
        { id:'p3', name:'S.M Dynamics Book X1', cat:'laptops', price:2199, rating:4.9, reviews:512, badge:'new', img:'/shop/Sm%20dynamic.jpg', desc:'Carbon-fiber laptop.', inStock: true },
      ];
      console.log('📦 Using default products');
    }
  }
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
}

function getProductWithSpares(id) {
  let product = PRODUCTS.find(p => p.id === id);
  if (product) return product;
  const spares = JSON.parse(localStorage.getItem('nova_spare_parts') || '{}');
  const spare = spares[id];
  if (spare) {
    return {
      id: id,
      name: spare.name,
      price: spare.price,
      img: spare.img,
      cat: 'spare_parts',
      inStock: true,
      desc: 'Replacement spare part',
      rating: 5,
      reviews: 0,
      specs: { Type: 'Spare Part', Warranty: '3 months' }
    };
  }
  return null;
}

// ----- CART FUNCTIONS -----
function addCart(id) {
  const p = getProductWithSpares(id);
  if (!p) return toast('Product not found', 'error');
  if (p.inStock === false) return toast('Out of stock', 'error');
  const item = state.cart.find(c => c.id === id);
  if (item) item.qty++;
  else state.cart.push({ id, qty: 1 });
  save('nova_cart', state.cart);
  renderCart();
  toast(p.name + ' added to cart', 'success');
}

function rmCart(id) {
  state.cart = state.cart.filter(c => c.id !== id);
  save('nova_cart', state.cart);
  renderCart();
}

function setQty(id, qty) {
  const item = state.cart.find(c => c.id === id);
  if (!item) return;
  item.qty = Math.max(1, qty);
  save('nova_cart', state.cart);
  renderCart();
}

function renderCart() {
  const box = $('#cartItems');
  const cartCount = state.cart.reduce((s, c) => s + c.qty, 0);
  $('#cartCount').textContent = cartCount;
  
  if (!state.cart.length) {
    if (box) box.innerHTML = '<div class="cart-empty"><div>🛒</div><p>Your cart is empty</p></div>';
  } else {
    if (box) {
      box.innerHTML = stateCart.map(c => {
        const p = getProductWithSpares(c.id);
        if (!p) return '';
        return `
          <div class="cart-item">
            <img src="${p.img}" alt="${p.name}" onerror="this.src='/shop/hero-phone.jpg'">
            <div>
              <div class="ci-title">${p.name}</div>
              <div class="ci-price">${fmt(p.price)}</div>
              <div class="ci-qty">
                <button data-act="dec" data-id="${p.id}">−</button>
                <span>${c.qty}</span>
                <button data-act="inc" data-id="${p.id}">+</button>
              </div>
            </div>
            <button class="ci-rm" data-act="rm" data-id="${p.id}">✕</button>
          </div>
        `;
      }).join('');
      
      box.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const item = state.cart.find(c => c.id === id);
          if (btn.dataset.act === 'inc') setQty(id, item.qty + 1);
          if (btn.dataset.act === 'dec') setQty(id, item.qty - 1);
          if (btn.dataset.act === 'rm') rmCart(id);
        });
      });
    }
  }
  
  const subtotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);
  
  const cartTotal = $('#cartTotal');
  if (cartTotal) cartTotal.textContent = fmt(subtotal + deliveryFee);
  
  const deliveryFeeEl = $('#deliveryFee');
  if (deliveryFeeEl) deliveryFeeEl.textContent = fmt(deliveryFee);
}

// ----- PRODUCT RENDERING -----
function card(p, opts = {}) {
  const isWish = state.wish.includes(p.id);
  const out = p.inStock === false;
  return `
    <article class="card" data-id="${p.id}">
      <div class="card-media">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='/shop/hero-phone.jpg'">
        <div class="card-badges">
          ${out ? '<span class="b b-out">Out of Stock</span>' : ''}
          ${p.badge === 'new' ? '<span class="b b-new">New</span>' : ''}
          ${p.badge === 'hot' ? '<span class="b b-hot">Hot</span>' : ''}
          ${p.badge === 'sale' ? '<span class="b b-sale">Flash Sale</span>' : ''}
        </div>
        <div class="card-actions">
          <button class="act js-wish ${isWish ? 'active' : ''}">❤</button>
          <button class="act js-view">👁</button>
        </div>
      </div>
      <div class="card-body">
        <span class="card-cat">${p.cat}</span>
        <h3 class="card-title">${p.name}</h3>
        <div class="card-rating"><span class="stars">${star(p.rating)}</span> ${p.rating}</div>
        <div class="card-foot">
          <div class="price">${p.was ? `<s>${fmt(p.was)}</s>` : ''}${fmt(p.price)}</div>
          <button class="add js-add" ${out ? 'disabled' : ''}>${out ? 'Out' : 'Add'}</button>
        </div>
      </div>
    </article>`;
}

function renderProducts() {
  const grid = $('#productGrid');
  if (!grid) return;
  let list = PRODUCTS.slice();
  if (state.filter !== 'all') list = list.filter(p => p.cat === state.filter);
  if (state.sort === 'low') list.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') list.sort((a, b) => b.price - a.price);
  grid.innerHTML = list.map(p => card(p)).join('');
  bindCardEvents(grid);
}

function renderFlash() {
  const grid = $('#flashGrid');
  if (!grid) return;
  const items = PRODUCTS.filter(p => p.was).slice(0, 4);
  grid.innerHTML = items.map(p => card(p)).join('');
  bindCardEvents(grid);
}

function renderRecent() {
  const list = state.recent.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  const section = $('#recentSection');
  const grid = $('#recentGrid');
  if (!section || !grid) return;
  if (!list.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = list.map(p => card(p)).join('');
  bindCardEvents(grid);
}

function bindCardEvents(container) {
  $$('.js-add', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.card');
      if (card) addCart(card.dataset.id);
    });
  });
  $$('.js-wish', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.card');
      if (card) toggleWish(card.dataset.id, btn);
    });
  });
  $$('.js-view', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.card');
      if (card) openModal(card.dataset.id);
    });
  });
}

function toggleWish(id, btn) {
  const idx = state.wish.indexOf(id);
  if (idx > -1) {
    state.wish.splice(idx, 1);
    toast('Removed from wishlist', 'info');
  } else {
    state.wish.push(id);
    toast('Added to wishlist', 'success');
  }
  save('nova_wish', state.wish);
  $('#wishCount').textContent = state.wish.length;
  if (btn) btn.classList.toggle('active');
}

function openModal(id) {
  const p = getProductWithSpares(id);
  if (!p) return;
  
  if (!state.recent.includes(id)) {
    state.recent.unshift(id);
    state.recent = state.recent.slice(0, 6);
    save('nova_recent', state.recent);
    renderRecent();
  }
  
  const modal = $('#productModal');
  const modalCard = $('#modalCard');
  if (!modal || !modalCard) return;
  
  modalCard.innerHTML = `
    <button class="modal-close">✕</button>
    <div class="modal-inner">
      <div class="modal-media">
        <img src="${p.img}" alt="${p.name}" onerror="this.src='/shop/hero-phone.jpg'">
      </div>
      <div class="modal-body">
        <span class="eyebrow"><span class="dot"></span>${p.cat}</span>
        <h2>${p.name}</h2>
        <div class="price">${p.was ? `<s>${fmt(p.was)}</s>` : ''}${fmt(p.price)}</div>
        <p class="desc">${p.desc}</p>
        <button class="btn primary block" id="modalAddBtn">Add to Cart</button>
      </div>
    </div>
  `;
  
  modal.classList.add('open');
  $('#overlay').classList.add('show');
  
  $('.modal-close', modalCard).addEventListener('click', closeModal);
  $('#modalAddBtn', modalCard).addEventListener('click', () => {
    addCart(id);
    closeModal();
  });
}

function closeModal() {
  $('#productModal')?.classList.remove('open');
  $('#overlay')?.classList.remove('show');
}

// ----- DELIVERY & LOCATION -----
function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function updateCartTotals() {
  const subtotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);
  
  const total = subtotal + deliveryFee;
  const cartTotal = $('#cartTotal');
  if (cartTotal) cartTotal.textContent = fmt(total);
}

function loadCounties() {
  const el = $('#county');
  if (!el) return;
  
  const fallbackCounties = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Uasin Gishu',
    'Machakos', 'Kajiado', 'Meru', 'Nyeri', 'Kirinyaga', 'Muranga'
  ];
  
  el.innerHTML = '<option value="">Select County</option>' + 
    fallbackCounties.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('');
  
  el.addEventListener('change', () => {
    const subEl = $('#subLocation');
    const datalist = $('#sublocationsList');
    const countyName = el.options[el.selectedIndex]?.text || '';
    
    const fallbackAreas = {
      'Nairobi': ['CBD', 'Westlands', 'Kilimani', 'Karen', 'Langata', 'Eastleigh'],
      'Mombasa': ['Nyali', 'Bamburi', 'Likoni', 'Changamwe', 'Mombasa CBD'],
      'Kisumu': ['Milimani', 'Kondele', 'Nyalenda', 'Kisumu CBD'],
      'Nakuru': ['CBD', 'Milimani', 'Lanet', 'Rhoda', 'Kaptembwo', 'London']
    };
    
    const areas = fallbackAreas[countyName] || ['Town Centre', 'Estate', 'Phase 1'];
    
    if (datalist) {
      datalist.innerHTML = areas.map(a => `<option value="${a}"></option>`).join('');
    }
    if (subEl) subEl.placeholder = `Type area in ${countyName}...`;
  });
}

// ----- AUTH FUNCTIONS -----
function openAuth() {
  $('#authModal')?.classList.add('open');
  $('#overlay')?.classList.add('show');
}

function closeAuth() {
  $('#authModal')?.classList.remove('open');
  $('#overlay')?.classList.remove('show');
}

async function login(email, password) {
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.error) {
      toast(data.error || 'Login failed', 'error');
      return;
    }
    if (data.user.role === 'admin' || data.user.role === 'staff') {
      toast('Redirecting to management...', 'info');
      location.href = 'management.html';
      return;
    }
    state.user = data.user;
    closeAuth();
    updateAccountUi();
    toast('Login successful!', 'success');
  } catch (err) {
    toast('Login failed', 'error');
  }
}

function updateAccountUi() {
  const user = state.user;
  const accountBtn = $('#accountLabel');
  const dashboard = $('#dashboard');
  
  if (accountBtn) {
    accountBtn.textContent = user ? `Hello, ${user.name?.split(' ')[0] || 'User'}` : 'Login';
  }
  if (dashboard) {
    dashboard.hidden = !user || user.role !== 'customer';
  }
}

// ----- OPEN/CLOSE CART -----
function openCart(open) {
  const cart = $('#cartSide');
  const overlay = $('#overlay');
  if (!cart || !overlay) return;
  if (open) {
    cart.classList.add('open');
    overlay.classList.add('show');
  } else {
    cart.classList.remove('open');
    overlay.classList.remove('show');
  }
}

// ----- INITIALIZATION -----
async function initApp() {
  console.log('🚀 Initializing app...');
  
  // Load products
  await refreshProducts();
  
  // Render UI
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
  
  $('#wishCount').textContent = state.wish.length;
  $('#cartCount').textContent = state.cart.reduce((s, c) => s + c.qty, 0);
  
  // Load counties
  loadCounties();
  
  // Check auth
  try {
    const session = await api('/api/auth/me');
    if (session && !session.error && session.user) {
      state.user = session.user;
      updateAccountUi();
    }
  } catch (err) {
    console.log('Auth check skipped');
  }
  
  updateAccountUi();
  console.log('✅ App initialized with', PRODUCTS.length, 'products');
}

// ----- EVENT LISTENERS -----
document.addEventListener('DOMContentLoaded', () => {
  // Cart toggle
  $('#cartBtn')?.addEventListener('click', () => openCart(true));
  $('#cartClose')?.addEventListener('click', () => openCart(false));
  $('#overlay')?.addEventListener('click', () => {
    openCart(false);
    closeModal();
    closeAuth();
  });
  
  // Auth
  $('#accountBtn')?.addEventListener('click', () => {
    if (state.user) {
      $('#dashboard')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      openAuth();
    }
  });
  $('#authClose')?.addEventListener('click', closeAuth);
  $('#loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    login(formData.get('email'), formData.get('password'));
  });
  
  // Theme toggle
  $('#themeBtn')?.addEventListener('click', () => {
    const html = document.documentElement;
    const newTheme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = newTheme;
    localStorage.setItem('nova_theme', newTheme);
  });
  
  // Mobile menu
  $('#menuToggle')?.addEventListener('click', () => {
    $('#mobileMenu')?.classList.toggle('open');
  });
  
  // Back to top
  $('#toTop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  // Filter chips
  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filter = chip.dataset.cat;
      renderProducts();
    });
  });
  
  // Sort
  $('#sortBy')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderProducts();
  });
  
  // Start app
  initApp();
});

// Make sure stateCart is accessible (fix for renderCart)
const stateCart = state.cart;
