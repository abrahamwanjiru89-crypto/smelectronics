const installBtn = document.getElementById('installBtn');
const notifyBtn = document.getElementById('notifyBtn');
let deferredPrompt = null;

function showInstallButton() {
  if (!installBtn) return;
  installBtn.style.display = 'inline-flex';
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      toast('Install prompt accepted. Add SM Dynamics to your home screen.', 'success');
    } else {
      toast('Installation dismissed. You can install it later from the browser menu.', 'info');
    }
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
}

function showUpdateBanner(registration) {
  const existing = document.getElementById('updateBanner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>New version available.</span>
    <button class="btn ghost" id="refreshAppBtn" type="button">Reload</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('refreshAppBtn')?.addEventListener('click', async () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return toast('Notifications are not supported in this browser.', 'error');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Notifications not enabled.', 'info');
    return;
  }
  toast('Notifications enabled. You may receive updates and promotions.', 'success');

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification('SM Dynamics Electronics', {
      body: 'You will receive new product alerts and promotions here.',
      icon: '/shop/brand%20logo.png',
      badge: '/shop/brand%20logo.png',
      vibrate: [100, 50, 100],
      tag: 'welcome-notification'
    });
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/service-worker.js').then(reg => {
    if (reg.waiting) {
      showUpdateBanner(reg);
    }
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(reg);
        }
      });
    });
  }).catch(() => {
    toast('Service worker registration failed. App will still work offline when possible.', 'error');
  });

  let prevController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (prevController) {
      window.location.reload();
    }
    prevController = navigator.serviceWorker.controller;
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  toast('SM Dynamics Electronics installed successfully!', 'success');
});

window.addEventListener('load', () => {
  registerServiceWorker();
  if (notifyBtn) {
    notifyBtn.addEventListener('click', requestNotificationPermission);
  }
  // If beforeinstallprompt fired before DOM was ready, show the button now
  if (deferredPrompt) {
    showInstallButton();
  }
});
