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

function notifySparePartsUpdated() {
  window.dispatchEvent(new StorageEvent('storage', { 
    key: 'spare_parts_updated',
    newValue: Date.now().toString(),
    oldValue: null
  }));
}

// Badge controls
window.markAsFlashSale = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) return toast('Product not found', 'error');
  let wasPrice = product.was;
  if (!wasPrice) {
    const input = prompt('Enter original price:', product.price * 1.5);
    if (!input) return;
    wasPrice = parseFloat(input);
  }
  product.badge = 'sale';
  product.was = wasPrice;
  localStorage.setItem('management_products', JSON.stringify(products));
  renderProducts();
  toast(`🔥 ${product.name} marked as FLASH SALE!`, 'success');
};

window.markAsHot = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) return toast('Product not found', 'error');
  product.badge = 'hot';
  localStorage.setItem('management_products', JSON.stringify(products));
  renderProducts();
  toast(`⚡ ${product.name} marked as HOT!`, 'success');
};

window.markAsNew = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) return toast('Product not found', 'error');
  product.badge = 'new';
  localStorage.setItem('management_products', JSON.stringify(products));
  renderProducts();
  toast(`✨ ${product.name} marked as NEW!`, 'success');
};

window.removeBadge = async function(id) {
  const productId = String(id);
  const product = products.find(p => String(p.id) === productId);
  if (!product) return toast('Product not found', 'error');
  product.badge = '';
  localStorage.setItem('management_products', JSON.stringify(products));
  renderProducts();
  toast(`${product.name} badge removed`, 'success');
};

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
        <img src="${product.img || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;">
        <div style="flex:1;">
          <h4>${esc(product.name)}</h4>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
            <span style="color:#00e5ff;">${esc(product.cat)}</span>
            <span style="color:#00e5ff;">Price: ${fmt(product.price)}</span>
            ${product.was ? `<span style="color:#888; text-decoration:line-through;">Original: ${fmt(product.was)}</span>` : ''}
            <span class="badge-status" style="${product.badge === 'sale' ? 'background:#ff2bd6; padding:2px 8px; border-radius:12px; color:white;' : product.badge === 'hot' ? 'background:#ff4d6d; padding:2px 8px; border-radius:12px; color:white;' : product.badge === 'new' ? 'background:#20e0a6; padding:2px 8px; border-radius:12px; color:#000;' : ''}">
              ${product.badge === 'sale' ? '🔥 FLASH SALE' : product.badge === 'hot' ? '⚡ HOT' : product.badge === 'new' ? '✨ NEW' : 'No Badge'}
            </span>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="markAsFlashSale('${productId}')" class="btn-badge btn-flash-sale">% Sale</button>
          <button onclick="markAsHot('${productId}')" class="btn-badge btn-hot">Hot</button>
          <button onclick="markAsNew('${productId}')" class="btn-badge btn-new">New</button>
          <button onclick="removeBadge('${productId}')" class="btn-badge btn-remove-badge">Reset</button>
          <button onclick="deleteProduct('${productId}')" class="btn-badge btn-delete">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.deleteProduct = async function(id) {
  if (!confirm('Delete this product permanently from the server?')) return;
  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    products = products.filter(p => p.id != id);
    localStorage.setItem('management_products', JSON.stringify(products));
    renderProducts();
    toast('Product deleted completely', 'success');
  } catch (err) {
    toast(err.message || 'Failed to delete product from server', 'error');
  }
};

async function loadAdminData() {
  try {
    const d = await api('/api/products');
    products = d.products || [];
    localStorage.setItem('management_products', JSON.stringify(products));
    renderProducts();
  } catch (e) {
    console.error("Products load failed, relying on local storage", e);
    products = JSON.parse(localStorage.getItem('management_products') || '[]');
    renderProducts();
  }
}

// Add Product Form Listener Fix
$('#productForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  
  try {
    await api('/api/admin/products', { method:'POST', body:fd });
    e.target.reset();
    await loadAdminData();
    toast('Product added successfully!', 'success');
  } catch (err) {
    toast(err.message || 'Failed to add product', 'error');
  }
});

// Setup Initial Auth Context 
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await api('/api/auth/me');
    if (data && data.user && (data.user.role === 'admin' || data.user.role === 'staff')) {
      manager = data.user;
      if ($('#managerName')) $('#managerName').textContent = manager.name;
      if ($('#managerRole')) $('#managerRole').textContent = manager.role.toUpperCase();
      $('#managerLogin').hidden = true;
      $('#managerOrders').hidden = false;
      await loadAdminData();
    } else {
      window.location.href = '/login.html';
    }
  } catch (err) {
    window.location.href = '/login.html';
  }
});
