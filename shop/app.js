// Replace your existing api function with this improved version
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
    throw new Error('Network request failed. Please check your server connection.');
  }
  
  // Handle 403 and 404 gracefully
  if (res.status === 403 || res.status === 404) {
    console.warn(`API endpoint ${path} returned ${res.status}, using fallback data`);
    return { error: true, status: res.status };
  }
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Update loadCounties function to handle missing endpoint
async function loadCounties() {
  const el = $('#county');
  if (!el) return;
  
  // Fallback counties (always available)
  const fallbackCounties = [
    { id: 'c-nairobi', name: 'Nairobi' },
    { id: 'c-mombasa', name: 'Mombasa' },
    { id: 'c-kisumu', name: 'Kisumu' },
    { id: 'c-nakuru', name: 'Nakuru' },
    { id: 'c-kiambu', name: 'Kiambu' },
    { id: 'c-eldoret', name: 'Uasin Gishu' },
    { id: 'c-machakos', name: 'Machakos' },
    { id: 'c-kajiado', name: 'Kajiado' },
    { id: 'c-thika', name: 'Thika' },
    { id: 'c-malindi', name: 'Malindi' },
    { id: 'c-garissa', name: 'Garissa' },
    { id: 'c-kakamega', name: 'Kakamega' },
    { id: 'c-bungoma', name: 'Bungoma' },
    { id: 'c-nyeri', name: 'Nyeri' },
    { id: 'c-meru', name: 'Meru' },
    { id: 'c-embu', name: 'Embu' },
    { id: 'c-kitui', name: 'Kitui' },
    { id: 'c-muranga', name: 'Muranga' },
    { id: 'c-kericho', name: 'Kericho' },
    { id: 'c-kisii', name: 'Kisii' },
    { id: 'c-kwale', name: 'Kwale' },
    { id: 'c-kilifi', name: 'Kilifi' },
    { id: 'c-lamu', name: 'Lamu' },
    { id: 'c-tana-river', name: 'Tana River' },
    { id: 'c-taita-taveta', name: 'Taita Taveta' },
    { id: 'c-vihiga', name: 'Vihiga' },
    { id: 'c-siaya', name: 'Siaya' },
    { id: 'c-homa-bay', name: 'Homa Bay' },
    { id: 'c-migori', name: 'Migori' },
    { id: 'c-nyamira', name: 'Nyamira' },
    { id: 'c-trans-nzoia', name: 'Trans Nzoia' },
    { id: 'c-west-pokot', name: 'West Pokot' },
    { id: 'c-nyandarua', name: 'Nyandarua' },
    { id: 'c-laikipia', name: 'Laikipia' },
    { id: 'c-samburu', name: 'Samburu' },
    { id: 'c-isiolo', name: 'Isiolo' },
    { id: 'c-marsabit', name: 'Marsabit' },
    { id: 'c-wajir', name: 'Wajir' },
    { id: 'c-mandera', name: 'Mandera' }
  ];
  
  // Populate dropdown immediately
  el.innerHTML = '<option value="">Select County</option>' + 
    fallbackCounties.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  // Try server but don't error if it fails
  try {
    const data = await api('/api/locations/counties');
    if (data && !data.error && data.counties && data.counties.length > 0) {
      el.innerHTML = '<option value="">Select County</option>' + 
        data.counties.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.log('Using fallback counties - server endpoint not available');
  }
  
  // Rest of the function remains the same...
  const changeHandler = async () => {
    const subEl = $('#subLocation');
    const datalist = $('#sublocationsList');
    const countyName = el.options[el.selectedIndex]?.text || '';
    const selectedCountyId = el.value;
    
    if (!selectedCountyId) {
      countySubLocations = [];
      if (subEl) subEl.value = '';
      if (datalist) datalist.innerHTML = '';
      updateCartTotals();
      return;
    }
    
    const fallbackSubLocationsData = {
      'Nairobi': ['CBD', 'Westlands', 'Kilimani', 'Karen', 'Langata', 'Eastleigh', 'South B', 'South C', 'Buruburu', 'Donholm', 'Kasarani', 'Ruaraka'],
      'Mombasa': ['Nyali', 'Bamburi', 'Mtwapa', 'Likoni', 'Changamwe', 'Kisauni', 'Mombasa CBD'],
      'Kisumu': ['Milimani', 'Kondele', 'Nyalenda', 'Kibos', 'Kisumu East', 'Kisumu West'],
      'Nakuru': ['CBD', 'Milimani', 'Lanet', 'Rhoda', 'Kaptembwo', 'London', 'Bondeni', 'Free Area', 'Menengai'],
      'Kiambu': ['Kiambu Town', 'Thika', 'Ruiru', 'Kikuyu', 'Limuru', 'Githunguri', 'Juja'],
      'Uasin Gishu': ['Eldoret CBD', 'Kapsoya', 'Langas', 'Huruma', 'Kimumu', 'Kamukunji']
    };
    
    const locations = fallbackSubLocationsData[countyName] || 
      ['Town Centre', 'Estate', 'Phase 1', 'Phase 2', 'Central', 'North', 'South'];
    
    countySubLocations = locations.map((loc, index) => ({
      id: `sl-${selectedCountyId}-${index}`,
      name: loc,
      countyId: selectedCountyId
    }));
    
    if (datalist) {
      datalist.innerHTML = locations.map(loc => `<option value="${loc}"></option>`).join('');
    }
    
    if (subEl) {
      subEl.placeholder = `Type area in ${countyName}...`;
      subEl.value = '';
    }
    
    updateCartTotals();
  };
  
  // Remove old listener and add new one
  if (el._changeListener) el.removeEventListener('change', el._changeListener);
  el._changeListener = changeHandler;
  el.addEventListener('change', changeHandler);
  
  $('#subLocation')?.addEventListener('change', updateCartTotals);
  $('#subLocation')?.addEventListener('input', debounce(updateCartTotals, 250));
}

// Update the delivery fee loading to handle 403 gracefully
async function loadDeliveryFee() {
  try {
    const data = await api('/api/admin/delivery-fee');
    if (data && !data.error && data.fee) {
      deliveryFee = data.fee;
      updateCartTotals();
    }
  } catch (err) {
    console.log('Using default delivery fee - admin endpoint requires login');
    // Keep default fee of 600
    deliveryFee = 600;
  }
}

// Update the init function
(async function initApp() {
  console.log('🚀 Initializing app...');
  
  // Load products from server
  await refreshProducts();
  
  renderProducts();
  renderFlash();
  renderCart();
  renderRecent();
  $('#wishCount').textContent = state.wish.length;
  
  // Load counties (uses fallbacks internally)
  loadCounties();
  
  // Load delivery fee (handles 403 gracefully)
  await loadDeliveryFee();
  
  try {
    const session = await api('/api/auth/me');
    if (session && !session.error && session.user?.role === 'customer') {
      state.user = session.user;
      await refreshOrders();
    }
  } catch (err) {
    console.log('Auth check failed:', err);
  }
  
  updateAccountUi();
  console.log('✅ App initialized with', PRODUCTS.length, 'products');
})();
