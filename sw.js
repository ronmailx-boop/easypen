/*
 * EasyPen - Service Worker
 *  - Precaches the app shell + PDF libraries for full offline use.
 *  - Handles the Web Share Target POST (files shared from WhatsApp/Gmail/…):
 *    stores the PDF in IndexedDB and redirects to the editor.
 */
importScripts('js/storage.js');

const VERSION = 'easypen-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL = [
  './',
  'index.html',
  'viewer.html',
  'share-target/',
  'manifest.json',
  'css/style.css',
  'js/storage.js',
  'js/ui.js',
  'js/home.js',
  'js/signature-pad.js',
  'js/pdf-handler.js',
  'js/share.js',
  'js/viewer.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/pdf-lib/pdf-lib.min.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs'
];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('easypen-') && !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === 'POST' && url.href.startsWith(scopeUrl('share-target/'))) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET') return;
  event.respondWith(cacheFirst(request, event));
});

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('file').filter((f) => f && typeof f !== 'string');
    if (!files.length) return Response.redirect(scopeUrl('index.html?error=share'), 303);
    const file = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
    if (!file) return Response.redirect(scopeUrl('index.html?error=type'), 303);
    const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    await self.EasyPenStorage.setCurrentDocument(file.name || 'document.pdf', blob);
    return Response.redirect(scopeUrl('viewer.html?source=share'), 303);
  } catch (err) {
    console.error('Share target failed', err);
    return Response.redirect(scopeUrl('index.html?error=share'), 303);
  }
}

// Cache first, refreshed in the background (stale-while-revalidate).
async function cacheFirst(request, event) {
  const isPage = request.mode === 'navigate';
  const cached = await caches.match(request, { ignoreSearch: isPage });

  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(cached ? SHELL_CACHE : RUNTIME_CACHE);
        await cache.put(isPage ? stripSearch(request.url) : request, response.clone());
      }
      return response;
    });

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  try {
    return await network;
  } catch (err) {
    if (isPage) {
      const fallback = await caches.match(scopeUrl('index.html'));
      if (fallback) return fallback;
    }
    return new Response('אין חיבור לרשת', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

function stripSearch(href) {
  const u = new URL(href);
  u.search = '';
  return u.href;
}
