/*
 * Minimal static server for the tests.
 * Serves the repo under /easypen/ to mimic a GitHub Pages project site
 * (catches absolute paths that would break there).
 * With { prettyUrls: true } it also mimics Cloudflare's default HTML handling:
 * /page.html and /dir/index.html redirect (307) to /page and /dir/, which serve the file.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PREFIX = '/easypen/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.md': 'text/markdown; charset=utf-8'
};

function start({ prettyUrls = false } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(PREFIX)) {
      res.writeHead(404).end('Not found');
      return;
    }
    // Like GitHub Pages: only GET/HEAD. POSTs must be handled by the Service Worker.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(PREFIX.length));
    if (prettyUrls && rel.endsWith('.html')) {
      const pretty = rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel.slice(0, -'.html'.length);
      res.writeHead(307, { Location: PREFIX + pretty + url.search }).end();
      return;
    }
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    else if (prettyUrls && !path.extname(rel)) rel += '.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ baseUrl: `http://127.0.0.1:${port}${PREFIX}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

module.exports = { start };
