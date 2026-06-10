// shop/pwa.js - SIMPLIFIED FIXED VERSION

let deferredPrompt = null;

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW failed:', err));
  });
}

// Install button
const installButton = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installButton) {
    installButton.style.display = 'flex';
    installButton.onclick = async () => {
      installButton.style.display = 'none';
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    };
  }
});

// Notifications - using different variable name
const notifButton = document.getElementById('notifyBtn');
if (notifButton && 'Notification' in window) {
  notifButton.onclick = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notifButton.style.display = 'none';
    }
  };
  if (Notification.permission === 'granted') {
    notifButton.style.display = 'none';
  }
}
