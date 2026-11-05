/*
 * EasyPen - free version (website) and full version (the Google Play app, with a subscription).
 * Exposes a global `EasyPenPlan`.
 *
 * - In the Play app (a Trusted Web Activity) the full version needs a subscription:
 *   Google Play Billing through the Digital Goods API + Payment Request API.
 *   Each purchase is verified and acknowledged by the server (/api/play/verify, worker/index.js),
 *   which Google requires within 3 days.
 * - On the website the full version is the app's: web visitors get the basic tools.
 *   WEB_LIMITS stays false until the app is in the store, so nothing changes before launch.
 * - People who used the site before the limits started keep everything for LEGACY_DAYS.
 *
 * The result is kept on the device (localStorage) so the app works offline.
 */
(function (global) {
  'use strict';

  const PACKAGE = 'app.vplusstudio.easypen';
  const STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`;
  const MANAGE_URL = `https://play.google.com/store/account/subscriptions?package=${PACKAGE}`;
  const BILLING = 'https://play.google.com/billing';
  // Play Console subscription ids (one base plan each, with a 30-day free trial offer)
  const SKUS = { monthly: 'easypen_monthly', yearly: 'easypen_yearly' };
  const FALLBACK_PRICES = { monthly: '₪12.90', yearly: '₪79' };
  // Turn on (true) once the app is published in Google Play
  const WEB_LIMITS = false;
  const LEGACY_DAYS = 30;
  // A purchase Google Play reports but the server could not check (offline): kept for a few days
  const GRACE_DAYS = 3;
  const DAY = 24 * 60 * 60 * 1000;
  const FREE_SIGNATURES = 1;
  const FULL_SIGNATURES = 3;

  const KEY_PLAN = 'easypen.plan';            // ms: the subscription is paid up to then
  const KEY_LEGACY = 'easypen.legacyUntil';   // ms: earlier users keep everything up to then
  const KEY_START = 'easypen.planStart';      // first visit after the limits started
  const KEY_NOTICE = 'easypen.legacyNotice';  // '1': the earlier-user message is waiting
  const KEY_IN_APP = 'easypen.inApp';         // sessionStorage: this tab is the Play app

  const { t, lang } = global.EasyPenI18n;

  function read(store, key) {
    try {
      return global[store].getItem(key);
    } catch (e) {
      return null;
    }
  }
  function write(store, key, value) {
    try {
      if (value === null) global[store].removeItem(key);
      else global[store].setItem(key, String(value));
    } catch (e) { /* No storage: this visit only */ }
  }
  const readTime = (key) => Number(read('localStorage', key)) || 0;

  // The Play app opens the site from android-app://<package> (and ?source=twa, see twa-manifest.json);
  // remembered for the tab, so it holds on the next pages
  function detectApp() {
    if (read('sessionStorage', KEY_IN_APP) === '1') return true;
    let fromApp = false;
    try {
      fromApp = (global.document.referrer || '').startsWith(`android-app://${PACKAGE}`)
        || new URLSearchParams(global.location.search).get('source') === 'twa';
    } catch (e) { /* ignore */ }
    if (fromApp) write('sessionStorage', KEY_IN_APP, '1');
    return fromApp;
  }

  const inApp = detectApp();
  // Tests turn the website limits on with localStorage easypen.testLimits = 1
  const limited = inApp || WEB_LIMITS || read('localStorage', 'easypen.testLimits') === '1';

  function isFull() {
    if (!limited) return true;
    const now = Date.now();
    return readTime(KEY_PLAN) > now || readTime(KEY_LEGACY) > now;
  }

  function maxSignatures() {
    return isFull() ? FULL_SIGNATURES : FREE_SIGNATURES;
  }

  const ua = (global.navigator && global.navigator.userAgent) || '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && global.navigator.maxTouchPoints > 1);

  /* ---------------- earlier users ---------------- */

  // On the first visit with limits: someone who already used EasyPen here (saved signatures,
  // or choices it remembers) keeps the full version for LEGACY_DAYS and gets a message once
  async function initLegacy() {
    if (!limited || read('localStorage', KEY_START)) return;
    write('localStorage', KEY_START, Date.now());
    let used = ['easypen.sharePromo', 'easypen.invited', 'easypen.langChoice']
      .some((k) => read('localStorage', k) !== null);
    if (!used && global.EasyPenStorage) {
      try {
        used = (await global.EasyPenStorage.listSignatures()).length > 0;
      } catch (e) { /* no storage */ }
    }
    if (!used) return;
    write('localStorage', KEY_LEGACY, Date.now() + LEGACY_DAYS * DAY);
    write('localStorage', KEY_NOTICE, '1');
  }

  // The date earlier users keep everything until, once (null when there's nothing to tell)
  function takeLegacyNotice() {
    if (read('localStorage', KEY_NOTICE) !== '1') return null;
    write('localStorage', KEY_NOTICE, null);
    const until = readTime(KEY_LEGACY);
    return until > Date.now() ? new Date(until).toLocaleDateString(lang) : null;
  }

  /* ---------------- Google Play ---------------- */

  let servicePromise = null;
  function getService() {
    if (!inApp || !('getDigitalGoodsService' in global)) return Promise.resolve(null);
    if (!servicePromise) {
      servicePromise = global.getDigitalGoodsService(BILLING).catch((err) => {
        console.warn('Google Play Billing is not available', err);
        return null;
      });
    }
    return servicePromise;
  }

  // The server checks the purchase with Google and acknowledges it: { active, expiry }
  async function verify(sku, token) {
    const response = await fetch(new URL('api/play/verify', global.document.baseURI), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, token })
    });
    if (!response.ok) throw new Error(`verify ${response.status}`);
    return response.json();
  }

  // Applies Google Play's purchases: { full, reason } ('none' | 'offline' | 'checked')
  async function applyPurchases(purchases) {
    const ours = purchases.filter((p) => Object.values(SKUS).includes(p.itemId));
    if (!ours.length) {
      write('localStorage', KEY_PLAN, null);
      return false;
    }
    let until = 0;
    for (const p of ours) {
      try {
        const result = await verify(p.itemId, p.purchaseToken);
        if (result.active) until = Math.max(until, Number(result.expiry) || 0);
      } catch (err) {
        // Offline or the server is down: Google Play says it's paid, keep it for now
        console.warn(err);
        until = Math.max(until, readTime(KEY_PLAN), Date.now() + GRACE_DAYS * DAY);
      }
    }
    write('localStorage', KEY_PLAN, until > Date.now() ? until : null);
    return until > Date.now();
  }

  // Reads the subscription from Google Play (the app only); false when Play can't be reached
  async function refresh() {
    const service = await getService();
    if (!service) return false;
    try {
      await applyPurchases(await service.listPurchases());
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  // Prices from Google Play, in the store's currency: { monthly, yearly }
  async function prices() {
    const result = { ...FALLBACK_PRICES };
    const service = await getService();
    if (!service) return result;
    try {
      const items = await service.getDetails(Object.values(SKUS));
      for (const item of items) {
        const plan = Object.keys(SKUS).find((k) => SKUS[k] === item.itemId);
        if (!plan || !item.price) continue;
        result[plan] = new Intl.NumberFormat(lang, { style: 'currency', currency: item.price.currency })
          .format(Number(item.price.value));
      }
    } catch (err) {
      console.warn(err);
    }
    return result;
  }

  // Google Play's purchase sheet for the plan ('monthly' | 'yearly'): 'full' | 'cancelled' | 'error'
  async function buy(plan) {
    const sku = SKUS[plan];
    if (!sku || !global.PaymentRequest) return 'error';
    let response;
    try {
      const request = new global.PaymentRequest(
        [{ supportedMethods: BILLING, data: { sku } }],
        // Google Play takes the price from the Play Console; this total is required but unused
        { total: { label: 'Total', amount: { currency: 'ILS', value: '0' } } }
      );
      response = await request.show();
    } catch (err) {
      return err && err.name === 'AbortError' ? 'cancelled' : (console.warn(err), 'error');
    }
    const token = response.details && response.details.purchaseToken;
    let full = false;
    try {
      const result = await verify(sku, token);
      full = !!result.active;
      if (full) write('localStorage', KEY_PLAN, Number(result.expiry));
    } catch (err) {
      // Paid but not checked yet (offline): the next start checks and acknowledges it
      console.warn(err);
      write('localStorage', KEY_PLAN, Date.now() + GRACE_DAYS * DAY);
      full = true;
    }
    try {
      await response.complete(full ? 'success' : 'fail');
    } catch (e) { /* already closed */ }
    if (full) global.dispatchEvent(new Event('easypen-plan'));
    return full ? 'full' : 'error';
  }

  /* ---------------- the "full version" sheet ---------------- */

  function make(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  let dialog = null;
  function buildDialog() {
    dialog = make('dialog', 'modal sheet paywall');
    dialog.id = 'paywall';
    dialog.setAttribute('aria-labelledby', 'paywall-title');
    const card = make('div', 'modal-card');
    const header = make('header', 'modal-header');
    const title = make('h2', null, t('plan.title'));
    title.id = 'paywall-title';
    const close = make('button', 'icon-btn', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', t('pad.close'));
    close.addEventListener('click', () => dialog.close());
    header.append(title, close);
    const reason = make('p', 'paywall-reason');
    const list = make('ul', 'paywall-features');
    ['plan.fImages', 'plan.fCombine', 'plan.fDraw', 'plan.fSigs', 'plan.fSample', 'plan.fClean']
      .forEach((key) => list.appendChild(make('li', null, t(key))));
    const body = make('div', 'paywall-body');
    card.append(header, reason, list, body);
    dialog.appendChild(card);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    global.document.body.appendChild(dialog);
  }

  // The app: the two plans and Google Play's purchase sheet
  async function fillAppBody(body) {
    const p = await prices();
    let chosen = 'yearly';
    const plans = make('div', 'paywall-plans');
    plans.setAttribute('role', 'radiogroup');
    plans.setAttribute('aria-label', t('plan.choose'));
    const options = {};
    for (const plan of ['yearly', 'monthly']) {
      const btn = make('button', 'paywall-plan');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      const name = make('span', 'paywall-plan-name', t(`plan.${plan}`));
      const price = make('span', 'paywall-plan-price', t(`plan.${plan}Price`, { price: p[plan] }));
      btn.append(name, price);
      if (plan === 'yearly') btn.appendChild(make('span', 'paywall-badge', t('plan.save')));
      btn.addEventListener('click', () => select(plan));
      options[plan] = btn;
      plans.appendChild(btn);
    }
    function select(plan) {
      chosen = plan;
      for (const [k, btn] of Object.entries(options)) btn.setAttribute('aria-checked', String(k === plan));
    }
    select(chosen);
    const start = make('button', 'btn btn-primary btn-block', t('plan.start'));
    start.type = 'button';
    const status = make('p', 'form-error');
    status.setAttribute('role', 'alert');
    start.addEventListener('click', async () => {
      start.disabled = true;
      status.textContent = '';
      const result = await buy(chosen);
      start.disabled = false;
      if (result === 'full') {
        dialog.close();
        global.EasyPenUI && global.EasyPenUI.toast(t('plan.thanks'), 'success', 5000);
      } else if (result === 'error') {
        status.textContent = t('plan.buyError');
      }
    });
    const terms = make('p', 'muted small', t('plan.terms'));
    const restore = make('button', 'btn btn-ghost btn-sm', t('plan.restore'));
    restore.type = 'button';
    restore.addEventListener('click', async () => {
      restore.disabled = true;
      const reached = await refresh();
      restore.disabled = false;
      if (isFull()) {
        dialog.close();
        global.dispatchEvent(new Event('easypen-plan'));
        global.EasyPenUI && global.EasyPenUI.toast(t('plan.restored'), 'success');
      } else {
        status.textContent = reached ? t('plan.noSub') : t('plan.buyError');
      }
    });
    body.append(plans, start, status, terms, restore);
  }

  // The website: where the full version is
  function fillWebBody(body) {
    if (isIos) {
      body.appendChild(make('p', 'muted', t('plan.ios')));
      return;
    }
    body.appendChild(make('p', 'muted', t(isAndroid ? 'plan.android' : 'plan.desktop')));
    const link = make('a', 'btn btn-primary btn-block', t('plan.getApp'));
    link.href = STORE_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    body.appendChild(link);
  }

  // Shows what the full version adds; feature: the locked one that was tapped (a plan.why.* key).
  // Resolves when the sheet closes.
  function showPaywall(feature) {
    if (!dialog) buildDialog();
    dialog.querySelector('.paywall-reason').textContent = feature ? t(`plan.why.${feature}`) : t('plan.intro');
    const body = dialog.querySelector('.paywall-body');
    body.replaceChildren();
    if (inApp) fillAppBody(body);
    else fillWebBody(body);
    if (!dialog.open) dialog.showModal();
    return new Promise((resolve) => dialog.addEventListener('close', resolve, { once: true }));
  }

  // For features: resolves true when allowed, otherwise shows the sheet and resolves false
  async function allow(feature) {
    await ready;
    if (isFull()) return true;
    showPaywall(feature);
    return false;
  }

  const ready = initLegacy().catch(() => {})
    .then(() => (inApp ? refresh() : null))
    .then(() => global.dispatchEvent(new Event('easypen-plan')));

  global.EasyPenPlan = {
    inApp,
    limited,
    ready,
    isFull,
    maxSignatures,
    allow,
    showPaywall,
    takeLegacyNotice,
    refresh,
    STORE_URL,
    MANAGE_URL,
    SKUS,
    FULL_SIGNATURES
  };
})(window);
