/*
 * EasyPen end-to-end tests (Playwright + Chromium, mobile viewport).
 * Run: npm test
 */
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./helpers/server');
const { createTestPdf } = require('./helpers/fixtures');

const MOBILE = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 };

let server;
let browser;
let pdfBytes;
let context;
let page;
let pageErrors;

before(async () => {
  server = await start();
  pdfBytes = await createTestPdf();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // UTF-8 locale so Chromium keeps Hebrew download file names
    env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  // Fresh context = fresh IndexedDB, caches and Service Worker for every test
  context = await browser.newContext({ ...MOBILE, locale: 'he-IL', acceptDownloads: true });
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
});

afterEach(async () => {
  await context.close();
  assert.deepEqual(pageErrors, [], 'no console errors');
});

/* ---------------- helpers ---------------- */

const pdfFile = (name = 'test.pdf') => ({ name, mimeType: 'application/pdf', buffer: pdfBytes });

async function openInEditor(name) {
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', pdfFile(name));
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
}

async function scrollToPage(n) {
  await page.evaluate((n) => document.querySelector(`.page[data-page="${n}"]`).scrollIntoView({ block: 'center' }), n);
}

async function drawSignature() {
  const c = await page.locator('.sig-canvas').boundingBox();
  await page.mouse.move(c.x + 30, c.y + c.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    await page.mouse.move(c.x + 30 + t * (c.width - 60), c.y + c.height * (0.5 + 0.2 * Math.sin(t * 12)));
  }
  await page.mouse.up();
}

async function drawNewSignatureAndPlace() {
  await page.click('#add-sig');
  const picker = page.locator('#sig-picker[open]');
  if (await picker.isVisible()) await page.click('#sig-picker [data-action="new"]');
  await page.waitForSelector('dialog.sig-dialog[open]');
  await drawSignature();
  await page.click('dialog.sig-dialog [data-action="confirm"]');
  await page.waitForSelector('dialog.sig-dialog', { state: 'detached' });
}

async function dragBy(locator, dx, dy) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

// Bounding box (page fractions) of all overlays per page, as laid out in the editor
function overlayBoxes() {
  return page.evaluate(() => {
    const out = {};
    for (const ov of document.querySelectorAll('.ov')) {
      const pageEl = ov.closest('.page');
      const pr = pageEl.getBoundingClientRect();
      const r = ov.getBoundingClientRect();
      const box = {
        x0: (r.left - pr.left) / pr.width, y0: (r.top - pr.top) / pr.height,
        x1: (r.right - pr.left) / pr.width, y1: (r.bottom - pr.top) / pr.height
      };
      const n = pageEl.dataset.page;
      const u = out[n];
      out[n] = u ? { x0: Math.min(u.x0, box.x0), y0: Math.min(u.y0, box.y0), x1: Math.max(u.x1, box.x1), y1: Math.max(u.y1, box.y1) } : box;
    }
    return out;
  });
}

/*
 * Renders the original and exported PDFs with pdf.js and returns, per page,
 * the bounding box (page fractions) of pixels that changed, or null.
 */
async function changedBoxes(originalBytes, exportedBytes) {
  const renderer = await context.newPage();
  await renderer.goto(server.baseUrl + 'index.html');
  const result = await renderer.evaluate(async ([a, b]) => {
    const lib = await import(new URL('vendor/pdfjs/pdf.min.mjs', document.baseURI).href);
    lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    const decode = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const load = (s) => lib.getDocument({ data: decode(s) }).promise;
    const render = async (pdf, n) => {
      const pg = await pdf.getPage(n);
      const vp = pg.getViewport({ scale: 1 });
      const cv = document.createElement('canvas');
      cv.width = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      await pg.render({ canvas: cv, viewport: vp }).promise;
      return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    };
    const [orig, out] = [await load(a), await load(b)];
    const boxes = { numPages: out.numPages };
    for (let n = 1; n <= orig.numPages; n++) {
      const A = await render(orig, n);
      const B = await render(out, n);
      if (A.width !== B.width || A.height !== B.height) { boxes[n] = 'size-mismatch'; continue; }
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let y = 0; y < A.height; y++) {
        for (let x = 0; x < A.width; x++) {
          const i = (y * A.width + x) * 4;
          const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
          if (d > 60) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      boxes[n] = x1 < 0 ? null : { x0: x0 / A.width, y0: y0 / A.height, x1: (x1 + 1) / A.width, y1: (y1 + 1) / A.height };
    }
    return boxes;
  }, [originalBytes.toString('base64'), exportedBytes.toString('base64')]);
  await renderer.close();
  return result;
}

async function exportViaDownload() {
  const download = page.waitForEvent('download');
  await page.click('#save-share');
  const d = await download;
  const chunks = [];
  for await (const c of await d.createReadStream()) chunks.push(c);
  return { name: d.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

/* ---------------- tests ---------------- */

test('home screen: rejects non-PDF files', async () => {
  await page.goto(server.baseUrl);
  assert.equal(await page.title(), 'EasyPen - חתימה דיגיטלית');
  await page.setInputFiles('#file-input', { name: 'contract.docx', mimeType: 'application/msword', buffer: Buffer.from('x') });
  assert.equal(await page.textContent('#upload-error'), 'כרגע נתמכים קבצי PDF בלבד');
});

test('editor: file with .pdf name but non-PDF content shows an error', async () => {
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.status-screen.is-error');
  assert.equal(await page.textContent('#status-text'), 'כרגע נתמכים קבצי PDF בלבד');
  pageErrors.length = 0;   // the app logs the load failure on purpose
});

test('editor: signatures and text are exported at the exact position on every page type', async () => {
  await openInEditor('חוזה.pdf');
  assert.equal(await page.textContent('#doc-pages'), '4 עמודים');

  // Page 1: draw, save for reuse, drag and resize
  await drawNewSignatureAndPlace();
  const sig = page.locator('.page[data-page="1"] .ov-sig');
  await dragBy(sig, -40, 60);
  await dragBy(page.locator('.page[data-page="1"] .ov-resize'), -30, 0);
  await page.click('#item-toolbar [data-action="done"]');

  // Page 2 (rotated 90): Hebrew + English multi-line text, larger font
  await scrollToPage(2);
  await page.click('#add-text');
  const p2 = await page.locator('.page[data-page="2"]').boundingBox();
  await page.mouse.click(p2.x + p2.width * 0.6, p2.y + p2.height * 0.3);
  await page.keyboard.type('שלום World 123');
  await page.keyboard.press('Enter');
  await page.keyboard.type('שורה שנייה');
  await page.click('#item-toolbar [data-action="font-up"]');
  assert.equal(await page.textContent('#item-toolbar .font-size'), '16pt');
  await page.click('#item-toolbar [data-action="done"]');

  // Pages 3 (CropBox) and 4 (rotated 270, landscape, last page): reuse the saved signature
  for (const n of [3, 4]) {
    await scrollToPage(n);
    await page.click('#add-sig');
    await page.waitForSelector('#sig-picker[open] .sig-choice');
    await page.click('#sig-picker .sig-choice');
    await page.waitForSelector(`.page[data-page="${n}"] .ov-sig`);
    await page.click('#item-toolbar [data-action="done"]');
  }

  // Page 3: LTR text near the top-left corner
  await scrollToPage(3);
  await page.click('#add-text');
  const p3 = await page.locator('.page[data-page="3"]').boundingBox();
  await page.mouse.click(p3.x + 20, p3.y + 30);
  await page.keyboard.type('Top-left LTR');
  await page.click('#item-toolbar [data-action="done"]');
  assert.equal(await page.getAttribute('.page[data-page="3"] .ov-text-content', 'dir'), 'ltr');

  const expected = await overlayBoxes();
  assert.deepEqual(Object.keys(expected).sort(), ['1', '2', '3', '4']);

  const { name, bytes } = await exportViaDownload();
  assert.equal(name, 'חוזה-חתום.pdf');
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');

  const changed = await changedBoxes(pdfBytes, bytes);
  assert.equal(changed.numPages, 4);
  const TOL = 0.015;   // 1.5% of the page
  for (const n of ['1', '2', '3', '4']) {
    const exp = expected[n];
    const got = changed[n];
    assert.ok(got && typeof got === 'object', `page ${n}: overlay missing from exported PDF (${got})`);
    const inside = got.x0 >= exp.x0 - TOL && got.y0 >= exp.y0 - TOL && got.x1 <= exp.x1 + TOL && got.y1 <= exp.y1 + TOL;
    assert.ok(inside, `page ${n}: exported ink ${JSON.stringify(got)} outside overlay ${JSON.stringify(exp)}`);
    // Ink must fill most of the overlay (catches scaled / shrunken output)
    const cover = ((got.x1 - got.x0) * (got.y1 - got.y0)) / ((exp.x1 - exp.x0) * (exp.y1 - exp.y0));
    assert.ok(cover > 0.4, `page ${n}: exported ink covers only ${(cover * 100).toFixed(0)}% of the overlay`);
  }

  assert.equal(await page.textContent('#toast'), 'המסמך החתום נשמר בהורדות');
});

test('editor: empty text box is discarded and deleting items works', async () => {
  await openInEditor();
  await page.click('#add-text');
  const p1 = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.click(p1.x + 100, p1.y + 100);
  await page.click('#item-toolbar [data-action="done"]');
  assert.equal(await page.locator('.ov-text').count(), 0);

  await drawNewSignatureAndPlace();
  assert.equal(await page.locator('.ov-sig').count(), 1);
  await page.click('#item-toolbar [data-action="delete"]');
  assert.equal(await page.locator('.ov').count(), 0);

  await page.click('#save-share');
  assert.equal(await page.textContent('#toast'), 'עדיין לא הוספתם חתימה או טקסט למסמך');
});

test('editor: dragging a signature onto another page moves it there', async () => {
  await openInEditor();
  await drawNewSignatureAndPlace();
  const sig = page.locator('.ov-sig');
  assert.equal(await sig.evaluate((el) => el.closest('.page').dataset.page), '1');

  // Scroll so the gap between pages 1 and 2 is on screen, then drag down across it
  await page.evaluate(() => {
    const r = document.querySelector('.page[data-page="2"]').getBoundingClientRect();
    window.scrollBy(0, r.top - window.innerHeight / 2);
  });
  const b = await sig.boundingBox();
  const p2 = await page.locator('.page[data-page="2"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, p2.y + 80, { steps: 8 });
  await page.mouse.up();

  assert.equal(await sig.evaluate((el) => el.closest('.page').dataset.page), '2');
  const box = await sig.boundingBox();
  const p2After = await page.locator('.page[data-page="2"]').boundingBox();
  assert.ok(box.y >= p2After.y - 1 && box.y + box.height <= p2After.y + p2After.height + 1, 'kept inside page 2');
});

test('my signatures: add up to 3, edit and delete', async () => {
  await page.goto(server.baseUrl);
  await page.waitForSelector('#sig-empty', { state: 'visible' });   // shown after the async IndexedDB read
  for (let i = 1; i <= 3; i++) {
    await page.click('#add-sig-btn');
    await page.waitForSelector('dialog.sig-dialog[open]');
    await drawSignature();
    await page.click('dialog.sig-dialog [data-action="confirm"]');
    await page.waitForFunction((n) => document.querySelectorAll('.sig-card').length === n, i);
  }
  assert.equal(await page.textContent('#sig-count'), '3 מתוך 3');
  assert.equal(await page.isVisible('#add-sig-btn'), false, 'add button hidden at the limit');

  // Edit keeps the count
  await page.locator('.sig-card').first().getByText('עריכה').click();
  await page.waitForSelector('dialog.sig-dialog[open]');
  await drawSignature();
  await page.click('dialog.sig-dialog [data-action="confirm"]');
  await page.waitForSelector('dialog.sig-dialog', { state: 'detached' });
  assert.equal(await page.locator('.sig-card').count(), 3);

  page.once('dialog', (d) => d.accept());
  await page.locator('.sig-card').first().getByText('מחיקה').click();
  await page.waitForFunction(() => document.querySelectorAll('.sig-card').length === 2);
  assert.equal(await page.isVisible('#add-sig-btn'), true);
  const stored = await page.evaluate(() => EasyPenStorage.listSignatures().then((l) => l.map((s) => s.blob.type)));
  assert.deepEqual(stored, ['image/png', 'image/png']);
});

test('service worker: share target opens shared PDFs, rejects other types, works offline', async () => {
  await page.goto(server.baseUrl);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'page controlled by SW');

  // Simulates Android's share sheet: multipart POST to share-target/
  const share = (name, type, b64) => page.evaluate(({ name, type, b64 }) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = 'share-target/';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'file';
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], name, { type }));
    input.files = dt.files;
    form.append(input);
    document.body.append(form);
    form.submit();
  }, { name, type, b64 });

  await share('חוזה שכירות.pdf', 'application/pdf', pdfBytes.toString('base64'));
  await page.waitForURL(/viewer\.html\?source=share/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-name'), 'חוזה שכירות.pdf');

  await page.goto(server.baseUrl);
  await share('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('x').toString('base64'));
  await page.waitForURL(/index\.html/);
  assert.equal(await page.textContent('#upload-error'), 'כרגע נתמכים קבצי PDF בלבד');

  await context.setOffline(true);
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', pdfFile());
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-pages'), '4 עמודים');
});
