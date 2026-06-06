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
// HELPER: Extract filename from image path
// ============================================
function getImageFilenameFromPath(imagePath) {
  if (!imagePath) return null;
  // Extract filename from paths like /uploads/filename.jpg or shop/hero-phone.jpg
  const parts = imagePath.split('/');
  return parts[parts.length - 1];
}

// ============================================
// HELPER: Delete image file from server
// ============================================
async function deleteImageFile(imagePath) {
  if (!imagePath) return true;
  // Don't delete default shop images
  const defaultImages = ['hero-phone.jpg', 'headphones.jpg', 'laptop.jpg', 'watch.jpg', 'vr.jpg', 'earbuds.jpg', 'camera.jpg', 'console.jpg', 'tablet.jpg', 'speaker.jpg', 'drone.jpg', 'hub.jpg', 'keyboard.jpg', 'brand logo.png'];
  const filename = getImageFilenameFromPath(imagePath);
  if (defaultImages.includes(filename)) {
    console.log('Skipping deletion of default image:', filename);
    return true;
  }
  
  try {
    const response = await fetch('/api/admin/delete-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath: imagePath })
    });
    const result = await response.json();
    return result.ok;
  } catch (err) {
    console.error('Failed to delete image file:', err);
    return false;
  }
}

// ============================================
// SPARE PARTS - FULL CRUD with image deletion
// ============================================

window.editSparePart = function(id) {
  const part = spareParts.find(p => p.id == id);
  if (!part) {
    toast('Spare part not found', 'error');
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'editSpareModal';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10001; display:flex; align-items:center; justify-content:center;';
  
  modal.innerHTML = `
    <div style="background:#1a1a2e; border-radius:1.5rem; padding:2rem; max-width:550px; width:90%; max-height:90vh; overflow-y:auto;">
      <h3 style="margin-bottom:1.5rem; color:#00e5ff;">✏️ Edit Spare Part</h3>
      <form id="editSpareForm" enctype="multipart/form-data">
        <input type="hidden" name="id" value="${part.id}">
        <input type="hidden" name="oldImage" value="${part.image || ''}">
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Part Name</label>
          <input name="name" value="${esc(part.name)}" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Brand</label>
          <input name="brand" value="${esc(part.brand)}" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Category</label>
          <input name="category" value="${esc(part.category || '')}" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Model Number</label>
          <input name="modelNumber" value="${esc(part.modelNumber || '')}" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Price (Kshs)</label>
          <input name="price" type="number" value="${part.price}" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Stock Quantity</label>
          <input name="stock" type="number" value="${part.stock}" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">New Image (optional)</label>
          <input name="image" type="file" accept="image/*" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
          <small style="color:#888;">Current: ${part.image || 'No image'}</small>
        </div>
        
        <div style="margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; color:#888;">Description</label>
          <textarea name="description" rows="3" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">${esc(part.description || '')}</textarea>
        </div>
        
        <div style="display:flex; gap:1rem; margin-top:1.5rem;">
          <button type="submit" class="btn primary" style="flex:1; padding:0.75rem;">💾 Save Changes</button>
          <button type="button" class="btn ghost" onclick="document.getElementById('editSpareModal').remove()" style="flex:1; padding:0.75rem;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('editSpareForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const oldImage = formData.get('oldImage');
    const newImage = formData.get('image');
    
    try {
      // If there's a new image, delete the old one first
      if (newImage && newImage.size > 0 && oldImage) {
        await deleteImageFile(oldImage);
      }
      
      const response = await fetch(`/api/admin/spare-parts/${id}`, {
        method: 'PUT',
        body: formData
      });
      
      if (response.ok) {
        await loadAdminSpareParts();
        modal.remove();
        toast('Spare part updated successfully!', 'success');
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
};

window.deleteSparePart = async function(id) {
  if (!confirm('⚠️ Are you sure you want to delete this spare part? This will also delete its image from the server.')) return;
  
  const part = spareParts.find(p => p.id == id);
  const imagePath = part?.image;
  
  try {
    // Delete the image file from server first
    if (imagePath) {
      await deleteImageFile(imagePath);
    }
    
    // Delete the database record
    await api(`/api/admin/spare-parts/${id}`, { method: 'DELETE' });
    
    // Update local data
    spareParts = spareParts.filter(p => p.id !== id);
    localStorage.setItem('spare_parts', JSON.stringify(spareParts));
    renderAdminSpareParts();
    toast('Spare part and image deleted successfully!', 'success');
  } catch (err) {
    toast('Failed to delete: ' + err.message, 'error');
  }
};

function renderAdminSpareParts() {
  const el = $('#sparePartAdmin');
  if (!el) return;
  
  if (!spareParts || spareParts.length === 0) {
    el.innerHTML = '<div class="dash-empty">No spare parts in inventory. Click "Add Spare Part" to get started.</div>';
    return;
  }
  
  el.innerHTML = spareParts.map(part => `
    <div style="background: #1a1a2e; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        <img src="${part.image || 'shop/hero-phone.jpg'}" alt="${esc(part.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 0.5rem;">
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.25rem;">${esc(part.name)}</h4>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem;">
            <span style="color: #00e5ff;">${esc(part.brand)}</span>
            <span style="color: #888;">${esc(part.category || 'Uncategorized')}</span>
            ${part.modelNumber ? `<span style="color: #888;">Model: ${esc(part.modelNumber)}</span>` : ''}
            <span style="color: #00e5ff;">${fmt(part.price)}</span>
            <span style="${part.stock > 0 ? 'color:#00c853' : 'color:#ff3b30'}">Stock: ${part.stock}</span>
          </div>
          ${part.description ? `<p style="font-size: 0.75rem; color: #888; margin-top: 0.25rem;">${esc(part.description.substring(0, 100))}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="editSparePart(${part.id})" style="background: #00e5ff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">✏️ Edit</button>
          <button onclick="deleteSparePart(${part.id})" style="background: #ff3b30; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================
// PRODUCTS - Full CRUD with image deletion
// ============================================

window.deleteProduct = async function(id) {
  if (!confirm('⚠️ Delete this product? This will also delete its image from the server.')) return;
  
  const product = products.find(p => p.id == id);
  const imagePath = product?.img;
  
  try {
    // Delete image file from server
    if (imagePath && !imagePath.includes('shop/')) {
      await deleteImageFile(imagePath);
    }
    
    // Delete from server
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    
    // Update local
    products = products.filter(p => p.id !== id);
    localStorage.setItem('management_products', JSON.stringify(products));
    renderProducts();
    toast('Product and image deleted!', 'success');
  } catch (err) {
    toast('Failed to delete: ' + err.message, 'error');
  }
};

window.editProduct = function(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  
  const modal = document.createElement('div');
  modal.id = 'editProductModal';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10001; display:flex; align-items:center; justify-content:center;';
  
  modal.innerHTML = `
    <div style="background:#1a1a2e; border-radius:1.5rem; padding:2rem; max-width:500px; width:90%;">
      <h3 style="margin-bottom:1.5rem;">✏️ Edit Product</h3>
      <form id="editProductForm" enctype="multipart/form-data">
        <input type="hidden" name="id" value="${product.id}">
        <input type="hidden" name="oldImage" value="${product.img || ''}">
        <div style="margin-bottom:1rem;"><input name="name" value="${esc(product.name)}" placeholder="Product Name" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;"></div>
        <div style="margin-bottom:1rem;">
          <select name="cat" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">
            <option value="phones" ${product.cat === 'phones' ? 'selected' : ''}>Phones</option>
            <option value="audio" ${product.cat === 'audio' ? 'selected' : ''}>Audio</option>
            <option value="laptops" ${product.cat === 'laptops' ? 'selected' : ''}>Laptops</option>
            <option value="wearables" ${product.cat === 'wearables' ? 'selected' : ''}>Wearables</option>
            <option value="gaming" ${product.cat === 'gaming' ? 'selected' : ''}>Gaming</option>
            <option value="home" ${product.cat === 'home' ? 'selected' : ''}>Smart Home</option>
          </select>
        </div>
        <div style="margin-bottom:1rem;"><input name="price" type="number" value="${product.price}" placeholder="Price" required style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;"></div>
        <div style="margin-bottom:1rem;"><input name="image" type="file" accept="image/*" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;"><small>Leave empty to keep current image</small></div>
        <div style="margin-bottom:1rem;"><textarea name="desc" rows="3" placeholder="Description" style="width:100%; padding:0.75rem; border-radius:0.75rem; background:#0f0f1a; border:1px solid #2a2a3e; color:white;">${esc(product.desc || '')}</textarea></div>
        <div style="display:flex; gap:1rem;">
          <button type="submit" class="btn primary" style="flex:1;">💾 Save</button>
          <button type="button" class="btn ghost" onclick="document.getElementById('editProductModal').remove()" style="flex:1;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const oldImage = formData.get('oldImage');
    const newImage = formData.get('image');
    
    try {
      if (newImage && newImage.size > 0 && oldImage && !oldImage.includes('shop/')) {
        await deleteImageFile(oldImage);
      }
      
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: formData
      });
      
      if (response.ok) {
        await loadAdminData();
        modal.remove();
        toast('Product updated!', 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
};

// ============================================
// REPAIR SERVICES with image deletion
// ============================================

window.deleteRepairService = async function(id) {
  if (!confirm('⚠️ Delete this repair service? This will also delete its image from the server.')) return;
  
  const service = repairServices.find(s => s.id == id);
  const imagePath = service?.image;
  
  try {
    if (imagePath && !imagePath.includes('shop/')) {
      await deleteImageFile(imagePath);
    }
    
    await api(`/api/management/repair-services/${id}`, { method: 'DELETE' });
    
    repairServices = repairServices.filter(s => s.id !== id);
    localStorage.setItem('repair_services', JSON.stringify(repairServices));
    renderRepairServices();
    toast('Repair service deleted!', 'success');
  } catch (err) {
    toast('Failed to delete: ' + err.message, 'error');
  }
};

// ============================================
// Add this to your server.py (create this endpoint)
// The server needs this DELETE endpoint for images
// ============================================
// Add this to your server.py do_DELETE method:
/*
if path == "/api/admin/delete-image":
    if not self.require({"admin"}):
        return
    data = self.read_json()
    image_path = data.get("imagePath")
    if image_path:
        filename = image_path.split('/')[-1]
        target = UPLOAD_DIR / filename
        if target.exists():
            target.unlink()
    self.send_json({"ok": True})
    return
*/

// ============================================
// LOAD FUNCTIONS (keep existing)
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

function renderRepairServices() {
  const el = $('#repairServiceAdmin');
  if (!el) return;
  
  if (!repairServices || repairServices.length === 0) {
    el.innerHTML = '<div class="dash-empty">No repair services available.</div>';
    return;
  }
  
  el.innerHTML = repairServices.map(service => `
    <div style="background: #1a1a2e; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        ${service.image ? `<img src="${service.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 0.5rem;">` : ''}
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.25rem;">${esc(service.title)}</h4>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem;">
            <span style="color: #00e5ff;">${esc(service.brand)}</span>
            <span style="color: #888;">${esc(service.repairType)}</span>
            <span style="color: #00e5ff;">${fmt(service.price)}</span>
            <span style="${service.available ? 'color:#00c853' : 'color:#ff3b30'}">${service.available ? 'Available' : 'Unavailable'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="editRepairService(${service.id})" style="background: #00e5ff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">✏️ Edit</button>
          <button onclick="deleteRepairService(${service.id})" style="background: #ff3b30; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderProducts() {
  const el = $('#productAdmin');
  if (!el) return;
  
  if (!products || products.length === 0) {
    el.innerHTML = '<div class="dash-empty">No products. Click "Add Product" to get started.</div>';
    return;
  }
  
  el.innerHTML = products.map(product => `
    <div style="background: #1a1a2e; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        <img src="${product.img || 'shop/hero-phone.jpg'}" alt="${esc(product.name)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 0.5rem;">
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.25rem;">${esc(product.name)}</h4>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem;">
            <span style="color: #00e5ff;">${esc(product.cat)}</span>
            <span style="color: #00e5ff;">${fmt(product.price)}</span>
            <span style="${product.inStock !== false ? 'color:#00c853' : 'color:#ff3b30'}">${product.inStock !== false ? 'In Stock' : 'Out of Stock'}</span>
          </div>
          ${product.desc ? `<p style="font-size: 0.75rem; color: #888; margin-top: 0.25rem;">${esc(product.desc.substring(0, 100))}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="editProduct(${product.id})" style="background: #00e5ff; color: #000; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">✏️ Edit</button>
          <button onclick="deleteProduct(${product.id})" style="background: #ff3b30; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================
// Keep all your existing functions below unchanged
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
