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
// SPARE PARTS - FULL CRUD (Add, Update, Delete)
// ============================================

function showEditSparePartModal(part) {
  // Create modal for editing
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
  modal.style.zIndex = '2000';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 500px; width: 90%; background: #1a1a2e; border-radius: 1.5rem; padding: 2rem;">
      <h3 style="margin-bottom: 1rem;">✏️ Edit Spare Part</h3>
      <form id="editSparePartForm">
        <input type="hidden" name="id" value="${part.id}">
        <div style="margin-bottom: 1rem;">
          <label>Part Name</label>
          <input name="name" value="${esc(part.name)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Brand</label>
          <input name="brand" value="${esc(part.brand)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Category</label>
          <input name="category" value="${esc(part.category)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Model Number</label>
          <input name="modelNumber" value="${esc(part.modelNumber || '')}" style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Price (Kshs)</label>
          <input name="price" type="number" value="${part.price}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Stock</label>
          <input name="stock" type="number" value="${part.stock}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Description</label>
          <textarea name="description" rows="3" style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">${esc(part.description || '')}</textarea>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button type="submit" class="btn primary" style="flex: 1;">💾 Save Changes</button>
          <button type="button" class="btn ghost" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('editSparePartForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    
    try {
      await api(`/api/admin/spare-parts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.get('name'),
          brand: formData.get('brand'),
          category: formData.get('category'),
          modelNumber: formData.get('modelNumber'),
          price: parseInt(formData.get('price')),
          stock: parseInt(formData.get('stock')),
          description: formData.get('description')
        })
      });
      modal.remove();
      toast('Spare part updated successfully!', 'success');
      await loadAdminSpareParts();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function renderAdminSpareParts() {
  const el = $('#sparePartAdmin');
  if (!el) return;
  
  if (!spareParts || spareParts.length === 0) {
    el.innerHTML = '<div class="dash-empty">No spare parts in inventory. Click "Add Spare Part" to get started.</div>';
    return;
  }
  
  el.innerHTML = spareParts.map(part => `
    <div class="spare-card" style="background: #1a1a2e; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        ${part.image ? `<img src="${part.image}" alt="${esc(part.name)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 0.5rem;">` : ''}
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.5rem;">${esc(part.name)}</h4>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
            <span style="color: #00e5ff;">${esc(part.brand)}</span>
            <span style="color: #888;">${esc(part.category)}</span>
            ${part.modelNumber ? `<span style="color: #888;">Model: ${esc(part.modelNumber)}</span>` : ''}
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <span class="price" style="font-size: 1.25rem; font-weight: bold; color: #00e5ff;">${fmt(part.price)}</span>
            <span class="stock ${part.stock > 0 ? 'in-stock' : 'out-stock'}" style="padding: 0.25rem 0.75rem; border-radius: 2rem; font-size: 0.75rem; ${part.stock > 0 ? 'background: #00c853; color: white;' : 'background: #ff3b30; color: white;'}">
              ${part.stock > 0 ? `Stock: ${part.stock}` : 'Out of Stock'}
            </span>
          </div>
          ${part.description ? `<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #888;">${esc(part.description)}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <button class="btn-sm btn-edit" onclick="window.editSparePart(${part.id})" style="background: #00e5ff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">✏️ Edit</button>
          <button class="btn-sm btn-delete" onclick="window.deleteSparePart(${part.id})" style="background: #ff3b30; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Make functions global for onclick handlers
window.editSparePart = async (id) => {
  const part = spareParts.find(p => p.id == id);
  if (part) {
    showEditSparePartModal(part);
  } else {
    toast('Spare part not found', 'error');
  }
};

window.deleteSparePart = async (id) => {
  if (!confirm('Are you sure you want to delete this spare part?')) return;
  try {
    await api(`/api/admin/spare-parts/${id}`, { method: 'DELETE' });
    toast('Spare part deleted', 'success');
    await loadAdminSpareParts();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ============================================
// REPAIR SERVICES - FULL CRUD (Add, Update, Delete)
// ============================================

function showEditRepairServiceModal(service) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
  modal.style.zIndex = '2000';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 500px; width: 90%; background: #1a1a2e; border-radius: 1.5rem; padding: 2rem;">
      <h3 style="margin-bottom: 1rem;">✏️ Edit Repair Service</h3>
      <form id="editRepairServiceForm">
        <input type="hidden" name="id" value="${service.id}">
        <div style="margin-bottom: 1rem;">
          <label>Service Title</label>
          <input name="title" value="${esc(service.title)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Brand</label>
          <input name="brand" value="${esc(service.brand)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Repair Type</label>
          <input name="repairType" value="${esc(service.repairType)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Price (Kshs)</label>
          <input name="price" type="number" value="${service.price}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Duration</label>
          <input name="duration" value="${esc(service.duration)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Warranty</label>
          <input name="warranty" value="${esc(service.warranty)}" required style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Available</label>
          <select name="available" style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">
            <option value="1" ${service.available ? 'selected' : ''}>Available</option>
            <option value="0" ${!service.available ? 'selected' : ''}>Unavailable</option>
          </select>
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Description</label>
          <textarea name="description" rows="3" style="width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #0f0f1a; border: 1px solid #2a2a3e; color: white;">${esc(service.description || '')}</textarea>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button type="submit" class="btn primary" style="flex: 1;">💾 Save Changes</button>
          <button type="button" class="btn ghost" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('editRepairServiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    
    try {
      await api(`/api/management/repair-services/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: formData.get('title'),
          brand: formData.get('brand'),
          repairType: formData.get('repairType'),
          price: parseInt(formData.get('price')),
          duration: formData.get('duration'),
          warranty: formData.get('warranty'),
          available: formData.get('available') === '1',
          description: formData.get('description')
        })
      });
      modal.remove();
      toast('Repair service updated successfully!', 'success');
      await loadRepairServices();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function renderRepairServices() {
  const el = $('#repairServiceAdmin');
  if (!el) return;
  
  if (!repairServices || repairServices.length === 0) {
    el.innerHTML = '<div class="dash-empty">No repair services available. Click "Add Repair Service" to get started.</div>';
    return;
  }
  
  el.innerHTML = repairServices.map(service => `
    <div class="service-card" style="background: #1a1a2e; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.5rem;">${esc(service.title)}</h4>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
            <span style="color: #00e5ff;">${esc(service.brand)}</span>
            <span style="color: #888;">${esc(service.repairType)}</span>
            <span style="color: #888;">⏱️ ${service.duration || 'N/A'}</span>
            <span style="color: #888;">🛡️ ${service.warranty || 'N/A'}</span>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <span class="price" style="font-size: 1.25rem; font-weight: bold; color: #00e5ff;">${fmt(service.price)}</span>
            <span class="status ${service.available ? 'available' : 'unavailable'}" style="padding: 0.25rem 0.75rem; border-radius: 2rem; font-size: 0.75rem; ${service.available ? 'background: #00c853; color: white;' : 'background: #ff3b30; color: white;'}">
              ${service.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          ${service.description ? `<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #888;">${esc(service.description)}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <button class="btn-sm btn-edit" onclick="window.editRepairService(${service.id})" style="background: #00e5ff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">✏️ Edit</button>
          <button class="btn-sm btn-delete" onclick="window.deleteRepairService(${service.id})" style="background: #ff3b30; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.editRepairService = async (id) => {
  const service = repairServices.find(s => s.id == id);
  if (service) {
    showEditRepairServiceModal(service);
  } else {
    toast('Repair service not found', 'error');
  }
};

window.deleteRepairService = async (id) => {
  if (!confirm('Are you sure you want to delete this repair service?')) return;
  try {
    await api(`/api/management/repair-services/${id}`, { method: 'DELETE' });
    toast('Repair service deleted', 'success');
    await loadRepairServices();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ============================================
// EXISTING FUNCTIONS (kept as is)
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
// Add this function to management.js - ensures spare parts are saved with proper image handling
async function loadAdminSpareParts() {
  if (offlineManager) {
    spareParts = [];
    renderAdminSpareParts();
    return;
  }
  try {
    const data = await api('/api/spare-parts');
    spareParts = data.spares || [];
    // Also save to localStorage with the correct key that repair page expects
    localStorage.setItem('spare_parts', JSON.stringify(spareParts));
    renderAdminSpareParts();
  } catch (err) {
    console.error("Failed to load spare parts:", err);
    // Try to load from localStorage as fallback
    const stored = localStorage.getItem('spare_parts');
    if (stored) {
      spareParts = JSON.parse(stored);
      renderAdminSpareParts();
    }
  }
}

// Update the add spare part function
document.getElementById('sparePartForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const response = await api('/api/admin/spare-parts', { method:'POST', body:fd });
    // Save to localStorage with the correct key
    const updatedParts = await api('/api/spare-parts');
    localStorage.setItem('spare_parts', JSON.stringify(updatedParts.spares || []));
    e.target.reset();
    await loadAdminSpareParts();
    toast('Spare part added to inventory', 'success');
  } catch (err) { 
    // Fallback for offline - save to localStorage directly
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
    toast('Spare part added (offline mode)', 'success');
  }
});
