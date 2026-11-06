/*
 * EasyPen - the server routes: checking a Google Play subscription, and reviewers' access code.
 *
 * Also /.well-known/assetlinks.json (worker/assetlinks.mjs), which links the Android app to the site.
 * Everything else is the static site (wrangler.jsonc: run_worker_first only for these).
 *
 * POST /api/play/verify  { sku, token }  ->  { active, expiry }
 *   Asks Google Play (Play Developer API, subscriptionsv2) about the purchase token and
 *   acknowledges a new purchase. Google refunds a purchase that is not acknowledged
 *   within 3 days, and Digital Goods API v2 can't acknowledge from the app.
 *   Nothing is stored: no tokens, no accounts, no personal details.
 *
 * POST /api/access  { code }  ->  { active, expiry }
 *   An access code for Google Play's app reviewers, who can't subscribe (Play Console →
 *   App content → App access). The code is the secret REVIEW_ACCESS_CODE; it opens the
 *   full version for ACCESS_DAYS on that device. Without the secret every code is refused.
 *
 * Secret (Cloudflare → Workers → easypen → Settings → Variables and Secrets):
 *   PLAY_SERVICE_ACCOUNT - the JSON key of a Google Cloud service account that has
 *   access to the app in Play Console (Users and permissions → "View financial data"
 *   and "Manage orders and subscriptions").
 *   REVIEW_ACCESS_CODE - the reviewers' access code (8+ characters, case-insensitive).
 * Both are GitHub secrets that the "Deploy to Cloudflare" workflow copies to the Worker.
 */

import { assetLinks } from './assetlinks.mjs';

const PACKAGE = 'app.vplusstudio.easypen';
const SKUS = ['easypen_monthly', 'easypen_yearly'];
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
// Paid up to the expiry time (a cancelled subscription runs to the end of what was paid)
const ACCESS_DAYS = 30;
const ENTITLED = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/play/verify') return verifyRoute(request, env);
    if (url.pathname === '/api/access') return accessRoute(request, env);
    if (url.pathname === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify(assetLinks(), null, 2), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' }
      });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function verifyRoute(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env.PLAY_SERVICE_ACCOUNT) return json({ error: 'not_configured' }, 503);
  let input;
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'bad_request' }, 400);
    input = JSON.parse(text);
  } catch (e) {
    return json({ error: 'bad_request' }, 400);
  }
  const { sku, token } = input || {};
  if (!SKUS.includes(sku) || typeof token !== 'string' || !/^[A-Za-z0-9._:-]{10,2048}$/.test(token)) {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    return json(await checkSubscription(env, sku, token));
  } catch (err) {
    console.error('verify failed', err && err.message);
    return json({ error: 'upstream' }, 502);
  }
}

async function accessRoute(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  let code = '';
  try {
    const text = await request.text();
    if (text.length > 512) return json({ error: 'bad_request' }, 400);
    code = String((JSON.parse(text) || {}).code || '').trim();
  } catch (e) {
    return json({ error: 'bad_request' }, 400);
  }
  const secret = String(env.REVIEW_ACCESS_CODE || '').trim();
  const ok = secret.length >= 8 && await sameText(code.toUpperCase(), secret.toUpperCase());
  return json(ok ? { active: true, expiry: Date.now() + ACCESS_DAYS * 86400000 } : { active: false, expiry: 0 });
}

// Compares the SHA-256 digests in constant time, so the answer time says nothing about the code
async function sameText(a, b) {
  const digest = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// { active, expiry (ms) } for the purchase token; acknowledges it when it's new
export async function checkSubscription(env, sku, token) {
  const access = await accessToken(env);
  const auth = { Authorization: `Bearer ${access}` };
  const res = await fetch(`${API}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: auth });
  // Unknown or expired token (or another app's): not a subscription
  if (res.status === 400 || res.status === 404 || res.status === 410) return { active: false, expiry: 0 };
  if (!res.ok) throw new Error(`subscriptionsv2 ${res.status} ${await googleError(res)}`);
  const sub = await res.json();
  const items = (sub.lineItems || []).filter((i) => i.productId === sku);
  const expiry = Math.max(0, ...items.map((i) => Date.parse(i.expiryTime) || 0));
  const active = ENTITLED.has(sub.subscriptionState) && expiry > Date.now();
  if (active && sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    const ack = await fetch(`${API}/purchases/subscriptions/${sku}/tokens/${encodeURIComponent(token)}:acknowledge`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: '{}'
    });
    // Not fatal: the next check acknowledges it (Google allows 3 days)
    if (!ack.ok) console.error('acknowledge failed', ack.status, await googleError(ack));
  }
  return { active, expiry: active ? expiry : 0 };
}

// Google's reason for a refusal, for the Worker log (its error message: no tokens or keys in it)
async function googleError(res) {
  try {
    const body = await res.json();
    const e = body.error;
    return String((e && (e.message || e.status)) || body.error_description || e || '').slice(0, 300);
  } catch (err) {
    return '';
  }
}

/* ---------------- Google OAuth for the service account ---------------- */

let cached = null; // { token, until }

async function accessToken(env) {
  if (cached && cached.until > Date.now() + 60000) return cached.token;
  const account = JSON.parse(env.PLAY_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(account, {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  if (!res.ok) throw new Error(`oauth ${res.status} ${await googleError(res)}`);
  const data = await res.json();
  cached = { token: data.access_token, until: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (text) => b64url(new TextEncoder().encode(text));

async function signJwt(account, claims) {
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const body = `${b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlText(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
  return `${body}.${b64url(sig)}`;
}

// For tests: forget the cached Google token
export function resetTokenCache() {
  cached = null;
}
