// EasyPen promo video (30 s, 1080x1920, Hebrew / English / Russian): drives the real app inside a
// phone frame, records it (CDP screencast) and encodes media/easypen-promo-<lang>.mp4 (+ .jpg, the
// poster shown before it plays in the guides).
// Needs ffmpeg (FFMPEG=/path/to/ffmpeg, or `pip install imageio-ffmpeg`) and the fonts Heebo,
// Noto Sans Hebrew and Noto Sans installed (Google Fonts).
// Usage: node scripts/make-promo-video.js [he|en|ru] [workDir]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { start } = require('../tests/helpers/server');

const ROOT = path.join(__dirname, '..');
// Everything that is said or typed in the video, per language
const LANGS = {
  he: {
    locale: 'he-IL', dir: 'rtl', font: 'Heebo, "Noto Sans Hebrew", sans-serif', shared: /שותף/,
    intro: 'חותמים על מסמכים<br>ישר מהטלפון',
    steps: ['מעלים PDF או תמונה', 'חותמים באצבע', 'ממלאים פרטים', 'מסמנים ✓', 'שומרים ושולחים'],
    pills: ['✓ בחינם, בלי הרשמה', '✓ הקבצים לא עוזבים את המכשיר'],
    file: 'הסכם שכירות.pdf', typed: 'רון כהן',
    doc: { title: 'הסכם שכירות', sub: 'דירת 3 חדרים · רחוב הרצל 12, תל אביב',
      paras: ['הסכם זה נערך בין בעל הדירה לבין השוכר, לתקופה של 12 חודשים החל מ-1 בנובמבר 2026.',
        'השוכר מתחייב לשמור על הדירה ולהחזירה בתום התקופה במצב תקין.'],
      name: 'שם השוכר:', agree: 'קראתי ואני מאשר/ת את תנאי ההסכם', sig: 'חתימת השוכר:' }
  },
  en: {
    locale: 'en-US', dir: 'ltr', font: 'Heebo, "Noto Sans", sans-serif', shared: /Document shared/,
    intro: 'Sign documents<br>right on your phone',
    steps: ['Upload a PDF or photo', 'Sign with your finger', 'Fill in your details', 'Tick the box ✓', 'Save & send'],
    pills: ['✓ Free, no sign-up', '✓ Files never leave your device'],
    file: 'Rental agreement.pdf', typed: 'John Smith',
    doc: { title: 'Rental Agreement', sub: '2-bedroom apartment · 12 Park Street',
      paras: ['This agreement is made between the landlord and the tenant for a period of 12 months, starting 1 November 2026.',
        'The tenant will take good care of the apartment and return it in good condition.'],
      name: 'Tenant name:', agree: 'I have read and agree to the terms', sig: 'Tenant signature:' }
  },
  ru: {
    locale: 'ru-RU', dir: 'ltr', font: '"Noto Sans", sans-serif', shared: /Документ отправлен/,
    intro: 'Подписывайте документы<br>прямо в телефоне',
    steps: ['Загрузите PDF или фото', 'Подпишите пальцем', 'Заполните данные', 'Поставьте ✓', 'Сохраните и отправьте'],
    pills: ['✓ Бесплатно, без регистрации', '✓ Файлы не покидают устройство'],
    file: 'Договор аренды.pdf', typed: 'Иван Петров',
    doc: { title: 'Договор аренды', sub: 'Двухкомнатная квартира · ул. Парковая, 12',
      paras: ['Договор заключён между арендодателем и арендатором на 12 месяцев, начиная с 1 ноября 2026 г.',
        'Арендатор обязуется бережно относиться к квартире и вернуть её в исправном состоянии.'],
      name: 'ФИО арендатора:', agree: 'Согласен(на) с условиями договора', sig: 'Подпись арендатора:' }
  }
};
const LANG = process.argv[2] || 'he';
const L = LANGS[LANG];
if (!L) throw new Error(`Unknown language ${LANG} (he, en or ru)`);
const OUT = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'easypen-video-'));
const VIDEO = path.join(ROOT, 'media', `easypen-promo-${LANG}.mp4`);
const FFMPEG = process.env.FFMPEG ||
  execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the demo document (A5, large type so it reads on a phone) ----------
const DOC_HTML = `<!doctype html><html lang="${LANG}" dir="${L.dir}"><head><meta charset="utf-8"><style>
  @page { size: 148mm 160mm; margin: 0 }
  body { margin: 0; font-family: "Noto Sans Hebrew", "Noto Sans"; color: #1d2433 }
  .p { width: 148mm; height: 160mm; box-sizing: border-box; padding: 11mm 10mm; position: relative }
  h1 { font-size: 27pt; margin: 0 0 2mm; text-align: center }
  .sub { text-align: center; color: #667; font-size: 13pt; margin-bottom: 6mm }
  p { font-size: 14pt; line-height: 1.5; margin: 0 0 3mm }
  .line { display: inline-block; border-bottom: 1.3px solid #1d2433; width: 58mm; height: 8mm; vertical-align: bottom }
  .row { font-size: 16pt; margin: 7mm 0 0; display: flex; gap: 3mm; align-items: flex-end }
  .box { width: 7mm; height: 7mm; border: 1.5px solid #1d2433; display: inline-block; border-radius: 1mm }
  .fill { color: #b0b6c3 }
</style></head><body><div class="p">
  <h1>${L.doc.title}</h1>
  <div class="sub">${L.doc.sub}</div>
  ${L.doc.paras.map((t) => `<p>${t}</p>`).join('\n  ')}
  <div class="row">${L.doc.name} <span class="line" id="name"></span></div>
  <div class="row"><span class="box" id="agree"></span> ${L.doc.agree}</div>
  <div class="row">${L.doc.sig} <span class="line" id="sig"></span></div>
</div></body></html>`;

// ---------- the stage: brand background, captions, phone frame with the app ----------
const STAGE_HTML = `<!doctype html><html lang="${LANG}" dir="${L.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  * { box-sizing: border-box }
  html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; font-family: ${L.font} }
  body { background: #1d2f86; color: #fff }
  /* Laid out at 360x640 and scaled 3x: the browser draws everything (and the app) at full 1080x1920 */
  #stage { position: absolute; left: 0; top: 0; width: 360px; height: 640px; transform: scale(3); transform-origin: 0 0;
    background: radial-gradient(120% 80% at 50% 0%, #4565e0 0%, #2f4fc4 45%, #1d2f86 100%) }
  .cap { position: absolute; top: 26px; inset-inline: 0; text-align: center; height: 74px }
  .cap .step { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%;
    background: #fff; color: #2f4fc4; font-weight: 800; font-size: 17px; margin-bottom: 6px }
  .cap .txt { font-size: 25px; font-weight: 800; letter-spacing: -.2px; text-shadow: 0 2px 10px rgba(0,0,0,.18) }
  .cap > div { transition: opacity .35s, transform .35s }
  .cap.out > div { opacity: 0; transform: translateY(-8px) }
  .phone { position: absolute; left: 50%; top: 110px; width: 291px; height: 508px; margin-left: -145.5px;
    border-radius: 38px; background: #0d1222; padding: 9px; box-shadow: 0 24px 50px rgba(0,0,0,.35), inset 0 0 0 1.5px #3b4563 }
  .screen { width: 273px; height: 490px; border-radius: 30px; overflow: hidden; position: relative; background: #fff }
  iframe { border: 0; width: 390px; height: 700px; transform: scale(.7); transform-origin: 0 0; position: absolute; left: 0; top: 0 }
  .finger { position: absolute; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; pointer-events: none; z-index: 20;
    background: rgba(255,255,255,.55); border: 6px solid rgba(47,79,196,.55); box-shadow: 0 6px 24px rgba(0,0,0,.25);
    opacity: 0; transition: opacity .2s, transform .12s }
  .finger.on { opacity: 1 } .finger.down { transform: scale(.78); background: rgba(47,79,196,.35) }
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    background: radial-gradient(120% 80% at 50% 0%, #4565e0 0%, #2f4fc4 45%, #1d2f86 100%); z-index: 10; transition: opacity .5s; padding: 0 28px }
  .card.hide { opacity: 0; pointer-events: none }
  .logo { width: 104px; height: 104px; border-radius: 26px; background: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 16px 40px rgba(0,0,0,.3); margin-bottom: 22px }
  .logo img { width: 74px; height: 74px }
  .name { font-size: 44px; font-weight: 800; letter-spacing: -.5px; direction: ltr }
  .tag { font-size: 23px; font-weight: 700; margin-top: 6px; line-height: 1.3 }
  .pills { display: flex; flex-direction: column; gap: 9px; margin-top: 26px }
  .pill { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); border-radius: 999px; padding: 7px 18px; font-size: 17px; font-weight: 600 }
  .pop { animation: pop .6s cubic-bezier(.2,1.4,.4,1) both } .pop2 { animation-delay: .15s } .pop3 { animation-delay: .3s } .pop4 { animation-delay: .45s } .pop5 { animation-delay: .6s }
  @keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
</style></head><body><div id="stage">
  <div class="cap out" id="cap"><div><div class="step" id="step">1</div><div class="txt" id="txt"></div></div></div>
  <div class="phone"><div class="screen"><iframe id="app" src="about:blank"></iframe></div></div>
  <div class="card" id="intro">
    <div class="logo pop"><img src="icons/icon.svg" alt=""></div>
    <div class="name pop pop2">EasyPen</div>
    <div class="tag pop pop3">${L.intro}</div>
  </div>
  <div class="card hide" id="outro"></div>
</div><div class="finger" id="finger"></div></body></html>`;

const OUTRO_HTML = `
  <div class="logo pop"><img src="icons/icon.svg" alt=""></div>
  <div class="name pop pop2">EasyPen</div>
  <div class="pills">
    <div class="pill pop pop3">${L.pills[0]}</div>
    <div class="pill pop pop4">${L.pills[1]}</div>
  </div>`;

(async () => {
  const server = await start();
  const browser = await chromium.launch();

  // The demo PDF, printed by the browser (real text in the language), and where its fields are
  const docPage = await browser.newPage();
  await docPage.setContent(DOC_HTML);
  await docPage.evaluate(() => document.fonts.ready);
  const fields = await docPage.evaluate(() => {
    const p = document.querySelector('.p').getBoundingClientRect();
    const f = (id) => { const r = document.getElementById(id).getBoundingClientRect();
      return { x: (r.left - p.left) / p.width, y: (r.top - p.top) / p.height, w: r.width / p.width, h: r.height / p.height }; };
    return { name: f('name'), agree: f('agree'), sig: f('sig') };
  });
  const pdf = await docPage.pdf({ width: '148mm', height: '160mm', printBackground: true });
  await docPage.close();

  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: L.locale, serviceWorkers: 'block'
  });
  // In the app: a phone-like font, no install banner or invite, and a share sheet that "sends"
  await context.addInitScript(() => {
    if (window === window.top) return;
    try { localStorage.setItem('easypen.invited', '1'); } catch (e) {}
    navigator.canShare = () => true;
    navigator.share = () => new Promise((r) => setTimeout(r, 700));
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--font:"Noto Sans Hebrew","Noto Sans",sans-serif} html{scrollbar-width:none} ::-webkit-scrollbar{display:none}';
      document.head.appendChild(s);
    });
  });
  const page = await context.newPage();
  await page.route('**/easypen/__stage.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: STAGE_HTML }));
  await page.goto(server.baseUrl + '__stage.html');
  await page.evaluate(() => document.fonts.ready);

  // App in the frame
  await page.evaluate((u) => { document.getElementById('app').src = u; }, server.baseUrl);
  await page.waitForFunction(() => document.getElementById('app').contentDocument?.querySelector('#file-input'));
  const app = () => page.frames().find((f) => f.parentFrame() === page.mainFrame());
  await app().waitForSelector('#sig-empty', { state: 'visible' });
  await sleep(300);

  // ---------- recording ----------
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(FRAMES, `f${String(n++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  const t0 = Date.now();
  const mark = (label) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5), label);

  // Finger helpers (page coordinates)
  let fx = 540, fy = 1260;
  const finger = (x, y, cls) => page.evaluate(({ x, y, cls }) => {
    const f = document.getElementById('finger');
    f.style.left = x + 'px'; f.style.top = y + 'px';
    f.className = 'finger ' + cls;
  }, { x, y, cls });
  async function moveTo(x, y, ms = 380) {
    const steps = Math.max(6, Math.round(ms / 45));
    await finger(fx, fy, 'on');
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x1 = fx + (x - fx) * e, y1 = fy + (y - fy) * e;
      await finger(x1, y1, 'on');
      await page.mouse.move(x1, y1);
      await sleep(ms / steps);
    }
    fx = x; fy = y;
  }
  async function tap(x, y, { hold = 140, after = 250 } = {}) {
    await moveTo(x, y);
    await finger(x, y, 'on down');
    await page.mouse.down(); await sleep(hold); await page.mouse.up();
    await finger(x, y, 'on');
    await sleep(after);
  }
  const center = async (sel) => { const b = await app().locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const tapSel = async (sel, opt) => { const [x, y] = await center(sel); await tap(x, y, opt); };
  const hideFinger = () => finger(fx, fy, '');
  // A drawn stroke through page points, at a steady pace
  async function stroke(points, ms) {
    await moveTo(points[0][0], points[0][1], 300);
    await finger(fx, fy, 'on down');
    await page.mouse.down();
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      await page.mouse.move(x, y);
      await finger(x, y, 'on down');
      await sleep(ms / points.length);
    }
    await page.mouse.up();
    [fx, fy] = points[points.length - 1];
    await finger(fx, fy, 'on');
  }
  async function caption(step, text) {
    await page.evaluate(() => document.getElementById('cap').classList.add('out'));
    await sleep(220);
    await page.evaluate(({ step, text }) => {
      document.getElementById('step').textContent = step;
      document.getElementById('txt').textContent = text;
      document.getElementById('cap').classList.remove('out');
    }, { step, text });
  }
  // A point on page 1 of the document, from fractions of the page
  async function onPage(fx_, fy_) {
    const b = await app().locator('.page[data-page="1"]').boundingBox();
    return [b.x + b.width * fx_, b.y + b.height * fy_];
  }

  // ---- 0: intro ----
  mark('intro');
  await sleep(1600);
  await page.evaluate(() => document.getElementById('intro').classList.add('hide'));
  await caption('1', L.steps[0]);
  await sleep(500);

  // ---- 1: upload ----
  mark('upload');
  await tapSel('.upload-btn', { after: 150 });
  await app().setInputFiles('#file-input', { name: L.file, mimeType: 'application/pdf', buffer: pdf });
  await app().waitForURL(/viewer\.html/);
  await app().waitForSelector('.page.is-rendered');
  await hideFinger();
  await sleep(700);

  // ---- 2: signature ----
  mark('signature');
  await caption('2', L.steps[1]);
  await sleep(250);
  await tapSel('#add-sig', { after: 350 });
  if (await app().locator('#sig-picker[open]').isVisible().catch(() => false)) await tapSel('#sig-picker [data-action="new"]');
  await app().waitForSelector('dialog.sig-dialog[open]');
  await sleep(300);
  const c = await app().locator('.sig-canvas').boundingBox();
  // A handwritten-looking signature: a tall initial and a run of joined letters,
  // drawn as smooth curves through points (fractions of the drawing box)
  const spline = (cp, per) => cp.slice(0, -1).flatMap((p1, i) => {
    const p0 = cp[i - 1] || p1, p2 = cp[i + 1], p3 = cp[i + 2] || p2;
    return Array.from({ length: per }, (_, s) => { const t = s / per, t2 = t * t, t3 = t2 * t;
      return [0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)); });
  }).concat([cp[cp.length - 1]]).map(([u, v]) => [c.x + c.width * u, c.y + c.height * v]);
  await stroke(spline([[0.13, 0.66], [0.17, 0.44], [0.21, 0.2], [0.235, 0.24], [0.215, 0.46], [0.18, 0.64], [0.165, 0.68], [0.2, 0.58],
    [0.28, 0.4], [0.32, 0.47], [0.27, 0.57], [0.245, 0.6], [0.3, 0.63], [0.345, 0.56], [0.365, 0.49], [0.385, 0.48], [0.395, 0.55],
    [0.405, 0.62], [0.43, 0.53], [0.45, 0.47], [0.47, 0.48], [0.48, 0.56], [0.495, 0.62], [0.53, 0.52], [0.565, 0.32], [0.575, 0.25],
    [0.56, 0.24], [0.545, 0.34], [0.55, 0.55], [0.565, 0.62], [0.6, 0.56], [0.625, 0.5], [0.645, 0.52], [0.65, 0.59], [0.67, 0.62],
    [0.71, 0.56], [0.75, 0.58], [0.81, 0.59], [0.88, 0.5]], 4), 1300);
  await sleep(600);
  await tapSel('dialog.sig-dialog [data-action="confirm"]', { after: 200 });
  await app().waitForSelector('dialog.sig-dialog', { state: 'detached' });
  await sleep(450);
  // Drag it onto the signature line
  const sb = await app().locator('.ov-sig').boundingBox();
  const [tx, ty] = await onPage(fields.sig.x + fields.sig.w / 2, fields.sig.y + fields.sig.h * 0.2);
  await moveTo(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await finger(fx, fy, 'on down');
  await page.mouse.down();
  await moveTo(tx, ty, 700);
  await page.mouse.up();
  await finger(fx, fy, 'on');
  await sleep(400);

  // ---- 3: text ----
  mark('text');
  await caption('3', L.steps[2]);
  await sleep(200);
  await tapSel('#add-text', { after: 300 });
  const [nx, ny] = await onPage(fields.name.x + fields.name.w * (L.dir === 'rtl' ? 0.255 : 0.1), fields.name.y + fields.name.h * 0.3);
  await tap(nx, ny, { after: 250 });
  await hideFinger();
  for (const ch of L.typed) { await page.keyboard.type(ch); await sleep(85); }
  await sleep(250);
  await page.keyboard.press('Escape');
  await sleep(200);
  for (let i = 0; i < 3; i++) await tapSel('#item-toolbar [data-action="font-up"]', { hold: 90, after: 120 });
  await sleep(250);
  await page.keyboard.press('Escape');
  await sleep(300);

  // ---- 4: tick ----
  mark('draw');
  await caption('4', L.steps[3]);
  await sleep(200);
  await tapSel('#draw-btn', { after: 400 });
  const a = fields.agree;
  const p1 = await onPage(a.x + a.w * 0.2, a.y + a.h * 0.5);
  const p2 = await onPage(a.x + a.w * 0.45, a.y + a.h * 0.85);
  const p3 = await onPage(a.x + a.w * 1.0, a.y - a.h * 0.2);
  const tick = [];
  for (let i = 0; i <= 8; i++) tick.push([p1[0] + (p2[0] - p1[0]) * i / 8, p1[1] + (p2[1] - p1[1]) * i / 8]);
  for (let i = 1; i <= 14; i++) tick.push([p2[0] + (p3[0] - p2[0]) * i / 14, p2[1] + (p3[1] - p2[1]) * i / 14]);
  await stroke(tick, 500);
  await sleep(350);
  await tapSel('#draw-done', { after: 400 });

  // ---- 5: save & share ----
  mark('share');
  await caption('5', L.steps[4]);
  await sleep(200);
  await tapSel('#save-share', { after: 300 });
  await app().waitForSelector('#name-dialog[open]');
  await sleep(700);
  await tapSel('#name-dialog [type="submit"]', { after: 100 });
  await hideFinger();
  await app().waitForFunction((re) => new RegExp(re).test(document.getElementById('toast')?.textContent || ''), L.shared.source, { timeout: 15000 });
  await sleep(1300);

  // ---- outro ----
  mark('outro');
  await page.evaluate((html) => { const o = document.getElementById('outro'); o.innerHTML = html; o.classList.remove('hide'); }, OUTRO_HTML);
  await sleep(3100);
  mark('end');
  await cdp.send('Page.stopScreencast');
  await sleep(200);

  // ffmpeg concat list with each frame's real duration
  frames.sort((a, b) => a.t - b.t);
  const end = frames[frames.length - 1].t + 0.04;
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(OUT, 'frames.txt'), list);
  const seconds = end - frames[0].t;
  console.log('frames', frames.length, 'seconds', seconds.toFixed(1));
  await browser.close();
  await server.close();

  // Exactly 30 seconds (a few percent faster or slower is not noticeable)
  fs.mkdirSync(path.dirname(VIDEO), { recursive: true });
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'frames.txt'),
    '-vf', `fps=60,setpts=PTS*30/${seconds.toFixed(3)},fps=30,scale=1080:1920:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', '-t', '30', VIDEO], { stdio: 'inherit' });
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '1.7', '-i', VIDEO, '-frames:v', '1', '-vf', 'scale=540:960', '-q:v', '4',
    VIDEO.replace(/\.mp4$/, '.jpg')], { stdio: 'inherit' });
  console.log('video', VIDEO);
})().catch((e) => { console.error(e); process.exit(1); });
