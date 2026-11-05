/*
 * The subscription check (worker/index.mjs) with Google's APIs replaced by a fake fetch.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  PLAY_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'easypen@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
  }),
  ASSETS: { fetch: async () => new Response('asset') }
};

let worker;
let calls;
let subscription;
const realFetch = global.fetch;

beforeEach(async () => {
  worker = worker || await import(pathToFileURL(path.resolve(__dirname, '../worker/index.mjs')).href);
  worker.resetTokenCache();
  calls = [];
  subscription = {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems: [{ productId: 'easypen_monthly', expiryTime: new Date(Date.now() + 30 * 86400000).toISOString() }]
  };
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      // The JWT is signed with the service account's key
      const jwt = new URLSearchParams(init.body).get('assertion');
      const [h, c, s] = jwt.split('.');
      const ok = crypto.verify('sha256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'));
      assert.ok(ok, 'JWT signature');
      assert.equal(JSON.parse(Buffer.from(c, 'base64url')).scope, 'https://www.googleapis.com/auth/androidpublisher');
      return Response.json({ access_token: 'google-token', expires_in: 3600 });
    }
    if (String(url).includes('/subscriptionsv2/tokens/')) {
      assert.equal(init.headers.Authorization, 'Bearer google-token');
      return subscription ? Response.json(subscription) : new Response('{}', { status: 410 });
    }
    if (String(url).endsWith(':acknowledge')) return new Response(null, { status: 204 });
    throw new Error(`unexpected ${url}`);
  };
});

afterEach(() => { global.fetch = realFetch; });

const verify = (body, method = 'POST') => worker.default.fetch(new Request('https://easypen.vplusstudio.app/api/play/verify', {
  method, body: method === 'POST' ? JSON.stringify(body) : undefined
}), env);

test('worker: an active new subscription is verified and acknowledged', async () => {
  const res = await verify({ sku: 'easypen_monthly', token: 'tok_1234567890.abc' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.active, true);
  assert.ok(data.expiry > Date.now());
  const ack = calls.find((c) => c.url.endsWith(':acknowledge'));
  assert.ok(ack, 'acknowledged');
  assert.match(ack.url, /\/purchases\/subscriptions\/easypen_monthly\/tokens\/tok_1234567890\.abc:acknowledge$/);
});

test('worker: already acknowledged, cancelled but paid up: active, no second acknowledge', async () => {
  subscription.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  subscription.subscriptionState = 'SUBSCRIPTION_STATE_CANCELED';
  const data = await (await verify({ sku: 'easypen_monthly', token: 'tok_1234567890' })).json();
  assert.equal(data.active, true);
  assert.equal(calls.some((c) => c.url.endsWith(':acknowledge')), false);
});

test('worker: expired, on hold, another product or an unknown token are not active', async () => {
  subscription.subscriptionState = 'SUBSCRIPTION_STATE_EXPIRED';
  assert.equal((await (await verify({ sku: 'easypen_monthly', token: 'tok_1234567890' })).json()).active, false);
  subscription.subscriptionState = 'SUBSCRIPTION_STATE_ON_HOLD';
  assert.equal((await (await verify({ sku: 'easypen_monthly', token: 'tok_1234567890' })).json()).active, false);
  subscription.subscriptionState = 'SUBSCRIPTION_STATE_ACTIVE';
  assert.equal((await (await verify({ sku: 'easypen_yearly', token: 'tok_1234567890' })).json()).active, false);
  subscription = null;
  assert.equal((await (await verify({ sku: 'easypen_monthly', token: 'tok_1234567890' })).json()).active, false);
  assert.equal(calls.some((c) => c.url.endsWith(':acknowledge')), false);
});

test('worker: bad input is refused before asking Google; other paths go to the site', async () => {
  assert.equal((await verify({ sku: 'other', token: 'tok_1234567890' })).status, 400);
  assert.equal((await verify({ sku: 'easypen_monthly', token: '../../x?y' })).status, 400);
  assert.equal((await verify(null, 'GET')).status, 405);
  assert.equal(calls.length, 0);
  const asset = await worker.default.fetch(new Request('https://easypen.vplusstudio.app/index.html'), env);
  assert.equal(await asset.text(), 'asset');
  const noKey = await worker.default.fetch(new Request('https://easypen.vplusstudio.app/api/play/verify', {
    method: 'POST', body: '{}'
  }), { ...env, PLAY_SERVICE_ACCOUNT: '' });
  assert.equal(noKey.status, 503);
});

test('worker: assetlinks.json links the Android app to the site', async () => {
  const res = await worker.default.fetch(new Request('https://easypen.vplusstudio.app/.well-known/assetlinks.json'), env);
  const [statement] = await res.json();
  assert.equal(statement.target.package_name, 'app.vplusstudio.easypen');
  assert.ok(Array.isArray(statement.target.sha256_cert_fingerprints));
});
