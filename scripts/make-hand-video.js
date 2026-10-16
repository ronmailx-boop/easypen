// EasyPen 10-second clip (1080x1920, Hebrew / English / Russian): an illustrated hand holds a phone,
// the thumb opens EasyPen from the home screen, picks a document and adds a saved signature. The app
// on the screen is the real one; it is recorded (CDP screencast) into media/easypen-hand-<lang>.mp4
// (+ .jpg poster). Same needs as make-promo-video.js (ffmpeg via imageio-ffmpeg, Heebo / Noto fonts).
// Usage: node scripts/make-hand-video.js [he|en|ru] [workDir]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { start } = require('../tests/helpers/server');
const { LANGS, docHtml, SIGNATURE, spline } = require('./video-content');

const ROOT = path.join(__dirname, '..');
const LANG = process.argv[2] || 'he';
const L = LANGS[LANG];
if (!L) throw new Error(`Unknown language ${LANG} (he, en or ru)`);
const OUT = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'easypen-hand-'));
const VIDEO = path.join(ROOT, 'media', `easypen-hand-${LANG}.mp4`);
const SECONDS = 10;
const FFMPEG = process.env.FFMPEG ||
  execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the phone's home screen: simple made-up apps around the EasyPen icon ----------
const GLYPHS = [
  '<path d="M7 3h3l1.6 4.2-2.1 1.4a11 11 0 0 0 5 5l1.4-2.1L20 13v3a2 2 0 0 1-2 2A15 15 0 0 1 5 5a2 2 0 0 1 2-2z"/>',
  '<path d="M12 4c4.6 0 8 2.9 8 6.5S16.6 17 12 17c-.9 0-1.8-.1-2.6-.3L5 19l1.2-3.6C4.8 14.2 4 12.4 4 10.5 4 6.9 7.4 4 12 4z"/>',
  '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4" fill="#0003"/>',
  '<circle cx="12" cy="8" r="3"/><circle cx="8" cy="13" r="3"/><circle cx="16" cy="13" r="3"/><circle cx="12" cy="16.5" r="3"/>',
  '<circle cx="12" cy="12" r="8"/><path d="M11.2 7h1.6v5.2l3.2 2-.8 1.3-4-2.5z" fill="#0004"/>',
  '<path d="M12 3a6 6 0 0 1 6 6c0 4.5-6 12-6 12S6 13.5 6 9a6 6 0 0 1 6-6z"/><circle cx="12" cy="9" r="2.2" fill="#0003"/>',
  '<circle cx="9" cy="9" r="4"/><path d="M8 19a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.4A3.3 3.3 0 0 1 17 19z" fill="#fffd"/>',
  '<path d="M18 4v11.2A3 3 0 1 1 16 12.4V8l-7 1.6v7.6A3 3 0 1 1 7 14.4V6.2z"/>',
  '<rect x="4" y="5" width="16" height="15" rx="2.5"/><rect x="4" y="5" width="16" height="4.5" rx="2" fill="#0003"/>',
  '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5" stroke="#0004" stroke-width="1.6"/>',
  '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8 8h8" stroke="#0004" stroke-width="2.4"/><g fill="#0004"><circle cx="9" cy="12.5" r="1.2"/><circle cx="12" cy="12.5" r="1.2"/><circle cx="15" cy="12.5" r="1.2"/><circle cx="9" cy="16.5" r="1.2"/><circle cx="12" cy="16.5" r="1.2"/><circle cx="15" cy="16.5" r="1.2"/></g>'
];
const COLORS = ['#34c759,#1f9d45', '#5ac8fa,#2f80ed', '#8e8e93,#55565c', '#ff9f0a,#ff375f', '#3a3a3c,#1c1c1e', '#30d158,#0a84ff',
  '#64d2ff,#0a84ff', '#ff375f,#bf2050', '#ff453a,#ff9f0a', '#ffd60a,#ff9f0a', '#636366,#2c2c2e'];
const icon = (i) => `<div class="app"><div class="ico" style="background:linear-gradient(160deg,${COLORS[i]})"><svg viewBox="0 0 24 24" fill="#fff">${GLYPHS[i]}</svg></div><span>${L.hand.apps[i]}</span></div>`;
// Two rows of apps with EasyPen at the end of the second row, nearest the thumb (on the right)
const grid = [4, 5, 6, 7, 8, 9, 10].map(icon);
grid.splice(L.dir === 'rtl' ? 4 : 7, 0, '<div class="app" id="ep"><div class="ico ep"><img src="icons/icon.svg" alt=""></div><span>EasyPen</span></div>');
const DATE = new Date(2026, 10, 1).toLocaleDateString(L.locale, { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- the stage (laid out at 360x640, scaled 3x to 1080x1920) ----------
const STAGE_HTML = `<!doctype html><html lang="${LANG}" dir="${L.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  * { box-sizing: border-box }
  html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; font-family: ${L.font} }
  body { background: #1d2f86; color: #fff }
  #stage { position: absolute; left: 0; top: 0; width: 360px; height: 640px; transform: scale(3); transform-origin: 0 0; overflow: hidden;
    background: radial-gradient(120% 80% at 50% 0%, #4565e0 0%, #2f4fc4 45%, #1d2f86 100%) }
  .cap { position: absolute; top: 40px; inset-inline: 0; text-align: center; font-size: 27px; font-weight: 800; letter-spacing: -.2px;
    text-shadow: 0 2px 10px rgba(0,0,0,.18); transition: opacity .3s, transform .3s }
  .cap.out { opacity: 0; transform: translateY(-8px) }
  /* phone + hand move in together */
  #rig { position: absolute; inset: 0; transition: transform 1s cubic-bezier(.2,.8,.2,1); transform-origin: 300px 640px }
  #rig.away { transform: translateY(560px) rotate(-8deg) }
  .phone { position: absolute; left: 49px; top: 118px; width: 262px; height: 470px; border-radius: 38px; background: #0d1222; padding: 9px;
    box-shadow: 0 24px 50px rgba(0,0,0,.35), inset 0 0 0 1.5px #3b4563; z-index: 2 }
  .screen { width: 244px; height: 452px; border-radius: 30px; overflow: hidden; position: relative; background: #f4f5fa }
  iframe { border: 0; width: 390px; height: 722.5px; transform: scale(.62564); transform-origin: 0 0; position: absolute; left: 0; top: 0 }
  /* home screen */
  #home { position: absolute; inset: 0; z-index: 3; transition: opacity .25s; color: #fff; direction: ${L.dir};
    background: radial-gradient(90% 60% at 20% 10%, #8fb0ff 0%, transparent 60%), radial-gradient(80% 60% at 90% 90%, #b06ad8 0%, transparent 60%), linear-gradient(170deg, #5b7cf0, #3b3fa8 60%, #2a2266) }
  #home.gone { opacity: 0; pointer-events: none }
  .bar { display: flex; justify-content: space-between; align-items: center; padding: 11px 22px 0; font: 600 11px/1 "Noto Sans", sans-serif; direction: ltr }
  .bar i { display: inline-block; width: 18px; height: 9px; border: 1.3px solid #fff; border-radius: 3px; position: relative; margin-left: 4px }
  .bar i::after { content: ""; position: absolute; inset: 1.2px 4px 1.2px 1.2px; background: #fff; border-radius: 1px }
  .bar b { display: inline-block; width: 14px; height: 9px; background: linear-gradient(90deg, #fff 0 22%, transparent 0 26%, #fff 0 48%, transparent 0 52%, #fff 0 74%, transparent 0 78%, #fff 0);
    clip-path: polygon(0 100%, 100% 0, 100% 100%) }
  .widget { margin: 28px 22px 0; text-align: center }
  .widget .t { font: 300 64px/1 "Noto Sans", sans-serif; letter-spacing: -2px; direction: ltr }
  .widget .d { font-size: 13px; font-weight: 600; opacity: .9; margin-top: 6px }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); row-gap: 14px; padding: 0 8px; margin-top: 74px }
  .app { display: flex; flex-direction: column; align-items: center; gap: 5px }
  .app span { font-size: 9px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,.35); white-space: nowrap }
  .ico { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,.18) }
  .ico svg { width: 28px; height: 28px }
  .ico.ep { background: #fff } .ico.ep img { width: 34px; height: 34px }
  .dock { position: absolute; left: 10px; right: 10px; bottom: 10px; height: 70px; border-radius: 24px; background: rgba(255,255,255,.22);
    display: grid; grid-template-columns: repeat(4, 1fr); align-items: center; backdrop-filter: blur(6px) }
  .dock .app span { display: none }
  #launch { position: absolute; z-index: 4; pointer-events: none; background: #f4f5fa; display: flex; align-items: center; justify-content: center; opacity: 0;
    transition: all .38s cubic-bezier(.3,.7,.2,1) }
  #launch img { width: 70%; max-width: 64px; transition: opacity .3s }
  /* the hand */
  .skin { background: linear-gradient(100deg, #d79c76, #ebb792 45%, #f2c7a5 70%, #dfa47d) }
  #palm, #wrist, #sleeve, .fing, #thenar, .seg { position: absolute; pointer-events: none }
  #back { position: absolute; inset: 0; z-index: 1 }
  #front { position: absolute; inset: 0; z-index: 5; pointer-events: none; filter: drop-shadow(3px 9px 9px rgba(10,15,40,.33)) }
  #palm { left: 228px; top: 470px; width: 200px; height: 250px; border-radius: 48% 52% 40% 50%; transform: rotate(-22deg) }
  #wrist { left: 290px; top: 560px; width: 140px; height: 260px; transform: rotate(-38deg); border-radius: 40px }
  #sleeve { left: 330px; top: 600px; width: 170px; height: 260px; transform: rotate(-38deg); border-radius: 30px; background: linear-gradient(100deg, #1b2440, #2c3a62);
    box-shadow: inset 0 9px 0 #e8ecfb }
  .fing { left: 24px; width: 40px; height: 31px; border-radius: 16px 10px 10px 16px; box-shadow: inset 0 -4px 0 rgba(160,90,60,.18) }
  #thenar { width: 92px; height: 120px; border-radius: 50%; transform: translate(-30%, -40%) rotate(-30deg) }
  .seg { height: var(--w); margin-top: calc(var(--w) / -2); border-radius: calc(var(--w) / 2); transform-origin: calc(var(--w) / 2) 50%;
    background: linear-gradient(180deg, #f3c9a8, #ebb48d 55%, #d39871) }
  #s2 .nail { position: absolute; right: 5px; top: 50%; width: 27px; height: 25px; margin-top: -12.5px; border-radius: 46% 54% 54% 46%;
    background: linear-gradient(90deg, #f0c2a8, #fbe1d1); box-shadow: inset 0 0 0 1px rgba(150,80,60,.12) }
  #ripple { position: absolute; width: 46px; height: 46px; margin: -23px; border-radius: 50%; border: 3px solid rgba(255,255,255,.95); z-index: 4;
    box-shadow: 0 0 0 2px rgba(47,79,196,.5); opacity: 0; pointer-events: none }
  #ripple.go { animation: ripple .45s ease-out }
  @keyframes ripple { from { opacity: .9; transform: scale(.3) } to { opacity: 0; transform: scale(1.2) } }
  /* end card */
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; z-index: 10;
    background: radial-gradient(120% 80% at 50% 0%, #4565e0 0%, #2f4fc4 45%, #1d2f86 100%); transition: opacity .45s; padding: 0 28px }
  .card.hide { opacity: 0; pointer-events: none }
  .logo { width: 104px; height: 104px; border-radius: 26px; background: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 16px 40px rgba(0,0,0,.3); margin-bottom: 22px }
  .logo img { width: 74px; height: 74px }
  .name { font-size: 44px; font-weight: 800; letter-spacing: -.5px; direction: ltr }
  .tag { font-size: 23px; font-weight: 700; margin-top: 6px; line-height: 1.3 }
  .card:not(.hide) .pop { animation: pop .6s cubic-bezier(.2,1.4,.4,1) both } .pop2 { animation-delay: .12s !important } .pop3 { animation-delay: .24s !important }
  @keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
</style></head><body><div id="stage">
  <div class="cap" id="cap">${L.hand.caps[0]}</div>
  <div id="rig" class="away">
    <div id="back"><div id="sleeve"></div><div id="wrist" class="skin"></div><div id="palm" class="skin"></div></div>
    <div class="phone"><div class="screen">
      <iframe id="app" src="about:blank"></iframe>
      <div id="home">
        <div class="bar"><span>9:41</span><span><b></b><i></i></span></div>
        <div class="widget"><div class="t">9:41</div><div class="d">${DATE}</div></div>
        <div class="grid">${grid.join('')}</div>
        <div class="dock">${[0, 1, 2, 3].map(icon).join('')}</div>
      </div>
      <div id="launch"><img src="icons/icon.svg" alt=""></div>
      <div id="ripple"></div>
    </div></div>
    <div id="front">
      <div class="fing skin" style="--i:0"></div><div class="fing skin" style="--i:1"></div><div class="fing skin" style="--i:2"></div><div class="fing skin" style="--i:3"></div>
      <div id="thenar" class="skin"></div>
      <div class="seg" id="s1" style="--w:50px"></div>
      <div class="seg" id="s2" style="--w:42px"><div class="nail"></div></div>
    </div>
  </div>
  <div class="card hide" id="outro">
    <div class="logo pop"><img src="icons/icon.svg" alt=""></div>
    <div class="name pop pop2">EasyPen</div>
    <div class="tag pop pop3">${L.intro}</div>
  </div>
</div>
<script>
  // The thumb: two segments from the base of the thumb (right edge of the phone, near the bottom) to the tip.
  // For a far target the whole hand slides up the phone, as a real grip would.
  const BASE = [322, 566], L1 = 118, L2 = 104, REACH = 196;
  const $ = (id) => document.getElementById(id);
  function seg(el, [x1, y1], [x2, y2], extra) {
    const w = parseFloat(el.style.getPropertyValue('--w'));
    const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    el.style.width = len + w / 2 + extra + 'px';
    el.style.left = x1 - w / 2 + 'px'; el.style.top = y1 + 'px';
    el.style.transform = 'rotate(' + a + 'rad)';
  }
  window.thumb = (x, y, press) => {
    const dx = BASE[0] - x;
    let dy = BASE[1] - y, oy = 0;
    if (Math.hypot(dx, dy) > REACH) oy = -Math.min(190, dy - Math.sqrt(Math.max(REACH * REACH - dx * dx, 0)));
    const b = [BASE[0], BASE[1] + oy];
    const reach = press ? 0.96 : 1;
    let d = Math.hypot(x - b[0], y - b[1]);
    const dd = Math.min(Math.max(d, Math.abs(L1 - L2) + 2), (L1 + L2) * reach - 1);
    const a = Math.atan2(y - b[1], x - b[0]);
    const al = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))));
    // Knuckle bends outward (down and to the right)
    const c1 = [b[0] + L1 * Math.cos(a + al), b[1] + L1 * Math.sin(a + al)], c2 = [b[0] + L1 * Math.cos(a - al), b[1] + L1 * Math.sin(a - al)];
    const j = (c1[0] + c1[1]) > (c2[0] + c2[1]) ? c1 : c2;
    const tip = [j[0] + L2 * Math.cos(Math.atan2(y - j[1], x - j[0])), j[1] + L2 * Math.sin(Math.atan2(y - j[1], x - j[0]))];
    seg($('s1'), b, j, 0);
    seg($('s2'), j, tip, 0);
    $('thenar').style.left = b[0] + 'px'; $('thenar').style.top = b[1] + 'px';
    document.querySelectorAll('.fing').forEach((f, i) => {
      f.style.top = 352 + i * 37 + oy * 0.85 + 'px';
      f.style.transform = 'rotate(' + (i * 4 - 6) + 'deg)';
    });
    ['palm', 'wrist', 'sleeve'].forEach((id) => { $(id).style.translate = '0 ' + oy + 'px'; });
  };
  window.ripple = (x, y) => {
    const r = $('ripple'), s = document.querySelector('.screen').getBoundingClientRect();
    r.style.left = (x - s.left / 3) + 'px'; r.style.top = (y - s.top / 3) + 'px';
    r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
  };
</script></body></html>`;

(async () => {
  const server = await start();
  const browser = await chromium.launch();

  // The demo PDF and where its signature line is
  const docPage = await browser.newPage();
  await docPage.setContent(docHtml(LANG, L));
  await docPage.evaluate(() => document.fonts.ready);
  const sigLine = await docPage.evaluate(() => {
    const p = document.querySelector('.p').getBoundingClientRect(), r = document.getElementById('sig').getBoundingClientRect();
    return { x: (r.left - p.left + r.width / 2) / p.width, y: (r.bottom - p.top) / p.height };
  });
  const pdf = await docPage.pdf({ width: '148mm', height: '160mm', printBackground: true });
  await docPage.close();

  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: L.locale, serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    if (window === window.top) return;
    try { localStorage.setItem('easypen.invited', '1'); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--font:"Noto Sans Hebrew","Noto Sans",sans-serif} html{scrollbar-width:none} ::-webkit-scrollbar{display:none}';
      document.head.appendChild(s);
    });
  });
  const page = await context.newPage();
  await page.route('**/easypen/__hand.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: STAGE_HTML }));
  await page.goto(server.baseUrl + '__hand.html');
  await page.evaluate(() => document.fonts.ready);

  // The app, with one saved signature (drawn here from the same curves as the other video)
  await page.evaluate((u) => { document.getElementById('app').src = u; }, server.baseUrl);
  await page.waitForFunction(() => document.getElementById('app').contentDocument?.querySelector('#file-input'));
  const app = () => page.frames().find((f) => f.parentFrame() === page.mainFrame());
  await app().waitForFunction(() => window.EasyPenStorage);
  await app().evaluate(async (strokes) => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 170;
    const x = c.getContext('2d'); x.lineWidth = 7; x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#1d2433';
    for (const s of strokes) { x.beginPath(); s.forEach(([u, v], i) => x[i ? 'lineTo' : 'moveTo'](u * 640, (v - 0.14) / 0.76 * 170)); x.stroke(); }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    for (const s of await window.EasyPenStorage.listSignatures()) await window.EasyPenStorage.deleteSignature(s.id);
    await window.EasyPenStorage.addSignature(blob);
  }, SIGNATURE.map((cp, i) => spline(cp, i ? 6 : 4)));
  await page.evaluate((u) => { document.getElementById('app').src = u + '?r=1'; }, server.baseUrl);
  await page.waitForFunction(() => document.getElementById('app').contentDocument?.querySelector('#sig-list img, .sig-card img, .signatures-section img'));
  const REST = [266, 520];
  await page.evaluate(([x, y]) => window.thumb(x, y), REST);
  await sleep(400);

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

  // Thumb helpers (stage coordinates, 360x640; the page is 3x)
  let [tx, ty] = REST;
  const setThumb = (x, y, press = false) => page.evaluate(([x, y, p]) => window.thumb(x, y, p), [x, y, press]);
  async function thumbTo(x, y, ms = 420, drag = false) {
    const steps = Math.max(6, Math.round(ms / 40));
    const [x0, y0] = [tx, ty];
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // A slight arc, as a thumb swings rather than slides
      const lift = Math.sin(Math.PI * k) * Math.min(18, Math.hypot(x - x0, y - y0) * 0.08);
      const x1 = x0 + (x - x0) * e + lift, y1 = y0 + (y - y0) * e + lift * 0.4;
      await setThumb(x1, y1, drag);
      if (drag) await page.mouse.move(x1 * 3, y1 * 3);
      await sleep(ms / steps);
    }
    tx = x; ty = y;
  }
  async function tap(x, y, { after = 250 } = {}) {
    await thumbTo(x, y);
    await setThumb(x, y, true);
    await page.evaluate(([x, y]) => window.ripple(x, y), [x, y]);
    await page.mouse.move(x * 3, y * 3);
    await page.mouse.down(); await sleep(110); await page.mouse.up();
    await setThumb(x, y);
    await sleep(after);
  }
  const box = async (sel) => { const b = await app().locator(sel).first().boundingBox(); return [(b.x + b.width / 2) / 3, (b.y + b.height / 2) / 3]; };
  const tapSel = async (sel, opt) => { const [x, y] = await box(sel); await tap(x, y, opt); };
  async function caption(text) {
    await page.evaluate(() => document.getElementById('cap').classList.add('out'));
    await sleep(200);
    await page.evaluate((text) => { const c = document.getElementById('cap'); c.textContent = text; c.classList.remove('out'); }, text);
  }

  // ---- 1: the phone comes in, the thumb opens EasyPen ----
  mark('home');
  await page.evaluate(() => document.getElementById('rig').classList.remove('away'));
  await sleep(1150);
  const ep = await page.evaluate(() => { const r = document.querySelector('#ep .ico').getBoundingClientRect(); return [r.left / 3, r.top / 3, r.width / 3, r.height / 3]; });
  await tap(ep[0] + ep[2] / 2, ep[1] + ep[3] / 2, { after: 0 });
  await page.evaluate(() => {
    const s = document.querySelector('.screen').getBoundingClientRect(), r = document.querySelector('#ep .ico').getBoundingClientRect(), l = document.getElementById('launch');
    Object.assign(l.style, { left: (r.left - s.left) / 3 + 'px', top: (r.top - s.top) / 3 + 'px', width: r.width / 3 + 'px', height: r.height / 3 + 'px', borderRadius: '12px', opacity: 1 });
    void l.offsetWidth;
    Object.assign(l.style, { left: 0, top: 0, width: '100%', height: '100%', borderRadius: '30px' });
  });
  await thumbTo(...REST, 380);
  await page.evaluate(() => { document.getElementById('home').classList.add('gone'); });
  await sleep(150);
  await page.evaluate(() => { const l = document.getElementById('launch'); l.style.transition = 'opacity .3s'; l.style.opacity = 0; });
  await sleep(450);

  // ---- 2: pick a document ----
  mark('upload');
  await caption(L.hand.caps[1]);
  await sleep(250);
  await tapSel('.upload-btn', { after: 100 });
  await app().setInputFiles('#file-input', { name: L.file, mimeType: 'application/pdf', buffer: pdf });
  await thumbTo(...REST, 380);
  await app().waitForURL(/viewer\.html/);
  await app().waitForSelector('.page.is-rendered');
  await sleep(450);

  // ---- 3: add the saved signature and put it on the line ----
  mark('signature');
  await caption(L.hand.caps[2]);
  await tapSel('#add-sig', { after: 200 });
  await app().waitForSelector('#sig-picker[open] .sig-choice');
  await sleep(250);
  await tapSel('#sig-picker .sig-choice', { after: 0 });
  await app().waitForSelector('.ov-sig');
  await sleep(350);
  const s = await box('.ov-sig');
  const sh = (await app().locator('.ov-sig').boundingBox()).height / 3;
  const pg = await app().locator('.page[data-page="1"]').boundingBox();
  // Centered on the line, resting on it
  const target = [(pg.x + pg.width * sigLine.x) / 3, (pg.y + pg.height * sigLine.y) / 3 - sh * 0.22];
  await thumbTo(s[0], s[1], 380);
  await setThumb(s[0], s[1], true);
  await page.mouse.move(s[0] * 3, s[1] * 3);
  await page.mouse.down();
  await thumbTo(target[0], target[1], 650, true);
  await page.mouse.up();
  await setThumb(...target);
  await sleep(150);
  await thumbTo(...REST, 400);
  await sleep(500);

  // ---- end card ----
  mark('outro');
  await page.evaluate(() => { document.getElementById('cap').classList.add('out'); document.getElementById('outro').classList.remove('hide'); });
  await sleep(2300);
  mark('end');
  await cdp.send('Page.stopScreencast');
  await sleep(200);

  frames.sort((a, b) => a.t - b.t);
  const end = frames[frames.length - 1].t + 0.04;
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(OUT, 'frames.txt'), list);
  const seconds = end - frames[0].t;
  console.log('frames', frames.length, 'seconds', seconds.toFixed(1));
  await browser.close();
  await server.close();

  fs.mkdirSync(path.dirname(VIDEO), { recursive: true });
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'frames.txt'),
    '-vf', `fps=60,setpts=PTS*${SECONDS}/${seconds.toFixed(3)},fps=30,scale=1080:1920:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', '-t', String(SECONDS), VIDEO], { stdio: 'inherit' });
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '1.3', '-i', VIDEO, '-frames:v', '1', '-vf', 'scale=540:960', '-q:v', '4',
    VIDEO.replace(/\.mp4$/, '.jpg')], { stdio: 'inherit' });
  console.log('video', VIDEO);
})().catch((e) => { console.error(e); process.exit(1); });
