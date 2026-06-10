// shop/repair.js - FIXED with public endpoint

async function fetchRepairServices() {
    try {
        // Use public endpoint (no login required)
        const response = await fetch('/api/repair-services', {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.services) {
                allServices = data.services;
                console.log('✅ Loaded', allServices.length, 'repair services');
                return true;
            }
        }
        
        // If public endpoint fails, try the old one (for backward compatibility)
        const fallbackResponse = await fetch('/api/management/repair-services', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            if (data && data.services) {
                allServices = data.services;
                console.log('✅ Loaded from admin endpoint:', allServices.length);
                return true;
            }
        }
        
        allServices = [];
        return false;
    } catch (err) {
        console.error('Failed to fetch repair services:', err);
        allServices = [];
        return false;
    }
}
