/* =========================================================
   S.M Dynamics Electronics — Premium electronics storefront (vanilla JS)
   UPDATED: Partial Payment System - Pay delivery fee only upfront
   UPDATED: Spare parts integration from repair page
   FIXED: Cache busting and persistence
   FIXED: Orders persist after login/logout
========================================================= */

// ----- PRODUCT DATA -----
// No default products — all products are loaded from the server/admin management page
let PRODUCTS = [];

// ============================================
// SPARE PARTS INTEGRATION - For repair page cart items
// ============================================

function getProductWithSpares(productId) {
    // First check regular products
    let product = PRODUCTS.find(p => p.id === productId);
    if (product) return product;
    
    // Check spare parts stored in localStorage (added from repair page)
    const sparePartsStore = JSON.parse(localStorage.getItem('nova_spare_parts') || '{}');
    const sparePart = sparePartsStore[productId];
    if (sparePart) {
        return {
            id: productId,
            name: sparePart.name,
            price: sparePart.price,
            img: sparePart.img,
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

function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const fmt = n => 'KES ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
const currentUser = () => state.user;

let deliveryFee = 200;
let countySubLocations = [];

function normalizeAreaName(value) {
  return String(value || '').trim().toLowerCase();
}

function getSelectedSubLocation() {
  const value = normalizeAreaName($('#subLocation')?.value);
  if (!value) return null;
  return countySubLocations.find(sl => normalizeAreaName(sl.name) === value) || null;
}

// ============================================
// LOAD PRODUCTS FROM LOCALSTORAGE (SYNC WITH MANAGEMENT PAGE)
// ============================================
function loadProductsFromLocalStorage() {
  const stored = localStorage.getItem('management_products');
  if (stored && JSON.parse(stored).length > 0) {
    console.log('⚠️ Using localStorage fallback products (offline mode)');
    PRODUCTS = JSON.parse(stored);
    return true;
  }
  console.log('📦 No localStorage products found');
  return false;
}

// ============================================
// API FUNCTION WITH CACHE BUSTING
// ============================================
async function api(path, options = {}) {
  let res;
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const separator = path.includes('?') ? '&' : '?';
  const cacheBustPath = path + separator + '_=' + Date.now();
  
  try {
    res = await fetch(cacheBustPath, {
      credentials: 'include',
      method: options.method || 'GET',
      body: options.body,
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (err) {
    throw new Error('Network request failed. Please check your server connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============================================
// CHECKOUT MODAL
// ============================================
function showCheckoutModal(productTotal, phone, onConfirm) {
  const existingModal = document.querySelector('.checkout-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `
    <div class="checkout-card">
      <h3>💰 Confirm Order</h3>
      <div class="details" style="text-align: left;">
        <div style="background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.25); border-radius:0.75rem; padding:1rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <span>Products Total:</span>
            <b style="color:#00e5ff;">${fmt(productTotal)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; color:#aaa; font-size:0.85rem;">
            <span>Delivery Fee:</span>
            <span>Set by admin after order</span>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border-radius:0.6rem; padding:0.75rem; margin-bottom:0.75rem; font-size:0.88rem;">
          📲 M-Pesa STK push will be sent to <b style="color:#00e5ff;">${esc(phone)}</b>
        </div>
        <p style="font-size:0.82rem; color:#aaa;">🚚 Delivery fee will be communicated to you after your order is confirmed.</p>
        <p class="checkout-error" style="color:#ff4d6d; font-size:0.8rem; margin-top:0.5rem; display:none;"></p>
      </div>
      <div class="checkout-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Confirm &amp; Pay ${fmt(productTotal)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);
  
  modal.querySelector('.btn-cancel').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });
  
  const confirmBtn = modal.querySelector('.btn-confirm');
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    if (onConfirm) await onConfirm(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  });
}

function showOrderSuccessModal(order) {
  const existing = document.querySelector('.checkout-modal');
  if (existing) { existing.classList.remove('show'); setTimeout(() => existing.remove(), 300); }

  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `
    <div class="checkout-card">
      <h3>✅ Order Placed!</h3>
      <div class="details" style="text-align: left;">
        <p><strong>Order ID:</strong> ${esc(order.id)}</p>
        <p><strong>Amount paid:</strong> <span style="color:#00e5ff;">${fmt(order.total)}</span></p>
        <hr style="margin: 1rem 0; border-color: rgba(255,255,255,0.1);">
        <p style="font-size: 0.85rem;">📲 Check your phone for the M-Pesa prompt to complete payment.</p>
        <p style="font-size: 0.85rem;">🚚 Your delivery fee will be set by our team — we'll notify you with the amount.</p>
        <p style="font-size: 0.85rem;">📦 We'll prepare your order and contact you when it's ready for delivery.</p>
      </div>
      <div class="checkout-actions">
        <button class="btn-confirm">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);

  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  };
  modal.querySelector('.btn-confirm').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

async function updateCartTotals() {
  const subtotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);
  updateCartFooter(subtotal);
}

function updateCartFooter(subtotal) {
  const cartFooter = $('.cart-foot');
  if (cartFooter) {
    cartFooter.innerHTML = `
      <div class="cart-total">
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Products Total:</span>
            <b style="color:#00e5ff;">${fmt(subtotal)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; color:#aaa; font-size:0.85rem; padding-top:0.5rem; border-top:1px solid rgba(255,255,255,0.1);">
            <span>Delivery Fee:</span>
            <span>Set after order confirmation</span>
          </div>
        </div>
        <div style="background: rgba(0,229,255,0.07); padding: 0.75rem; border-radius: 0.75rem; margin-bottom:0.75rem;">
          <small>💡 Pay your full product total now. Delivery fee is calculated by our team based on your location and communicated to you separately.</small>
        </div>
      </div>
      <button class="btn primary block" id="checkoutBtn">Pay ${fmt(subtotal)} via M-Pesa & Place Order</button>
    `;
    
    const newCheckoutBtn = document.getElementById('checkoutBtn');
    if (newCheckoutBtn) {
      newCheckoutBtn.removeEventListener('click', handleCheckout);
      newCheckoutBtn.addEventListener('click', handleCheckout);
    }
  }
}

// ============================================
// CHECKOUT HANDLER
// ============================================
async function handleCheckout() {
  if (!state.cart.length) {
    toast('Cart is empty', 'error');
    return;
  }
  
  const user = currentUser();
  if (!user || user.role !== 'customer') {
    toast('Please login as a customer to place an order', 'error');
    openCart(false);
    openAuth();
    return;
  }
  
  const phone = $('#customerPhone')?.value.trim();
  const countyId = $('#county').value;
  const subLocationText = $('#subLocation').value.trim();
  const subLocation = getSelectedSubLocation();
  const street = $('#street').value.trim();
  
  if (!phone || phone.length < 10) {
    toast('Please enter your M-Pesa phone number', 'error');
    $('#customerPhone')?.focus();
    return;
  }
  if (!countyId || !subLocationText || !street) {
    toast('Please fill in your delivery location', 'error');
    return;
  }
  if (!subLocation) {
    toast('Please choose a listed sub-location for the selected county', 'error');
    return;
  }

  const productTotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);

  showCheckoutModal(productTotal, phone, async (modal) => {
    try {
      const orderResp = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          county: $('#county option:checked')?.textContent || '',
          constituency: subLocation.name,
          street,
          depositAmount: productTotal,
          depositMpesa: "MPESA-" + Date.now(),
        })
      });
      const order = orderResp.order;

      state.orders.unshift(order);
      save('nova_orders', state.orders);
      state.cart = [];
      save('nova_cart', state.cart);
      renderCart();
      openCart(false);
      showOrderSuccessModal(order);
      renderDashboard();

      try {
        await api('/api/payments/stk-push', {
          method: 'POST',
          body: JSON.stringify({
            phone,
            amount: productTotal,
            orderId: order.id,
            paymentType: 'product_total'
          })
        });
        toast(`✅ M-Pesa prompt sent to ${phone} for ${fmt(productTotal)}`, 'success');
      } catch (stkErr) {
        toast('Order placed, but the M-Pesa prompt could not be sent. Please contact us to complete payment.', 'warning');
      }
    } catch (err) {
      const errorEl = modal?.querySelector('.checkout-error');
      const confirmBtn = modal?.querySelector('.btn-confirm');
      if (errorEl) {
        errorEl.textContent = 'Checkout failed: ' + err.message;
        errorEl.style.display = 'block';
      } else {
        toast("Checkout failed: " + err.message, 'error');
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm & Pay ${fmt(productTotal)}`;
      }
    }
  });
}

// ============================================
// LOAD COUNTIES
// ============================================
async function loadCounties() {
  const el = $('#county');
  if (!el) return;
  
  const fallbackCounties = [
    { id: 'c-nairobi', name: 'Nairobi' },
    { id: 'c-mombasa', name: 'Mombasa' },
    { id: 'c-kisumu', name: 'Kisumu' },
    { id: 'c-nakuru', name: 'Nakuru' },
    { id: 'c-kiambu', name: 'Kiambu' },
    { id: 'c-eldoret', name: 'Uasin Gishu' },
    { id: 'c-machakos', name: 'Machakos' },
    { id: 'c-kajiado', name: 'Kajiado' },
  ];
  
  el.innerHTML = '<option value="">Select County</option>' + 
    fallbackCounties.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  try {
    const data = await api('/api/locations/counties');
    if (data && data.counties && data.counties.length > 0) {
      el.innerHTML = '<option value="">Select County</option>' + 
        data.counties.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load counties from server, using fallback');
  }
  
  const oldListener = el._changeListener;
  if (oldListener) el.removeEventListener('change', oldListener);
  
  const changeHandler = async () => {
    const subEl = $('#subLocation');
    const datalist = $('#sublocationsList');
    const countyName = el.options[el.selectedIndex]?.text || '';
    const selectedCountyId = el.value;
    
    if (!selectedCountyId) {
      countySubLocations = [];
      if (subEl) subEl.value = '';
      if (datalist) datalist.innerHTML = '';
      updateCartTotals();
      return;
    }
    
    const fallbackSubLocationsData = {
      'Nairobi': ['CBD', 'Westlands', 'Kilimani', 'Karen', 'Langata', 'Eastleigh'],
      'Mombasa': ['Nyali', 'Bamburi', 'Mtwapa', 'Likoni', 'Changamwe'],
      'Kisumu': ['Milimani', 'Kondele', 'Nyalenda', 'Kibos'],
      'Nakuru': ['CBD', 'Milimani', 'Lanet', 'Rhoda', 'Kaptembwo'],
    };
    
    const locations = fallbackSubLocationsData[countyName] || 
      ['Town Centre', 'Estate', 'Central', 'North', 'South'];
    
    countySubLocations = locations.map((loc, index) => ({
      id: `sl-${selectedCountyId}-${index}`,
      name: loc,
      countyId: selectedCountyId
    }));
    
    if (datalist) {
      datalist.innerHTML = locations.map(loc => `<option value="${loc}"></option>`).join('');
    }
    
    if (subEl) {
      subEl.placeholder = `Type area in ${countyName}...`;
      subEl.value = '';
    }
    
    updateCartTotals();
  };
  
  el._changeListener = changeHandler;
  el.addEventListener('change', changeHandler);
  
  $('#subLocation')?.addEventListener('change', updateCartTotals);
  $('#subLocation')?.addEventListener('input', debounce(updateCartTotals, 250));
}

function debounce(fn, wait=300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// ============================================
// REFRESH PRODUCTS & ORDERS
// ============================================
async function refreshProducts() {
  console.log('🔄 Refreshing products from server...');
  
  try {
    const data = await api('/api/products');
    
    if (data && data.products && data.products.length > 0) {
      PRODUCTS = data.products;
      console.log('✅ Loaded', PRODUCTS.length, 'products from server');
      localStorage.setItem('management_products', JSON.stringify(PRODUCTS));
    } else {
      console.warn('⚠️ Server returned empty products, checking localStorage...');
      const stored = localStorage.getItem('management_products');
      if (stored && JSON.parse(stored).length > 0) {
        PRODUCTS = JSON.parse(stored);
        console.log('📦 Loaded', PRODUCTS.length, 'products from localStorage fallback');
      }
    }
  } catch (err) {
    console.error('❌ Failed to refresh products from server:', err);
    const stored = localStorage.getItem('management_products');
    if (stored && JSON.parse(stored).length > 0) {
      PRODUCTS = JSON.parse(stored);
      console.log('📦 Using localStorage products (server offline)');
    } else {
      console.warn('⚠️ No products available - using defaults');
      PRODUCTS = [];
      console.warn('⚠️ No products available — server offline and no cache. Add products via the admin panel.');
    }
  }
  
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
}

// ============================================
// FIXED: Refresh orders with persistence
// ============================================
async function refreshOrders() {
  if (!state.user) return;
  try {
    const data = await api('/api/orders/my');
    state.orders = data.orders || [];
    // Save to localStorage as backup
    save('nova_orders', state.orders);
    renderDashboard();
  } catch (err) {
    console.error('Failed to refresh orders from server:', err);
    // Try to load from localStorage as fallback
    const stored = load('nova_orders', []);
    state.orders = stored;
    renderDashboard();
  }
}

// ============================================
// LOAD USER ORDERS (for after login)
// ============================================
async function loadUserOrders() {
  if (!state.user || state.user.role !== 'customer') return;
  try {
    const data = await api('/api/orders/my');
    state.orders = data.orders || [];
    save('nova_orders', state.orders);
    renderDashboard();
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

// ----- LOADER -----
window.addEventListener('load', () => {
  setTimeout(() => $('#loader')?.classList.add('hide'), 600);
});

// ----- NAV scroll -----
addEventListener('scroll', () => {
  $('#nav').classList.toggle('scrolled', scrollY > 20);
  $('#toTop').classList.toggle('show', scrollY > 600);
}, { passive: true });

// ----- THEME -----
const savedTheme = localStorage.getItem('nova_theme') || 'dark';
document.documentElement.dataset.theme = savedTheme;
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('nova_theme', next);
  toast(`Switched to ${next} mode`, 'info');
});

// ----- MOBILE MENU -----
$('#menuToggle').addEventListener('click', e => {
  e.currentTarget.classList.toggle('open');
  $('#mobileMenu').classList.toggle('open');
});
$$('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
  $('#menuToggle').classList.remove('open');
  $('#mobileMenu').classList.remove('open');
}));

// ----- SEARCH -----
const searchPanel = $('#searchPanel');
$('#searchBtn').addEventListener('click', () => { searchPanel.classList.toggle('open'); $('#searchInput').focus(); });
$('#searchClose').addEventListener('click', () => searchPanel.classList.remove('open'));
addEventListener('keydown', e => { if (e.key === 'Escape') searchPanel.classList.remove('open'); });
$('#searchInput').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  const r = $('#searchResults');
  if (!q) { r.innerHTML = ''; return; }
  const hits = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.cat.includes(q)).slice(0, 8);
  r.innerHTML = hits.length ? hits.map(p => `
    <button class="sr-item" data-id="${p.id}">
      <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='/shop/hero-phone.jpg'">
      <div><div>${p.name}</div><small>${fmt(p.price)} · ${p.cat}</small></div>
    </button>`).join('') : '<p class="muted" style="padding:1rem">No matches.</p>';
  r.querySelectorAll('.sr-item').forEach(b => b.addEventListener('click', () => { openModal(b.dataset.id); searchPanel.classList.remove('open'); }));
});

// ----- PARTICLES -----
const canvas = $('#particles');
const ctx = canvas?.getContext('2d');
let particles = [], W, H;
function resizeCanvas() {
  if (!canvas || !ctx) return;
  W = canvas.width = canvas.offsetWidth * devicePixelRatio;
  H = canvas.height = canvas.offsetHeight * devicePixelRatio;
}
function initParticles() {
  if (!canvas || !ctx) return;
  resizeCanvas();
  particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 2 + .5,
    vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
    c: ['#00e5ff', '#7c4dff', '#ff2bd6'][Math.floor(Math.random() * 3)]
  }));
}
function drawParticles() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, W, H);
  particles.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = p.c; ctx.shadowBlur = 15; ctx.shadowColor = p.c; ctx.fill();
    for (let j = i+1; j < particles.length; j++) {
      const q = particles[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d < 120 * devicePixelRatio) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(124,77,255,${.15 * (1 - d / (120*devicePixelRatio))})`;
        ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
      }
    }
  });
  requestAnimationFrame(drawParticles);
}
if (canvas && ctx) {
  initParticles(); drawParticles();
  addEventListener('resize', initParticles);
}

// ----- HERO SLIDER -----
const slides = $$('.hero-slide');
const dotsBox = $('.hero-dots');
let slideIdx = 0;
if (slides.length && dotsBox) {
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    if (i === 0) b.classList.add('active');
    b.addEventListener('click', () => setSlide(i));
    dotsBox.appendChild(b);
  });
  function setSlide(i) {
    slides.forEach(s => s.classList.remove('active'));
    $$('.hero-dots button').forEach(d => d.classList.remove('active'));
    slides[i].classList.add('active');
    $$('.hero-dots button')[i].classList.add('active');
    slideIdx = i;
  }
  setInterval(() => setSlide((slideIdx + 1) % slides.length), 5000);
} else {
  function setSlide() {}
}

// ----- COUNTERS -----
const counters = $$('[data-count]');
const counterObs = new IntersectionObserver(es => {
  es.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target, target = +el.dataset.count;
      let cur = 0, step = Math.ceil(target / 50);
      const t = setInterval(() => { cur += step; if (cur >= target) { cur = target; clearInterval(t); } el.textContent = cur; }, 30);
      counterObs.unobserve(el);
    }
  });
});
counters.forEach(c => counterObs.observe(c));

// ----- REVEAL -----
const revObs = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .12 });
$$('.reveal').forEach(el => revObs.observe(el));

// ----- COUNTDOWN -----
const endTime = Date.now() + 6 * 3600 * 1000;
setInterval(() => {
  const d = Math.max(0, endTime - Date.now());
  const h = String(Math.floor(d / 3600000)).padStart(2, '0');
  const m = String(Math.floor(d % 3600000 / 60000)).padStart(2, '0');
  const s = String(Math.floor(d % 60000 / 1000)).padStart(2, '0');
  $('#countdown').textContent = `${h}:${m}:${s}`;
}, 1000);

// ----- PRODUCT RENDER -----
function star(r) { return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)); }

function card(p, opts = {}) {
  const isWish = state.wish.includes(p.id);
  const stockPct = opts.stock || Math.floor(Math.random() * 60 + 20);
  const out = p.inStock === false;
  return `
    <article class="card ${out ? 'out-of-stock' : ''}" data-id="${p.id}">
      <div class="card-media">
        <img src="${p.img}" alt="${p.name}" loading="lazy" width="600" height="600" onerror="this.src='/shop/hero-phone.jpg'">
        <div class="card-badges">
          ${out ? '<span class="b b-out">Out of Stock</span>' : ''}
          ${p.badge === 'new' ? '<span class="b b-new">New</span>' : ''}
          ${p.badge === 'hot' ? '<span class="b b-hot">Hot</span>' : ''}
          ${p.badge === 'sale' ? '<span class="b b-sale">Flash Sale</span>' : ''}
          ${(!p.badge && p.was) ? '<span class="b b-sale">Sale</span>' : ''}
        </div>
        <div class="card-actions">
          <button class="act js-wish ${isWish ? 'active' : ''}" aria-label="Wishlist"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg></button>
          <button class="act js-view" aria-label="Quick view"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/></svg></button>
        </div>
      </div>
      <div class="card-body">
        <span class="card-cat">${p.cat}</span>
        <h3 class="card-title">${p.name}</h3>
        <div class="card-rating"><span class="stars">${star(p.rating)}</span> ${p.rating} · ${p.reviews}</div>
        <div class="card-foot">
          <div class="price">${p.was ? `<s>${fmt(p.was)}</s>` : ''}${fmt(p.price)}</div>
          <button class="add js-add" ${out ? 'disabled' : ''}>${out ? 'Unavailable' : 'Add'}</button>
        </div>
      </div>
      ${opts.stock ? `<div class="stock"><small>Only ${Math.round(100 - stockPct)}% left</small><div class="stock-bar"><i style="width:${stockPct}%"></i></div></div>` : ''}
    </article>`;
}

function renderProducts() {
  let list = PRODUCTS.slice();
  if (state.filter !== 'all') list = list.filter(p => p.cat === state.filter);
  if (state.sort === 'low') list.sort((a,b) => a.price - b.price);
  if (state.sort === 'high') list.sort((a,b) => b.price - a.price);
  if (state.sort === 'rating') list.sort((a,b) => b.rating - a.rating);
  $('#productGrid').innerHTML = list.map(p => card(p)).join('');
  bindCards($('#productGrid'));
}
function renderFlash() {
  const items = PRODUCTS.filter(p => p.was).slice(0, 4);
  $('#flashGrid').innerHTML = items.map(p => card(p, { stock: Math.floor(Math.random() * 60 + 20) })).join('');
  bindCards($('#flashGrid'));
}
function renderRecent() {
  const list = state.recent.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  if (!list.length) return;
  $('#recentSection').hidden = false;
  $('#recentGrid').innerHTML = list.map(p => card(p)).join('');
  bindCards($('#recentGrid'));
}
function bindCards(root) {
  $$('.card', root).forEach(c => {
    const id = c.dataset.id;
    $('.js-add', c).addEventListener('click', () => addCart(id));
    $('.js-wish', c).addEventListener('click', () => toggleWish(id, c));
    $('.js-view', c).addEventListener('click', () => openModal(id));
    $('.card-media', c).addEventListener('click', () => openModal(id));
  });
}

// ----- FILTERS / SORT -----
$$('.chip').forEach(c => c.addEventListener('click', () => {
  $$('.chip').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  state.filter = c.dataset.cat;
  renderProducts();
}));
$('#sortBy').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });

// ----- CART -----
function addCart(id) {
  const p = getProductWithSpares(id);
  if (p?.inStock === false) return toast('This product is out of stock', 'error');
  const item = state.cart.find(c => c.id === id);
  if (item) item.qty++; else state.cart.push({ id, qty: 1 });
  save('nova_cart', state.cart); renderCart();
  toast(`${p.name} added to cart`, 'success');
}
function rmCart(id) { state.cart = state.cart.filter(c => c.id !== id); save('nova_cart', state.cart); renderCart(); }
function clearCart() {
  if (!state.cart.length) return;
  if (!confirm('Remove all items from your cart?')) return;
  state.cart = [];
  save('nova_cart', state.cart);
  renderCart();
  toast('Cart cleared', 'info');
}
function setQty(id, q) {
  const it = state.cart.find(c => c.id === id); if (!it) return;
  it.qty = Math.max(1, q); save('nova_cart', state.cart); renderCart();
}

function renderCart() {
  const box = $('#cartItems');
  if (!state.cart.length) { 
    box.innerHTML = '<div class="cart-empty"><div style="font-size:3rem">🛒</div><p>Your cart is empty</p></div>'; 
  } else {
    box.innerHTML = state.cart.map(c => {
      const p = getProductWithSpares(c.id);
      if (!p) return '';
      return `<div class="cart-item">
        <img src="${p.img}" alt="${p.name}" onerror="this.src='/shop/hero-phone.jpg'">
        <div><div class="ci-title">${p.name}</div><div class="ci-price">${fmt(p.price)}</div>
          <div class="ci-qty"><button data-act="dec" data-id="${p.id}">−</button><span>${c.qty}</span><button data-act="inc" data-id="${p.id}">+</button></div>
        </div>
        <button class="ci-rm" data-act="rm" data-id="${p.id}" aria-label="Remove">✕</button>
    </div>`;
    }).join('');
    
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, item = state.cart.find(c => c.id === id);
      if (b.dataset.act === 'inc') setQty(id, item.qty + 1);
      if (b.dataset.act === 'dec') setQty(id, item.qty - 1);
      if (b.dataset.act === 'rm') rmCart(id);
    }));
  }
  
  const subtotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);
  $('#cartCount').textContent = state.cart.reduce((s, c) => s + c.qty, 0);
  updateCartFooter(subtotal);
}

function openCart(open) {
  const cart = $('#cartSide');
  const overlay = $('#overlay');
  if (!cart || !overlay) return;
  if (open) {
    cart.classList.add('open');
    cart.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
  } else {
    cart.classList.remove('open');
    cart.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('show');
  }
}
$('#cartBtn').addEventListener('click', () => openCart(true));
$('#cartClose').addEventListener('click', () => openCart(false));
$('#cartClear')?.addEventListener('click', clearCart);
$('#overlay').addEventListener('click', () => { openCart(false); closeModal(); closeAuth(); });

// ----- WISHLIST -----
function toggleWish(id, cardEl) {
  const idx = state.wish.indexOf(id);
  if (idx > -1) { state.wish.splice(idx, 1); toast('Removed from wishlist', 'info'); }
  else { state.wish.push(id); toast('Added to wishlist ❤', 'success'); }
  save('nova_wish', state.wish);
  $('#wishCount').textContent = state.wish.length;
  if (cardEl) $('.js-wish', cardEl).classList.toggle('active');
}
$('#wishBtn').addEventListener('click', () => toast(state.wish.length ? `${state.wish.length} item(s) in wishlist` : 'Wishlist is empty', 'info'));

// ----- MODAL -----
function openModal(id) {
  const p = getProductWithSpares(id);
  if (!p) return;
  if (!state.recent.includes(id)) {
    state.recent.unshift(id); state.recent = state.recent.slice(0, 6); save('nova_recent', state.recent);
    renderRecent();
  }
  const imgs = [p.img, p.img, p.img];
  $('#modalCard').innerHTML = `
    <button class="modal-close" aria-label="Close">✕</button>
    <div class="modal-inner">
      <div class="modal-media">
        <img id="mImg" src="${p.img}" alt="${p.name}" onerror="this.src='/shop/hero-phone.jpg'">
        <div class="modal-thumbs">${imgs.map((i, k) => `<button class="${k===0?'active':''}" data-src="${i}"><img src="${i}" alt="" onerror="this.src='/shop/hero-phone.jpg'"></button>`).join('')}</div>
      </div>
      <div class="modal-body">
        <span class="eyebrow"><span class="dot"></span>${p.cat}</span>
        <h2>${p.name}</h2>
        <div class="card-rating"><span class="stars">${star(p.rating)}</span> ${p.rating} · ${p.reviews} reviews</div>
        <div class="price">${p.was ? `<s>${fmt(p.was)}</s>` : ''}${fmt(p.price)}</div>
        <p class="desc">${p.desc}</p>
        <div class="specs">${Object.entries(p.specs || { Type: 'Spare Part', Warranty: '3 months' }).map(([k,v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}</div>
        <button class="btn primary block" id="mAdd" ${p.inStock === false ? 'disabled' : ''}>${p.inStock === false ? 'Out of Stock' : 'Add to Cart'}</button>
      </div>
    </div>`;
  $('.modal-close').addEventListener('click', closeModal);
  $('#mAdd').addEventListener('click', () => {
    if (p.inStock === false) return toast('This product is out of stock', 'error');
    addCart(id); closeModal(); openCart(true);
  });
  $$('.modal-thumbs button').forEach(b => b.addEventListener('click', () => {
    $$('.modal-thumbs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); $('#mImg').src = b.dataset.src;
  }));
  $('#productModal').classList.add('open'); $('#overlay').classList.add('show');
}
function closeModal() { $('#productModal').classList.remove('open'); $('#overlay').classList.remove('show'); }
$('#productModal').addEventListener('click', e => { if (e.target.id === 'productModal') closeModal(); });

// ----- TESTIMONIALS -----
const REVIEWS = [
  { n:'Maya R.', r:'Designer · Tokyo', t:'The S.M Dynamics Phone 16 Pro is genuinely the best device I have ever owned. Display is unreal.', s:5 },
  { n:'David K.', r:'Producer · Berlin', t:'Aura Studio Pro headphones replaced my $1000 reference cans. That is wild for the price.', s:5 },
  { n:'Sofia L.', r:'Engineer · São Paulo', t:'Shipping was 2 days to Brazil and packaging felt like opening a luxury watch.', s:5 },
  { n:'Anand P.', r:'Photographer · Mumbai', t:'Lumen R7 autofocus tracks birds in flight. I have never been so confident on a shoot.', s:5 },
  { n:'Elena F.', r:'Creator · Madrid', t:'Customer support replied in 4 minutes. Four. Minutes. Unheard of in this industry.', s:5 },
];
$('#rvTrack').innerHTML = REVIEWS.map(r => `
  <article class="rv-card">
    <div class="stars">${star(r.s)}</div>
    <q>${r.t}</q>
    <div class="rv-who"><div class="rv-avatar">${r.n[0]}</div><div><b>${r.n}</b><br><small>${r.r}</small></div></div>
  </article>`).join('');
$('.rv-nav.prev').addEventListener('click', () => $('#rvTrack').scrollBy({ left: -380, behavior: 'smooth' }));
$('.rv-nav.next').addEventListener('click', () => $('#rvTrack').scrollBy({ left: 380, behavior: 'smooth' }));

// ----- NEWSLETTER -----
$('#nlForm').addEventListener('submit', e => { e.preventDefault(); e.target.reset(); toast('Subscribed! Welcome ✨', 'success'); });

// ----- AI -----
$('#aiForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#aiInput').value.toLowerCase();
  const ans = $('#aiAnswer'); ans.className = 'ai-answer show'; ans.textContent = 'Thinking…';
  setTimeout(() => {
    let pick;
    if (q.includes('laptop') || q.includes('edit') || q.includes('work')) pick = PRODUCTS.find(p => p.id === 'p3');
    else if (q.includes('phone') || q.includes('camera') && q.includes('pocket')) pick = PRODUCTS.find(p => p.id === 'p1');
    else if (q.includes('audio') || q.includes('headphone') || q.includes('music')) pick = PRODUCTS.find(p => p.id === 'p2');
    else if (q.includes('game') || q.includes('vr')) pick = PRODUCTS.find(p => p.id === 'p5');
    else if (q.includes('camera') || q.includes('photo')) pick = PRODUCTS.find(p => p.id === 'p7');
    else if (q.includes('watch') || q.includes('fitness')) pick = PRODUCTS.find(p => p.id === 'p4');
    else pick = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    ans.innerHTML = `Based on your needs, I recommend the <b>${pick.name}</b> (${fmt(pick.price)}). ${pick.desc} <a href="#" data-id="${pick.id}" style="color:var(--primary)">View product →</a>`;
    ans.querySelector('a').addEventListener('click', ev => { ev.preventDefault(); openModal(pick.id); });
  }, 700);
});

// ----- CHAT -----
$('#chatFab').addEventListener('click', () => $('#chatPanel').classList.toggle('open'));
$('#chatClose').addEventListener('click', () => $('#chatPanel').classList.remove('open'));
$('#chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#chatInput').value.trim(); if (!v) return;
  const log = $('#chatLog');
  log.insertAdjacentHTML('beforeend', `<div class="msg user">${v}</div>`);
  $('#chatInput').value = ''; log.scrollTop = log.scrollHeight;
  setTimeout(() => {
    const replies = ['Got it! Let me check on that for you.', 'Great question — our team usually responds within 5 minutes.', 'You qualify for free express shipping today 🎉', 'I can offer you a 10% code: SMDELECT10'];
    log.insertAdjacentHTML('beforeend', `<div class="msg bot">${replies[Math.floor(Math.random()*replies.length)]}</div>`);
    log.scrollTop = log.scrollHeight;
  }, 900);
});

// ----- AUTH / ROLE DASHBOARDS -----
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function openAuth(panel = 'login') {
  $('#authModal').classList.add('open');
  $('#overlay').classList.add('show');
  setAuthPanel(panel);
}
function closeAuth() {
  $('#authModal').classList.remove('open');
  $('#overlay').classList.remove('show');
  $('#loginForm').reset();
  $('#registerForm').reset();
  $('#forgotForm')?.reset();
  setAuthPanel('login');
}
function setAuthPanel(panel) {
  $('#panelLogin').hidden  = panel !== 'login';
  $('#panelRegister').hidden = panel !== 'register';
  $('#panelForgot').hidden  = panel !== 'forgot';
}

// ============================================
// FIXED: Update Account UI with orders refresh
// ============================================
function updateAccountUi() {
  const user = currentUser();
  const customer = user?.role === 'customer' ? user : null;
  $('#accountLabel').textContent = customer ? `Customer: ${customer.name.split(' ')[0]}` : 'Login';
  $('#dashboard').hidden = !customer;
  if (customer) {
    // Always refresh orders when showing dashboard
    refreshOrders();
  }
}

// ============================================
// FIXED: Login function with order refresh
// ============================================
async function login(email, password, successMessage = 'Login successful') {
  try {
    const data = await api('/api/auth/login', { method:'POST', body:JSON.stringify({ email, password }) });
    if (data.user.role === 'admin' || data.user.role === 'staff') {
      toast('Opening management page', 'info');
      location.href = 'management.html';
      return;
    }
    state.user = data.user;
    closeAuth();
    updateAccountUi();
    // Refresh orders immediately after login
    await refreshOrders();
    toast(successMessage, 'success');
    $('#dashboard').scrollIntoView({ behavior:'smooth' });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderOrderList(orders, mode = 'user') {
  if (!orders.length) return '<div class="dash-empty">No orders yet.</div>';
  return orders.map(order => {
    const dfStatus = order.deliveryFeeSet
      ? `<span style="color:#00c853;">🚚 Delivery Fee: ${fmt(order.deliveryFee)}</span>`
      : `<span style="color:#ffb300;">⏳ Delivery fee pending — our team will contact you</span>`;
    const latestNotif = order.notifications && order.notifications.length
      ? `<div class="order-meta" style="margin-top:0.35rem; background:rgba(0,229,255,0.07); border-radius:0.5rem; padding:0.4rem 0.6rem;"><small>📬 ${esc(order.notifications[0].message)}</small></div>`
      : '';
    return `
    <article class="order-row">
      <div>
        <b>${esc(order.id)}</b>
        <span>${new Date(order.createdAt).toLocaleString()}</span>
        ${mode !== 'user' ? `<small>${esc(order.customer)} · ${esc(order.email)}</small>` : ''}
      </div>
      <div class="order-items">
        ${order.items.map(i => `${esc(i.name)} x${i.qty}`).join('<br>')}
        <div class="order-meta"><small>Location: ${esc(order.location.county)}, ${esc(order.location.constituency)} · ${esc(order.location.street)}</small></div>
        <div class="order-meta"><small>Paid: ${fmt(order.depositAmount)} · Ref: ${esc(order.depositMpesa || 'N/A')}</small></div>
        <div class="order-meta" style="margin-top:0.25rem;">${dfStatus}</div>
        ${latestNotif}
      </div>
      <div><b>${fmt(order.total)}</b><span class="status ${order.status.toLowerCase()}">${esc(order.status)}</span></div>
    </article>`;
  }).join('');
}
function renderDashboard() {
  const user = currentUser();
  if (!user || user.role !== 'customer') return;
  $('#dashRole').textContent = 'Customer';
  $('#dashTitle').textContent = 'Track Your Orders';
  const customerOrders = state.orders.filter(o => o.userId === user.id);
  $('#dashGrid').innerHTML = `<div class="dash-panel wide"><h3>Your Orders</h3>${renderOrderList(customerOrders)}</div>`;
}
$('#accountBtn').addEventListener('click', () => currentUser()?.role === 'customer' ? $('#dashboard').scrollIntoView({ behavior:'smooth' }) : openAuth());
$('#authClose').addEventListener('click', closeAuth);
$('#authModal').addEventListener('click', e => { if (e.target.id === 'authModal') closeAuth(); });

// Panel switchers
document.addEventListener('click', e => {
  if (e.target.id === 'toRegister')  { e.preventDefault(); setAuthPanel('register'); }
  if (e.target.id === 'toLogin')     { e.preventDefault(); setAuthPanel('login'); }
  if (e.target.id === 'toForgot')    { e.preventDefault(); setAuthPanel('forgot'); }
  if (e.target.id === 'backToLogin') { e.preventDefault(); setAuthPanel('login'); }
});

$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  login(fd.get('email').trim(), fd.get('password'));
});
$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get('email').trim();
  try {
    const data = await api('/api/auth/register', { method:'POST', body:JSON.stringify({ name:fd.get('name').trim(), email, password:fd.get('password') }) });
    state.user = data.user;
    closeAuth();
    updateAccountUi();
    toast('Registration successful. You are now logged in.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});
$('#forgotForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get('email').trim();
  try {
    await api('/api/auth/forgot-password', { method:'POST', body:JSON.stringify({ email }) });
    toast('Password reset link sent! Check your email.', 'success');
    setAuthPanel('login');
  } catch (err) {
    // Even if endpoint doesn't exist yet, show friendly message
    toast('If that email is registered, a reset link has been sent.', 'info');
    setAuthPanel('login');
  }
});

// ============================================
// FIXED: Logout with order cleanup
// ============================================
$('#logoutBtn')?.addEventListener('click', () => {
  api('/api/auth/logout', { method:'POST', body:JSON.stringify({}) }).finally(() => {
    state.user = null;
    state.orders = [];
    updateAccountUi();
    renderDashboard();
    toast('Logged out', 'info');
  });
});

// ----- TOAST -----
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(50%)'; t.style.transition = 'all .4s'; }, 2800);
  setTimeout(() => t.remove(), 3300);
}

// ----- LIVE PURCHASE -----
const FAKE = ['Alex from NYC','Mei from Shanghai','Liam from London','Sara from Paris','Carlos from Madrid','Yuki from Tokyo','Noah from Toronto','Aisha from Dubai'];
function liveNotif() {
  const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const who = FAKE[Math.floor(Math.random() * FAKE.length)];
  const el = $('#liveNotif');
  el.innerHTML = `<img src="${p.img}" alt="" onerror="this.src='/shop/hero-phone.jpg'"><div><b>${who}</b><small>just bought ${p.name}</small></div>`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4500);
}
// Delay live-notif timers until PRODUCTS is loaded
function startLiveNotif() {
  if (PRODUCTS.length === 0) {
    setTimeout(startLiveNotif, 500);
    return;
  }
  setTimeout(liveNotif, 4000);
  setInterval(liveNotif, 16000);
}
startLiveNotif();

// ----- BACK TO TOP -----
$('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

// ============================================
// ADMIN: Set Delivery Fee
// ============================================
window.setDeliveryFee = async function(fee) {
  if (!confirm('Are you sure you want to change the delivery fee?')) return;
  try {
    await api('/api/admin/delivery-fee', { 
      method: 'POST', 
      body: JSON.stringify({ fee: parseInt(fee) }) 
    });
    deliveryFee = parseInt(fee);
    toast(`Delivery fee updated to ${fmt(deliveryFee)}`, 'success');
    updateCartTotals();
  } catch (err) {
    toast('Failed to update delivery fee', 'error');
  }
};

// ============================================
// STORAGE EVENT LISTENERS
// ============================================

window.addEventListener('storage', (e) => {
  if (e.key === 'management_products') {
    console.log('Products updated from management page, refreshing...');
    refreshProducts();
  }
  if (e.key === 'nova_cart') {
    console.log('Cart updated from another page, refreshing...');
    state.cart = load('nova_cart', []);
    renderCart();
    $('#cartCount').textContent = state.cart.reduce((s, c) => s + c.qty, 0);
  }
  if (e.key === 'nova_spare_parts') {
    console.log('Spare parts updated, refreshing cart display...');
    renderCart();
  }
  if (e.key === 'nova_orders') {
    console.log('Orders updated from another page, refreshing...');
    const stored = load('nova_orders', []);
    state.orders = stored;
    renderDashboard();
  }
});

window.addEventListener('products-updated', () => {
  console.log('🎯 Products-updated event received, refreshing...');
  refreshProducts();
});

// ============================================
// FORCE REFRESH FUNCTION (for debugging)
// ============================================
window.forceRefresh = async function() {
  console.log('🔄 Force refreshing all data...');
  localStorage.removeItem('management_products');
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
  await refreshProducts();
  if (state.user) await refreshOrders();
  toast('Data refreshed from server!', 'success');
};

// ============================================
// INIT
// ============================================
(async function initApp() {
  console.log('🚀 Initializing app...');
  
  // NOTE: renderProducts/renderFlash/renderRecent moved after refreshProducts()
  // to avoid "PRODUCTS is not defined" errors on empty array access before load.
  renderCart();
  $('#wishCount').textContent = state.wish.length;
  loadCounties();
  
  try {
    const session = await api('/api/auth/me');
    if (session.user?.role === 'customer') {
      state.user = session.user;
      await refreshOrders();
    }
  } catch (err) {
    console.log('Auth check failed, continuing as guest');
  }
  
  await refreshProducts();
  updateAccountUi();
  console.log('✅ App initialized');
})();

console.log('✅ app.js loaded');
