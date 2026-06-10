// shop/pwa.js - FIXED VERSION (no conflicts with app.js)

const installBtn = document.getElementById('installBtn');
const notificationBtn = document.getElementById('notifyBtn'); // Changed from notifyBtn
let deferredPrompt = null;

// Toast function for PWA (if app.js toast isn't available)
function pwaToast(msg, type = 'success') {
  const existingToast = document.getElementById('toasts');
  if (existingToast && typeof toast === 'function') {
    toast(msg, type);
  } else {
    console.log(msg);
    alert(msg);
  }
}

function showInstallButton() {
  if (!installBtn) return;
  installBtn.style.display = 'inline-flex';
  
  // Remove existing listeners to avoid duplicates
  const newInstallBtn = installBtn.cloneNode(true);
  installBtn.parentNode?.replaceChild(newInstallBtn, installBtn);
  
  newInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      pwaToast('Installation not ready yet. Try again later.', 'info');
      return;
    }
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      pwaToast('Add SM Dynamics to your home screen.', 'success');
    } else {
      pwaToast('You can install it later from the browser menu.', 'info');
    }
    deferredPrompt = null;
    newInstallBtn.style.display = 'none';
  });
}

function showUpdateBanner(registration) {
  const existing = document.getElementById('updateBanner');
  if (existing) return;
  
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>✨ New version available</span>
    <button class="btn ghost" id="refreshAppBtn" type="button">Update Now</button>
  `;
  document.body.appendChild(banner);
  
  const refreshBtn = document.getElementById('refreshAppBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    pwaToast('Notifications are not supported in this browser.', 'error');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    pwaToast('Notifications not enabled.', 'info');
    return false;
  }
  
  pwaToast('Notifications enabled! You will receive updates.', 'success');

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('SM Dynamics Electronics', {
        body: 'You will receive new product alerts and promotions here.',
        icon: '/shop/brand logo.png',
        badge: '/shop/brand logo.png',
        vibrate: [100, 50, 100],
        tag: 'welcome-notification',
        data: { url: window.location.href }
      });
    } catch (err) {
      console.error('Notification error:', err);
    }
  }
  return true;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return;
  }
  
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
      console.log('✅ Service Worker registered:', reg.scope);
      
      // Check for waiting worker
      if (reg.waiting) {
        showUpdateBanner(reg);
      }
      
      // Listen for new workers
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });
    })
    .catch(err => {
      console.error('❌ Service Worker registration failed:', err);
      pwaToast('Offline mode limited. App will still work.', 'info');
    });

  // Handle controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('Service Worker updated, reloading...');
    window.location.reload();
  });
}

// Before install prompt
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  showInstallButton();
  console.log('📱 PWA install prompt available');
});

// App installed
window.addEventListener('appinstalled', () => {
  pwaToast('SM Dynamics Electronics installed successfully! 🎉', 'success');
  console.log('App installed successfully');
});

// Page load initialization
window.addEventListener('load', () => {
  console.log('🚀 PWA module initializing...');
  registerServiceWorker();
  
  // Setup notification button (using notificationBtn, not notifyBtn)
  if (notificationBtn) {
    // Remove existing listeners to avoid duplicates
    const newNotificationBtn = notificationBtn.cloneNode(true);
    notificationBtn.parentNode?.replaceChild(newNotificationBtn, notificationBtn);
    
    newNotificationBtn.addEventListener('click', requestNotificationPermission);
    
    // Check if notifications are already granted
    if (Notification.permission === 'granted') {
      newNotificationBtn.style.display = 'none';
    } else {
      newNotificationBtn.style.display = 'inline-flex';
    }
  }
});

// Export for debugging (optional)
window.pwaReady = true;
