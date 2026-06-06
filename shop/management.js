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

// ============================================
// PRODUCTS CRUD
// ============================================

function renderProducts() {
  const el = $('#productAdmin');
  if (!el) return;
  if (!products || products.length === 0) {
    el.innerHTML = '<div class="dash-empty">No products yet.</div>';
    return;
  }
  el.innerHTML = products.map(product => `
    <div class="product-item" data-id="${product.id}" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <img src="${product.img || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;">
        <div style="flex:1;">
          <h4>${esc(product.name)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(product.cat)}</span>
            <span style="color:#00e5ff;">${fmt(product.price)}</span>
            <span style="${product.inStock !== false ? 'color:#00c853' : 'color:#ff3b30'}">${product.inStock !== false ? 'In Stock' : 'Out of Stock'}</span>
          </div>
        </div>
        <div>
          <button class="edit-product" data-id="${product.id}" style="background:#00e5ff; color:#000; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer; margin-right:0.5rem;">✏️ Edit</button>
          <button class="delete-product" data-id="${product.id}" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Attach event listeners
  $$('.edit-product').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.id)));
  $$('.delete-product').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
}

function editProduct(id) {
  const product = products.find(p => p.id == id);
  if (!product) { toast('Product not found', 'error'); return; }
  
  const newName = prompt('Edit product name:', product.name);
  if (newName && newName.trim()) {
    const newPrice = prompt('Edit price (Kshs):', product.price);
    if (newPrice) {
      product.name = newName.trim();
      product.price = parseFloat(newPrice);
      localStorage.setItem('management_products', JSON.stringify(products));
      renderProducts();
      toast('Product updated locally', 'success');
    }
  }
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  products = products.filter(p => p.id != id);
  localStorage.setItem('management_products', JSON.stringify(products));
  renderProducts();
  toast('Product deleted', 'success');
}

// ============================================
// SPARE PARTS CRUD
// ============================================

function renderAdminSpareParts() {
  const el = $('#sparePartAdmin');
  if (!el) return;
  if (!spareParts || spareParts.length === 0) {
    el.innerHTML = '<div class="dash-empty">No spare parts yet.</div>';
    return;
  }
  el.innerHTML = spareParts.map(part => `
    <div class="spare-item" data-id="${part.id}" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <img src="${part.image || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;">
        <div style="flex:1;">
          <h4>${esc(part.name)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(part.brand)}</span>
            <span style="color:#888;">${esc(part.category || 'Uncategorized')}</span>
            ${part.modelNumber ? `<span style="color:#888;">Model: ${esc(part.modelNumber)}</span>` : ''}
            <span style="color:#00e5ff;">${fmt(part.price)}</span>
            <span style="${part.stock > 0 ? 'color:#00c853' : 'color:#ff3b30'}">Stock: ${part.stock}</span>
          </div>
        </div>
        <div>
          <button class="edit-spare" data-id="${part.id}" style="background:#00e5ff; color:#000; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer; margin-right:0.5rem;">✏️ Edit</button>
          <button class="delete-spare" data-id="${part.id}" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  
  $$('.edit-spare').forEach(btn => btn.addEventListener('click', () => editSparePart(btn.dataset.id)));
  $$('.delete-spare').forEach(btn => btn.addEventListener('click', () => deleteSparePart(btn.dataset.id)));
}

function editSparePart(id) {
  const part = spareParts.find(p => p.id == id);
  if (!part) { toast('Spare part not found', 'error'); return; }
  
  const newName = prompt('Edit part name:', part.name);
  if (newName && newName.trim()) {
    const newPrice = prompt('Edit price (Kshs):', part.price);
    if (newPrice) {
      const newStock = prompt('Edit stock quantity:', part.stock);
      if (newStock !== null) {
        part.name = newName.trim();
        part.price = parseFloat(newPrice);
        part.stock = parseInt(newStock);
        localStorage.setItem('spare_parts', JSON.stringify(spareParts));
        renderAdminSpareParts();
        toast('Spare part updated', 'success');
      }
    }
  }
}

function deleteSparePart(id) {
  if (!confirm('Delete this spare part?')) return;
  spareParts = spareParts.filter(p => p.id != id);
  localStorage.setItem('spare_parts', JSON.stringify(spareParts));
  renderAdminSpareParts();
  toast('Spare part deleted', 'success');
}

// ============================================
// REPAIR SERVICES CRUD
// ============================================

function renderRepairServices() {
  const el = $('#repairServiceAdmin');
  if (!el) return;
  if (!repairServices || repairServices.length === 0) {
    el.innerHTML = '<div class="dash-empty">No repair services yet.</div>';
    return;
  }
  el.innerHTML = repairServices.map(service => `
    <div class="service-item" data-id="${service.id}" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <div style="flex:1;">
          <h4>${esc(service.title)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(service.brand)}</span>
            <span style="color:#888;">${esc(service.repairType)}</span>
            <span style="color:#00e5ff;">${fmt(service.price)}</span>
            <span style="${service.available ? 'color:#00c853' : 'color:#ff3b30'}">${service.available ? 'Available' : 'Unavailable'}</span>
          </div>
        </div>
        <div>
          <button class="edit-service" data-id="${service.id}" style="background:#00e5ff; color:#000; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer; margin-right:0.5rem;">✏️ Edit</button>
          <button class="delete-service" data-id="${service.id}" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  
  $$('.edit-service').forEach(btn => btn.addEventListener('click', () => editRepairService(btn.dataset.id)));
  $$('.delete-service').forEach(btn => btn.addEventListener('click', () => deleteRepairService(btn.dataset.id)));
}

function editRepairService(id) {
  const service = repairServices.find(s => s.id == id);
  if (!service) { toast('Service not found', 'error'); return; }
  
  const newTitle = prompt('Edit service title:', service.title);
  if (newTitle && newTitle.trim()) {
    const newPrice = prompt('Edit price (Kshs):', service.price);
    if (newPrice) {
      service.title = newTitle.trim();
      service.price = parseFloat(newPrice);
      localStorage.setItem('repair_services', JSON.stringify(repairServices));
      renderRepairServices();
      toast('Repair service updated', 'success');
    }
  }
}

function deleteRepairService(id) {
  if (!confirm('Delete this repair service?')) return;
  repairServices = repairServices.filter(s => s.id != id);
  localStorage.setItem('repair_services', JSON.stringify(repairServices));
  renderRepairServices();
  toast('Repair service deleted', 'success');
}

// ============================================
// LOAD FUNCTIONS
// ============================================

async function loadAdminSpareParts() {
  if (offlineManager) {
    const stored = localStorage.getItem('spare_parts');
    spareParts = stored ? JSON.parse(stored) : [];
    renderAdminSpareParts();
    return;
  }
  try {
    const data = await api('/api/spare-parts');
    spareParts = data.spares || [];
    localStorage.setItem('spare_parts', JSON.stringify(spareParts));
    renderAdminSpareParts();
  } catch (err) {
    const stored = localStorage.getItem('spare_parts');
    if (stored) {
      spareParts = JSON.parse(stored);
      renderAdminSpareParts();
    }
  }
}

async function loadRepairServices() {
  if (offlineManager) {
    const stored = localStorage.getItem('repair_services');
    repairServices = stored ? JSON.parse(stored) : DUMMY_REPAIR_SERVICES;
    renderRepairServices();
    return;
  }
  try {
    const data = await api('/api/management/repair-services');
    repairServices = data.services || [];
    localStorage.setItem('repair_services', JSON.stringify(repairServices));
    renderRepairServices();
  } catch (err) {
    const stored = localStorage.getItem('repair_services');
    if (stored) {
      repairServices = JSON.parse(stored);
      renderRepairServices();
    }
  }
}

async function loadAdminData() {
  if (offlineManager) {
    products = DUMMY_PRODUCTS;
    staff = DUMMY_STAFF;
    renderStaff();
    renderProducts();
    renderPerformance(DUMMY_ANALYTICS);
    return;
  }
  if ($('#staffList')) $('#staffList').innerHTML = LOADING.staff;
  if ($('#productAdmin')) $('#productAdmin').innerHTML = LOADING.products;
  try {
    api('/api/products').then(d => { products = d.products || []; renderProducts(); }).catch(e => console.error("Products load fail", e));
    api('/api/admin/staff').then(d => { staff = d.staff || []; renderStaff(); }).catch(e => console.error("Staff load fail", e));
    api('/api/admin/analytics').then(d => renderPerformance(d)).catch(e => console.error("Analytics load fail", e));
  } catch (err) {
    console.error("Admin data load failed:", err);
    toast("Some management metrics could not be loaded", "error");
  }
  await Promise.all([loadRepairServices(), loadTechnicians(), loadRepairCategories(), loadAdminSpareParts()]);
}

// ============================================
// EXISTING FUNCTIONS (keep as is)
// ============================================

function renderPlacedOrders() {
  const el = $('#placedOrders');
  if (!el) return;
  el.innerHTML = (orders && orders.length) ? orders.map(order => {
    const loc = order.location || {};
    return `
    <article class="order-row manager-order">
      <div>
        <b>${esc(order.id)}</b> <span class="status ${esc(order.paymentStatus?.toLowerCase() || 'pending')}">${esc(order.paymentStatus || 'Pending')}</span>
        <span>${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date Unknown'}</span>
        <small>${esc(order.customer)} · ${esc(order.email)}</small>
      </div>
      <div class="order-items">
        ${(order.items || []).map(item => `${esc(item.name)} x${item.qty}`).join('<br>')}
        <div class="order-meta">
           <small>Location: ${esc(loc.county || 'N/A')}, ${esc(loc.constituency || 'N/A')} · ${esc(loc.street || 'N/A')}</small>
        </div>
      </div>
      <div>
        <b>${fmt(order.total)}</b>
        <span class="status ${esc(order.status?.toLowerCase() || 'pending')}">${esc(order.status || 'Pending')}</span>
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
  const cats = (repairCategories && repairCategories.length) ? repairCategories : [];
  el.innerHTML = '<option value="">Select category</option>' + cats.map(category => `
    <option value="${esc(category.id)}">${esc(category.name)}</option>
  `).join('');
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
  return Promise.allSettled([
    loadOrders().catch(e => console.error("Orders fail:", e)),
    loadRepairBookings().catch(e => console.error("Bookings fail:", e)),
    isAdmin ? loadAdminData().catch(e => console.error("Admin data fail:", e)) : Promise.resolve()
  ]);
}

// ============================================
// EVENT LISTENERS
// ============================================

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
    await loadAdminSpareParts();
    e.target.reset();
    toast('Spare part added', 'success');
  } catch (err) {
    const newPart = {
      id: Date.now(),
      name: fd.get('name'),
      brand: fd.get('brand'),
      category: fd.get('category'),
      modelNumber: fd.get('modelNumber'),
      price: parseInt(fd.get('price')),
      stock: parseInt(fd.get('stock')),
      description: fd.get('description'),
      image: 'shop/hero-phone.jpg'
    };
    const existing = JSON.parse(localStorage.getItem('spare_parts') || '[]');
    existing.push(newPart);
    localStorage.setItem('spare_parts', JSON.stringify(existing));
    await loadAdminSpareParts();
    e.target.reset();
    toast('Spare part added (offline)', 'success');
  }
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
    await loadRepairServices();
    e.target.reset();
    toast('Repair service added', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#repairBookings')?.addEventListener('click', async e => {
  if (!e.target.matches('.js-update-booking')) return;
  const bookingId = e.target.dataset.id;
  if (!bookingId) return;
  const status = prompt('Enter new status: Pending, Received, Diagnosing, Repairing, Completed, Ready for pickup');
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
