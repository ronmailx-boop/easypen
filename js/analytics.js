/*
 * EasyPen - visit counts with Cloudflare Web Analytics.
 * No cookies or local storage, no profile of the visitor: only the page address,
 * the site the visit came from, country and device type, as totals.
 * Documents and signatures are never sent (they don't leave the device at all).
 * The token is public by design (it only identifies the site to count).
 */
(function () {
  'use strict';
  const TOKEN = '0ea6f507024a41c58be259e3c2e48381';
  // Only the real site: not tests, local copies or the workers.dev address
  if (!TOKEN || location.hostname !== 'easypen.vplusstudio.app') return;
  // Loaded after the page, so it never slows it down; offline it just fails quietly
  window.addEventListener('load', () => {
    const s = document.createElement('script');
    s.type = 'module';   // as in Cloudflare's snippet
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.dataset.cfBeacon = JSON.stringify({ token: TOKEN });
    document.head.appendChild(s);
  });
})();
