/*
 * EasyPen - shared UI helpers: toast messages, app version and Service Worker registration.
 * Exposes a global `EasyPenUI`.
 */
(function (global) {
  'use strict';

  let toastTimer = null;

  // Shows a short message at the bottom of the screen. type: 'info' | 'error' | 'success'
  function toast(message, type = 'info', duration = 3500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    global.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
        .catch((err) => console.warn('Service Worker registration failed', err));
    });
  }

  // Fills every [data-app-version] from js/version.js (when that page loads it)
  function showVersion() {
    if (!global.EASYPEN_VERSION) return;
    document.querySelectorAll('[data-app-version]').forEach((el) => {
      el.textContent = global.EASYPEN_VERSION;
    });
  }

  registerServiceWorker();
  showVersion();

  global.EasyPenUI = { toast };
})(window);
