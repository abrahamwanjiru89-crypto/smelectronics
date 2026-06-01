const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
let manager = null;
let offlineManager = false;
let orders = [];
let products = [];
let staff = [];
let repairBookings = [];
let repairServices = [];
let spareParts = [];
let technicians = [];
let repairCategories = [];
let counties = [];
let subLocations = [];
let deliveryZones = [];
let deliveryRates = [];

const LOADING = {
  orders: '<p class="muted" style="padding:1rem">Fetching orders...</p>',
  bookings: '<p class="muted" style="padding:1rem">Loading repair bookings...</p>',
  products: '<p class="muted" style="padding:1.25rem">Loading products...</p>',
  staff: '<p class="muted" style="padding:1rem">Loading staff accounts...</p>',
  spares: '<p class="muted" style="padding:1rem">Loading inventory...</p>'
};

const OFFLINE_MANAGER = { id:'local-admin', name:'Offline Admin', role:'admin' };
const DUMMY_ORDERS = [{ id:'ORD-0001', customer:'Local Admin', email:'admin@local', createdAt:new Date().toISOString(), items:[{name:'Demo product', qty:1}], total:0 }];
const DUMMY_PRODUCTS = [{ id:'prod-0001', name:'Demo Product', cat:'phones', price:999, was:1199, rating:4.5, reviews:76, img:'/shop/hero-phone.jpg', desc:'This is a local demo product for the management dashboard.' }];
const DUMMY_STAFF = [{ id:'staff-0001', name:'Staff Member', email:'staff@local' }];
const DUMMY_REPAIR_BOOKINGS = [{ id:'BKG-0001', name:'Jane Doe', email:'jane@local', brand:'Samsung', model:'Galaxy S23', repairType:'Screen repair', pickupDropoff:'Dropoff', status:'Pending', repairServiceTitle:'Screen Replacement' }];
const DUMMY_REPAIR_SERVICES = [{ id:'svc-0001', title:'Screen Replacement', brand:'Samsung', repairType:'Screen repair', price:4500, available:true }];
const DUMMY_TECHNICIANS = [{ id:'tech-0001', name:'Alex Mwangi', email:'alex@local' }];
const DUMMY_REPAIR_CATEGORIES = [{ id:'cat-0001', name:'Phones' }];
const DUMMY_COUNTIES = [{ id:'c-0001', name:'Nairobi' }];
const DUMMY_SUB_LOCATIONS = [{ id:'sl-0001', countyId:'c-0001', name:'Westlands', deliveryZoneId:'dz-0001' }];
const DUMMY_DELIVERY_ZONES = [{ id:'dz-0001', name:'Nairobi Central', description:'Central areas of Nairobi' }];
const DUMMY_DELIVERY_RATES = [{ id:'dr-0001', deliveryZoneId:'dz-0001', baseFee:300 }];
const DUMMY_ANALYTICS = { totalSales:0, totalOrders:0, delivered:0, products:1, days:[
  { label:'Mon', sales:0, orders:0 },
  { label:'Tue', sales:0, orders:0 },
  { label:'Wed', sales:0, orders:0 },
  { label:'Thu', sales:0, orders:0 },
  { label:'Fri', sales:0, orders:0 },
  { label:'Sat', sales:0, orders:0 },
  { label:'Sun', sales:0, orders:0 }
]};

const fmt = n => 'Kshs ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 });
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

async function api(path, options = {}) {
  let res;
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    res = await fetch(path, {
      credentials: 'include',
      method: options.method || 'GET',
      body: options.body,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    });
  } catch (err) {
    const error = new Error(err.message || 'Network request failed');
    error.network = true;
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type='info') {
  const t = document.createElement('div');
  const container = $('#toasts');
  if (!container) return console.log(`Toast (${type}): ${msg}`);
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(50%)'; t.style.transition = 'all .4s'; }, 2800);
  setTimeout(() => t.remove(), 3300);
}

function renderPlacedOrders() {
  const el = $('#placedOrders');
  if (!el) return;
  el.innerHTML = (orders && orders.length) ? orders.map(order => {
    const loc = order.location || {};
    return `
    <article class="order-row manager-order">
      <div>
        <b>${esc(order.id)}</b> <span class="status ${esc(order.paymentStatus.toLowerCase())}">${esc(order.paymentStatus)}</span>
        <span>${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date Unknown'}</span>
        <small>${esc(order.customer)} · ${esc(order.email)}</small>
      </div>
      <div class="order-items">
        ${(order.items || []).map(item => `${esc(item.name)} x${item.qty}`).join('<br>')}
        <div class="order-meta">
           <small>Location: ${esc(loc.county || 'N/A')}, ${esc(loc.constituency || 'N/A')} · ${esc(loc.street || 'N/A')}</small>
        </div> <!-- This needs to be updated to show sub-location name -->
      </div>
      <div>
        <b>${fmt(order.total)}</b>
        <span class="status ${esc(order.status.toLowerCase())}">${esc(order.status)}</span>
      </div>
    </article>`;
  }).join('') : '<div class="dash-empty">No placed orders yet.</div>';
}

function renderStaff() {
  const el = $('#staffList');
  if (!el) return;
  el.innerHTML = (staff && staff.length) ? staff.map(user => `
    <article class="staff-row">
      <div><b>${esc(user.name)}</b><span>${esc(user.email)}</span></div>
      <button class="btn ghost js-delete-staff" data-id="${user.id}" type="button">Delete</button>
    </article>`).join('') : '<div class="dash-empty">No staff accounts yet.</div>';

  $$('.js-delete-staff').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/api/admin/staff/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadAdminData();
      toast('Staff account deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

function renderProducts() {
  const el = $('#productAdmin');
  if (!el) return;
  el.innerHTML = products.map(product => `
    <form class="product-row" data-product="${product.id}" enctype="multipart/form-data">
      <img src="${product.img}" alt="">
      <input name="name" value="${esc(product.name)}" aria-label="Product name" required>
      <select name="cat" aria-label="Category">
        <option value="phones" ${product.cat === 'phones' ? 'selected' : ''}>Phones</option>
        <option value="audio" ${product.cat === 'audio' ? 'selected' : ''}>Audio</option>
        <option value="laptops" ${product.cat === 'laptops' ? 'selected' : ''}>Laptops</option>
        <option value="wearables" ${product.cat === 'wearables' ? 'selected' : ''}>Wearables</option>
        <option value="gaming" ${product.cat === 'gaming' ? 'selected' : ''}>Gaming</option>
        <option value="home" ${product.cat === 'home' ? 'selected' : ''}>Smart Home</option>
        <option value="repair" ${product.cat === 'repair' ? 'selected' : ''}>Repairs</option>
      </select>
      <input name="price" type="number" min="0" value="${product.price}" aria-label="Price" required>
      <input name="img" type="file" accept="image/*" aria-label="Product image">
      <select name="inStock" aria-label="Stock status">
        <option value="true" ${product.inStock === false ? '' : 'selected'}>In Stock</option>
        <option value="false" ${product.inStock === false ? 'selected' : ''}>Out of Stock</option>
      </select>
      <button class="btn ghost" type="submit">Update</button>
      <button class="btn ghost danger-btn js-delete-product" type="button" data-id="${product.id}">Delete</button>
    </form>`).join('');

  $$('.product-row').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api(`/api/admin/products/${encodeURIComponent(form.dataset.product)}`, {
        method:'PUT',
        body: fd
      });
      await loadAdminData();
      toast('Product updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));

  $$('.js-delete-product').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/api/admin/products/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadAdminData();
      toast('Product deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function renderRepairBookings() {
  const el = $('#repairBookings');
  if (!el) return;
  el.innerHTML = (repairBookings && repairBookings.length) ? repairBookings.map(booking => `
    <article class="order-row manager-order">
      <div>
        <b>${esc(booking.id)}</b>
        <span>${formatDate(booking.createdAt)}</span>
        <small>${esc(booking.customer || booking.name)} · ${esc(booking.email)}</small>
      </div>
      <div>
        <small>${esc(booking.brand)} ${esc(booking.model)} · ${esc(booking.repairType)}</small>
        <small>${esc(booking.pickupDropoff)} · ${esc(booking.status)}</small>
        <small>${esc(booking.repairServiceTitle || 'Custom repair')}</small>
      </div>
      <div>
        <button class="btn ghost js-update-booking" type="button" data-id="${esc(booking.id)}">Update</button>
      </div>
    </article>
  `).join('') : '<div class="dash-empty">No repair bookings found.</div>';
}

function renderRepairServices() {
  const el = $('#repairServiceAdmin');
  if (!el) return;
  el.innerHTML = (repairServices && repairServices.length) ? repairServices.map(service => `
    <article class="product-row" data-service="${esc(service.id)}">
      <div>
        <strong>${esc(service.title)}</strong>
        <small>${esc(service.brand)} · ${esc(service.repairType)}</small>
      </div>
      <div>
        <span>${fmt(service.price)}</span>
        <span>${service.available ? 'Available' : 'Unavailable'}</span>
      </div>
      <button class="btn ghost danger-btn js-delete-repair-service" type="button" data-id="${esc(service.id)}">Delete</button>
    </article>
  `).join('') : '<div class="dash-empty">No repair services available.</div>';
  $$('.js-delete-repair-service').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/api/management/repair-services/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadRepairServices();
      toast('Repair service deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

function renderAdminSpareParts() {
  const el = $('#sparePartAdmin');
  if (!el) return;
  el.innerHTML = (spareParts && spareParts.length) ? spareParts.map(part => `
    <article class="product-row" data-spare="${part.id}">
      <img src="${part.image || '/shop/hero-phone.jpg'}" alt="">
      <div>
        <strong>${esc(part.name)}</strong>
        <small>${esc(part.brand)} · ${esc(part.category)}</small>
      </div>
      <div>
        <span>${fmt(part.price)}</span>
        <span>Stock: ${part.stock}</span>
      </div>
      <button class="btn ghost danger-btn js-delete-spare" type="button" data-id="${part.id}">Delete</button>
    </article>`).join('') : '<div class="dash-empty">No spare parts in inventory.</div>';

  $$('.js-delete-spare').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this spare part?')) return;
    try {
      await api(`/api/admin/spare-parts/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadAdminSpareParts();
      toast('Spare part deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }));
}

function renderTechnicians() {
  const el = $('#technicianList');
  if (!el) return;
  el.innerHTML = (technicians && technicians.length) ? technicians.map(tech => `
    <article class="staff-row">
      <div><b>${esc(tech.name)}</b><span>${esc(tech.email)}</span></div>
      <button class="btn ghost danger-btn js-delete-technician" type="button" data-id="${esc(tech.id)}">Delete</button>
    </article>
  `).join('') : '<div class="dash-empty">No technicians assigned yet.</div>';
  $$('.js-delete-technician').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/api/management/repair-technicians/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadTechnicians();
      toast('Technician removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

function renderRepairCategories() {
  const el = $('#repairCategorySelect');
  if (!el) return;
  // Show categories immediately if we have them
  const cats = (repairCategories && repairCategories.length) ? repairCategories : [];
  el.innerHTML = '<option value="">Select category</option>' + cats.map(category => `
    <option value="${esc(category.id)}">${esc(category.name)}</option>
  `).join('');
}

async function loadRepairBookings() {
  if (offlineManager) {
    repairBookings = DUMMY_REPAIR_BOOKINGS;
    renderRepairBookings();
    return;
  }
  const data = await api('/api/management/repair-bookings');
  repairBookings = data.bookings || [];
  renderRepairBookings();
}

async function loadAdminSpareParts() {
  if (offlineManager) {
    spareParts = [];
    renderAdminSpareParts();
    return;
  }
  const data = await api('/api/spare-parts');
  spareParts = data.spares || [];
  renderAdminSpareParts();
}

async function loadRepairServices() {
  if (offlineManager) {
    repairServices = DUMMY_REPAIR_SERVICES;
    renderRepairServices();
    return;
  }
  const data = await api('/api/management/repair-services');
  repairServices = data.services || [];
  renderRepairServices();
}

async function loadTechnicians() {
  if (offlineManager) {
    technicians = DUMMY_TECHNICIANS;
    renderTechnicians();
    return;
  }
  const data = await api('/api/repair/technicians');
  technicians = data.technicians || [];
  renderTechnicians();
}

async function loadRepairCategories() {
  if (offlineManager) {
    repairCategories = DUMMY_REPAIR_CATEGORIES;
    renderRepairCategories();
    return;
  }
  const data = await api('/api/repair/categories');
  repairCategories = data.categories || [];
  renderRepairCategories();
}

function renderPerformance(analytics) {
  const metrics = $('#metrics');
  if (metrics) metrics.innerHTML = `
    <div><b>${fmt(analytics.totalSales)}</b><span>Total Sales</span></div>
    <div><b>${analytics.totalOrders}</b><span>Total Orders</span></div>
    <div><b>${analytics.delivered}</b><span>Delivered</span></div>
    <div><b>${analytics.products}</b><span>Products</span></div>`;

  const canvas = $('#performanceChart');
  if (!canvas) return;
  
  const data = analytics.days || [];
  if (!data.length) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 42;
  const max = Math.max(1, ...data.map(day => day.sales));
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 4; i++) {
    const y = pad + i * ((h - pad * 2) / 3);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
  }
  ctx.font = '14px Inter, sans-serif';
  data.forEach((day, index) => {
    const x = pad + index * ((w - pad * 2) / Math.max(1, data.length - 1));
    const barH = (day.sales / max) * (h - pad * 2);
    const y = h - pad - barH;
    const gradient = ctx.createLinearGradient(0, y, 0, h - pad);
    gradient.addColorStop(0, '#00e5ff');
    gradient.addColorStop(1, '#7c4dff');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 18, y, 36, barH || 2);
    ctx.fillStyle = '#9aa0b4';
    ctx.fillText(day.label, x - 14, h - 14);
  });
}

async function loadOrders() {
  if (offlineManager) {
    orders = DUMMY_ORDERS;
    renderPlacedOrders();
    return;
  }
  const data = await api('/api/management/orders/placed');
  orders = data.orders || [];
  renderPlacedOrders();
}

function renderCounties() {
  const el = $('#countyList');
  if (!el) return;
  el.innerHTML = (counties && counties.length) ? counties.map(county => `
    <article class="staff-row">
      <div><b>${esc(county.name)}</b></div>
      <button class="btn ghost js-delete-county" data-id="${county.id}" type="button">Delete</button>
    </article>`).join('') : '<div class="dash-empty">No counties added yet.</div>';

  $$('.js-delete-county').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this county and all associated sub-locations?')) return;
    try {
      await api(`/api/admin/locations/counties/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadCountiesData();
      toast('County deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }));
}

function renderSubLocations() {
  const el = $('#subLocationList');
  if (!el) return;
  el.innerHTML = (subLocations && subLocations.length) ? subLocations.map(sl => {
    const countyName = counties.find(c => c.id === sl.countyId)?.name || 'Unknown County';
    const zoneName = deliveryZones.find(dz => dz.id === sl.deliveryZoneId)?.name || 'Unknown Zone';
    return `
    <article class="staff-row">
      <div><b>${esc(sl.name)}</b><span>${esc(countyName)} · ${esc(zoneName)}</span></div>
      <button class="btn ghost js-delete-sublocation" data-id="${sl.id}" type="button">Delete</button>
    </article>`;
  }).join('') : '<div class="dash-empty">No sub-locations added yet.</div>';

  $$('.js-delete-sublocation').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this sub-location?')) return;
    try {
      await api(`/api/admin/locations/sublocations/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadSubLocations();
      toast('Sub-location deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }));
}

function renderDeliveryZones() {
  const el = $('#deliveryZoneList');
  if (!el) return;
  el.innerHTML = (deliveryZones && deliveryZones.length) ? deliveryZones.map(dz => `
    <article class="staff-row">
      <div><b>${esc(dz.name)}</b><span>${esc(dz.description || '')}</span></div>
      <button class="btn ghost js-delete-delivery-zone" data-id="${dz.id}" type="button">Delete</button>
    </article>`).join('') : '<div class="dash-empty">No delivery zones added yet.</div>';

  $$('.js-delete-delivery-zone').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      await api(`/api/admin/delivery-zones/${encodeURIComponent(btn.dataset.id)}`, { method:'DELETE' });
      await loadDeliveryZones();
      toast('Delivery zone deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }));
}

function renderDeliverySettings() {
  const el = $('#deliveryRateList');
  if (!el) return;
  el.innerHTML = (deliveryRates && deliveryRates.length) ? deliveryRates.map(r => `
    <div class="staff-row">
      <div><b>${esc(r.zone_name)}</b><span>Base Fee: ${fmt(r.base_fee)}</span></div>
      <button class="btn ghost js-edit-rate" data-id="${r.id}">Edit</button>
    </div>
  `).join('') : '<p class="muted">No rates configured</p>';
}

async function loadCountiesData() {
  const data = await api('/api/locations/counties');
  counties = data.counties || [];
  renderCounties();
  const countySelects = $$('.js-county-select');
  countySelects.forEach(select => {
    select.innerHTML = '<option value="">Select County</option>' + counties.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  });
}

async function loadSubLocations() {
  const data = await api('/api/locations/sublocations');
  subLocations = data.subLocations || [];
  renderSubLocations();
}

async function loadDeliveryZones() {
  try {
    const data = await api('/api/admin/delivery-zones'); // Assuming this endpoint exists based on prev requests
    deliveryZones = data.deliveryZones || [];
    renderDeliveryZones();
    const zoneSelects = $$('.js-delivery-zone-select');
    zoneSelects.forEach(select => {
      select.innerHTML = '<option value="">Select Delivery Zone</option>' + deliveryZones.map(dz => `<option value="${dz.id}">${esc(dz.name)}</option>`).join('');
    });
  } catch(e) { console.error("Zones load fail", e); }
}

async function loadDeliveryData() {
  try {
    const data = await api('/api/admin/delivery-rates');
    deliveryRates = data.rates || [];
    renderDeliverySettings();
  } catch (e) { console.error("Failed to load rates", e); }
}

async function loadAdminData() {
  if (offlineManager) {
    products = DUMMY_PRODUCTS;
    staff = DUMMY_STAFF;
    counties = DUMMY_COUNTIES;
    subLocations = DUMMY_SUB_LOCATIONS;
    deliveryZones = DUMMY_DELIVERY_ZONES;
    deliveryRates = DUMMY_DELIVERY_RATES;
    renderStaff();
    renderProducts();
    renderCounties(); renderSubLocations(); renderDeliveryZones(); renderDeliverySettings();
    renderPerformance(DUMMY_ANALYTICS);
    await Promise.all([loadRepairServices(), loadTechnicians(), loadRepairCategories(), loadCountiesData(), loadSubLocations(), loadDeliveryZones(), loadDeliveryData()]);
    return;
  }

  // Show initial loading states
  if ($('#staffList')) $('#staffList').innerHTML = LOADING.staff;
  if ($('#productAdmin')) $('#productAdmin').innerHTML = LOADING.products;
  if ($('#sparePartAdmin')) $('#sparePartAdmin').innerHTML = LOADING.spares;

  try {
    // Load admin data items individually so one failure doesn't block the UI
    api('/api/products').then(d => { products = d.products || []; renderProducts(); }).catch(e => console.error("Products load fail", e));
    api('/api/admin/staff').then(d => { staff = d.staff || []; renderStaff(); }).catch(e => console.error("Staff load fail", e));
    api('/api/admin/analytics').then(d => renderPerformance(d)).catch(e => console.error("Analytics load fail", e));
    loadCountiesData(); loadSubLocations(); loadDeliveryZones(); loadDeliveryData();
  } catch (err) {
    console.error("Admin data load failed:", err);
    toast("Some management metrics could not be loaded", "error");
  }

  await Promise.all([loadRepairServices(), loadTechnicians(), loadRepairCategories(), loadAdminSpareParts()]);
}

async function updateView() {
  let data = null;
  try {
    data = await api('/api/auth/me');
    offlineManager = false;
  } catch (err) {
    if (localStorage.getItem('smd_mgmt_offline') === '1') {
      offlineManager = true;
      manager = OFFLINE_MANAGER;
    } else {
      manager = null;
    }
  }

  if (data?.user && ['admin', 'staff'].includes(data.user.role)) {
    manager = data.user;
    offlineManager = false;
  }
  
  if ($('#managerLogin')) $('#managerLogin').hidden = !!manager;
  if ($('#managerOrders')) $('#managerOrders').hidden = !manager;

  // Initialize IntersectionObserver for animations (must run even if not logged in so login card shows)
  const revObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('in');
  }), { threshold: .1 });
  document.querySelectorAll('.reveal').forEach(el => revObs.observe(el));

  if (!manager) return;

  const isAdmin = manager.role === 'admin';
  if ($('#managerRole')) $('#managerRole').textContent = isAdmin ? 'Admin' : 'Staff';
  if ($('#managerTitle')) $('#managerTitle').textContent = isAdmin ? 'Admin Management' : 'Orders Placed';
  if ($('#adminSections')) $('#adminSections').hidden = !isAdmin;

  if ($('#placedOrders')) $('#placedOrders').innerHTML = LOADING.orders;
  if ($('#repairBookings')) $('#repairBookings').innerHTML = LOADING.bookings;

  // Trigger background loads without blocking UI visibility
  return Promise.allSettled([
    loadOrders().catch(e => console.error("Orders fail:", e)),
    loadRepairBookings().catch(e => console.error("Bookings fail:", e)),
    isAdmin ? loadAdminData().catch(e => console.error("Admin data fail:", e)) : Promise.resolve()
  ]);
}

$('#managerLoginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  try {
    await api('/api/auth/management-login', {
      method:'POST',
      body:JSON.stringify({ email, password })
    });
    localStorage.removeItem('smd_mgmt_offline');
    e.target.reset();
    await updateView();
    toast('Login successful', 'success');
  } catch (err) {
    if (err.network && email && password) {
      offlineManager = true;
      localStorage.setItem('smd_mgmt_offline', '1');
      await updateView();
      toast('Login successful (offline fallback)', 'success');
      return;
    }
    toast(err.message, 'error');
  }
});

$('#sparePartForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/admin/spare-parts', { method:'POST', body:fd });
    e.target.reset();
    await loadAdminSpareParts();
    toast('Spare part added to inventory', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

$('#staffForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/admin/staff', {
      method:'POST',
      body:JSON.stringify({ name:fd.get('name').trim(), email:fd.get('email').trim(), password:fd.get('password') })
    });
    e.target.reset();
    await loadAdminData();
    toast('Staff account created', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#technicianForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/management/repair-technicians', {
      method:'POST',
      body: JSON.stringify({ name: fd.get('name').trim(), email: fd.get('email').trim() })
    });
    e.target.reset();
    await loadTechnicians();
    toast('Technician added', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#repairServiceForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/management/repair-services', { method: 'POST', body: fd });
    e.target.reset();
    await loadRepairServices();
    toast('Repair service added', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#repairBookings')?.addEventListener('click', async e => {
  if (!e.target.matches('.js-update-booking')) return;
  const bookingId = e.target.dataset.id;
  if (!bookingId) return;
  const status = prompt('Enter new status for booking ' + bookingId + ' (Pending, Received, Diagnosing, Repairing, Completed, Ready for pickup):');
  if (!status) return;
  try {
    await api(`/api/management/repair-bookings/${encodeURIComponent(bookingId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    await loadRepairBookings();
    toast('Booking status updated', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#productForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/admin/products', { method:'POST', body:fd });
    e.target.reset();
    await loadAdminData();
    toast('Product added', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#managerLogout')?.addEventListener('click', async () => {
  await api('/api/auth/logout', { method:'POST', body:JSON.stringify({}) });
  manager = null;
  orders = [];
  products = [];
  staff = [];
  repairBookings = [];
  repairServices = [];
  technicians = [];
  await updateView();
});

updateView().catch(() => {
  const login = $('#managerLogin');
  if (login) login.hidden = false;
  const ordersPanel = $('#managerOrders');
  if (ordersPanel) ordersPanel.hidden = true;
});
