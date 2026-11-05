// EasyPen - Google Play store graphics: 6 phone screenshots (1080x1920) and the feature graphic
// (1024x500) per language, made from the real app (Playwright) inside a branded frame.
// Output: store/graphics/<lang>/01-sign.png ... 06-trial.png, feature-graphic.png (RGB, no alpha).
// Needs the fonts Heebo, Noto Sans Hebrew and Noto Sans installed (Google Fonts), and Python's PIL.
// Usage: node scripts/make-store-assets.js [he|en|ru ...]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { start } = require('../tests/helpers/server');

const ROOT = path.join(__dirname, '..');
const FONT = 'Heebo, "Noto Sans Hebrew", "Noto Sans", sans-serif';
const LANGS = {
  he: {
    locale: 'he-IL', dir: 'rtl', prices: { currency: 'ILS', monthly: '12.90', yearly: '79.00' },
    slides: [
      ['חותמים על PDF<br>ישר מהטלפון', 'בלי להדפיס ובלי לסרוק'],
      ['חתימה באצבע', 'נשמרת לפעם הבאה'],
      ['חותמים גם על תמונות', 'ומאחדים כמה קבצים למסמך אחד'],
      ['ציור חופשי ומרקר', 'מסמנים, מדגישים ומוסיפים הערות'],
      ['שולחים בוואטסאפ', 'או בכל אפליקציה, בנגיעה אחת'],
      ['30 יום חינם', 'הקבצים לא עוזבים את המכשיר']
    ],
    feature: ['חותמים על מסמכים', 'ישר מהטלפון'],
    file: 'הסכם שכירות.pdf', typed: 'רון כהן', photo: 'קבלה',
    doc: { title: 'הסכם שכירות', sub: 'דירת 3 חדרים · רחוב הרצל 12, תל אביב',
      paras: ['הסכם זה נערך בין בעל הדירה לבין השוכר, לתקופה של 12 חודשים החל מ-1 בנובמבר 2026.',
        'השוכר מתחייב לשמור על הדירה ולהחזירה בתום התקופה במצב תקין.'],
      name: 'שם השוכר:', agree: 'קראתי ואני מאשר/ת את תנאי ההסכם', sig: 'חתימת השוכר:' }
  },
  en: {
    locale: 'en-US', dir: 'ltr', prices: { currency: 'USD', monthly: '3.99', yearly: '24.99' },
    slides: [
      ['Sign PDFs<br>right on your phone', 'No printing, no scanning'],
      ['Sign with your finger', 'Saved for next time'],
      ['Sign photos too', 'and combine files into one document'],
      ['Draw and highlight', 'Mark up and add notes to any page'],
      ['Send it on WhatsApp', 'or any app, in one tap'],
      ['30 days free', 'Your files never leave your device']
    ],
    feature: ['Sign documents', 'right on your phone'],
    file: 'Rental agreement.pdf', typed: 'John Smith', photo: 'Receipt',
    doc: { title: 'Rental Agreement', sub: '2-bedroom apartment · 12 Park Street',
      paras: ['This agreement is made between the landlord and the tenant for a period of 12 months, starting 1 November 2026.',
        'The tenant will take good care of the apartment and return it in good condition.'],
      name: 'Tenant name:', agree: 'I have read and agree to the terms', sig: 'Tenant signature:' }
  },
  ru: {
    locale: 'ru-RU', dir: 'ltr', prices: { currency: 'ILS', monthly: '12.90', yearly: '79.00' },
    slides: [
      ['Подписывайте PDF<br>прямо в телефоне', 'Без печати и сканирования'],
      ['Подпись пальцем', 'Сохранится на следующий раз'],
      ['Подписывайте и фото', 'и объединяйте файлы в один документ'],
      ['Рисуйте и выделяйте', 'Пометки и заметки на любой странице'],
      ['Отправка в WhatsApp', 'или в любое приложение одним касанием'],
      ['30 дней бесплатно', 'Файлы не покидают устройство']
    ],
    feature: ['Подписывайте документы', 'прямо в телефоне'],
    file: 'Договор аренды.pdf', typed: 'Иван Петров', photo: 'Чек',
    doc: { title: 'Договор аренды', sub: 'Двухкомнатная квартира · ул. Парковая, 12',
      paras: ['Договор заключён между арендодателем и арендатором на 12 месяцев, начиная с 1 ноября 2026 г.',
        'Арендатор обязуется бережно относиться к квартире и вернуть её в исправном состоянии.'],
      name: 'ФИО арендатора:', agree: 'Согласен(на) с условиями договора', sig: 'Подпись арендатора:' }
  }
};

const VIEW = { width: 384, height: 832 };   // Galaxy S25 FE CSS viewport
const SCALE = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The demo contract (A5-ish, large type), printed by the browser, and where its fields are
async function makeDoc(browser, L, lang) {
  const html = `<!doctype html><html lang="${lang}" dir="${L.dir}"><head><meta charset="utf-8"><style>
    @page { size: 148mm 160mm; margin: 0 }
    body { margin: 0; font-family: "Noto Sans Hebrew", "Noto Sans"; color: #1d2433 }
    .p { width: 148mm; height: 160mm; box-sizing: border-box; padding: 11mm 10mm; position: relative }
    h1 { font-size: 27pt; margin: 0 0 2mm; text-align: center }
    .sub { text-align: center; color: #667; font-size: 13pt; margin-bottom: 6mm }
    p { font-size: 14pt; line-height: 1.5; margin: 0 0 3mm }
    .line { display: inline-block; border-bottom: 1.3px solid #1d2433; width: 58mm; height: 8mm; vertical-align: bottom }
    .row { font-size: 16pt; margin: 7mm 0 0; display: flex; gap: 3mm; align-items: flex-end }
    .box { width: 7mm; height: 7mm; border: 1.5px solid #1d2433; display: inline-block; border-radius: 1mm }
  </style></head><body><div class="p">
    <h1>${L.doc.title}</h1><div class="sub">${L.doc.sub}</div>
    ${L.doc.paras.map((t) => `<p>${t}</p>`).join('')}
    <div class="row">${L.doc.name} <span class="line" id="name"></span></div>
    <div class="row"><span class="box" id="agree"></span> ${L.doc.agree}</div>
    <div class="row">${L.doc.sig} <span class="line" id="sig"></span></div>
  </div></body></html>`;
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const fields = await page.evaluate(() => {
    const p = document.querySelector('.p').getBoundingClientRect();
    const f = (id) => { const r = document.getElementById(id).getBoundingClientRect();
      return { x: (r.left - p.left) / p.width, y: (r.top - p.top) / p.height, w: r.width / p.width, h: r.height / p.height }; };
    return { name: f('name'), agree: f('agree'), sig: f('sig') };
  });
  const pdf = await page.pdf({ width: '148mm', height: '160mm', printBackground: true });
  await page.close();
  return { pdf, fields };
}

// A photographed receipt (JPEG), drawn by the browser
async function makePhoto(browser, L) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await page.setContent(`<body style="margin:0;background:#cfc8bb;display:flex;align-items:center;justify-content:center;height:800px;font-family:'Noto Sans Hebrew','Noto Sans'">
    <div style="width:420px;height:700px;background:#fbfaf6;transform:rotate(-2deg);box-shadow:0 10px 30px rgba(0,0,0,.25);padding:34px;box-sizing:border-box;direction:${L.dir}">
    <div style="font-size:34px;font-weight:700;text-align:center">${L.photo}</div>
    <div style="text-align:center;color:#777;margin:6px 0 24px">#20471 · 05/11/2026</div>
    ${[1, 2, 3, 4, 5].map((i) => `<div style="display:flex;justify-content:space-between;font-size:22px;margin:14px 0;color:#333"><span style="background:#ddd;height:14px;width:${120 + i * 17}px;display:inline-block;border-radius:3px"></span><span>${(i * 23.5).toFixed(2)}</span></div>`).join('')}
    <div style="border-top:2px dashed #999;margin-top:26px;padding-top:16px;display:flex;justify-content:space-between;font-size:26px;font-weight:700"><span>Total</span><span>352.50</span></div>
    </div></body>`);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 90 });
  await page.close();
  return jpg;
}

// Raw app screens for one language: { sign, pad, combine, draw, share, trial } PNG buffers
async function captureApp(browser, server, lang) {
  const L = LANGS[lang];
  const { pdf, fields } = await makeDoc(browser, L, lang);
  const photo = await makePhoto(browser, L);
  const shots = {};
  const context = await browser.newContext({
    viewport: VIEW, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, locale: L.locale, serviceWorkers: 'block'
  });
  await context.addInitScript(({ prices }) => {
    try { localStorage.setItem('easypen.invited', '1'); } catch (e) { /* ignore */ }
    // Google Play inside the app: prices from the "store", nothing bought yet
    window.getDigitalGoodsService = async () => ({
      getDetails: async (ids) => ids.map((itemId) => ({
        itemId, price: { currency: prices.currency, value: itemId.includes('year') ? prices.yearly : prices.monthly }
      })),
      listPurchases: async () => []
    });
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--font:Heebo,"Noto Sans Hebrew","Noto Sans",sans-serif} html{scrollbar-width:none} ::-webkit-scrollbar{display:none}';
      document.head.appendChild(s);
    });
  }, { prices: L.prices });
  const page = await context.newPage();
  const shot = async (name) => { await sleep(350); shots[name] = await page.screenshot(); };
  const onPage = async (fx, fy, n = 1) => {
    const b = await page.locator(`.page[data-page="${n}"]`).boundingBox();
    return [b.x + b.width * fx, b.y + b.height * fy];
  };
  async function stroke(points) {
    await page.mouse.move(...points[0]);
    await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(...p, { steps: 2 });
    await page.mouse.up();
  }

  // 1-2, 5: the contract, signed, filled in and ready to send
  await page.goto(`${server.baseUrl}?source=twa`);
  await page.setInputFiles('#file-input', { name: L.file, mimeType: 'application/pdf', buffer: pdf });
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  await page.click('#add-sig');
  await page.waitForSelector('dialog.sig-dialog[open]');
  const c = await page.locator('.sig-canvas').boundingBox();
  const spline = (cp, per) => cp.slice(0, -1).flatMap((p1, i) => {
    const p0 = cp[i - 1] || p1, p2 = cp[i + 1], p3 = cp[i + 2] || p2;
    return Array.from({ length: per }, (_, s) => { const t = s / per, t2 = t * t, t3 = t2 * t;
      return [0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)); });
  }).concat([cp[cp.length - 1]]).map(([u, v]) => [c.x + c.width * u, c.y + c.height * v]);
  await stroke(spline([[0.13, 0.66], [0.17, 0.44], [0.21, 0.2], [0.235, 0.24], [0.215, 0.46], [0.18, 0.64], [0.165, 0.68], [0.2, 0.58],
    [0.28, 0.4], [0.32, 0.47], [0.27, 0.57], [0.245, 0.6], [0.3, 0.63], [0.345, 0.56], [0.365, 0.49], [0.385, 0.48], [0.395, 0.55],
    [0.405, 0.62], [0.43, 0.53], [0.45, 0.47], [0.47, 0.48], [0.48, 0.56], [0.495, 0.62], [0.53, 0.52], [0.565, 0.32], [0.575, 0.25],
    [0.56, 0.24], [0.545, 0.34], [0.55, 0.55], [0.565, 0.62], [0.6, 0.56], [0.625, 0.5], [0.645, 0.52], [0.65, 0.59], [0.67, 0.62],
    [0.71, 0.56], [0.75, 0.58], [0.81, 0.59], [0.88, 0.5]], 4));
  await shot('pad');
  await page.click('dialog.sig-dialog [data-action="confirm"]');
  await page.waitForSelector('dialog.sig-dialog', { state: 'detached' });
  await sleep(300);
  // Onto the signature line
  const sb = await page.locator('.ov-sig').boundingBox();
  const [tx, ty] = await onPage(fields.sig.x + fields.sig.w / 2, fields.sig.y + fields.sig.h * 0.2);
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
  // The name and the tick
  for (const [field, text, at] of [['name', L.typed, L.dir === 'rtl' ? 0.255 : 0.1], ['agree', '✓', 0.05]]) {
    await page.click('#add-text');
    const [x, y] = await onPage(fields[field].x + fields[field].w * at, fields[field].y + fields[field].h * 0.3);
    await page.mouse.click(x, y);
    await page.keyboard.type(text);
    await page.keyboard.press('Escape');
    await sleep(200);
  }
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.mouse.click(VIEW.width / 2, 70);
  await page.evaluate(() => document.querySelector('.page[data-page="1"]').scrollIntoView({ block: 'start' }));
  await shot('sign');

  // 4: drawing - a highlighter over the first paragraph and a red circle around the date
  await page.click('#draw-btn');
  await page.waitForSelector('#draw-tray:not([hidden])');
  await page.click('#draw-tray [data-tool="marker"]');
  await page.click('#draw-tray [data-color="#f2c230"]');
  const para = (u, v) => onPage(u, v);
  const a = await para(0.1, 0.235), b = await para(0.9, 0.235);
  await stroke(Array.from({ length: 20 }, (_, i) => [a[0] + (b[0] - a[0]) * i / 19, a[1]]));
  await page.click('#draw-tray [data-tool="pen"]');
  await page.click('#draw-tray [data-color="#d6385a"]');
  const ctr = await para(0.5, 0.48);
  const pr = await page.locator('.page[data-page="1"]').boundingBox();
  await stroke(Array.from({ length: 40 }, (_, i) => {
    const t = (i / 39) * Math.PI * 2.15;
    return [ctr[0] + Math.cos(t) * pr.width * 0.42, ctr[1] + Math.sin(t) * pr.height * 0.05];
  }));
  await shot('draw');
  await page.click('#draw-done');
  await sleep(200);

  // 5: save & send
  await page.click('#save-share');
  await page.waitForSelector('#name-dialog[open]');
  await page.evaluate(() => { const i = document.activeElement; if (i && i.setSelectionRange) i.setSelectionRange(0, 0); if (i) i.blur(); });
  await shot('share');
  await page.keyboard.press('Escape');

  // 3: a photo and the contract combined into one document
  await page.goto(`${server.baseUrl}?source=twa`);
  await page.setInputFiles('#file-input', [
    { name: `${L.photo}.jpg`, mimeType: 'image/jpeg', buffer: photo },
    { name: L.file, mimeType: 'application/pdf', buffer: pdf }
  ]);
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  await sleep(600);
  await shot('combine');

  // 6: the full version, in the app
  await page.goto(`${server.baseUrl}?source=twa`);
  await page.waitForSelector('#plan-card:not([hidden])');
  await page.evaluate(() => { window.EasyPenPlan.showPaywall(); });
  await page.waitForSelector('#paywall .paywall-plan');
  await shot('trial');
  await context.close();
  return shots;
}

const SLIDE_ORDER = ['sign', 'pad', 'combine', 'draw', 'share', 'trial'];
const SLIDE_FILES = ['01-sign', '02-signature', '03-photos', '04-draw', '05-share', '06-trial'];

const BG = 'radial-gradient(120% 80% at 50% 0%, #4565e0 0%, #2f4fc4 45%, #1d2f86 100%)';
const slideHtml = (L, lang, [title, sub], img) => `<!doctype html><html lang="${lang}" dir="${L.dir}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box } html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden }
  body { background: ${BG}; color: #fff; font-family: ${FONT}; text-align: center }
  h1 { margin: 90px 60px 0; font-size: 80px; line-height: 1.12; font-weight: 800; letter-spacing: -1px; text-shadow: 0 4px 24px rgba(0,0,0,.2) }
  p { margin: 26px 70px 0; font-size: 42px; font-weight: 500; opacity: .88 }
  .phone { position: absolute; left: 50%; bottom: 60px; width: 620px; margin-left: -310px; border-radius: 78px; background: #0d1222;
    padding: 20px; box-shadow: 0 40px 90px rgba(0,0,0,.4), inset 0 0 0 3px #3b4563 }
  .phone img { display: block; width: 100%; border-radius: 60px }
</style></head><body><h1>${title}</h1><p>${sub}</p>
  <div class="phone"><img src="data:image/png;base64,${img.toString('base64')}"></div></body></html>`;

const featureHtml = (L, lang, [l1, l2], img) => `<!doctype html><html lang="${lang}" dir="${L.dir}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box } html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden }
  body { background: ${BG}; color: #fff; font-family: ${FONT}; position: relative }
  .text { position: absolute; top: 0; bottom: 0; inset-inline-start: 64px; width: 560px; display: flex; flex-direction: column; justify-content: center }
  .brand { display: flex; align-items: center; gap: 18px; margin-bottom: 26px }
  .logo { width: 84px; height: 84px; border-radius: 22px; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 30px rgba(0,0,0,.3) }
  .logo img { width: 60px; height: 60px }
  .name { font-size: 52px; font-weight: 800; direction: ltr }
  .l1 { font-size: 46px; font-weight: 800; line-height: 1.15 } .l2 { font-size: 46px; font-weight: 800; line-height: 1.15; color: #c9d4ff }
  .phone { position: absolute; inset-inline-end: 70px; top: 46px; width: 300px; border-radius: 40px; background: #0d1222; padding: 10px;
    box-shadow: 0 30px 60px rgba(0,0,0,.4), inset 0 0 0 2px #3b4563; transform: rotate(${L.dir === 'rtl' ? '-' : ''}6deg) }
  .phone img { display: block; width: 100%; border-radius: 31px }
</style></head><body>
  <div class="text"><div class="brand"><div class="logo"><img src="icons/icon.svg" alt=""></div><div class="name">EasyPen</div></div>
  <div class="l1">${l1}</div><div class="l2">${l2}</div></div>
  <div class="phone"><img src="data:image/png;base64,${img.toString('base64')}"></div></body></html>`;

// Play wants PNG or JPEG without alpha
function toRgb(file) {
  execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[1], optimize=True)', file]);
}

(async () => {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LANGS);
  const server = await start();
  const browser = await chromium.launch();
  try {
    for (const lang of langs) {
      const L = LANGS[lang];
      const out = path.join(ROOT, 'store', 'graphics', lang);
      fs.mkdirSync(out, { recursive: true });
      const shots = await captureApp(browser, server, lang);
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
      for (let i = 0; i < SLIDE_ORDER.length; i++) {
        await page.setContent(slideHtml(L, lang, L.slides[i], shots[SLIDE_ORDER[i]]));
        await page.evaluate(() => document.fonts.ready);
        const file = path.join(out, `${SLIDE_FILES[i]}.png`);
        await page.screenshot({ path: file });
        toRgb(file);
      }
      await page.setViewportSize({ width: 1024, height: 500 });
      await page.route('**/easypen/__feature.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: featureHtml(L, lang, L.feature, shots.sign) }));
      await page.goto(`${server.baseUrl}__feature.html`);
      await page.evaluate(() => document.fonts.ready);
      const fg = path.join(out, 'feature-graphic.png');
      await page.screenshot({ path: fg });
      toRgb(fg);
      await page.close();
      console.log(`store/graphics/${lang}: ${SLIDE_FILES.length} screenshots + feature graphic`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
