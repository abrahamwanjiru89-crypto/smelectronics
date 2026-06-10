// ============================================
// S.M DYNAMICS MANAGEMENT JS - COMPLETE FIX
// ============================================

let currentUser = null;
let products = [];
let spareParts = [];
let repairServices = [];
let staff = [];
let technicians = [];
let orders = [];
let repairBookings = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

function showToast(message, type = 'info') {
    let container = document.getElementById('toasts');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toasts';
        container.className = 'toasts';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`API Error (${url}):`, err);
        throw err;
    }
}

// ============================================
// MANAGEMENT LOGIN
// ============================================

async function managerLogin(email, password) {
    try {
        const response = await fetch('/api/auth/management-login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showToast(`Welcome ${currentUser.name}`, 'success');
            await loadManagementPanel();
            return true;
        } else {
            const error = await response.json();
            showToast(error.error || 'Login failed', 'error');
            return false;
        }
    } catch (err) {
        showToast('Connection error: ' + err.message, 'error');
        return false;
    }
}

// ============================================
// LOAD MANAGEMENT PANEL
// ============================================

async function loadManagementPanel() {
    const loginSection = document.getElementById('managerLogin');
    const ordersSection = document.getElementById('managerOrders');
    
    if (loginSection) loginSection.hidden = true;
    if (ordersSection) ordersSection.hidden = false;
    
    const roleSpan = document.getElementById('managerRole');
    const titleSpan = document.getElementById('managerTitle');
    const adminSections = document.getElementById('adminSections');
    
    if (currentUser && currentUser.role === 'admin') {
        if (roleSpan) roleSpan.textContent = 'Administrator';
        if (titleSpan) titleSpan.textContent = 'Admin Dashboard';
        if (adminSections) adminSections.hidden = false;
    } else {
        if (roleSpan) roleSpan.textContent = 'Staff Portal';
        if (titleSpan) titleSpan.textContent = 'Staff Dashboard';
        if (adminSections) adminSections.hidden = true;
    }
    
    // Load all data in parallel
    await Promise.all([
        loadOrders(),
        loadRepairBookings(),
        loadDeliveryFee(),
        loadProducts(),
        loadSpareParts(),
        loadRepairServices(),
        loadStaffList(),
        loadTechnicians(),
        loadMetrics()
    ]);
}

// ============================================
// LOAD ORDERS
// ============================================

async function loadOrders() {
    const container = document.getElementById('placedOrders');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading orders...</div>';
    
    try {
        const data = await apiRequest('/api/management/orders/placed');
        orders = data.orders || [];
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="dash-empty">📦 No orders yet</div>';
            return;
        }
        
        container.innerHTML = orders.map(order => `
            <div class="order-row" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                    <div>
                        <strong style="color:#00e5ff;">${escapeHtml(order.id)}</strong>
                        <span class="status ${(order.status || 'pending').toLowerCase()}" style="margin-left:0.5rem;">${escapeHtml(order.status || 'Pending')}</span>
                    </div>
                    <div>${new Date(order.createdAt).toLocaleString()}</div>
                </div>
                <div style="margin-top:0.5rem;">
                    <div>Customer: <strong>${escapeHtml(order.customer)}</strong> (${escapeHtml(order.email)})</div>
                    <div>Total: <strong style="color:#20e0a6;">KES ${(order.total || 0).toLocaleString()}</strong> | Deposit: KES ${(order.depositAmount || 0).toLocaleString()}</div>
                    <div class="order-items" style="margin-top:0.5rem; font-size:0.85rem; color:#888;">
                        Items: ${(order.items || []).map(i => `${escapeHtml(i.name)} (x${i.qty})`).join(', ')}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Load orders error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load orders</div>';
    }
}

// ============================================
// LOAD REPAIR BOOKINGS
// ============================================

async function loadRepairBookings() {
    const container = document.getElementById('repairBookings');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading repair bookings...</div>';
    
    try {
        const data = await apiRequest('/api/management/repair-bookings');
        repairBookings = data.bookings || [];
        
        if (repairBookings.length === 0) {
            container.innerHTML = '<div class="dash-empty">🔧 No repair bookings yet</div>';
            return;
        }
        
        container.innerHTML = repairBookings.map(booking => `
            <div class="order-row" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                    <div><strong>${escapeHtml(booking.name)}</strong> - ${escapeHtml(booking.phone)}</div>
                    <span class="status pending">${escapeHtml(booking.status || 'Pending')}</span>
                </div>
                <div style="margin-top:0.5rem;">
                    <div>Device: ${escapeHtml(booking.brand)} ${escapeHtml(booking.model)}</div>
                    <div>Service: ${escapeHtml(booking.repairType)}</div>
                    <div style="font-size:0.8rem; color:#888;">Booked: ${new Date(booking.createdAt).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Load repair bookings error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load repair bookings</div>';
    }
}

// ============================================
// DELIVERY FEE
// ============================================

async function loadDeliveryFee() {
    try {
        const data = await apiRequest('/api/admin/delivery-fee');
        const feeElement = document.getElementById('currentDeliveryFee');
        if (feeElement) {
            feeElement.textContent = `Kshs ${(data.fee || 600).toLocaleString()}`;
        }
    } catch (err) {
        console.error('Failed to load delivery fee:', err);
        const feeElement = document.getElementById('currentDeliveryFee');
        if (feeElement) feeElement.textContent = 'Kshs 600';
    }
}

async function updateDeliveryFee() {
    const input = document.getElementById('newDeliveryFee');
    const newFee = parseInt(input.value);
    
    if (isNaN(newFee) || newFee < 0) {
        showToast('Please enter a valid delivery fee amount', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/delivery-fee', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fee: newFee })
        });
        
        if (response.ok) {
            const feeElement = document.getElementById('currentDeliveryFee');
            if (feeElement) feeElement.textContent = `Kshs ${newFee.toLocaleString()}`;
            input.value = '';
            showToast(`Delivery fee updated to Kshs ${newFee.toLocaleString()}`, 'success');
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        showToast('Failed to update delivery fee', 'error');
    }
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================

async function loadProducts() {
    const container = document.getElementById('productAdmin');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading products...</div>';
    
    try {
        const data = await apiRequest('/api/products');
        products = data.products || [];
        renderProducts();
    } catch (err) {
        console.error('Load products error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load products. Make sure server is running.</div>';
    }
}

function renderProducts() {
    const container = document.getElementById('productAdmin');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="dash-empty">📦 No products yet. Add your first product above.</div>';
        return;
    }
    
    container.innerHTML = products.map(product => {
        let badgeClass = '';
        let badgeText = 'No Badge';
        if (product.badge === 'sale') {
            badgeClass = 'badge-flash-sale';
            badgeText = '🔥 FLASH SALE';
        } else if (product.badge === 'hot') {
            badgeClass = 'badge-hot';
            badgeText = '⚡ HOT';
        } else if (product.badge === 'new') {
            badgeClass = 'badge-new';
            badgeText = '✨ NEW';
        }
        
        return `
            <div class="product-item" data-id="${product.id}" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                    <img src="${product.img || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;" onerror="this.src='shop/hero-phone.jpg'">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 5px 0;">${escapeHtml(product.name)}</h4>
                        <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
                            <span style="color:#00e5ff;">${escapeHtml(product.cat)}</span>
                            <span style="color:#20e0a6;">KES ${(product.price || 0).toLocaleString()}</span>
                            ${product.was ? `<span style="color:#888; text-decoration:line-through;">KES ${product.was.toLocaleString()}</span>` : ''}
                            <span style="${product.inStock !== false ? 'color:#00c853' : 'color:#ff3b30'}">${product.inStock !== false ? '✅ In Stock' : '❌ Out of Stock'}</span>
                            <span class="${badgeClass}" style="padding:2px 8px; border-radius:12px; font-size:0.7rem;">${badgeText}</span>
                        </div>
                        ${product.desc ? `<p style="font-size: 0.75rem; color: #888; margin-top: 5px;">${escapeHtml(product.desc.substring(0, 80))}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button onclick="updateProductBadge('${product.id}', 'sale', ${product.price * 1.5})" class="btn-badge" style="background:#ff2bd6; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer;">🔥 Flash Sale</button>
                        <button onclick="updateProductBadge('${product.id}', 'hot')" class="btn-badge" style="background:#ff4d6d; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer;">⚡ Hot</button>
                        <button onclick="updateProductBadge('${product.id}', 'new')" class="btn-badge" style="background:#20e0a6; color:#000; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer;">✨ New</button>
                        <button onclick="updateProductBadge('${product.id}', '')" class="btn-badge" style="background:#888; color:white; border:none; padding:0.5rem 0.8rem; border-radius:0.5rem; cursor:pointer;">Remove</button>
                        <button onclick="deleteProduct('${product.id}')" class="btn-badge" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function addProduct(formData) {
    try {
        const response = await fetch('/api/admin/products', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            showToast('✅ Product added successfully!', 'success');
            await loadProducts();
            return true;
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to add product', 'error');
            return false;
        }
    } catch (err) {
        showToast('Failed to add product: ' + err.message, 'error');
        return false;
    }
}

async function deleteProduct(productId) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Product deleted successfully', 'success');
            await loadProducts();
        } else {
            throw new Error('Delete failed');
        }
    } catch (err) {
        showToast('Failed to delete product', 'error');
    }
}

async function updateProductBadge(productId, badgeType, wasPrice = null) {
    try {
        const product = products.find(p => p.id === productId);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }
        
        const updateData = {
            name: product.name,
            price: product.price,
            inStock: product.inStock,
            cat: product.cat,
            desc: product.desc,
            badge: badgeType,
            was: wasPrice || product.was
        };
        
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showToast(`Badge updated to ${badgeType || 'none'}`, 'success');
            await loadProducts();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        showToast('Failed to update badge', 'error');
    }
}

// ============================================
// SPARE PARTS MANAGEMENT
// ============================================

async function loadSpareParts() {
    const container = document.getElementById('sparePartAdmin');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading spare parts...</div>';
    
    try {
        const data = await apiRequest('/api/spare-parts');
        spareParts = data.spares || [];
        renderSpareParts();
    } catch (err) {
        console.error('Load spare parts error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load spare parts</div>';
    }
}

function renderSpareParts() {
    const container = document.getElementById('sparePartAdmin');
    if (!container) return;
    
    if (!spareParts || spareParts.length === 0) {
        container.innerHTML = '<div class="dash-empty">🔩 No spare parts yet. Add your first spare part above.</div>';
        return;
    }
    
    container.innerHTML = spareParts.map(part => `
        <div class="spare-item" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                <img src="${part.image || part.image_path || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;" onerror="this.src='shop/hero-phone.jpg'">
                <div style="flex:1;">
                    <h4 style="margin:0 0 5px 0;">${escapeHtml(part.name)}</h4>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
                        <span style="color:#00e5ff;">${escapeHtml(part.brand || 'Generic')}</span>
                        <span style="color:#888;">${escapeHtml(part.category || 'Uncategorized')}</span>
                        <span style="color:#20e0a6;">KES ${(part.price || 0).toLocaleString()}</span>
                        <span style="${(part.stock || 0) > 0 ? 'color:#00c853' : 'color:#ff3b30'}">Stock: ${part.stock || 0}</span>
                    </div>
                    ${part.description ? `<p style="font-size: 0.75rem; color: #888; margin-top: 5px;">${escapeHtml(part.description.substring(0, 80))}</p>` : ''}
                </div>
                <div>
                    <button onclick="deleteSparePart('${part.id}')" class="btn-badge" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addSparePart(formData) {
    try {
        const response = await fetch('/api/admin/spare-parts', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            showToast('✅ Spare part added successfully!', 'success');
            await loadSpareParts();
            return true;
        } else {
            showToast('Failed to add spare part', 'error');
            return false;
        }
    } catch (err) {
        showToast('Failed to add spare part: ' + err.message, 'error');
        return false;
    }
}

async function deleteSparePart(partId) {
    if (!confirm('Delete this spare part?')) return;
    
    try {
        const response = await fetch(`/api/admin/spare-parts/${partId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Spare part deleted successfully', 'success');
            await loadSpareParts();
        } else {
            throw new Error('Delete failed');
        }
    } catch (err) {
        showToast('Failed to delete spare part', 'error');
    }
}

// ============================================
// REPAIR SERVICES MANAGEMENT
// ============================================

async function loadRepairServices() {
    const container = document.getElementById('repairServiceAdmin');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading repair services...</div>';
    
    try {
        const data = await apiRequest('/api/management/repair-services');
        repairServices = data.services || [];
        renderRepairServices();
    } catch (err) {
        console.error('Load repair services error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load repair services</div>';
    }
}

function renderRepairServices() {
    const container = document.getElementById('repairServiceAdmin');
    if (!container) return;
    
    if (!repairServices || repairServices.length === 0) {
        container.innerHTML = '<div class="dash-empty">🔧 No repair services yet. Add your first service above.</div>';
        return;
    }
    
    container.innerHTML = repairServices.map(service => `
        <div class="service-item" style="background:#1a1a2e; border-radius:1rem; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                <img src="${service.image || 'shop/hero-phone.jpg'}" style="width:60px; height:60px; object-fit:cover; border-radius:0.5rem;" onerror="this.src='shop/hero-phone.jpg'">
                <div style="flex:1;">
                    <h4 style="margin:0 0 5px 0;">${escapeHtml(service.title)}</h4>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.875rem;">
                        <span style="color:#00e5ff;">${escapeHtml(service.brand)}</span>
                        <span style="color:#888;">${escapeHtml(service.repairType)}</span>
                        <span style="color:#20e0a6;">KES ${(service.price || 0).toLocaleString()}</span>
                        <span>⏱️ ${service.duration || 'N/A'}</span>
                        <span>🔧 ${service.warranty || 'N/A'}</span>
                        <span style="${service.available ? 'color:#00c853' : 'color:#ff3b30'}">${service.available ? '✅ Available' : '❌ Unavailable'}</span>
                    </div>
                    ${service.description ? `<p style="font-size: 0.75rem; color: #888; margin-top: 5px;">${escapeHtml(service.description.substring(0, 80))}</p>` : ''}
                </div>
                <div>
                    <button onclick="deleteRepairService('${service.id}')" class="btn-badge" style="background:#ff3b30; color:#fff; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addRepairService(formData) {
    try {
        const response = await fetch('/api/management/repair-services', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            showToast('✅ Repair service added successfully!', 'success');
            await loadRepairServices();
            return true;
        } else {
            showToast('Failed to add repair service', 'error');
            return false;
        }
    } catch (err) {
        showToast('Failed to add repair service: ' + err.message, 'error');
        return false;
    }
}

async function deleteRepairService(serviceId) {
    if (!confirm('Delete this repair service?')) return;
    
    try {
        const response = await fetch(`/api/management/repair-services/${serviceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Repair service deleted successfully', 'success');
            await loadRepairServices();
        } else {
            throw new Error('Delete failed');
        }
    } catch (err) {
        showToast('Failed to delete repair service', 'error');
    }
}

// ============================================
// STAFF MANAGEMENT
// ============================================

async function loadStaffList() {
    const container = document.getElementById('staffList');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading staff...</div>';
    
    try {
        const data = await apiRequest('/api/admin/staff');
        staff = data.staff || [];
        
        if (staff.length === 0) {
            container.innerHTML = '<div class="dash-empty">No staff accounts</div>';
            return;
        }
        
        container.innerHTML = staff.map(user => `
            <div class="staff-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div>
                    <strong>${escapeHtml(user.name)}</strong>
                    <span style="font-size:0.8rem; color:#888; display:block;">${escapeHtml(user.email)}</span>
                </div>
                <button onclick="deleteStaff('${user.id}')" class="btn-badge" style="background:#ff3b30; color:white; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">Delete</button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Load staff error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load staff</div>';
    }
}

async function createStaff(name, email, password) {
    try {
        await apiRequest('/api/admin/staff', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        showToast('Staff created successfully', 'success');
        await loadStaffList();
        return true;
    } catch (err) {
        showToast(err.message, 'error');
        return false;
    }
}

async function deleteStaff(userId) {
    if (!confirm('Delete this staff account?')) return;
    try {
        await fetch(`/api/admin/staff/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        showToast('Staff deleted', 'success');
        await loadStaffList();
    } catch (err) {
        showToast('Delete failed', 'error');
    }
}

// ============================================
// TECHNICIANS MANAGEMENT
// ============================================

async function loadTechnicians() {
    const container = document.getElementById('technicianList');
    if (!container) return;
    
    container.innerHTML = '<div class="dash-empty">Loading technicians...</div>';
    
    try {
        const data = await apiRequest('/api/repair/technicians');
        technicians = data.technicians || [];
        
        if (technicians.length === 0) {
            container.innerHTML = '<div class="dash-empty">No technicians</div>';
            return;
        }
        
        container.innerHTML = technicians.map(tech => `
            <div class="staff-row" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div>
                    <strong>${escapeHtml(tech.name)}</strong>
                    <span style="font-size:0.8rem; color:#888; display:block;">${escapeHtml(tech.email)}</span>
                </div>
                <button onclick="deleteTechnician('${tech.id}')" class="btn-badge" style="background:#ff3b30; color:white; border:none; padding:0.5rem 1rem; border-radius:0.5rem; cursor:pointer;">Delete</button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Load technicians error:', err);
        container.innerHTML = '<div class="dash-empty">❌ Failed to load technicians</div>';
    }
}

async function addTechnician(name, email) {
    try {
        await apiRequest('/api/management/repair-technicians', {
            method: 'POST',
            body: JSON.stringify({ name, email })
        });
        showToast('Technician added successfully', 'success');
        await loadTechnicians();
        return true;
    } catch (err) {
        showToast(err.message, 'error');
        return false;
    }
}

async function deleteTechnician(techId) {
    if (!confirm('Delete this technician?')) return;
    try {
        await fetch(`/api/management/repair-technicians/${techId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        showToast('Technician deleted', 'success');
        await loadTechnicians();
    } catch (err) {
        showToast('Delete failed', 'error');
    }
}

// ============================================
// METRICS
// ============================================

async function loadMetrics() {
    try {
        const data = await apiRequest('/api/management/orders/placed');
        const ordersData = data.orders || [];
        
        const totalOrders = ordersData.length;
        const totalRevenue = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalDeposits = ordersData.reduce((sum, o) => sum + (o.depositAmount || 0), 0);
        
        const metricsDiv = document.getElementById('metrics');
        if (metricsDiv) {
            metricsDiv.innerHTML = `
                <div><b>${totalOrders}</b><span>Total Orders</span></div>
                <div><b>KES ${totalRevenue.toLocaleString()}</b><span>Total Revenue</span></div>
                <div><b>KES ${totalDeposits.toLocaleString()}</b><span>Total Deposits</span></div>
                <div><b>${products.length}</b><span>Products</span></div>
            `;
        }
    } catch (err) {
        console.error('Failed to load metrics:', err);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Login form
const loginForm = document.getElementById('managerLoginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;
        await managerLogin(email, password);
    });
}

// Logout
const logoutBtn = document.getElementById('managerLogout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        location.reload();
    });
}

// Staff creation
const staffForm = document.getElementById('staffForm');
if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = staffForm.querySelector('input[name="name"]').value;
        const email = staffForm.querySelector('input[name="email"]').value;
        const password = staffForm.querySelector('input[name="password"]').value;
        await createStaff(name, email, password);
        staffForm.reset();
    });
}

// Product addition
const productForm = document.getElementById('productForm');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(productForm);
        await addProduct(formData);
        productForm.reset();
    });
}

// Spare part addition
const sparePartForm = document.getElementById('sparePartForm');
if (sparePartForm) {
    sparePartForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(sparePartForm);
        await addSparePart(formData);
        sparePartForm.reset();
    });
}

// Repair service addition
const repairServiceForm = document.getElementById('repairServiceForm');
if (repairServiceForm) {
    repairServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(repairServiceForm);
        await addRepairService(formData);
        repairServiceForm.reset();
    });
}

// Technician addition
const technicianForm = document.getElementById('technicianForm');
if (technicianForm) {
    technicianForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = technicianForm.querySelector('input[name="name"]').value;
        const email = technicianForm.querySelector('input[name="email"]').value;
        await addTechnician(name, email);
        technicianForm.reset();
    });
}

// Delivery fee update
const updateFeeBtn = document.getElementById('updateDeliveryFeeBtn');
if (updateFeeBtn) {
    updateFeeBtn.addEventListener('click', updateDeliveryFee);
}
const feeInput = document.getElementById('newDeliveryFee');
if (feeInput) {
    feeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') updateDeliveryFee();
    });
}

// Make functions global for onclick handlers
window.deleteProduct = deleteProduct;
window.deleteSparePart = deleteSparePart;
window.deleteRepairService = deleteRepairService;
window.deleteStaff = deleteStaff;
window.deleteTechnician = deleteTechnician;
window.updateProductBadge = updateProductBadge;

// Check if user is already logged in on page load
async function checkAuth() {
    try {
        const data = await apiRequest('/api/auth/me');
        if (data.user && (data.user.role === 'admin' || data.user.role === 'staff')) {
            currentUser = data.user;
            await loadManagementPanel();
        } else {
            // Show login form
            const loginSection = document.getElementById('managerLogin');
            const ordersSection = document.getElementById('managerOrders');
            if (loginSection) loginSection.hidden = false;
            if (ordersSection) ordersSection.hidden = true;
        }
    } catch (err) {
        console.log('Not authenticated');
        const loginSection = document.getElementById('managerLogin');
        const ordersSection = document.getElementById('managerOrders');
        if (loginSection) loginSection.hidden = false;
        if (ordersSection) ordersSection.hidden = true;
    }
}

// Initialize
checkAuth();
