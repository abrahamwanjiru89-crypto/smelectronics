/* =========================================================
   S.M Dynamics Electronics — Premium electronics storefront (vanilla JS)
========================================================= */
window.DEFAULT_PRODUCTS = [
  { id:'p1', name:'S.M Dynamics Phone 16 Pro', cat:'phones', price:1299, was:1499, rating:4.9, reviews:1283, badge:'hot', img:'/shop/hero-phone.jpg', desc:'A flagship redefined. Titanium frame, 6.7" OLED 120Hz display and the new A18X bionic chip.', specs:{ Display:'6.7" OLED 120Hz', Chip:'A18X Bionic', Storage:'256GB', Camera:'Triple 48MP', Battery:'4800mAh' } },
  { id:'p2', name:'Aura Studio Pro', cat:'audio', price:449, was:549, rating:4.8, reviews:842, badge:'sale', img:'/shop/headphones.jpg', desc:'Reference-grade over-ear with adaptive noise cancellation and 60h battery.', specs:{ Driver:'40mm planar', ANC:'Adaptive', Battery:'60h', Codec:'LDAC/aptX', Weight:'248g' } },
  { id:'p3', name:'S.M Dynamics Book X1', cat:'laptops', price:2199, rating:4.9, reviews:512, badge:'new', img:'/shop/laptop.jpg', desc:'Carbon-fiber chassis, 14" mini-LED, 32GB RAM and 18-hour battery.', specs:{ CPU:'M4 Pro', RAM:'32GB', Storage:'1TB SSD', Display:'14" mini-LED', Battery:'18h' } },
  { id:'p4', name:'Orbit Watch Ultra', cat:'wearables', price:599, was:699, rating:4.7, reviews:301, badge:'sale', img:'/shop/watch.jpg', desc:'Sapphire crystal, dual-frequency GPS and 7-day battery in titanium.', specs:{ Display:'AMOLED 1.9"', GPS:'Dual-band', Battery:'7 days', Water:'10 ATM', Material:'Titanium' } },
  { id:'p5', name:'Vision Lens VR', cat:'gaming', price:899, rating:4.6, reviews:178, badge:'new', img:'/shop/vr.jpg', desc:'4K-per-eye micro-OLED with 120Hz tracking. The future of immersion.', specs:{ Display:'4K per eye', Refresh:'120Hz', Audio:'Spatial', Tracking:'Inside-out', Weight:'420g' } },
  { id:'p6', name:'Echo Buds 3', cat:'audio', price:179, was:229, rating:4.7, reviews:921, badge:'sale', img:'/shop/earbuds.jpg', desc:'Hi-Res certified earbuds with hybrid ANC and 32h total battery.', specs:{ Driver:'11mm dynamic', ANC:'Hybrid', Battery:'32h', Codec:'LHDC', Case:'Wireless charging' } },
  { id:'p7', name:'Lumen R7 Camera', cat:'wearables', price:1499, rating:4.8, reviews:215, img:'/shop/camera.jpg', desc:'45MP full-frame mirrorless with 8K video and AI subject tracking.', specs:{ Sensor:'45MP FF', Video:'8K 60p', ISO:'100-51200', AF:'AI subject', Stabilization:'8-stop IBIS' } },
  { id:'p8', name:'Apex Pad Ultra', cat:'gaming', price:79, rating:4.6, reviews:1502, badge:'hot', img:'/shop/console.jpg', desc:'Pro-grade wireless controller with haptic triggers and RGB.', specs:{ Connectivity:'BT 5.3', Battery:'40h', Triggers:'Hall-effect', RGB:'16M colors', Weight:'280g' } },
  { id:'p9', name:'Glide Tab 12', cat:'laptops', price:899, rating:4.5, reviews:402, img:'/shop/tablet.jpg', desc:'12.4" 2K tablet with pressure-sensitive stylus, perfect for creators.', specs:{ Display:'12.4" 2K 120Hz', Storage:'256GB', Stylus:'Included', Battery:'14h', Speakers:'Quad' } },
  { id:'p10', name:'Pulse Sound 360', cat:'home', price:249, was:299, rating:4.7, reviews:687, badge:'sale', img:'/shop/speaker.jpg', desc:'360° smart speaker with built-in voice assistant and room calibration.', specs:{ Drivers:'5x', Power:'120W', Voice:'Built-in AI', Bass:'Adaptive', Battery:'20h' } },
  { id:'p11', name:'Falcon Drone 4K', cat:'gaming', price:1199, rating:4.8, reviews:243, badge:'new', img:'/shop/drone.jpg', desc:'4K stabilized drone with 40-minute flight time and obstacle avoidance.', specs:{ Camera:'4K 60p', Range:'12km', Flight:'40 min', Obstacle:'6-direction', Weight:'595g' } },
  { id:'p12', name:'Nest Hub Mini', cat:'home', price:129, was:null, rating:4.5, reviews:1109, badge:'', img:'/shop/hub.jpg', desc:'Smart home command center with ambient display and voice control.', specs:{ Display:'7" touch', Voice:'Built-in', Hub:'Matter/Thread', Audio:'Stereo', Camera:'1080p' } },
  { id:'p13', name:'Forge Keyboard RGB', cat:'gaming', price:189, was:229, rating:4.7, reviews:534, badge:'sale', img:'/shop/keyboard.jpg', desc:'Mechanical RGB keyboard with hot-swap switches and aluminum frame.', specs:{ Switches:'Hot-swap', Layout:'87-key TKL', RGB:'Per-key', Connect:'USB-C / BT', Build:'Aluminum' } },
  { id:'r1', name:'Screen Replacement — iPhone 14', cat:'repair', price:7500, was:8600, rating:4.7, reviews:112, badge:'hot', img:'/shop/hero-phone.jpg', desc:'OEM screen replacement with precision installation and full quality testing.', specs:{ Brand:'Apple', Service:'Screen replacement', Warranty:'6 months', Turnaround:'1-2 days' } },
  { id:'r2', name:'Screen Replacement — Galaxy S23', cat:'repair', price:7200, was:8200, rating:4.7, reviews:98, badge:'hot', img:'/shop/hero-phone.jpg', desc:'Fast Samsung Galaxy screen repair with original-grade glass and calibration.', specs:{ Brand:'Samsung', Service:'Screen replacement', Warranty:'6 months', Turnaround:'1-2 days' } },
  { id:'r3', name:'Battery Replacement — Samsung', cat:'repair', price:3500, rating:4.6, reviews:206, img:'/shop/hero-phone.jpg', desc:'High-capacity replacement battery for Samsung phones, including health calibration.', specs:{ Brand:'Samsung', Service:'Battery replacement', Warranty:'3 months', Turnaround:'Same day' } },
  { id:'r4', name:'Charging Port Repair', cat:'repair', price:2200, rating:4.5, reviews:168, img:'/shop/headphones.jpg', desc:'Charging port replacement and cleaning for phones with intermittent power issues.', specs:{ Service:'Charging port', Warranty:'3 months', Turnaround:'1 day' } },
  { id:'r5', name:'Speaker & Mouthpiece Repair', cat:'repair', price:1999, rating:4.5, reviews:154, img:'/shop/earbuds.jpg', desc:'Repair or replacement of loudspeaker and mouthpiece components for clear calls and media.', specs:{ Service:'Speaker / mouthpiece', Warranty:'3 months', Turnaround:'1-2 days' } },
  { id:'r6', name:'Software & Network Support', cat:'repair', price:1900, rating:4.4, reviews:121, img:'/shop/laptop.jpg', desc:'Software fixes, network troubleshooting and system optimization for any phone model.', specs:{ Service:'Software & network', Warranty:'30 days', Turnaround:'Same day' } },
  { id:'r7', name:'Power Switch Repair', cat:'repair', price:2100, rating:4.5, reviews:103, img:'/shop/wristwatch.jpg', desc:'Power button repair for phones that do not turn on or have unresponsive side keys.', specs:{ Service:'Power switch', Warranty:'3 months', Turnaround:'1 day' } },
  { id:'r8', name:'Screen Guard Installation', cat:'repair', price:899, rating:4.6, reviews:131, img:'/shop/watch.jpg', desc:'Professional tempered glass fitting and alignment for maximum screen protection.', specs:{ Service:'Screen guard', Warranty:'30 days', Turnaround:'Same day' } },
  { id:'r9', name:'Screen Cover Installation', cat:'repair', price:1199, rating:4.6, reviews:98, img:'/shop/watch.jpg', desc:'Custom-fit screen covers for phones and tablets with premium clarity and protection.', specs:{ Service:'Screen cover', Warranty:'30 days', Turnaround:'Same day' } },
];
window.PRODUCTS = window.DEFAULT_PRODUCTS.slice();

window.deliveryFee = 600;
window.countySubLocations = [];

function normalizeAreaName(value) {
  return String(value || '').trim().toLowerCase();
}

function getSelectedSubLocation() {
  const value = normalizeAreaName($('#subLocation')?.value);
  if (!value) return null;
  return window.countySubLocations.find(sl => normalizeAreaName(sl.name) === value) || null;
}

window.updateCartTotals = async function() {
  const subtotal = state.cart.reduce((s, c) => s + (window.PRODUCTS.find(p => p.id === c.id)?.price || 0) * c.qty, 0);
  const subLocId = getSelectedSubLocation()?.id;
  // approximate weight: default 0.5kg per item unless product has weight
  const weight = state.cart.reduce((w, c) => w + (window.PRODUCTS.find(p => p.id === c.id)?.weight || 0.5) * c.qty, 0);
  if (subLocId) {
    try {
      const data = await api('/api/delivery/calculate', { method: 'POST', body: JSON.stringify({ subLocationId: subLocId, weight, distanceKm: 0 }) });
      window.deliveryFee = data.fee;
      // optional: if breakdown UI exists, show it
      if (data.breakdown && $('#deliveryBreakdown')) {
        $('#deliveryBreakdown').textContent = `Zone: ${data.breakdown.zone || 'N/A'} · Base ${fmt(data.breakdown.base)} · Weight ${data.breakdown.weight}kg`;
      }
    } catch (e) { window.deliveryFee = 600; }
  } else {
    window.deliveryFee = 600;
  }

  if ($('#deliveryFee')) $('#deliveryFee').textContent = fmt(window.deliveryFee);
  if ($('#cartTotal')) $('#cartTotal').textContent = fmt(subtotal + window.deliveryFee);
};

async function loadCounties() {
  const el = $('#county');
  if (!el) return;
  const data = await api('/api/locations/counties');
  el.innerHTML = '<option value="">Select County</option>' + data.counties.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  el.addEventListener('change', async () => {
    const subEl = $('#subLocation');
    const countyName = el.options[el.selectedIndex]?.text || '';
    if (!el.value) {
      window.countySubLocations = [];
      if (subEl) subEl.value = '';
      const datalist = $('#sublocationsList');
      if (datalist) datalist.innerHTML = '';
      const streetDatalist = $('#streetsList');
      if (streetDatalist) streetDatalist.innerHTML = '';
      window.updateCartTotals();
      return;
    }
    // Load existing DB sublocations first
    const subData = await api(`/api/locations/sublocations?countyId=${el.value}`);
    window.countySubLocations = subData.subLocations || [];
    const datalist = $('#sublocationsList');
    if (datalist) {
      datalist.innerHTML = window.countySubLocations.map(sl => `<option value="${esc(sl.name)}" data-id="${esc(sl.id)}"></option>`).join('');
    }
    if (subEl) subEl.value = '';
    // Keep street suggestions county-aware while sub-location choices come from our database.
    setupPlaceAutocomplete(countyName);
    window.updateCartTotals();
  });
  $('#subLocation')?.addEventListener('change', window.updateCartTotals);
  $('#subLocation')?.addEventListener('input', debounce(window.updateCartTotals, 250));
}

function debounce(fn, wait=300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function setupPlaceAutocomplete(countyName) {
  const streetInput = $('#street');
  const streetDatalist = $('#streetsList');
  if (!streetInput || !streetDatalist) return;

  // Autocomplete for street addresses
  streetInput.removeEventListener('input', streetInput._placeListener || (()=>{}));
  streetInput._placeListener = debounce(async (e) => {
    const q = e.target.value.trim();
    if (!q) return;
    try {
      const res = await api(`/api/places/autocomplete?q=${encodeURIComponent(q)}&type=street&countyName=${encodeURIComponent(countyName)}`);
      const preds = res.predictions || [];
      streetDatalist.innerHTML = preds.map(p => `<option value="${esc(p.description)}"></option>`).join('');
    } catch (err) {
      console.warn('Street autocomplete failed', err);
    }
  }, 250);
  streetInput.addEventListener('input', streetInput._placeListener);
}

async function refreshProducts() {
  const data = await api('/api/products');
  window.PRODUCTS = data.products;
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
}

window.refreshOrders = async function() {
  if (!state.user) return;
  const data = await api('/api/orders/my');
  state.orders = data.orders;
  window.renderDashboard();
};

// ----- PRODUCT RENDER -----
function star(r) { return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)); }

function card(p, opts = {}) {
  const isWish = state.wish.includes(p.id);
  const stockPct = opts.stock || Math.floor(Math.random() * 60 + 20);
  const out = p.inStock === false;
  return `
    <article class="card ${out ? 'out-of-stock' : ''}" data-id="${p.id}">
      <div class="card-media">
        <img src="${p.img}" alt="${p.name}" loading="lazy" width="600" height="600">
        <div class="card-badges">
          ${out ? '<span class="b b-out">Out of Stock</span>' : ''}
          ${p.badge === 'new' ? '<span class="b b-new">New</span>' : ''}
          ${p.badge === 'hot' ? '<span class="b b-hot">Hot</span>' : ''}
          ${p.badge === 'sale' || p.was ? '<span class="b b-sale">-' + Math.round((1 - p.price / (p.was||p.price)) * 100) + '%</span>' : ''}
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
  let list = window.PRODUCTS.slice();
  if (state.filter !== 'all') list = list.filter(p => p.cat === state.filter);
  if (state.sort === 'low') list.sort((a,b) => a.price - b.price);
  if (state.sort === 'high') list.sort((a,b) => b.price - a.price);
  if (state.sort === 'rating') list.sort((a,b) => b.rating - a.rating);
  $('#productGrid').innerHTML = list.map(p => card(p)).join('');
  bindCards($('#productGrid'));
}
function renderFlash() {
  const items = window.PRODUCTS.filter(p => p.was).slice(0, 4);
  $('#flashGrid').innerHTML = items.map(p => card(p, { stock: Math.floor(Math.random() * 60 + 20) })).join('');
  bindCards($('#flashGrid'));
}
function renderRepairServices(query = '') {
  const list = window.PRODUCTS.filter(p => p.cat === 'repair').filter(p => {
    const text = `${p.name} ${p.desc}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });
  $('#repairGrid').innerHTML = list.length
    ? list.map(p => card(p)).join('')
    : '<p class="muted" style="padding:1rem">No repair services match your search. Try a different model, brand, or filter.</p>';
  bindCards($('#repairGrid'));
}
function renderRecent() {
  const list = state.recent.map(id => window.PRODUCTS.find(p => p.id === id)).filter(Boolean);
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
    $('.js-view', c).addEventListener('click', () => window.openModal(id));
    $('.card-media', c).addEventListener('click', () => window.openModal(id));
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
  const p = window.PRODUCTS.find(x => x.id === id);
  if (p?.inStock === false) return toast('This product is out of stock', 'error');
  const item = state.cart.find(c => c.id === id);
  if (item) item.qty++; else state.cart.push({ id, qty: 1 });
  save('nova_cart', state.cart); renderCart();
  toast(`${p.name} added to cart`, 'success');
}
function rmCart(id) { state.cart = state.cart.filter(c => c.id !== id); save('nova_cart', state.cart); renderCart(); }
function setQty(id, q) {
  const it = state.cart.find(c => c.id === id); if (!it) return;
  it.qty = Math.max(1, q); save('nova_cart', state.cart); renderCart();
}
function renderCart() {
  const box = $('#cartItems');
  if (!state.cart.length) { box.innerHTML = '<div class="cart-empty"><div style="font-size:3rem">🛒</div><p>Your cart is empty</p></div>'; }
  else {
    box.innerHTML = state.cart.map(c => {
      const p = window.PRODUCTS.find(x => x.id === c.id); if (!p) return '';
      return `<div class="cart-item">
        <img src="${p.img}" alt="${p.name}">
        <div><div class="ci-title">${p.name}</div><div class="ci-price">${fmt(p.price)}</div>
          <div class="ci-qty"><button data-act="dec" data-id="${p.id}">−</button><span>${c.qty}</span><button data-act="inc" data-id="${p.id}">+</button></div>
        </div>
        <button class="ci-rm" data-act="rm" data-id="${p.id}" aria-label="Remove">✕</button>
    </div>`; // Note: Quantity changes will now trigger updateCartTotals via renderCart
    }).join('');
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, item = state.cart.find(c => c.id === id);
      if (b.dataset.act === 'inc') setQty(id, item.qty + 1);
      if (b.dataset.act === 'dec') setQty(id, item.qty - 1);
      if (b.dataset.act === 'rm') rmCart(id);
    }));
  }
  const total = state.cart.reduce((s, c) => s + (window.PRODUCTS.find(p => p.id === c.id)?.price || 0) * c.qty, 0);
  window.updateCartBadge();
  window.updateCartTotals();
}

$('#checkoutBtn')?.addEventListener('click', async () => {
  if (!state.cart.length) return toast('Cart is empty', 'error');
  const user = currentUser();
  if (!user || user.role !== 'customer') {
    toast('Please login as a customer to place an order', 'error');
    window.openCart(false);
    window.openAuth();
    return;
  }
  const countyId = $('#county').value;
  const subLocationText = $('#subLocation').value.trim();
  const subLocation = getSelectedSubLocation();
  const street = $('#street').value.trim();

  if (!countyId || !subLocationText || !street) {
    return toast('Please fill in your delivery location', 'error');
  }
  if (!subLocation) {
    return toast('Please choose a listed sub-location for the selected county', 'error');
  }

  const subtotal = state.cart.reduce((s, c) => s + (window.PRODUCTS.find(p => p.id === c.id)?.price || 0) * c.qty, 0);
  const total = subtotal + window.deliveryFee;

  const ok = await window.showConfirm(`Your total order amount is ${fmt(total)} including delivery charges (${fmt(window.deliveryFee)}). Do you wish to continue to payment?`);
  if (!ok) return;

  const phone = prompt("Enter M-Pesa Phone Number (e.g., 0712345678):");
  if (!phone || phone.length < 10) return toast("Valid phone number required", "error");

  try {
    // Create order first (status Placed)
    const orderResp = await api('/api/orders', {
      method:'POST',
      body:JSON.stringify({
        items: state.cart,
        county: $('#county option:checked').text(),
        constituency: subLocation.name,
        street,
        depositAmount: total,
        depositMpesa: "MOCK-" + Date.now(),
      })
    });
    const order = orderResp.order;
    // Trigger STK push linked to order
    toast("Sending STK Push...", "info");
    const payResp = await api('/api/payments/stk-push', { method: 'POST', body: JSON.stringify({ phone, amount: total, orderId: order.id }) });

    state.orders.unshift(order);
    toast('STK Push sent. Please complete payment on your phone. We will notify you once payment is confirmed.', 'success');
    state.cart = []; save('nova_cart', state.cart); renderCart(); window.openCart(false);
    window.renderDashboard();
  } catch (err) {
    toast("Checkout failed: " + err.message, 'error');
  }
});

// lightweight confirm modal returning Promise<boolean>
window.showConfirm = function(message, okLabel='Continue to Payment', cancelLabel='Cancel'){
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `<div class="confirm-card"><p>${esc(message)}</p><div class="confirm-actions"><button class="btn ghost cancel">${cancelLabel}</button><button class="btn primary ok">${okLabel}</button></div></div>`;
    document.body.appendChild(modal);
    const cleanup = (v)=>{ modal.remove(); resolve(v); };
    modal.querySelector('.cancel').addEventListener('click', ()=>cleanup(false));
    modal.querySelector('.ok').addEventListener('click', ()=>cleanup(true));
  });
};

// ----- WISHLIST -----
function toggleWish(id, cardEl) {
  const idx = state.wish.indexOf(id);
  if (idx > -1) { state.wish.splice(idx, 1); toast('Removed from wishlist', 'info'); }
  else { state.wish.push(id); toast('Added to wishlist ❤', 'success'); }
  save('nova_wish', state.wish);
  window.updateCartBadge(); // Wish count is part of cart badge logic
  if (cardEl) $('.js-wish', cardEl).classList.toggle('active');
}
$('#wishBtn')?.addEventListener('click', () => toast(state.wish.length ? `${state.wish.length} item(s) in wishlist` : 'Wishlist is empty', 'info'));

// ----- MODAL -----
window.openModal = function(id) {
  const p = window.PRODUCTS.find(x => x.id === id); if (!p) return;
  if (!state.recent.includes(id)) {
    state.recent
window.initApp = async function() {
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
    await refreshProducts();
  } catch (err) {
    toast('Using fallback product data until the server is available', 'error');
  }
  updateAccountUi();

  // Re-initialize particles if the canvas exists and is part of the main content
  const canvas = $('#particles');
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) {
    initParticles(); // Re-initializes W, H, and particles array
    // drawParticles is already called via requestAnimationFrame, so it will continue
  }

  // Re-initialize hero slider
  const slides = $$('.hero-slide');
  const dotsBox = $('.hero-dots');
  if (slides.length && dotsBox) {
    dotsBox.innerHTML = ''; // Clear old dots
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      if (i === 0) b.classList.add('active');
      b.addEventListener('click', () => setSlide(i));
      dotsBox.appendChild(b);
    });
    slideIdx = 0; // Reset slide index
    setSlide(0); // Set initial slide
  }

  // Re-initialize counters
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
  counters.forEach(c => counterObs.observe(c)); // Re-observe elements

  // Re-attach AI form listener (it's inside <main>)
  $('#aiForm')?.removeEventListener('submit', handleAiFormSubmit); // Ensure no duplicate listeners
  $('#aiForm')?.addEventListener('submit', handleAiFormSubmit);
};
