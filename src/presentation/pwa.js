import '../pwa.css';

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function updateNetworkStatus() {
  let status = document.querySelector('#network-status');
  if (navigator.onLine) {
    status?.remove();
    return;
  }
  if (!status) {
    status = document.createElement('aside');
    status.id = 'network-status';
    status.className = 'network-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Sin conexión. La app y el contenido público guardado están disponibles; los datos y pedidos requieren internet.';
    document.body.prepend(status);
  }
}

export function initializePwa(logger) {
  if (import.meta.env.PROD && window.location.protocol === 'http:' && !isLocalhost(window.location.hostname)) {
    window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
    return false;
  }

  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  if (!('serviceWorker' in navigator)) {
    logger.warn('Service workers are not supported by this browser');
    return true;
  }

  if (!window.isSecureContext) {
    logger.warn('The PWA service worker requires HTTPS or localhost');
    return true;
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .catch(error => logger.error('Could not register the PWA service worker', { message: error.message }));

  return true;
}
