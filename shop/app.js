/* =========================================================
   S.M Dynamics Electronics — Premium electronics storefront (vanilla JS)
   FIXED: Orders persistence after logout
   FIXED: Simplified location entry (manual input)
   ADDED: Delivery date display on customer dashboard
   REMOVED: Default products - only server products
   FIXED: Image handling with placeholders
========================================================= */

// ----- Helper function for images -----
function getImageUrl(imgPath) {
    if (!imgPath) return null;
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        return imgPath;
    }
    if (imgPath.startsWith('/')) {
        return imgPath;
    }
    return null;
}

// Placeholder SVG for missing images
const PLACEHOLDER_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect width="300" height="300" fill="%231a1a2e"/%3E%3Ctext x="150" y="150" font-size="14" text-anchor="middle" fill="%23666" font-family="Arial"%3ENo Image%3C/text%3E%3C/svg%3E';

// ----- PRODUCT DATA -----
// Products are loaded from server API. No hardcoded defaults.
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

function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const fmt = n => 'KES ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
const currentUser = () => state.user;

let deliveryFee = 200;

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

// ============================================
// SPARE PARTS INTEGRATION
// ============================================

function getProductWithSpares(productId) {
    let product = PRODUCTS.find(p => p.id === productId);
    if (product) return product;
    
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
// SIMPLIFIED LOCATION - Manual entry only
// ============================================

function loadCounties() {
  const el = $('#county');
  if (!el) return;
  
  const counties = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Uasin Gishu', 
    'Machakos', 'Kajiado', 'Baringo', 'Bomet', 'Bungoma', 'Busia', 
    'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 
    'Kakamega', 'Kericho', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kitui', 
    'Kwale', 'Laikipia', 'Lamu', 'Makueni', 'Mandera', 'Marsabit', 
    'Meru', 'Migori', 'Muranga', 'Narok', 'Nyamira', 'Nyandarua', 
    'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 
    'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Vihiga', 'Wajir', 'West Pokot'
  ];
  
  el.innerHTML = '<option value="">Select County</option>' + 
    counties.map(c => `<option value="${c}">${c}</option>`).join('');
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
  const county = $('#county').value;
  const constituency = $('#constituency')?.value.trim() || '';
  const street = $('#street').value.trim();
  
  if (!phone || phone.length < 10) {
    toast('Please enter your M-Pesa phone number', 'error');
    $('#customerPhone')?.focus();
    return;
  }
  if (!county || !street) {
    toast('Please fill in your delivery location (County and Street/Area)', 'error');
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
          county: county,
          constituency: constituency,
          street: street,
          depositMpesa: "MPESA-" + Date.now(),
        })
      });
      const order = orderResp.order;

      state.orders.unshift(order);
      state.cart = [];
      save('nova_cart', state.cart);
      renderCart();
      openCart(false);
      showOrderSuccessModal(order);
      renderDashboard();

      toast(`✅ Order ${order.id} placed successfully!`, 'success');
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
      newCheckoutBtn.addEventListener('click', handleCheckout);
    }
  }
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
      PRODUCTS = [];
      console.log('📦 No products found on server');
      localStorage.removeItem('management_products');
    }
  } catch (err) {
    console.error('❌ Failed to refresh products from server:', err);
    const stored = localStorage.getItem('management_products');
    if (stored && JSON.parse(stored).length > 0) {
      PRODUCTS = JSON.parse(stored);
      console.log('📦 Using localStorage products (server offline)');
    } else {
      PRODUCTS = [];
      console.log('📦 No products available - please add products in management panel');
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
    state.orders = data.orders || [];
    save('nova_orders', state.orders);
    renderDashboard();
  } catch (err) {
    console.error('Failed to refresh orders:', err);
    const stored = load('nova_orders', []);
    state.orders = stored;
    renderDashboard();
  }
}

// ============================================
// CART FUNCTIONS
// ============================================
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

// ============================================
// RENDER FUNCTIONS
// ============================================
function star(r) { return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)); }

function card(p, opts = {}) {
  const isWish = state.wish.includes(p.id);
  const stockPct = opts.stock || Math.floor(Math.random() * 60 + 20);
  const out = p.inStock === false;
  const imgSrc = getImageUrl(p.img) || PLACEHOLDER_SVG;
  
  return `
    <article class="card ${out ? 'out-of-stock' : ''}" data-id="${p.id}">
      <div class="card-media">
        <img src="${imgSrc}" alt="${p.name}" loading="lazy" width="600" height="600" onerror="this.src='${PLACEHOLDER_SVG}'">
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
  
  if (list.length === 0) {
    $('#productGrid').innerHTML = `
      <div class="no-products-message" style="text-align: center; padding: 3rem; grid-column: 1 / -1;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🛍️</div>
        <h3 style="color: #00e5ff;">No Products Yet</h3>
        <p style="color: #888;">Products will appear here once added by the admin.</p>
        <a href="management.html" class="btn primary" style="margin-top: 1rem; display: inline-block;">Go to Management Panel</a>
      </div>
    `;
    return;
  }
  
  $('#productGrid').innerHTML = list.map(p => card(p)).join('');
  bindCards($('#productGrid'));
}

function renderFlash() {
  const items = PRODUCTS.filter(p => p.was).slice(0, 4);
  if (items.length === 0) {
    $('#flashGrid').innerHTML = `
      <div class="no-products-message" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
        <p style="color: #888;">No flash sale items at the moment.</p>
      </div>
    `;
    return;
  }
  $('#flashGrid').innerHTML = items.map(p => card(p, { stock: Math.floor(Math.random() * 60 + 20) })).join('');
  bindCards($('#flashGrid'));
}

function renderRecent() {
  const list = state.recent.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  if (!list.length) {
    $('#recentSection').hidden = true;
    return;
  }
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

function renderCart() {
  const box = $('#cartItems');
  if (!state.cart.length) { 
    box.innerHTML = '<div class="cart-empty"><div style="font-size:3rem">🛒</div><p>Your cart is empty</p></div>'; 
  } else {
    box.innerHTML = state.cart.map(c => {
      const p = getProductWithSpares(c.id);
      if (!p) return '';
      const imgSrc = getImageUrl(p.img) || PLACEHOLDER_SVG;
      return `<div class="cart-item">
        <img src="${imgSrc}" alt="${p.name}" onerror="this.src='${PLACEHOLDER_SVG}'">
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

// ============================================
// WISHLIST
// ============================================
function toggleWish(id, cardEl) {
  const idx = state.wish.indexOf(id);
  if (idx > -1) { state.wish.splice(idx, 1); toast('Removed from wishlist', 'info'); }
  else { state.wish.push(id); toast('Added to wishlist ❤', 'success'); }
  save('nova_wish', state.wish);
  $('#wishCount').textContent = state.wish.length;
  if (cardEl) $('.js-wish', cardEl).classList.toggle('active');
}

// ============================================
// MODAL
// ============================================
function openModal(id) {
  const p = getProductWithSpares(id);
  if (!p) return;
  if (!state.recent.includes(id)) {
    state.recent.unshift(id); state.recent = state.recent.slice(0, 6); save('nova_recent', state.recent);
    renderRecent();
  }
  const imgs = [p.img, p.img, p.img];
  const imgSrc = getImageUrl(p.img) || PLACEHOLDER_SVG;
  $('#modalCard').innerHTML = `
    <button class="modal-close" aria-label="Close">✕</button>
    <div class="modal-inner">
      <div class="modal-media">
        <img id="mImg" src="${imgSrc}" alt="${p.name}" onerror="this.src='${PLACEHOLDER_SVG}'">
        <div class="modal-thumbs">${imgs.map((i, k) => `<button class="${k===0?'active':''}" data-src="${getImageUrl(i) || PLACEHOLDER_SVG}"><img src="${getImageUrl(i) || PLACEHOLDER_SVG}" alt="" onerror="this.src='${PLACEHOLDER_SVG}'"></button>`).join('')}</div>
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

// ============================================
// DASHBOARD with Delivery Date
// ============================================
function renderOrderList(orders) {
  if (!orders.length) return '<div class="dash-empty">No orders yet.</div>';
  return orders.map(order => {
    const dfStatus = order.deliveryFeeSet
      ? `<span style="color:#00c853;">🚚 Delivery Fee: ${fmt(order.deliveryFee)}</span>`
      : `<span style="color:#ffb300;">⏳ Delivery fee pending — our team will contact you</span>`;
    
    const deliveryDate = order.deliveryDate
      ? `<span style="color:#00e5ff;">📅 Estimated Delivery: ${new Date(order.deliveryDate).toLocaleDateString()}</span>`
      : '';
    
    const latestNotif = order.notifications && order.notifications.length
      ? `<div class="order-meta" style="margin-top:0.35rem; background:rgba(0,229,255,0.07); border-radius:0.5rem; padding:0.4rem 0.6rem;"><small>📬 ${esc(order.notifications[0].message)}</small></div>`
      : '';
    
    return `
    <article class="order-row">
      <div>
        <b>${esc(order.id)}</b>
        <span>${new Date(order.createdAt).toLocaleString()}</span>
      </div>
      <div class="order-items">
        ${order.items.map(i => `${esc(i.name)} x${i.qty}`).join('<br>')}
        <div class="order-meta"><small>📍 ${esc(order.location?.county || '')}, ${esc(order.location?.constituency || '')} · ${esc(order.location?.street || '')}</small></div>
        <div class="order-meta"><small>💰 Paid: ${fmt(order.total)} · Ref: ${esc(order.depositMpesa || 'N/A')}</small></div>
        <div class="order-meta" style="margin-top:0.25rem;">${dfStatus}</div>
        ${deliveryDate ? `<div class="order-meta" style="margin-top:0.25rem;">${deliveryDate}</div>` : ''}
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

// ============================================
// AUTH
// ============================================
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

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', () => {
  setTimeout(() => $('#loader')?.classList.add('hide'), 600);
});

addEventListener('scroll', () => {
  $('#nav').classList.toggle('scrolled', scrollY > 20);
  $('#toTop').classList.toggle('show', scrollY > 600);
}, { passive: true });

// Theme
const savedTheme = localStorage.getItem('nova_theme') || 'dark';
document.documentElement.dataset.theme = savedTheme;
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('nova_theme', next);
  toast(`Switched to ${next} mode`, 'info');
});

// Mobile menu
$('#menuToggle').addEventListener('click', e => {
  e.currentTarget.classList.toggle('open');
  $('#mobileMenu').classList.toggle('open');
});
$$('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
  $('#menuToggle').classList.remove('open');
  $('#mobileMenu').classList.remove('open');
}));

// Search
const searchPanel = $('#searchPanel');
$('#searchBtn').addEventListener('click', () => { searchPanel.classList.toggle('open'); $('#searchInput').focus(); });
$('#searchClose').addEventListener('click', () => searchPanel.classList.remove('open'));
addEventListener('keydown', e => { if (e.key === 'Escape') searchPanel.classList.remove('open'); });
$('#searchInput').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  const r = $('#searchResults');
  if (!q) { r.innerHTML = ''; return; }
  const hits = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.cat.includes(q)).slice(0, 8);
  r.innerHTML = hits.length ? hits.map(p => {
    const imgSrc = getImageUrl(p.img) || PLACEHOLDER_SVG;
    return `
    <button class="sr-item" data-id="${p.id}">
      <img src="${imgSrc}" alt="${p.name}" loading="lazy" onerror="this.src='${PLACEHOLDER_SVG}'">
      <div><div>${p.name}</div><small>${fmt(p.price)} · ${p.cat}</small></div>
    </button>`;
  }).join('') : '<p class="muted" style="padding:1rem">No matches.</p>';
  r.querySelectorAll('.sr-item').forEach(b => b.addEventListener('click', () => { openModal(b.dataset.id); searchPanel.classList.remove('open'); }));
});

// Cart buttons
$('#cartBtn').addEventListener('click', () => openCart(true));
$('#cartClose').addEventListener('click', () => openCart(false));
$('#cartClear')?.addEventListener('click', clearCart);
$('#overlay').addEventListener('click', () => { openCart(false); closeModal(); closeAuth(); });

$('#wishBtn').addEventListener('click', () => toast(state.wish.length ? `${state.wish.length} item(s) in wishlist` : 'Wishlist is empty', 'info'));

// Auth buttons
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

// Filters/Sort
$$('.chip').forEach(c => c.addEventListener('click', () => {
  $$('.chip').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  state.filter = c.dataset.cat;
  renderProducts();
}));
$('#sortBy').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });

// Live purchase
const FAKE = ['Alex from NYC','Mei from Shanghai','Liam from London','Sara from Paris','Carlos from Madrid','Yuki from Tokyo'];
function liveNotif() {
  if (PRODUCTS.length === 0) return;
  const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const who = FAKE[Math.floor(Math.random() * FAKE.length)];
  const el = $('#liveNotif');
  if (!el) return;
  const imgSrc = getImageUrl(p.img) || PLACEHOLDER_SVG;
  el.innerHTML = `<img src="${imgSrc}" alt="" onerror="this.src='${PLACEHOLDER_SVG}'"><div><b>${who}</b><small>just bought ${p.name}</small></div>`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4500);
}
setTimeout(liveNotif, 4000);
setInterval(liveNotif, 16000);

// Back to top
$('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

// Newsletter
$('#nlForm').addEventListener('submit', e => { e.preventDefault(); e.target.reset(); toast('Subscribed! Welcome ✨', 'success'); });

// Storage events
window.addEventListener('storage', (e) => {
  if (e.key === 'management_products') refreshProducts();
  if (e.key === 'nova_cart') {
    state.cart = load('nova_cart', []);
    renderCart();
    $('#cartCount').textContent = state.cart.reduce((s, c) => s + c.qty, 0);
  }
});
window.addEventListener('products-updated', () => refreshProducts());

// Initialize
(async function initApp() {
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
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
})();

function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(50%)'; t.style.transition = 'all .4s'; }, 2800);
  setTimeout(() => t.remove(), 3300);
}
