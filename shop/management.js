if (typeof $ === 'undefined')   var $ = (s, p=document) => p.querySelector(s);
if (typeof $$ === 'undefined')  var $$ = (s, p=document) => [...p.querySelectorAll(s)];
if (typeof fmt === 'undefined') var fmt = n => 'KES ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
if (typeof esc === 'undefined') var esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
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

async function api(path, options = {}) {
  let res;
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const separator = path.includes('?') ? '&' : '?';
  const cacheBustPath = path + separator + '_=' + Date.now();
  
  const maxRetries = (options.method || 'GET') === 'GET' ? 2 : 1;
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
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
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastErr = new Error('Server is starting up, retrying...');
        continue;
      }
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) continue;
      const error = new Error(err.message || 'Network request failed');
      error.network = true;
      throw error;
    }
  }
  if (!res) { const e = new Error(lastErr?.message || 'Request failed'); e.network = true; throw e; }
  
  // Handle non-OK responses gracefully
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw new Error('Server is temporarily unavailable. Please refresh.');
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  
  const data = await res.json().catch(() => ({}));
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

function notifySparePartsUpdated() {
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'spare_parts_updated',
    newValue: Date.now().toString(),
    oldValue: null
  }));
}

function notifyProductsUpdated() {
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'management_products',
    newValue: localStorage.getItem('management_products'),
    oldValue: null
  }));
}

async function bustProductsCache() {
  try {
    const cache = await caches.open('sm-dynamics-v2');
    await cache.delete('/api/products');
  } catch (_) {}
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'BUST_PRODUCTS_CACHE' });
  }
}

async function broadcastProductUpdate() {
  await loadAdminData();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('products-updated'));
  }
  const productsData = localStorage.getItem('management_products');
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'management_products',
    newValue: productsData,
    oldValue: null
  }));
}

// ============================================
// PRODUCT BADGE FUNCTIONS
// ============================================

window.markAsFlashSale = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) { toast('Product not found', 'error'); return; }
  
  let wasPrice = product.was;
  if (!wasPrice) {
    const input = prompt('Enter original price (for flash sale discount display):', product.price * 1.5);
    if (!input) return;
    wasPrice = parseFloat(input);
  }
  
  product.badge = 'sale';
  product.was = wasPrice;
  
  try {
    await api(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        was: product.was,
        badge: product.badge,
        img: product.img,
        rating: product.rating || 4.6,
        reviews: product.reviews || 0,
        inStock: product.inStock !== false,
        cat: product.cat,
        desc: product.desc || ''
      })
    });
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    renderProducts();
    toast(`🔥 ${product.name} marked as FLASH SALE!`, 'success');
  } catch (err) {
    toast('Failed to save: ' + (err.message || 'server error'), 'error');
  }
};

window.markAsHot = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) { toast('Product not found', 'error'); return; }
  
  product.badge = 'hot';
  
  try {
    await api(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        was: product.was,
        badge: product.badge,
        img: product.img,
        rating: product.rating || 4.6,
        reviews: product.reviews || 0,
        inStock: product.inStock !== false,
        cat: product.cat,
        desc: product.desc || ''
      })
    });
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    renderProducts();
    toast(`⚡ ${product.name} marked as HOT!`, 'success');
  } catch (err) {
    toast('Failed to save: ' + (err.message || 'server error'), 'error');
  }
};

window.markAsNew = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) { toast('Product not found', 'error'); return; }
  
  product.badge = 'new';
  
  try {
    await api(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        was: product.was,
        badge: product.badge,
        img: product.img,
        rating: product.rating || 4.6,
        reviews: product.reviews || 0,
        inStock: product.inStock !== false,
        cat: product.cat,
        desc: product.desc || ''
      })
    });
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    renderProducts();
    toast(`✨ ${product.name} marked as NEW!`, 'success');
  } catch (err) {
    toast('Failed to save: ' + (err.message || 'server error'), 'error');
  }
};

window.removeBadge = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) { toast('Product not found', 'error'); return; }
  
  product.badge = '';
  
  try {
    await api(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        was: product.was,
        badge: product.badge,
        img: product.img,
        rating: product.rating || 4.6,
        reviews: product.reviews || 0,
        inStock: product.inStock !== false,
        cat: product.cat,
        desc: product.desc || ''
      })
    });
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    renderProducts();
    toast(`${product.name} badge removed`, 'success');
  } catch (err) {
    toast('Failed to save: ' + (err.message || 'server error'), 'error');
  }
};

// ============================================
// DELIVERY DATE FUNCTION
// ============================================

window.setDeliveryDate = async function(orderId) {
  const dateInput = document.getElementById(`deliveryDate_${orderId}`);
  if (!dateInput) {
    toast('Date input not found', 'error');
    return;
  }
  
  const deliveryDate = dateInput.value;
  
  if (!deliveryDate) {
    toast('Please select a delivery date', 'error');
    return;
  }
  
  if (!confirm(`Set delivery date to ${new Date(deliveryDate).toLocaleDateString()} for order ${orderId}? The customer will be notified.`)) {
    return;
  }
  
  try {
    await api(`/api/admin/orders/${encodeURIComponent(orderId)}/delivery-date`, {
      method: 'PUT',
      body: JSON.stringify({ deliveryDate: deliveryDate })
    });
    toast(`✅ Delivery date set for order ${orderId}. Customer notified.`, 'success');
    await loadOrders();
  } catch (err) {
    toast('Failed to set delivery date: ' + err.message, 'error');
  }
};

// ============================================
// RENDER PRODUCTS
// ============================================

function renderProducts() {
  const el = $('#productAdmin');
  if (!el) return;
  if (!products || products.length === 0) {
    el.innerHTML = '<div class="dash-empty">No products yet.</div>';
    return;
  }
  
  el.innerHTML = products.map(product => {
    const productId = product.id;
    return `
    <div class="product-item" data-id="${productId}" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <img src="${product.img || '/shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;" onerror="this.src='/shop/hero-phone.jpg'">
        <div style="flex:1;">
          <h4>${esc(product.name)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(product.cat)}</span>
            <span style="color:#00e5ff;">Price: ${fmt(product.price)}</span>
            ${product.was ? `<span style="color:#888; text-decoration:line-through;">Original: ${fmt(product.was)}</span>` : ''}
            <span style="${product.inStock !== false ? 'color:#00c853' : 'color:#ff3b30'}">${product.inStock !== false ? '✅ In Stock' : '❌ Out of Stock'}</span>
            <span class="badge-status" style="${product.badge === 'sale' ? 'background:#ff2bd6; padding:2px 8px; border-radius:12px; color:white;' : product.badge === 'hot' ? 'background:#ff4d6d; padding:2px 8px; border-radius:12px; color:white;' : product.badge === 'new' ? 'background:#20e0a6; padding:2px 8px; border-radius:12px; color:#000;' : ''}">
              ${product.badge === 'sale' ? '🔥 FLASH SALE' : product.badge === 'hot' ? '⚡ HOT' : product.badge === 'new' ? '✨ NEW' : 'No Badge'}
            </span>
          </div>
          ${product.desc ? `<p style="font-size: 0.75rem; color: #888; margin-top: 0.25rem;">${esc(product.desc.substring(0, 100))}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="window.markAsFlashSale('${productId}')" class="btn-badge" style="background:#ff2bd6; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer; font-weight:500;">🔥 Flash Sale</button>
          <button onclick="window.markAsHot('${productId}')" class="btn-badge" style="background:#ff4d6d; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer; font-weight:500;">⚡ Hot</button>
          <button onclick="window.markAsNew('${productId}')" class="btn-badge" style="background:#20e0a6; color:#000; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer; font-weight:500;">✨ New</button>
          <button onclick="window.removeBadge('${productId}')" class="btn-badge" style="background:#888; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer; font-weight:500;">Remove Badge</button>
          <button class="edit-product" data-id="${productId}" style="background:#00e5ff; color:#000; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">✏️ Edit</button>
          <button class="delete-product" data-id="${productId}" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `}).join('');
  
  $$('.edit-product').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.id)));
  $$('.delete-product').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
}

async function editProduct(id) {
  const product = products.find(p => p.id == id);
  if (!product) { toast('Product not found', 'error'); return; }

  const newName = prompt('Edit product name:', product.name);
  if (!newName || !newName.trim()) return;
  const newPrice = prompt('Edit price (Kshs):', product.price);
  if (!newPrice) return;

  try {
    product.name = newName.trim();
    product.price = parseFloat(newPrice);
    
    await api(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        was: product.was,
        badge: product.badge || '',
        img: product.img,
        rating: product.rating || 4.6,
        reviews: product.reviews || 0,
        inStock: product.inStock !== false,
        cat: product.cat,
        desc: product.desc || ''
      })
    });
    
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    await loadAdminData();
    toast('Product updated successfully!', 'success');
  } catch (err) {
    toast(err.message || 'Failed to update product', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('⚠️ Delete this product? This action cannot be undone.')) return;
  try {
    await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    products = products.filter(p => p.id != id);
    localStorage.setItem('management_products', JSON.stringify(products));
    await bustProductsCache();
    notifyProductsUpdated();
    await broadcastProductUpdate();
    await loadAdminData();
    toast('Product deleted successfully!', 'success');
  } catch (err) {
    toast(err.message || 'Failed to delete product', 'error');
  }
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
        <img src="${part.image || part.image_path || '/shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;" onerror="this.src='/shop/hero-phone.jpg'">
        <div style="flex:1;">
          <h4>${esc(part.name)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(part.brand)}</span>
            <span style="color:#888;">${esc(part.category || 'Uncategorized')}</span>
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
  $$('.delete-spare').forEach(btn => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await deleteSparePart(btn.dataset.id);
  }));
}

async function editSparePart(id) {
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
        
        try {
          await api(`/api/admin/spare-parts/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: part.name,
              brand: part.brand,
              category: part.category,
              price: part.price,
              stock: part.stock,
              description: part.description,
              image_path: part.image_path
            })
          });
        } catch (err) {
          console.warn('Server update failed, saving locally only');
        }
        
        localStorage.setItem('spare_parts', JSON.stringify(spareParts));
        renderAdminSpareParts();
        notifySparePartsUpdated();
        toast('Spare part updated', 'success');
      }
    }
  }
}

async function deleteSparePart(id) {
  if (!confirm('Delete this spare part? This cannot be undone.')) return;
  try {
    await api(`/api/admin/spare-parts/${id}`, { method: 'DELETE' });
    spareParts = spareParts.filter(p => p.id != id);
    localStorage.setItem('spare_parts', JSON.stringify(spareParts));
    notifySparePartsUpdated();
    renderAdminSpareParts();
    toast('Spare part deleted successfully!', 'success');
  } catch (err) {
    spareParts = spareParts.filter(p => p.id != id);
    localStorage.setItem('spare_parts', JSON.stringify(spareParts));
    notifySparePartsUpdated();
    renderAdminSpareParts();
    toast('Spare part deleted (local only). Server may be offline.', 'warning');
  }
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
    const productsData = await api('/api/products');
    if (productsData.products && productsData.products.length > 0) {
      products = productsData.products;
      localStorage.setItem('management_products', JSON.stringify(products));
    } else {
      const stored = localStorage.getItem('management_products');
      if (stored) {
        products = JSON.parse(stored);
      }
    }
  } catch (err) {
    console.error('Products load fail:', err);
    const stored = localStorage.getItem('management_products');
    if (stored) {
      products = JSON.parse(stored);
    }
  }
  
  // Load staff (non-critical)
  try {
    const staffData = await api('/api/admin/staff');
    staff = staffData.staff || [];
    renderStaff();
  } catch (e) {
    console.error("Staff load fail", e);
    staff = [];
    renderStaff();
  }
  
  // Load analytics (non-critical - don't fail if it doesn't work)
  try {
    const analyticsData = await api('/api/admin/analytics');
    renderPerformance(analyticsData);
  } catch (e) {
    console.error("Analytics load fail", e);
    renderPerformance(DUMMY_ANALYTICS);
  }
  
  await Promise.allSettled([
    loadRepairServices().catch(e => console.error("Repair services load fail", e)),
    loadTechnicians().catch(e => console.error("Technicians load fail", e)),
    loadRepairCategories().catch(e => console.error("Repair categories load fail", e)),
    loadAdminSpareParts().catch(e => console.error("Spare parts load fail", e))
  ]);
  
  renderProducts();
}

function renderPlacedOrders() {
  const el = $('#placedOrders');
  if (!el) return;
  el.innerHTML = (orders && orders.length) ? orders.map(order => {
    const loc = order.location || {};
    const locationStr = [loc.county, loc.constituency, loc.street].filter(Boolean).join(', ') || 'N/A';
    
    const dfBadge = order.deliveryFeeSet
      ? `<span style="background:#1b5e20; color:#69f0ae; padding:2px 8px; border-radius:10px; font-size:0.75rem;">✅ Delivery: ${fmt(order.deliveryFee)}</span>`
      : `<span style="background:#4a2000; color:#ffb300; padding:2px 8px; border-radius:10px; font-size:0.75rem;">⏳ Delivery fee not set</span>`;
    
    const deliveryDateBadge = order.deliveryDate
      ? `<span class="delivery-date-badge" style="display:inline-block; background:#00e5ff; color:#000; padding:2px 8px; border-radius:10px; font-size:0.7rem; margin-left:0.5rem;">📅 Est. Delivery: ${new Date(order.deliveryDate).toLocaleDateString()}</span>`
      : '';
    
    const setFeeBtn = !order.deliveryFeeSet
      ? `<button class="btn-set-delivery-fee" data-id="${esc(order.id)}" data-location="${esc(locationStr)}"
           style="background:#00e5ff; color:#000; border:none; padding:0.45rem 0.9rem; border-radius:0.5rem; cursor:pointer; font-weight:600; font-size:0.8rem; white-space:nowrap;">
           🚚 Set Delivery Fee
         </button>`
      : `<button class="btn-update-delivery-fee" data-id="${esc(order.id)}" data-location="${esc(locationStr)}" data-current="${order.deliveryFee}"
           style="background:#333; color:#aaa; border:none; padding:0.45rem 0.9rem; border-radius:0.5rem; cursor:pointer; font-size:0.8rem; white-space:nowrap;">
           ✏️ Update Fee
         </button>`;

    return `
    <article class="order-row manager-order" style="border-left:3px solid ${order.deliveryFeeSet ? '#00c853' : '#ffb300'}; margin-bottom:1rem; padding:1rem; background:rgba(255,255,255,0.02); border-radius:0.75rem;">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
        <div>
          <b>${esc(order.id)}</b>
          <span class="status ${esc(order.paymentStatus?.toLowerCase().replace(/ /g,'-') || 'pending')}">${esc(order.paymentStatus || 'Pending')}</span>
          <span style="margin-left:0.5rem;">${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date Unknown'}</span>
          <div><small>${esc(order.customer)} · ${esc(order.email)}</small>${deliveryDateBadge}</div>
        </div>
      </div>
      <div class="order-items" style="margin:0.5rem 0;">
        ${(order.items || []).map(item => `${esc(item.name)} x${item.qty}`).join('<br>')}
        <div class="order-meta" style="margin-top:0.4rem;">
          <small>📍 <b>${esc(locationStr)}</b></small>
        </div>
        <div style="margin-top:0.4rem;">${dfBadge}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
        <b>${fmt(order.total)}</b>
        <span class="status ${esc(order.status?.toLowerCase() || 'pending')}">${esc(order.status || 'Pending')}</span>
        ${setFeeBtn}
      </div>
      <div class="delivery-date-control" style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
        <input type="date" id="deliveryDate_${order.id}" class="delivery-date-input" value="${order.deliveryDate || ''}" style="padding: 0.4rem 0.8rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.2); background: #0f0f1a; color: white; font-size: 0.85rem;">
        <button onclick="window.setDeliveryDate('${order.id}')" class="btn-set-delivery-date" style="background: #7c4dff; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.8rem;">📅 Set Delivery Date</button>
      </div>
    </article>`;
  }).join('') : '<div class="dash-empty">No placed orders yet.</div>';

  el.querySelectorAll('.btn-set-delivery-fee, .btn-update-delivery-fee').forEach(btn => {
    btn.addEventListener('click', () => setOrderDeliveryFee(btn.dataset.id, btn.dataset.location, btn.dataset.current));
  });
}

async function setOrderDeliveryFee(orderId, locationStr, currentFee) {
  const suggestion = currentFee ? parseInt(currentFee) : '';
  const input = prompt(
    `Set delivery fee for order ${orderId}\n📍 Location: ${locationStr}\n\nEnter delivery fee (KES):`,
    suggestion
  );
  if (input === null || input === '') return;
  const fee = parseFloat(input);
  if (isNaN(fee) || fee < 0) {
    toast('Invalid delivery fee amount', 'error');
    return;
  }
  try {
    await api(`/api/admin/orders/${encodeURIComponent(orderId)}/delivery-fee`, {
      method: 'PUT',
      body: JSON.stringify({ deliveryFee: fee })
    });
    await loadOrders();
    toast(`✅ Delivery fee set to ${fmt(fee)} for ${orderId}. Customer notified.`, 'success');
  } catch (err) {
    toast('Failed to set delivery fee: ' + err.message, 'error');
  }
}

function renderStaff() {
  const el = $('#staffList');
  if (!el) return;
  el.innerHTML = (staff && staff.length) ? staff.map(user => `
    <article class="staff-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.1);">
      <div><b>${esc(user.name)}</b><br><span style="font-size:0.75rem; color:#888;">${esc(user.email)}</span></div>
      <button class="btn ghost js-delete-staff" data-id="${user.id}" type="button" style="color:#ff3b30;">Delete</button>
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
    <article class="order-row manager-order" style="margin-bottom:1rem; padding:1rem; background:rgba(255,255,255,0.02); border-radius:0.75rem;">
      <div>
        <b>${esc(booking.id)}</b>
        <span style="margin-left:0.5rem;">${formatDate(booking.createdAt)}</span>
        <div><small>${esc(booking.customer || booking.name)} · ${esc(booking.email)}</small></div>
      </div>
      <div style="margin:0.5rem 0;">
        <small>${esc(booking.brand)} ${esc(booking.model)} · ${esc(booking.repairType)}</small><br>
        <small>${esc(booking.pickupDropoff)} · ${esc(booking.status)}</small><br>
        <small>${esc(booking.repairServiceTitle || 'Custom repair')}</small>
      </div>
      <div>
        <button class="btn ghost js-update-booking" type="button" data-id="${esc(booking.id)}" style="background:#00e5ff; color:#000; padding:0.3rem 0.8rem; border-radius:0.5rem;">Update</button>
      </div>
    </article>
  `).join('') : '<div class="dash-empty">No repair bookings found.</div>';
}

function renderTechnicians() {
  const el = $('#technicianList');
  if (!el) return;
  el.innerHTML = (technicians && technicians.length) ? technicians.map(tech => `
    <article class="staff-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.1);">
      <div><b>${esc(tech.name)}</b><br><span style="font-size:0.75rem; color:#888;">${esc(tech.email)}</span></div>
      <button class="btn ghost danger-btn js-delete-technician" type="button" data-id="${esc(tech.id)}" style="color:#ff3b30;">Delete</button>
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
    <div style="background:rgba(0,229,255,0.1); padding:1rem; border-radius:1rem; text-align:center;"><b style="display:block; font-size:1.5rem; color:#00e5ff;">${fmt(analytics.totalSales)}</b><span>Total Sales</span></div>
    <div style="background:rgba(0,229,255,0.1); padding:1rem; border-radius:1rem; text-align:center;"><b style="display:block; font-size:1.5rem; color:#00e5ff;">${analytics.totalOrders}</b><span>Total Orders</span></div>
    <div style="background:rgba(0,229,255,0.1); padding:1rem; border-radius:1rem; text-align:center;"><b style="display:block; font-size:1.5rem; color:#00e5ff;">${analytics.delivered}</b><span>Delivered</span></div>
    <div style="background:rgba(0,229,255,0.1); padding:1rem; border-radius:1rem; text-align:center;"><b style="display:block; font-size:1.5rem; color:#00e5ff;">${analytics.products}</b><span>Products</span></div>`;
  
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
  try {
    const data = await api('/api/management/orders/placed');
    orders = data.orders || [];
    renderPlacedOrders();
  } catch (err) {
    console.error('Failed to load orders:', err);
    orders = [];
    renderPlacedOrders();
  }
}

async function loadRepairBookings() {
  if (offlineManager) {
    repairBookings = DUMMY_REPAIR_BOOKINGS;
    renderRepairBookings();
    return;
  }
  try {
    const data = await api('/api/management/repair-bookings');
    repairBookings = data.bookings || [];
    renderRepairBookings();
  } catch (err) {
    console.error('Failed to load repair bookings:', err);
    repairBookings = [];
    renderRepairBookings();
  }
}

async function loadTechnicians() {
  if (offlineManager) {
    technicians = DUMMY_TECHNICIANS;
    renderTechnicians();
    return;
  }
  try {
    const data = await api('/api/repair/technicians');
    technicians = data.technicians || [];
    renderTechnicians();
  } catch (err) {
    console.error('Failed to load technicians:', err);
    technicians = [];
    renderTechnicians();
  }
}

async function loadRepairCategories() {
  if (offlineManager) {
    repairCategories = DUMMY_REPAIR_CATEGORIES;
    renderRepairCategories();
    return;
  }
  try {
    const data = await api('/api/repair/categories');
    repairCategories = data.categories || [];
    renderRepairCategories();
  } catch (err) {
    console.error('Failed to load repair categories:', err);
    repairCategories = [];
    renderRepairCategories();
  }
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

// Spare Part Form
$('#sparePartForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  const name = document.querySelector('#sparePartForm input[name="name"]').value;
  const brand = document.querySelector('#sparePartForm input[name="brand"]').value;
  const category = document.querySelector('#sparePartForm input[name="category"]').value;
  const price = parseFloat(document.querySelector('#sparePartForm input[name="price"]').value);
  const stock = parseInt(document.querySelector('#sparePartForm input[name="stock"]').value);
  const description = document.querySelector('#sparePartForm textarea[name="description"]').value;
  
  const imageFile = document.getElementById('sparePartImage')?.files?.[0];
  const imageUrl = document.getElementById('sparePartImageUrl')?.value?.trim();
  
  let formData = new FormData();
  let useJson = false;
  let spareData = {};
  
  if (imageUrl && imageUrl.length > 0) {
    useJson = true;
    spareData = {
      name: name,
      brand: brand,
      category: category,
      price: price,
      stock: stock,
      description: description,
      image_url: imageUrl
    };
    console.log('📝 Submitting spare part with image URL:', imageUrl);
  } else if (imageFile) {
    formData.append('name', name);
    formData.append('brand', brand);
    formData.append('category', category);
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('description', description);
    formData.append('image', imageFile);
    console.log('📝 Submitting spare part with file upload:', imageFile.name);
  } else {
    toast('Please provide either an image file or an image URL', 'error');
    return;
  }
  
  try {
    let response;
    if (useJson) {
      response = await api('/api/admin/spare-parts', {
        method: 'POST',
        body: JSON.stringify(spareData)
      });
    } else {
      response = await api('/api/admin/spare-parts', {
        method: 'POST',
        body: formData
      });
    }
    
    e.target.reset();
    if (document.getElementById('sparePartImageUrl')) {
      document.getElementById('sparePartImageUrl').value = '';
    }
    if (document.getElementById('sparePartImage')) {
      document.getElementById('sparePartImage').value = '';
    }
    await loadAdminSpareParts();
    notifySparePartsUpdated();
    toast('Spare part added successfully!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Product Form
$('#productForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  const name = document.querySelector('#productForm input[name="name"]').value;
  const category = document.querySelector('#productForm select[name="cat"]').value;
  const price = parseFloat(document.querySelector('#productForm input[name="price"]').value);
  const wasValue = document.querySelector('#productForm input[name="was"]').value;
  const was = wasValue ? parseFloat(wasValue) : null;
  const badge = document.querySelector('#productForm select[name="badge"]').value;
  const desc = document.querySelector('#productForm textarea[name="desc"]').value;
  
  const imageFile = document.getElementById('productImage')?.files?.[0];
  const imageUrl = document.getElementById('productImageUrl')?.value?.trim();
  
  let useJson = false;
  let productData = {};
  let formData = new FormData();
  
  if (imageUrl && imageUrl.length > 0) {
    useJson = true;
    productData = {
      name: name,
      cat: category,
      price: price,
      was: was,
      badge: badge,
      desc: desc,
      image_url: imageUrl
    };
    console.log('📝 Submitting product with image URL:', imageUrl);
  } else if (imageFile) {
    formData.append('name', name);
    formData.append('cat', category);
    formData.append('price', price);
    formData.append('was', was || '');
    formData.append('badge', badge);
    formData.append('desc', desc);
    formData.append('img', imageFile);
    console.log('📝 Submitting product with file upload:', imageFile.name);
  } else {
    toast('Please provide either an image file or an image URL', 'error');
    return;
  }
  
  try {
    let response;
    if (useJson) {
      response = await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      });
    } else {
      response = await api('/api/admin/products', {
        method: 'POST',
        body: formData
      });
    }
    
    e.target.reset();
    if (document.getElementById('productImageUrl')) {
      document.getElementById('productImageUrl').value = '';
    }
    if (document.getElementById('productImage')) {
      document.getElementById('productImage').value = '';
    }
    await loadAdminData();
    toast('Product added successfully!', 'success');
  } catch (err) {
    console.error('Error adding product:', err);
    toast(err.message || 'Failed to add product', 'error');
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

window.forceRefresh = async function() {
  localStorage.removeItem('management_products');
  localStorage.removeItem('spare_parts');
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
  await loadAdminData();
  toast('Data refreshed from server!', 'success');
};

console.log('✅ Management.js loaded');
