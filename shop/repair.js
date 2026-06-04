const elements = {
  searchMode: document.getElementById('searchMode'),
  searchText: document.getElementById('searchText'),
  availabilityFilter: document.getElementById('availabilityFilter'),
  repairFilterBar: document.getElementById('repairFilterBar'),
  spareFilterBar: document.getElementById('spareFilterBar'),
  brandChips: document.getElementById('brandChips'),
  categoryChips: document.getElementById('categoryChips'),
  spareBrand: document.getElementById('spareBrand'),
  spareSearch: document.getElementById('spareSearch'),
  repairGrid: document.getElementById('repairGrid'),
  spareGrid: document.getElementById('spareGrid'),
  bookingForm: document.getElementById('bookingForm'),
  serviceIdInput: document.getElementById('serviceId'),
  serviceTitle: document.getElementById('serviceTitle'),
  bookingMessage: document.getElementById('bookingMessage'),
  trackForm: document.getElementById('trackForm'),
  trackMessage: document.getElementById('trackMessage'),
  deviceBrand: document.getElementById('deviceBrand'),
  deviceModel: document.getElementById('deviceModel'),
  modelSuggest: document.getElementById('modelSuggest'),
  repairTypeSelect: document.getElementById('repairTypeSelect'),
  cartBtn: document.getElementById('cartBtn'),
  cartCount: document.getElementById('cartCount'),
  cartSide: document.getElementById('cartSide'),
  cartClose: document.getElementById('cartClose'),
  accountBtn: document.getElementById('accountBtn'),
  authModal: document.getElementById('authModal'),
  authClose: document.getElementById('authClose'),
  overlay: document.getElementById('overlay'),
  loginForm: document.getElementById('loginForm'),
  toasts: document.getElementById('toasts')
};

const state = {
  currentView: 'repairs',
  services: [],
  statuses: [],
  categories: [],
  spareBrands: [],
  spares: [],
  selectedService: null,
  selectedBrand: '',
  selectedCategory: '',
  loadedOnce: false,
  user: null
};

const LOADING = {
  repairs: '<p class="muted" style="padding:1.25rem">Loading repair services...</p>',
  spares: '<p class="muted" style="padding:1.25rem">Loading spare parts...</p>',
};

async function api(path, options = {}) {
  const response = await fetch(path, {
  credentials: 'include',
  headers: options.body instanceof FormData
    ? {}
    : { 'Content-Type': 'application/json' },
  ...options
});
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Server request failed');
  }
  return response.json();
}

function toast(msg, type='info') {
  const container = elements.toasts;
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(50%)'; t.style.transition = 'all .4s'; }, 2800);
  setTimeout(() => t.remove(), 3300);
}

function updateCartBadge() {
  try {
    const cart = JSON.parse(localStorage.getItem('nova_cart')) || [];
    if (elements.cartCount) elements.cartCount.textContent = cart.reduce((s, c) => s + c.qty, 0);
  } catch (e) {
    if (elements.cartCount) elements.cartCount.textContent = '0';
  }
}

function addSpareToCart(id) {
  const p = state.spares.find(x => x.id === id);
  if (!p) return;
  if (p.stock <= 0) return toast('This part is currently out of stock', 'error');
  
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('nova_cart')) || [];
  } catch (e) { cart = []; }
  
  const item = cart.find(c => c.id === id);
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  
  localStorage.setItem('nova_cart', JSON.stringify(cart));
  updateCartBadge();
  toast(`${p.name} added to cart`, 'success');
}

function formatCurrency(amount) {
  return 'Kshs ' + Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0 });
}

function buildStatusSteps(activeStatus) {
  return state.statuses
    .map(status => `
      <div class="track-step ${status.status.toLowerCase().replace(/\s+/g, '')} ${status.status === activeStatus ? 'active' : ''}">
        <div class="step-label">${status.status}</div>
        <small>${status.status === 'Pending' ? 'Booking received' : status.status === 'Received' ? 'Device received' : status.status === 'Diagnosing' ? 'Diagnostics underway' : status.status === 'Repairing' ? 'Repair in progress' : status.status === 'Completed' ? 'Repair complete' : 'Ready for pickup'}</small>
      </div>
    `)
    .join('');
}

function renderCategoryChips() {
  const container = elements.categoryChips;
  if (!container) return;

  elements.categoryChips.innerHTML = state.categories.length
    ? [{id: '', name: 'All'}, ...state.categories].map(category => `
        <button type="button" data-category="${category.id || ''}" class="${(state.selectedCategory || '') === String(category.id || '') ? 'active' : ''}">${category.name}</button>
      `).join('')
    : '<p class="muted">No categories yet</p>';

  elements.categoryChips.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedCategory = button.dataset.category;
      renderCategoryChips();
      renderServices();
    });
  });
}

function renderBrandChips() {
  if (!elements.brandChips) return;
  const brands = Array.from(new Set(state.services.map(service => service.brand).filter(Boolean))).sort();
  elements.brandChips.innerHTML = ['All', ...brands].map(brand => `
      <button type="button" data-brand="${brand === 'All' ? '' : brand}" class="${state.selectedBrand === brand ? 'active' : ''}">${brand}</button>
    `).join('');

  elements.brandChips.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedBrand = button.dataset.brand;
      renderBrandChips();
      renderServices();
    });
  });
}

function renderServices() {
  if (!elements.repairGrid) return;
  
  // Show a loading message if services haven't been fetched yet
  if (state.services.length === 0 && !state.loadedOnce) return elements.repairGrid.innerHTML = LOADING.repairs;

  const query = elements.searchText?.value?.trim().toLowerCase() || '';
  const available = elements.availabilityFilter?.value || '';
  const filtered = state.services.filter(service => {
    const text = `${service.title} ${service.brand} ${service.repairType} ${service.description}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (state.selectedBrand && service.brand !== state.selectedBrand) return false;
    if (state.selectedCategory && String(service.categoryId) !== state.selectedCategory) return false;
    if (available !== '') return (service.available ? "1" : "0") === available;
    return true;
  });

  elements.repairGrid.innerHTML = filtered.length
    ? filtered.map(service => `
        <article class="card card-service">
          <div class="card-media"><img src="${service.image || 'shop/hero-phone.jpg'}" alt="${service.title}" loading="lazy"></div>
          <div class="card-body">
            <span class="card-cat">${service.brand} · ${service.category || 'Repair'}</span>
            <h3 class="card-title">${service.title}</h3>
            <p>${service.description || 'Reliable repair service with transparent pricing.'}</p>
            <div class="card-foot">
              <div>
                <div class="price">${formatCurrency(service.price)}</div>
                <small>${service.duration || '1-2 days'} · ${service.warranty || 'Limited'} warranty</small>
              </div>
              <button type="button" class="btn primary js-select-service" data-id="${service.id}" ${!service.available ? 'disabled' : ''}>${service.available ? 'Select Service' : 'Unavailable'}</button>
            </div>
          </div>
        </article>
      `).join('')
    : '<p class="muted" style="padding:1.25rem">No repair services match your search. Try a different model, brand, or filter.</p>';

  elements.repairGrid.querySelectorAll('.js-select-service').forEach(button => {
    button.addEventListener('click', () => {
      const selected = state.services.find(item => item.id === button.dataset.id);
      if (selected) selectService(selected);
    });
  });
}

function renderSpareParts() {
  if (!elements.spareGrid) return;
  elements.spareGrid.innerHTML = state.spares.length
    ? state.spares.map(part => `
        <article class="card card-service">
          ${part.image ? `<div class="card-media"><img src="${part.image}" alt="${part.name}" loading="lazy"></div>` : ''}
          <div class="card-body">
            <span class="card-cat">${part.brand} · ${part.category}</span>
            <h3 class="card-title">${part.name}</h3>
            <p>${part.description || 'High-quality spare part sourced from trusted suppliers.'}</p>
            <div class="card-foot">
              <div>
                <div class="price">${formatCurrency(part.price)}</div>
                <small>${part.stock > 0 ? 'In stock' : 'Out of stock'}</small>
              </div>
              <button type="button" class="btn primary js-add-spare" data-id="${part.id}" ${part.stock <= 0 ? 'disabled' : ''}>Order</button>
            </div>
          </div>
        </article>
      `).join('')
    : '<p class="muted" style="padding:1.25rem">No spare parts found. Change brand or search term to discover more parts.</p>';

  elements.spareGrid.querySelectorAll('.js-add-spare').forEach(btn => {
    btn.addEventListener('click', () => addSpareToCart(btn.dataset.id));
  });
}

function setSearchMode(mode) {
  state.currentView = mode;
  if (elements.repairFilterBar) elements.repairFilterBar.style.display = mode === 'repairs' ? 'grid' : 'none';
  if (elements.spareFilterBar) elements.spareFilterBar.style.display = mode === 'spares' ? 'grid' : 'none';
  if (elements.repairGrid) elements.repairGrid.style.display = mode === 'repairs' ? 'grid' : 'none';
  if (elements.spareGrid) elements.spareGrid.style.display = mode === 'spares' ? 'grid' : 'none';
  if (mode === 'repairs') {
    renderServices();
  } else {
    loadSpareParts();
  }
}

function selectService(service) {
  if (!elements.serviceIdInput) return;
  state.selectedService = service;
  elements.serviceIdInput.value = service.id;

  if (elements.serviceTitle) elements.serviceTitle.value = `${esc(service.title)} — ${esc(service.brand)}`;
  if (elements.deviceBrand) elements.deviceBrand.value = service.brand;
  
  if (elements.repairTypeSelect) {
    const types = Array.from(new Set(state.services.map(item => item.repairType))).sort();
    elements.repairTypeSelect.innerHTML = types.map(type => `
        <option value="${type}" ${type === service.repairType ? 'selected' : ''}>${type}</option>
      `).join('');
  }
  if (elements.bookingMessage) elements.bookingMessage.innerHTML = `<p class="muted">Selected service: <strong>${esc(service.title)}</strong>. Complete the form to submit your booking.</p>`;
  if (elements.serviceTitle) elements.serviceTitle.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderRepairTypes() {
  if (!elements.repairTypeSelect) return;
  const types = Array.from(new Set(state.services.map(service => service.repairType))).sort();
  elements.repairTypeSelect.innerHTML = '<option value="">Select repair type</option>' + types.map(type => `<option value="${type}">${type}</option>`).join('');
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

let modelDebounce = null;
async function updateModelSuggestions() {
  if (!elements.deviceModel || !elements.modelSuggest) return;
  const query = elements.deviceModel.value.trim();
  if (!query) {
    elements.modelSuggest.innerHTML = '';
    return;
  }
  try {
    const params = new URLSearchParams({ q: query });
    if (elements.deviceBrand.value) params.append('brand', elements.deviceBrand.value);
    const data = await api(`/api/repair/models?${params.toString()}`);
    elements.modelSuggest.innerHTML = (data.models || []).slice(0, 8).map(model => `<li role="button" tabindex="0">${model}</li>`).join('');
    Array.from(elements.modelSuggest.children).forEach(item => {
      item.addEventListener('click', () => {
        elements.deviceModel.value = item.textContent;
        elements.searchText.value = item.textContent;
        elements.modelSuggest.innerHTML = '';
        if (state.currentView === 'repairs') renderServices();
      });
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter') item.click();
      });
    });
  } catch (error) {
    elements.modelSuggest.innerHTML = '<li class="muted">No models found</li>';
  }
}

async function loadServices() {
  try {
    const data = await api('/api/repair/services');
    state.loadedOnce = true;
    state.services = data.services || [];
    renderBrandChips();
    renderCategoryChips();
    renderRepairTypes();
    renderServices();
  } catch (error) {
    elements.repairGrid.innerHTML = `<p class="muted" style="padding:1.25rem">Unable to load repair services: ${error.message}</p>`;
  }
}

async function loadSpareBrands() {
  if (!elements.spareBrand) return;
  try {
    const data = await api('/api/spare-parts/brands');
    state.spareBrands = data.brands || [];
    elements.spareBrand.innerHTML = '<option value="">All brands</option>' + state.spareBrands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
  } catch (error) {
    elements.spareBrand.innerHTML = '<option value="">All brands</option>';
  }
}

async function loadSpareParts() {
  if (!elements.spareGrid) return;
  elements.spareGrid.innerHTML = LOADING.spares;
  try {
    const params = new URLSearchParams();
    if (elements.spareBrand.value) params.append('brand', elements.spareBrand.value);
    if (elements.spareSearch.value.trim()) params.append('search', elements.spareSearch.value.trim());
    const data = await api(`/api/spare-parts?${params.toString()}`);
    state.spares = data.spares || [];
    renderSpareParts();
  } catch (error) {
    elements.spareGrid.innerHTML = `<p class="muted" style="padding:1.25rem">Unable to load spare parts: ${error.message}</p>`;
  }
}

function showBookingMessage(message, type = 'info') {
  if (elements.bookingMessage) elements.bookingMessage.innerHTML = `<p class="muted">${message}</p>`;
}

function showTrackMessage(message, type = 'info') {
  if (elements.trackMessage) elements.trackMessage.innerHTML = `<p class="muted">${message}</p>`;
}

async function init() {
  // Initialize scroll reveal observer so content becomes visible
  const revObs = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => revObs.observe(el));

  // Setup Initial View
  setSearchMode(state.currentView);
  renderBrandChips();
  renderCategoryChips();

  // Navigation & UI
  elements.cartBtn?.addEventListener('click', () => {
    toast('Redirecting to shop for checkout...', 'info');
    setTimeout(() => location.href = 'index.html#cart', 1000);
  });

  elements.accountBtn?.addEventListener('click', () => {
    if (state.user) location.href = 'index.html#dashboard';
    else {
      elements.authModal?.classList.add('open');
      elements.overlay?.classList.add('show');
    }
  });

  elements.authClose?.addEventListener('click', () => {
    elements.authModal?.classList.remove('open');
    elements.overlay?.classList.remove('show');
  });

  elements.overlay?.addEventListener('click', () => {
    elements.authModal?.classList.remove('open');
    elements.overlay?.classList.remove('show');
  });

  elements.loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email').trim(), password: fd.get('password') })
      });
      state.user = data.user;
      elements.authModal?.classList.remove('open');
      elements.overlay?.classList.remove('show');
      if (elements.accountBtn) elements.accountBtn.textContent = state.user.name.split(' ')[0];
      toast('Login successful', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  elements.searchMode?.addEventListener('change', event => setSearchMode(event.target.value));
  elements.searchText?.addEventListener('input', () => {
    if (state.currentView === 'repairs') renderServices();
    else loadSpareParts();
  });
  elements.availabilityFilter?.addEventListener('change', renderServices);
  elements.spareBrand?.addEventListener('change', loadSpareParts);
  elements.spareSearch?.addEventListener('input', () => {
    clearTimeout(modelDebounce);
    modelDebounce = setTimeout(loadSpareParts, 300);
  });
  elements.deviceBrand?.addEventListener('change', () => {
    clearTimeout(modelDebounce);
    modelDebounce = setTimeout(updateModelSuggestions, 120);
  });
  elements.deviceModel?.addEventListener('input', () => {
    clearTimeout(modelDebounce);
    modelDebounce = setTimeout(updateModelSuggestions, 240);
  });
  if (elements.modelSuggest) document.addEventListener('click', event => {
    if (!elements.modelSuggest.contains(event.target) && event.target !== elements.deviceModel) {
      elements.modelSuggest.innerHTML = '';
    }
  });

  elements.bookingForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(elements.bookingForm);
    if (state.selectedService) {
      formData.set('serviceId', state.selectedService.id);
      formData.set('repairType', state.selectedService.repairType);
    }
    try {
      showBookingMessage('Submitting repair booking...');
      const response = await fetch('/api/repair/bookings', { method: 'POST', body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Booking failed');
      }
      const result = await response.json();
      elements.bookingForm.reset();
      state.selectedService = null;
      elements.serviceIdInput.value = '';
      elements.serviceTitle.value = '';
      renderServices();
      if (result.booking) {
        showBookingMessage(`Booking received. Your repair ID is ${result.booking.id}. Track status using your booking ID and email.`);
      } else {
        showBookingMessage('Booking created successfully.');
      }
    } catch (error) {
      showBookingMessage(error.message);
    }
  });

  // Handle Tracking Form
  elements.trackForm?.addEventListener('submit', handleTracking);

  // Incremental data loading
  loadAppData();
}

async function handleTracking(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(elements.trackForm).entries());
  if (!values.bookingId || !values.email) return showTrackMessage('Please enter both booking ID and email.');
  try {
    showTrackMessage('Looking up booking...');
    const data = await api(`/api/repair/bookings/track?bookingId=${encodeURIComponent(values.bookingId)}&email=${encodeURIComponent(values.email)}`);
    if (data.booking) {
      elements.trackMessage.innerHTML = `
        <div class="booking-panel card">
          <p><strong>Booking ID:</strong> ${esc(data.booking.id)}</p>
          <p><strong>Status:</strong> <span class="status-pill ${esc(data.booking.status.toLowerCase().replace(/\s+/g, ''))}">${esc(data.booking.status)}</span></p>
          <p><strong>Device:</strong> ${esc(data.booking.brand)} ${esc(data.booking.model)}</p>
          <p><strong>Repair:</strong> ${esc(data.booking.repairType)}</p>
          <div class="track-steps">${buildStatusSteps(data.booking.status)}</div>
        </div>`;
    } else {
      showTrackMessage('Booking not found.');
    }
  } catch (error) {
    showTrackMessage(error.message);
  }
}

async function loadAppData() {
  if (elements.repairGrid) elements.repairGrid.innerHTML = LOADING.repairs;
  api('/api/repair/statuses').then(data => { 
    state.statuses = data.statuses || []; 
  }).catch(() => {});
  
  api('/api/repair/categories').then(data => { 
    state.categories = data.categories || []; 
    renderCategoryChips();
  }).catch(() => {});

  try {
    updateCartBadge();
    api('/api/auth/me').then(data => {
      state.user = data.user;
      if (state.user && elements.accountBtn) elements.accountBtn.textContent = state.user.name.split(' ')[0];
    }).catch(() => {});
    
    await Promise.all([loadServices(), loadSpareBrands()]);
  } catch (error) {
    console.error("Critical data load failed:", error);
  }
}

init().catch(error => {
  if (elements.repairGrid) elements.repairGrid.innerHTML = `<p class="muted" style="padding:1.25rem">Initialization failed: ${error.message}</p>`;
  console.error("App Init Error:", error);
});
