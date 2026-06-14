/* =========================================================
   S.M Dynamics Electronics — Premium electronics storefront (vanilla JS)
   UPDATED: Partial Payment System - Pay delivery fee only upfront
   UPDATED: Spare parts integration from repair page
   FIXED: Cache busting and persistence
========================================================= */

// ----- PRODUCT DATA -----
const DEFAULT_PRODUCTS = [
  { id:'p1', name:'S.M Dynamics Phone 16 Pro', cat:'phones', price:1299, was:1499, rating:4.9, reviews:1283, badge:'hot', img:'/shop/hero-phone.jpg', desc:'A flagship redefined. Titanium frame, 6.7" OLED 120Hz display and the new A18X bionic chip.', specs:{ Display:'6.7" OLED 120Hz', Chip:'A18X Bionic', Storage:'256GB', Camera:'Triple 48MP', Battery:'4800mAh' } },
  { id:'p2', name:'Aura Studio Pro', cat:'audio', price:449, was:549, rating:4.8, reviews:842, badge:'sale', img:'/shop/headphones.jpg', desc:'Reference-grade over-ear with adaptive noise cancellation and 60h battery.', specs:{ Driver:'40mm planar', ANC:'Adaptive', Battery:'60h', Codec:'LDAC/aptX', Weight:'248g' } },
  { id:'p3', name:'S.M Dynamics Book X1', cat:'laptops', price:2199, rating:4.9, reviews:512, badge:'new', img:'/shop/Sm%20dynamic.jpg', desc:'Carbon-fiber chassis, 14" mini-LED, 32GB RAM and 18-hour battery.', specs:{ CPU:'M4 Pro', RAM:'32GB', Storage:'1TB SSD', Display:'14" mini-LED', Battery:'18h' } },
  { id:'p4', name:'Orbit Watch Ultra', cat:'wearables', price:599, was:699, rating:4.7, reviews:301, badge:'sale', img:'/shop/watch.jpg', desc:'Sapphire crystal, dual-frequency GPS and 7-day battery in titanium.', specs:{ Display:'AMOLED 1.9"', GPS:'Dual-band', Battery:'7 days', Water:'10 ATM', Material:'Titanium' } },
  { id:'p5', name:'Vision Lens VR', cat:'gaming', price:899, rating:4.6, reviews:178, badge:'new', img:'/shop/vr.jpg', desc:'4K-per-eye micro-OLED with 120Hz tracking. The future of immersion.', specs:{ Display:'4K per eye', Refresh:'120Hz', Audio:'Spatial', Tracking:'Inside-out', Weight:'420g' } },
  { id:'p6', name:'Echo Buds 3', cat:'audio', price:179, was:229, rating:4.7, reviews:921, badge:'sale', img:'/shop/earbuds.jpg', desc:'Hi-Res certified earbuds with hybrid ANC and 32h total battery.', specs:{ Driver:'11mm dynamic', ANC:'Hybrid', Battery:'32h', Codec:'LHDC', Case:'Wireless charging' } },
  { id:'p7', name:'Lumen R7 Camera', cat:'wearables', price:1499, rating:4.8, reviews:215, img:'/shop/camera.jpg', desc:'45MP full-frame mirrorless with 8K video and AI subject tracking.', specs:{ Sensor:'45MP FF', Video:'8K 60p', ISO:'100-51200', AF:'AI subject', Stabilization:'8-stop IBIS' } },
  { id:'p8', name:'Apex Pad Ultra', cat:'gaming', price:79, rating:4.6, reviews:1502, badge:'hot', img:'/shop/console.jpg', desc:'Pro-grade wireless controller with haptic triggers and RGB.', specs:{ Connectivity:'BT 5.3', Battery:'40h', Triggers:'Hall-effect', RGB:'16M colors', Weight:'280g' } },
  { id:'p9', name:'Glide Tab 12', cat:'laptops', price:899, rating:4.5, reviews:402, img:'/shop/tablet.jpg', desc:'12.4" 2K tablet with pressure-sensitive stylus, perfect for creators.', specs:{ Display:'12.4" 2K 120Hz', Storage:'256GB', Stylus:'Included', Battery:'14h', Speakers:'Quad' } },
  { id:'p10', name:'Pulse Sound 360', cat:'home', price:249, was:299, rating:4.7, reviews:687, badge:'sale', img:'/shop/speaker.jpg', desc:'360° smart speaker with built-in voice assistant and room calibration.', specs:{ Drivers:'5x', Power:'120W', Voice:'Built-in AI', Bass:'Adaptive', Battery:'20h' } },
  { id:'p11', name:'Falcon Drone 4K', cat:'gaming', price:1199, rating:4.8, reviews:243, badge:'new', img:'/shop/drone.jpg', desc:'4K stabilized drone with 40-minute flight time and obstacle avoidance.', specs:{ Camera:'4K 60p', Range:'12km', Flight:'40 min', Obstacle:'6-direction', Weight:'595g' } },
  { id:'p12', name:'Nest Hub Mini', cat:'home', price:129, rating:4.5, reviews:1109, img:'/shop/hub.jpg', desc:'Smart home command center with ambient display and voice control.', specs:{ Display:'7" touch', Voice:'Built-in', Hub:'Matter/Thread', Audio:'Stereo', Camera:'1080p' } },
  { id:'p13', name:'Forge Keyboard RGB', cat:'gaming', price:189, was:229, rating:4.7, reviews:534, badge:'sale', img:'/shop/keyboard.jpg', desc:'Mechanical RGB keyboard with hot-swap switches and aluminum frame.', specs:{ Switches:'Hot-swap', Layout:'87-key TKL', RGB:'Per-key', Connect:'USB-C / BT', Build:'Aluminum' } },
];

let PRODUCTS = DEFAULT_PRODUCTS.slice();

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
  // DEPRECATED: This function now only serves as offline fallback
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
  
  // Add cache-busting parameter
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
// UPDATED: CHECKOUT MODAL - Partial Payment (Only Delivery Fee)
// ============================================
function showCheckoutModal(subtotal, deliveryFeeAmount, onConfirm) {
  const existingModal = document.querySelector('.checkout-modal');
  if (existingModal) existingModal.remove();
  
  const total = subtotal + deliveryFeeAmount;
  const remainingAmount = subtotal;
  
  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `
    <div class="checkout-card">
      <h3>💰 Payment Summary</h3>
      <div class="details" style="text-align: left;">
        <p><strong>Subtotal:</strong> ${fmt(subtotal)}</p>
        <p><strong>Delivery Fee (Pay Now):</strong> <span style="color: #00e5ff;">${fmt(deliveryFeeAmount)}</span></p>
        <p><strong>Remaining on Delivery:</strong> ${fmt(remainingAmount)}</p>
        <hr style="margin: 1rem 0; border-color: rgba(255,255,255,0.1);">
        <p style="font-size: 0.85rem;">✅ You will only pay the delivery fee now via M-Pesa</p>
        <p style="font-size: 0.85rem;">📦 The remaining amount (${fmt(remainingAmount)}) will be paid when you receive your product</p>
        <div style="margin-top:1rem;">
          <label for="mpesaPhoneInput" style="display:block; font-size:0.85rem; margin-bottom:0.35rem;">M-Pesa Phone Number</label>
          <input type="tel" id="mpesaPhoneInput" placeholder="e.g. 0712345678" class="input" style="width:100%; padding:0.6rem 0.75rem; border-radius:0.5rem; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:inherit;">
          <p class="checkout-error" style="color:#ff4d6d; font-size:0.8rem; margin-top:0.35rem; display:none;"></p>
        </div>
      </div>
      <div class="checkout-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Pay Delivery Fee (${fmt(deliveryFeeAmount)})</button>
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
  const phoneInput = modal.querySelector('#mpesaPhoneInput');
  const errorEl = modal.querySelector('.checkout-error');

  confirmBtn.addEventListener('click', async () => {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 10) {
      errorEl.textContent = 'Please enter a valid M-Pesa phone number';
      errorEl.style.display = 'block';
      phoneInput.focus();
      return;
    }
    errorEl.style.display = 'none';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    if (onConfirm) await onConfirm(phone, modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  });
}

function showOrderSuccessModal(order, deliveryFee, remaining) {
  const existing = document.querySelector('.checkout-modal');
  if (existing) { existing.classList.remove('show'); setTimeout(() => existing.remove(), 300); }

  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `
    <div class="checkout-card">
      <h3>✅ Order Placed!</h3>
      <div class="details" style="text-align: left;">
        <p><strong>Order ID:</strong> ${esc(order.id)}</p>
        <p><strong>Delivery fee paid:</strong> <span style="color:#00e5ff;">${fmt(deliveryFee)}</span></p>
        <p><strong>Remaining on delivery:</strong> ${fmt(remaining)}</p>
        <hr style="margin: 1rem 0; border-color: rgba(255,255,255,0.1);">
        <p style="font-size: 0.85rem;">📲 Check your phone for the M-Pesa prompt to complete the delivery fee payment.</p>
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
  const subLocId = getSelectedSubLocation()?.id;
  const weight = state.cart.reduce((w, c) => {
    const p = getProductWithSpares(c.id);
    return w + (p?.weight || 0.5) * c.qty;
  }, 0);
  
  if (subLocId) {
    try {
      const data = await api('/api/delivery/calculate', { method: 'POST', body: JSON.stringify({ subLocationId: subLocId, weight, distanceKm: 0 }) });
      deliveryFee = data.fee;
      if (data.breakdown && $('#deliveryBreakdown')) {
        $('#deliveryBreakdown').textContent = `Zone: ${data.breakdown.zone || 'N/A'} · Base ${fmt(data.breakdown.base)} · Weight ${data.breakdown.weight}kg`;
      }
    } catch (e) { deliveryFee = 600; }
  } else {
    deliveryFee = 600;
  }

  if ($('#deliveryFee')) $('#deliveryFee').textContent = fmt(deliveryFee);
  
  updateCartFooter(subtotal);
}

function updateCartFooter(subtotal) {
  const cartFooter = $('.cart-foot');
  if (cartFooter) {
    const total = subtotal + deliveryFee;
    const remainingOnDelivery = subtotal;
    
    cartFooter.innerHTML = `
      <div class="cart-total">
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Subtotal:</span>
            <b>${fmt(subtotal)}</b>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Delivery Fee (Pay Now):</span>
            <b style="color: #00e5ff;">${fmt(deliveryFee)}</b>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <span>Remaining on Delivery:</span>
            <b>${fmt(remainingOnDelivery)}</b>
          </div>
        </div>
        <div style="background: rgba(0,229,255,0.1); padding: 0.75rem; border-radius: 0.75rem; margin-top: 0.5rem;">
          <small>💡 You only pay delivery fee (${fmt(deliveryFee)}) now. The remaining ${fmt(remainingOnDelivery)} will be paid when you receive your product.</small>
        </div>
      </div>
      <button class="btn primary block" id="checkoutBtn">Pay Delivery Fee & Place Order</button>
    `;
    
    const newCheckoutBtn = document.getElementById('checkoutBtn');
    if (newCheckoutBtn) {
      newCheckoutBtn.addEventListener('click', handleCheckout);
    }
  }
}

// ============================================
// UPDATED: CHECKOUT HANDLER - Partial Payment
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
  
  const countyId = $('#county').value;
  const subLocationText = $('#subLocation').value.trim();
  const subLocation = getSelectedSubLocation();
  const street = $('#street').value.trim();
  
  if (!countyId || !subLocationText || !street) {
    toast('Please fill in your delivery location', 'error');
    return;
  }
  if (!subLocation) {
    toast('Please choose a listed sub-location for the selected county', 'error');
    return;
  }

  const subtotal = state.cart.reduce((s, c) => {
    const p = getProductWithSpares(c.id);
    return s + (p?.price || 0) * c.qty;
  }, 0);
  const total = subtotal + deliveryFee;

  showCheckoutModal(subtotal, deliveryFee, async (phone, modal) => {
    try {
      const orderResp = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          county: $('#county option:checked')?.textContent || '',
          constituency: subLocation.name,
          street,
          depositAmount: deliveryFee,
          depositMpesa: "MOCK-" + Date.now(),
        })
      });
      const order = orderResp.order;

      state.orders.unshift(order);
      state.cart = [];
      save('nova_cart', state.cart);
      renderCart();

      openCart(false);
      showOrderSuccessModal(order, deliveryFee, subtotal);
      renderDashboard();

      try {
        await api('/api/payments/stk-push', {
          method: 'POST',
          body: JSON.stringify({
            phone,
            amount: deliveryFee,
            orderId: order.id,
            paymentType: 'delivery_fee'
          })
        });
        toast(`✅ M-Pesa prompt sent for ${fmt(deliveryFee)}`, 'success');
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
        confirmBtn.textContent = `Pay Delivery Fee (${fmt(deliveryFee)})`;
      }
    }
  });
}

// ============================================
// FIXED: loadCounties with immediate fallback
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
// refreshProducts — server is always the source of truth
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
      PRODUCTS = DEFAULT_PRODUCTS.slice();
    }
  }
  
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
}

async function refreshOrders() {
  if (!state.user) return;
  try {
    const data = await api('/api/orders/my');
    state.orders = data.orders;
    renderDashboard();
  } catch (err) {
    console.error('Failed to refresh orders:', err);
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
function openAuth() {
  $('#authModal').classList.add('open');
  $('#overlay').classList.add('show');
}
function closeAuth() {
  $('#authModal').classList.remove('open');
  $('#overlay').classList.remove('show');
  $('#loginForm').reset();
  $('#registerForm').reset();
  setAuthTab('login');
}
function setAuthTab(tab) {
  $$('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
  $('#loginForm').hidden = tab !== 'login';
  $('#registerForm').hidden = tab !== 'register';
}
function updateAccountUi() {
  const user = currentUser();
  const customer = user?.role === 'customer' ? user : null;
  $('#accountLabel').textContent = customer ? `Customer: ${customer.name.split(' ')[0]}` : 'Login';
  $('#dashboard').hidden = !customer;
  if (customer) renderDashboard();
}
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
    await refreshOrders();
    toast(successMessage, 'success');
    $('#dashboard').scrollIntoView({ behavior:'smooth' });
  } catch (err) {
    toast(err.message, 'error');
  }
}
function renderOrderList(orders, mode = 'user') {
  if (!orders.length) return '<div class="dash-empty">No orders yet.</div>';
  return orders.map(order => `
    <article class="order-row">
      <div>
        <b>${esc(order.id)}</b>
        <span>${new Date(order.createdAt).toLocaleString()}</span>
        ${mode !== 'user' ? `<small>${esc(order.customer)} · ${esc(order.email)}</small>` : ''}
      </div>
      <div class="order-items">
        ${order.items.map(i => `${esc(i.name)} x${i.qty}`).join('<br>')}
        <div class="order-meta"><small>Location: ${esc(order.location.county)}, ${esc(order.location.constituency)} · ${esc(order.location.street)}</small></div>
        <div class="order-meta"><small>Deposit: ${fmt(order.depositAmount)} · MPesa: ${esc(order.depositMpesa)}</small></div>
        ${order.deliveryDate ? `<div class="order-meta"><small>Delivery: ${esc(order.deliveryDate)}</small></div>` : ''}
      </div>
      <div><b>${fmt(order.total)}</b><span class="status ${order.status.toLowerCase()}">${esc(order.status)}</span></div>
    </article>`).join('');
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
$$('.auth-tabs button').forEach(b => b.addEventListener('click', () => setAuthTab(b.dataset.authTab)));
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
$('#logoutBtn').addEventListener('click', () => {
  api('/api/auth/logout', { method:'POST', body:JSON.stringify({}) }).finally(() => {
    state.user = null;
    state.orders = [];
    updateAccountUi();
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
setTimeout(liveNotif, 4000);
setInterval(liveNotif, 16000);

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
  toast('Data refreshed from server!', 'success');
};

// ============================================
// INIT
// ============================================
(async function initApp() {
  console.log('🚀 Initializing app...');
  
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
  $('#wishCount').textContent = state.wish.length;
  loadCounties();
  
  try {
    const feeData = await api('/api/delivery-fee');
    if (feeData && feeData.fee) {
      deliveryFee = feeData.fee;
      updateCartTotals();
    }
  } catch (err) {
    console.log('Using default delivery fee');
  }
  
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
