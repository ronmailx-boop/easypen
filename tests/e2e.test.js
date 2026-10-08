/*
 * EasyPen end-to-end tests (Playwright + Chromium, mobile viewport).
 * Run: npm test
 */
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('./helpers/server');
const { createTestPdf } = require('./helpers/fixtures');

// isMobile: the phone viewport rules (layout viewport, viewport meta tag)
const MOBILE = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

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

// Fresh context = fresh IndexedDB, caches and Service Worker; locale = the device language
async function newSession(locale) {
  context = await browser.newContext({ ...MOBILE, locale, acceptDownloads: true });
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
}

beforeEach(() => newSession('he-IL'));

// Switches the current test to a phone set to English
async function useEnglish() {
  await context.close();
  await newSession('en-US');
}

const hebrewOnScreen = () => page.evaluate(() => (document.title + document.body.innerText).match(/[\u0590-\u05FF]+/g));

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

// Waits until the selector matches exactly n elements (the UI updates asynchronously)
async function expectCount(selector, n) {
  await page.waitForFunction(({ selector, n }) => document.querySelectorAll(selector).length === n,
    { selector, n }, { timeout: 5000 }).catch(() => {});
  assert.equal(await page.locator(selector).count(), n, selector);
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

// `name` replaces the suggested file name in the name dialog
async function exportViaDownload(name) {
  await page.click('#save-share');
  await page.waitForSelector('#name-dialog[open]');
  if (name !== undefined) await page.fill('#file-name-input', name);
  const download = page.waitForEvent('download');
  await page.click('#name-dialog [type="submit"]');
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
  assert.equal(await page.textContent('#upload-error'), 'כרגע נתמכים קבצי PDF ותמונות JPG או PNG בלבד');
});

// JPG photo made by the browser; `exif6` adds an EXIF "rotate 90°" tag like a sideways phone photo
async function makeJpeg(width, height, color, { exif6 = false, type = 'image/jpeg' } = {}) {
  const base64 = await page.evaluate(async ({ width, height, color, type }) => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(width * 0.1, height * 0.1, width * 0.3, height * 0.2);   // marks the top-left corner
    const blob = await new Promise((r) => c.toBlob(r, type, 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }, { width, height, color, type });
  let jpeg = Buffer.from(base64, 'base64');
  if (exif6) {
    const tiff = Buffer.from('4d4d002a00000008000101120003000000010006000000000000', 'hex');
    const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, 0, 2 + 6 + tiff.length]), Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const afterApp0 = 4 + jpeg.readUInt16BE(4);
    jpeg = Buffer.concat([jpeg.subarray(0, afterApp0), app1, jpeg.subarray(afterApp0)]);
  }
  return jpeg;
}

// The compressed picture itself: from the start-of-scan marker to the end
const scanData = (jpeg) => jpeg.subarray(jpeg.indexOf(Buffer.from([0xFF, 0xDA])));

test('photos: 4 JPGs become a 4-page PDF, signed and exported with the original image data', async () => {
  await page.goto(server.baseUrl);
  const photos = [
    await makeJpeg(600, 800, '#c0392b'),
    await makeJpeg(800, 600, '#2980b9'),
    await makeJpeg(600, 800, '#27ae60', { exif6: true }),
    await makeJpeg(400, 400, '#8e44ad')
  ];
  await page.setInputFiles('#file-input', photos.map((buffer, i) => ({ name: `photo${i + 1}.jpg`, mimeType: 'image/jpeg', buffer })));
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-name'), 'photo1.pdf');
  assert.equal(await page.textContent('#doc-pages'), '4 עמודים');

  // Page order: arrows on each page (full size), disabled at the ends; move page 4 one place up
  const shown = () => page.$$eval('.page', (els) => els.map((e) => [e.dataset.page, e.querySelector('.page-num').textContent]));
  assert.deepEqual(await shown(), [['1', '1/4'], ['2', '2/4'], ['3', '3/4'], ['4', '4/4']]);
  assert.equal(await page.isDisabled('.page[data-page="1"] [data-move="up"]'), true);
  assert.equal(await page.isDisabled('.page[data-page="4"] [data-move="down"]'), true);
  await page.locator('.page[data-page="4"] .page-moves').scrollIntoViewIfNeeded();
  const arrowsAt = () => page.$eval('.page[data-page="4"] .page-moves', (b) => Math.round(b.getBoundingClientRect().top));
  const before = await arrowsAt();
  await page.click('.page[data-page="4"] [data-move="up"]');
  assert.deepEqual(await shown(), [['1', '1/4'], ['2', '2/4'], ['4', '3/4'], ['3', '4/4']]);
  const near = async (msg) => assert.ok(Math.abs(await arrowsAt() - before) <= 2, msg);
  await near('the arrows stay under the finger');
  // Again from the same spot, then back down
  await page.click('.page[data-page="4"] [data-move="up"]');
  await near('again');
  assert.deepEqual(await shown(), [['1', '1/4'], ['4', '2/4'], ['2', '3/4'], ['3', '4/4']]);
  await page.click('.page[data-page="4"] [data-move="down"]');
  await near('and back down');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'הזזת עמוד 3 למטה', 'focus follows the moved page');
  assert.equal(await page.getAttribute('.page[data-page="4"]', 'aria-label'), 'עמוד 3');
  await page.click('#draw-btn');
  assert.equal(await page.isVisible('.page-moves'), false, 'no arrows while drawing');
  await page.click('#draw-done');

  // Page shapes follow the photos in the new order; the EXIF-rotated one shows upright (landscape)
  const ratios = await page.$$eval('.page', (els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return Math.round((r.width / r.height) * 100) / 100;
  }));
  assert.deepEqual(ratios, [0.75, 1.33, 1, 1.33]);

  await drawNewSignatureAndPlace();
  const { name, bytes } = await exportViaDownload();
  assert.equal(name, 'photo1-חתום.pdf');

  // Every photo is in the signed PDF byte for byte: no re-compression, no quality loss
  photos.forEach((jpeg, i) => assert.ok(bytes.indexOf(scanData(jpeg)) >= 0, `photo ${i + 1} image data unchanged`));
  const { PDFDocument } = require(path.resolve(__dirname, '../vendor/pdf-lib/pdf-lib.min.js'));
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 4);
  assert.deepEqual(doc.getPages().map((p) => p.getRotation().angle), [0, 0, 0, 90]);
});

test('photos: PNG images keep their full size and transparency', async () => {
  await page.goto(server.baseUrl);
  const png = await makeJpeg(1500, 1000, 'rgba(0, 128, 0, 0.5)', { type: 'image/png' });
  const jpg = await makeJpeg(600, 800, '#c0392b');
  await page.setInputFiles('#file-input', [
    { name: 'Screenshot.png', mimeType: 'image/png', buffer: png },
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpg }
  ]);
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-pages'), '2 עמודים');
  await drawNewSignatureAndPlace();
  const { name, bytes } = await exportViaDownload();
  assert.equal(name, 'Screenshot-חתום.pdf');
  assert.ok(bytes.indexOf(scanData(jpg)) >= 0, 'JPG unchanged next to a PNG');

  // The PNG is stored at its own size, losslessly, with its transparency as a mask
  const { PDFDocument, PDFName, PDFRawStream } = require(path.resolve(__dirname, '../vendor/pdf-lib/pdf-lib.min.js'));
  const doc = await PDFDocument.load(bytes);
  const images = doc.context.enumerateIndirectObjects()
    .map(([, obj]) => obj)
    .filter((obj) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
    .map((obj) => ({
      w: obj.dict.get(PDFName.of('Width')).asNumber(),
      h: obj.dict.get(PDFName.of('Height')).asNumber(),
      filter: String(obj.dict.get(PDFName.of('Filter'))),
      mask: !!obj.dict.get(PDFName.of('SMask'))
    }));
  const pngImage = images.find((i) => i.w === 1500 && i.h === 1000 && i.filter === '/FlateDecode');
  assert.ok(pngImage, `PNG embedded at 1500x1000, lossless: ${JSON.stringify(images)}`);
  assert.equal(pngImage.mask, true, 'transparency kept');
});

test('combine: PDFs and photos become one PDF, PDF pages copied as they are', async () => {
  await page.goto(server.baseUrl);
  const jpg = await makeJpeg(600, 800, '#c0392b');
  const { PDFDocument, PDFName, StandardFonts } = require(path.resolve(__dirname, '../vendor/pdf-lib/pdf-lib.min.js'));
  const second = await PDFDocument.create();
  const font = await second.embedFont(StandardFonts.Helvetica);
  second.addPage([842, 595]).drawText('Second file', { x: 60, y: 500, size: 30, font });
  await page.setInputFiles('#file-input', [
    pdfFile('contract.pdf'),
    { name: 'id.jpg', mimeType: 'image/jpeg', buffer: jpg },
    { name: 'appendix.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await second.save()) }
  ]);
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-name'), 'contract.pdf');
  assert.equal(await page.textContent('#doc-pages'), '6 עמודים');
  assert.equal(await page.isVisible('.page[data-page="6"] .page-moves'), true, 'pages can be reordered');

  // Saved as it is, with nothing added: the combined file
  const plain = await exportViaDownload();
  assert.equal(plain.name, 'contract-מאוחד.pdf');
  assert.equal((await PDFDocument.load(plain.bytes)).getPageCount(), 6);
  assert.ok(plain.bytes.indexOf(scanData(jpg)) >= 0, 'photo unchanged');

  await page.locator('.page[data-page="6"] .page-moves').scrollIntoViewIfNeeded();
  await page.click('.page[data-page="6"] [data-move="up"]');

  await drawNewSignatureAndPlace();
  const { name, bytes } = await exportViaDownload();
  assert.equal(name, 'contract-חתום.pdf');
  assert.ok(bytes.indexOf(scanData(jpg)) >= 0, 'photo image data unchanged');
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  assert.equal(pages.length, 6);
  // PDF pages keep their rotation, and their text stays text (fonts, not a picture)
  assert.deepEqual(pages.map((p) => p.getRotation().angle), [0, 90, 0, 270, 0, 0]);
  // In the new order: the second PDF (landscape) moved above the photo
  assert.deepEqual(pages.map((p) => Math.round(p.getWidth())), [595, 595, 595, 595, 842, 632]);
  const hasFont = (p) => !!p.node.Resources().lookup(PDFName.of('Font'));
  assert.deepEqual(pages.slice(0, 5).map(hasFont), [true, true, true, true, true]);
});

test('add files: more PDFs and photos are added at the end of an open document, signatures stay', async () => {
  await openInEditor('contract.pdf');
  assert.equal(await page.isVisible('#add-pages-btn'), true);
  assert.equal(await page.locator('.page-moves').count(), 0, 'a single PDF has no page arrows');
  await drawNewSignatureAndPlace();
  const before = await overlayBoxes();

  // Something that isn't a PDF or a photo, then a broken PDF: refused, the document is unchanged
  await page.setInputFiles('#add-pages-input', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await page.waitForSelector('#toast.show');
  assert.equal(await page.textContent('#toast'), 'כרגע נתמכים קבצי PDF ותמונות JPG או PNG בלבד');
  await page.setInputFiles('#add-pages-input', { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 broken') });
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('broken.pdf'));
  assert.equal(await page.textContent('#toast'), 'לא ניתן לקרוא את הקובץ broken.pdf. ייתכן שהוא פגום.');
  await expectCount('.page', 4);
  pageErrors.length = 0;   // the failed file is logged on purpose

  const jpg = await makeJpeg(600, 800, '#c0392b');
  const { PDFDocument } = require(path.resolve(__dirname, '../vendor/pdf-lib/pdf-lib.min.js'));
  const extra = await PDFDocument.create();
  extra.addPage([842, 595]);
  await page.setInputFiles('#add-pages-input', [
    { name: 'id.jpg', mimeType: 'image/jpeg', buffer: jpg },
    { name: 'appendix.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await extra.save()) }
  ]);
  await expectCount('.page', 6);
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('נוספו'));
  assert.equal(await page.textContent('#toast'), 'נוספו 2 עמודים בסוף המסמך');
  assert.equal(await page.textContent('#doc-pages'), '6 עמודים');
  assert.equal(await page.locator('.page-moves').count(), 6, 'now every page can be moved');
  assert.deepEqual(await overlayBoxes(), before, 'the signature stayed where it was');
  // The add button stays after the last page
  assert.equal(await page.evaluate(() => document.getElementById('pages').lastElementChild.id), 'add-pages');

  // Once more, then the photo goes first
  await page.setInputFiles('#add-pages-input', { name: 'back.jpg', mimeType: 'image/jpeg', buffer: jpg });
  await expectCount('.page', 7);
  await page.waitForFunction(() => document.getElementById('toast').textContent === 'נוסף עמוד אחד בסוף המסמך');
  await page.locator('.page[data-page="5"] .page-moves').scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) await page.click('.page[data-page="5"] [data-move="up"]');

  const { name, bytes } = await exportViaDownload();
  assert.equal(name, 'contract-חתום.pdf');
  const pages = (await PDFDocument.load(bytes)).getPages();
  assert.deepEqual(pages.map((p) => Math.round(p.getWidth())), [632, 595, 595, 595, 595, 842, 632]);
  assert.ok(bytes.indexOf(scanData(jpg)) >= 0, 'photo image data unchanged');

  // Kept for a reload of the editor
  const stored = await page.evaluate(async () => {
    const r = await window.EasyPenStorage.getCurrentDocument();
    return { combined: r.combined, name: r.name, size: r.blob.size };
  });
  assert.equal(stored.combined, true);
  assert.equal(stored.name, 'contract.pdf');
  page.once('dialog', (d) => d.accept());
  await page.reload();
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-pages'), '7 עמודים');
});

test('combine: too many, broken or encrypted files are refused with a message', async () => {
  await page.goto(server.baseUrl);
  const jpeg = await makeJpeg(100, 100, '#000');
  await page.setInputFiles('#file-input', Array.from({ length: 21 }, (_, i) => ({ name: `p${i}.jpg`, mimeType: 'image/jpeg', buffer: jpeg })));
  assert.equal(await page.textContent('#upload-error'), 'אפשר לבחור עד 20 קבצים בפעם אחת');
  await page.setInputFiles('#file-input', [pdfFile(), { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
  assert.equal(await page.textContent('#upload-error'), 'כרגע נתמכים קבצי PDF ותמונות JPG או PNG בלבד');

  const refused = async (files, message) => {
    await page.evaluate(() => { document.getElementById('upload-error').textContent = ''; });
    await page.setInputFiles('#file-input', files);
    await page.waitForFunction(() => document.getElementById('upload-error').textContent);
    assert.equal(await page.textContent('#upload-error'), message);
    assert.match(page.url(), /index\.html|\/$/, 'stays on the home screen');
  };
  await refused([
    { name: 'good.jpg', mimeType: 'image/jpeg', buffer: jpeg },
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a photo') }
  ], 'לא ניתן לקרוא את הקובץ broken.jpg. ייתכן שהוא פגום.');
  await refused([pdfFile(), { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 broken') }],
    'לא ניתן לקרוא את הקובץ broken.pdf. ייתכן שהוא פגום.');

  const { PDFDocument } = require(path.resolve(__dirname, '../vendor/pdf-lib/pdf-lib.min.js'));
  const locked = await PDFDocument.load(pdfBytes);
  locked.context.trailerInfo.Encrypt = locked.context.register(locked.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
  await refused([pdfFile(), { name: 'bank.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await locked.save({ useObjectStreams: false })) }],
    'הקובץ bank.pdf מוגן בהצפנה, ולכן אי אפשר לאחד אותו עם קבצים אחרים. אפשר לפתוח אותו לבד.');
  pageErrors.length = 0;   // the failed conversions are logged on purpose
});

test('editor: file with .pdf name but non-PDF content shows an error', async () => {
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.status-screen.is-error');
  assert.equal(await page.textContent('#status-text'), 'כרגע נתמכים קבצי PDF ותמונות JPG או PNG בלבד');
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

test('save: the file name can be changed (and is cleaned) before saving', async () => {
  await openInEditor();
  await drawNewSignatureAndPlace();

  // Cancel keeps the document and saves nothing
  await page.click('#save-share');
  await page.waitForSelector('#name-dialog[open]');
  assert.equal(await page.inputValue('#file-name-input'), 'test-חתום');
  await page.click('#name-dialog .btn-secondary');
  assert.equal(await page.locator('#name-dialog[open]').count(), 0);

  const first = await exportViaDownload('  הסכם/שכירות: <2026>.pdf ');
  assert.equal(first.name, 'הסכםשכירות 2026.pdf');
  assert.equal(first.bytes.subarray(0, 5).toString(), '%PDF-');

  // The typed name is suggested next time; an empty name falls back to it
  await page.click('#save-share');
  await page.waitForSelector('#name-dialog[open]');
  assert.equal(await page.inputValue('#file-name-input'), 'הסכםשכירות 2026');
  await page.click('#name-dialog .btn-secondary');
  const second = await exportViaDownload('  ');
  assert.equal(second.name, 'הסכםשכירות 2026.pdf');
});

test('editor: empty text box is discarded and deleting items works', async () => {
  await openInEditor();
  await page.click('#add-text');
  const p1 = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.click(p1.x + 100, p1.y + 100);
  await page.click('#item-toolbar [data-action="done"]');
  await expectCount('.ov-text', 0);

  await drawNewSignatureAndPlace();
  await expectCount('.ov-sig', 1);
  await page.click('#item-toolbar [data-action="delete"]');
  await expectCount('.ov', 0);

  await page.click('#save-share');
  await page.waitForSelector('#toast.show');
  assert.equal(await page.textContent('#toast'), 'עדיין לא הוספתם חתימה, טקסט או ציור למסמך');
});

test('undo: each change (signature, move, delete, text, drawing, page order) can be undone step by step', async () => {
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', [pdfFile('a.pdf'), pdfFile('b.pdf')]);
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.isDisabled('#undo-btn'), true, 'nothing to undo yet');
  const order = () => page.evaluate(() => Array.from(document.querySelectorAll('.page'), (p) => p.dataset.page).join(','));

  // Page order
  await page.click('.page[data-page="1"] [data-move="down"]');
  assert.equal(await order(), '2,1,3,4,5,6,7,8');

  // Signature, then moved, then deleted
  await scrollToPage(2);
  await drawNewSignatureAndPlace();
  const sig = page.locator('.ov-sig');
  const pos = () => sig.evaluate((el) => el.style.left + ' ' + el.style.top);
  const placed = await pos();
  await dragBy(sig, 40, 30);
  assert.notEqual(await pos(), placed);
  await page.click('#item-toolbar [data-action="delete"]');
  await expectCount('.ov-sig', 0);

  // Text (typing is one step)
  await page.click('#add-text');
  const p = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.click(p.x + 80, p.y + 80);
  await page.keyboard.type('שלום');
  await page.click('#item-toolbar [data-action="done"]');
  await expectCount('.ov-text', 1);

  // A line drawn
  await page.click('#draw-btn');
  await page.waitForSelector('#draw-tray:not([hidden])');
  await scrollToPage(1);
  const d = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.move(d.x + d.width * 0.2, d.y + d.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(d.x + d.width * 0.6, d.y + d.height * 0.45, { steps: 8 });
  await page.mouse.up();
  await page.click('#draw-done');
  await expectCount('.draw-layer path', 1);

  // Undo, one step at a time, back to the start
  await page.click('#undo-btn');
  await expectCount('.draw-layer path', 0);
  await page.click('#undo-btn');
  await expectCount('.ov-text', 0);
  await page.click('#undo-btn');
  await expectCount('.ov-sig', 1);
  assert.notEqual(await pos(), placed, 'comes back where it was before deleting');
  await page.click('#undo-btn');
  assert.equal(await pos(), placed, 'move undone');
  await page.click('#undo-btn');
  await expectCount('.ov-sig', 0);
  await page.click('#undo-btn');
  assert.equal(await order(), '1,2,3,4,5,6,7,8');
  assert.equal(await page.isDisabled('#undo-btn'), true);

  // Ctrl+Z works too (outside a text box being typed in)
  await page.click('#add-text');
  await page.mouse.click(p.x + 80, p.y + 80);
  await page.keyboard.type('abc');
  await page.click('#item-toolbar [data-action="done"]');
  await expectCount('.ov-text', 1);
  await page.keyboard.press('Control+z');
  await expectCount('.ov-text', 0);
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

test('editor: free drawing - undo, cancel and export at the drawn position', async () => {
  await openInEditor();
  const scribble = async (fx0, fy0, fx1, fy1) => {
    const p = await page.locator('.page[data-page="1"]').boundingBox();
    await page.mouse.move(p.x + p.width * fx0, p.y + p.height * fy0);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      await page.mouse.move(p.x + p.width * (fx0 + (fx1 - fx0) * t),
        p.y + p.height * (fy0 + (fy1 - fy0) * t + 0.03 * Math.sin(t * 9)));
    }
    await page.mouse.up();
  };

  // Undo removes the last line
  await page.click('#draw-btn');
  await page.waitForSelector('#draw-tray:not([hidden])');
  assert.equal(await page.isVisible('.bottom-bar'), false);
  await scribble(0.2, 0.2, 0.5, 0.3);
  await expectCount('.draw-layer path', 1);
  await page.click('#draw-undo');
  await expectCount('.draw-layer path', 0);
  assert.equal(await page.isDisabled('#draw-undo'), true);

  // Cancel discards what was drawn in this session
  await scribble(0.2, 0.2, 0.5, 0.3);
  await page.click('#draw-cancel');
  await expectCount('.draw-layer path', 0);
  assert.equal(await page.isVisible('#draw-tray'), false);

  // Tool, color and thickness apply to the next line
  await page.click('#draw-btn');
  await page.click('#draw-tray [data-tool="felt"]');
  await page.click('#draw-tray [data-color="#d6385a"]');
  await page.evaluate(() => {
    const r = document.getElementById('draw-width');
    r.value = '10';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.textContent('#draw-tool-name'), 'טוש · 10');
  await scribble(0.3, 0.35, 0.7, 0.5);
  await page.click('#draw-done');
  await expectCount('.draw-layer path', 1);
  assert.equal(await page.getAttribute('.draw-layer path', 'stroke'), '#d6385a');

  // Exported where it was drawn, nothing on other pages
  const exp = await page.evaluate(() => {
    const pr = document.querySelector('.page[data-page="1"]').getBoundingClientRect();
    const r = document.querySelector('.draw-layer path').getBoundingClientRect();
    return { x0: (r.left - pr.left) / pr.width, y0: (r.top - pr.top) / pr.height,
      x1: (r.right - pr.left) / pr.width, y1: (r.bottom - pr.top) / pr.height };
  });
  const { bytes } = await exportViaDownload();
  const changed = await changedBoxes(pdfBytes, bytes);
  assert.equal(changed[2], null);
  assert.equal(changed[3], null);
  assert.equal(changed[4], null);
  const got = changed[1];
  const TOL = 0.04;   // stroke width + anti-aliasing
  assert.ok(got && got.x0 >= exp.x0 - TOL && got.y0 >= exp.y0 - TOL && got.x1 <= exp.x1 + TOL && got.y1 <= exp.y1 + TOL,
    `drawing exported at ${JSON.stringify(got)}, drawn at ${JSON.stringify(exp)}`);
  assert.ok(got.x1 - got.x0 > (exp.x1 - exp.x0) * 0.8, 'drawing not shrunk');
});

test('editor: drawing tray collapses to its handle, bars stay pinned while zoomed', async () => {
  // Fake pinch-zoom (headless Chromium can't pinch): 2x, panned right and down
  await page.addInitScript(() => {
    const vv = new EventTarget();
    Object.assign(vv, { scale: 1, offsetLeft: 0, offsetTop: 0, width: 390, height: 780 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.__zoom = (z) => { Object.assign(vv, z); vv.dispatchEvent(new Event('resize')); };
  });
  await openInEditor();
  const rect = (sel) => page.evaluate((sel) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = document.querySelector(sel).getBoundingClientRect();
    res([r.left, r.top, r.right, r.bottom].map((v) => Math.round(v)));
  }))), sel);

  await page.evaluate(() => window.__zoom({ scale: 2, offsetLeft: 100, offsetTop: 200, width: 195, height: 390 }));
  assert.deepEqual(await rect('.bottom-bar'), [100, 554, 295, 590]);
  assert.deepEqual(await rect('.viewer-header'), [100, 200, 295, 231]);

  await page.evaluate(() => window.__zoom({ scale: 1, offsetLeft: 0, offsetTop: 0, width: 390, height: 780 }));
  assert.deepEqual(await rect('.bottom-bar'), [0, 708, 390, 780]);

  // Collapse: only the handle stays on screen, tools can't be reached; tap again to restore
  await page.click('#draw-btn');
  await page.click('#draw-tray-toggle');
  await page.waitForTimeout(300);
  const handle = await rect('#draw-tray-toggle');
  assert.ok(handle[3] <= 780 && handle[1] >= 780 - 50, `handle on screen ${handle}`);
  assert.ok((await rect('.pen-row'))[1] >= 780, 'tools hidden below the screen');
  assert.equal(await page.getAttribute('#draw-tray-toggle', 'aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.getElementById('draw-tools').inert), true);

  // Scroll mode: the page can be scrolled and nothing is drawn
  await page.click('#draw-scroll');
  assert.equal(await page.getAttribute('#draw-scroll', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.draw-layer')).pointerEvents), 'none');
  const p1 = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.move(p1.x + 60, p1.y + 120);
  await page.mouse.down();
  await page.mouse.move(p1.x + 200, p1.y + 200, { steps: 6 });
  await page.mouse.up();
  await expectCount('.draw-layer path', 0);
  await page.click('#draw-scroll');
  assert.equal(await page.getAttribute('#draw-scroll', 'aria-pressed'), 'false');
  await page.click('#draw-scroll');

  // Opening the tools keeps scroll mode and its button; picking a pen turns it off
  await page.click('#draw-tray-toggle');
  await page.waitForTimeout(300);
  assert.equal(await page.getAttribute('#draw-tray-toggle', 'aria-expanded'), 'true');
  assert.ok((await rect('.pen-row'))[3] <= 780, 'tools back on screen');
  assert.equal(await page.isVisible('#draw-scroll'), true);
  assert.equal(await page.getAttribute('#draw-scroll', 'aria-pressed'), 'true');
  await page.click('.pen-btn[data-tool="pen"]');
  assert.equal(await page.getAttribute('#draw-scroll', 'aria-pressed'), 'false');
  await page.click('#draw-scroll');
  assert.equal(await page.getAttribute('#draw-scroll', 'aria-pressed'), 'true', 'scroll mode works with the tools open');
});

test('editor: pinch zoom enlarges the pages in the app, bars stay in place', async () => {
  await openInEditor();
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([x, y], id) => ({ x, y, id }))
  });
  // Two fingers at y=400, `from` px apart, spread to `to` px apart around x=195
  async function pinch(from, to) {
    await touch('touchStart', [[195 - from / 2, 400], [195 + from / 2, 400]]);
    for (let i = 1; i <= 8; i++) {
      const d = from + (to - from) * i / 8;
      await touch('touchMove', [[195 - d / 2, 400], [195 + d / 2, 400]]);
    }
    await touch('touchEnd', []);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  const info = () => page.evaluate(() => {
    const r = document.querySelector('.page[data-page="1"]').getBoundingClientRect();
    const bar = document.querySelector('.bottom-bar').getBoundingClientRect();
    return {
      width: Math.round(r.width),
      // The spot of page 1 under the fingers' centre, in page fractions
      fx: (195 - r.left) / r.width, fy: (400 - r.top) / r.height,
      bar: [bar.left, bar.top, bar.right, bar.bottom].map(Math.round),
      scale: window.visualViewport.scale
    };
  });

  const before = await info();
  assert.equal(before.width, 374);
  assert.equal(await page.locator('.page-moves').count(), 0, 'a PDF has no page order arrows');
  // The PDF is drawn left to right even in the Hebrew interface (RTL breaks Latin text)
  assert.equal(await page.$eval('.page canvas', (c) => getComputedStyle(c).direction), 'ltr');
  await pinch(100, 200);
  const zoomed = await info();
  assert.equal(zoomed.width, 2 * 390 - 16, 'pages area twice as wide');
  assert.ok(Math.abs(zoomed.fx - before.fx) < 0.01 && Math.abs(zoomed.fy - before.fy) < 0.01, 'same spot under the fingers');
  assert.deepEqual(zoomed.bar, [0, 708, 390, 780], 'bottom bar not moved');
  assert.equal(zoomed.scale, 1, 'browser zoom not used');
  // Rendered again, sharp at the new size
  await page.waitForFunction(() => document.querySelector('.page[data-page="1"] canvas').width > 1800);

  // In drawing mode two fingers zoom and don't draw; the tray keeps its size and place
  await page.click('#draw-btn');
  const tray = () => page.evaluate(() => {
    const r = document.querySelector('.draw-tray').getBoundingClientRect();
    return [r.left, r.right, r.bottom].map(Math.round).concat(innerWidth);
  });
  assert.deepEqual(await tray(), [0, 390, 780, 390], 'tray fills the screen width at the bottom, zoomed in');
  await pinch(200, 100);
  assert.equal((await info()).width, 374);
  await expectCount('.draw-layer path', 0);
  await pinch(100, 300);
  assert.deepEqual(await tray(), [0, 390, 780, 390], 'tray not stretched when zooming in');
  await page.click('#draw-tray-toggle');
  await page.waitForTimeout(300);
  const handle = await page.locator('#draw-scroll').boundingBox();
  assert.ok(handle && handle.y > 700 && handle.y + handle.height <= 780, 'tucked-away tray still on screen');
});

test('editor: bottom bar labels stay on one line with a large phone font', async () => {
  await openInEditor();
  await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; });
  const buttons = await page.$$eval('.bottom-bar .bar-btn', (bs) => bs.map((b) => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent.trim(), fits: b.scrollHeight <= Math.ceil(r.height) && b.scrollWidth <= Math.ceil(r.width) };
  }));
  assert.deepEqual(buttons.filter((b) => !b.fits), [], 'labels fit inside their buttons');
  // Scroll mode button on the right side (start of the line in Hebrew)
  await page.click('#draw-btn');
  const box = await page.locator('#draw-scroll').boundingBox();
  assert.ok(box.x + box.width > 390 - 20 && box.x > 195, `scroll button on the right: ${box.x}`);
});

test('home: link preview (WhatsApp) has the app icon', async () => {
  await page.goto(server.baseUrl);
  const og = await page.$$eval('meta[property^="og:"]', (ms) => Object.fromEntries(ms.map((m) => [m.getAttribute('property'), m.content])));
  assert.equal(og['og:image'], 'https://easypen.vplusstudio.app/icons/og-image.png');
  assert.equal(og['og:title'], await page.title());
  // The same file is served by this site, as a PNG small enough for WhatsApp (< 300KB)
  const res = await page.request.get(new URL(new URL(og['og:image']).pathname.slice(1), server.baseUrl).href);
  assert.equal(res.status(), 200);
  assert.equal(res.headers()['content-type'], 'image/png');
  const png = await res.body();
  assert.ok(png.length < 300e3);
  assert.equal(png[25], 2, 'RGB without transparency: no white corners in the preview');
});

test('english: an English device gets the home screen in English, left to right', async () => {
  // Every text has both languages; "iw" (old Android code) counts as Hebrew
  await page.goto(server.baseUrl);
  const i18n = await page.evaluate(() => {
    const { STRINGS, pick } = window.EasyPenI18n;
    return {
      missing: Object.keys(STRINGS.he).filter((k) => !(k in STRINGS.en)).concat(Object.keys(STRINGS.en).filter((k) => !(k in STRINGS.he))),
      picks: ['he', 'he-IL', 'iw-IL', 'en-US', 'fr', 'ar', ''].map(pick)
    };
  });
  assert.deepEqual(i18n.missing, []);

  // The Hebrew written in the HTML is the same as in i18n.js (a text changed in one place only)
  for (const url of ['index.html', 'viewer.html', 'legal.html', 'share-target/']) {
    const stale = await page.evaluate(async (url) => {
      const { STRINGS } = window.EasyPenI18n;
      // The file as written (the live page changes some texts while it runs)
      const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
      const all = [...doc.querySelectorAll('[data-i18n], [data-i18n-aria], [data-i18n-alt]')];
      return all.flatMap((el) => [
        el.dataset.i18n && [el.dataset.i18n, el.textContent.trim()],
        el.dataset.i18nAria && [el.dataset.i18nAria, el.getAttribute('aria-label')],
        el.dataset.i18nAlt && [el.dataset.i18nAlt, el.alt]
      ]).filter((pair) => pair && pair[1] !== STRINGS.he[pair[0]]);
    }, url);
    assert.deepEqual(stale, [], `${url}: Hebrew in the HTML matches i18n.js`);
  }
  assert.deepEqual(i18n.picks, ['he', 'he', 'he', 'en', 'en', 'en', 'en']);

  const en = await browser.newContext({ ...MOBILE, locale: 'en-US' });
  try {
    const p = await en.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const hebrew = () => p.evaluate(() => (document.title + document.body.innerText).match(/[֐-׿]+/g));
    await p.goto(server.baseUrl);
    await p.waitForSelector('#sig-empty', { state: 'visible' });
    assert.deepEqual(await p.evaluate(() => [document.documentElement.lang, document.documentElement.dir]), ['en', 'ltr']);
    assert.equal(await p.title(), 'EasyPen - Digital Signature');
    assert.equal(await p.textContent('h1'), 'Sign a document');
    assert.equal(await p.getAttribute('.footer-links', 'aria-label'), 'Legal information');
    assert.equal(await hebrew(), null, 'no Hebrew on the home screen');

    // Signature dialog (shared with the editor)
    await p.click('#add-sig-btn');
    await p.waitForSelector('dialog.sig-dialog[open]');
    assert.equal(await hebrew(), null, 'no Hebrew in the signature dialog');
    assert.equal(await p.getAttribute('dialog.sig-dialog .icon-btn', 'aria-label'), 'Close');
    await p.click('dialog.sig-dialog [data-action="cancel"] >> nth=-1');

    await p.goto(server.baseUrl + '?error=type');
    assert.equal(await p.textContent('#upload-error'), 'Only PDF files and JPG or PNG images are supported for now');

    await p.goto(server.baseUrl + 'share-target/');
    assert.equal(await p.evaluate(() => document.documentElement.dir), 'ltr');
    assert.equal(await hebrew(), null, 'no Hebrew on the share page');
    assert.deepEqual(errors, []);
  } finally {
    await en.close();
  }
});

test('english: the editor in English, left to right, handles mirrored', async () => {
  await useEnglish();
  await openInEditor();
  assert.deepEqual(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]), ['en', 'ltr']);
  assert.equal(await page.title(), 'Edit document - EasyPen');
  assert.equal(await page.textContent('#doc-pages'), '4 pages');
  assert.equal(await hebrewOnScreen(), null, 'no Hebrew in the editor');
  const labels = await page.$$eval('.bottom-bar .bar-btn', (bs) => bs.map((b) => [b.textContent.trim(), b.scrollWidth <= b.clientWidth]));
  assert.deepEqual(labels, [['Signature', true], ['Text', true], ['Draw', true], ['Save & Share', true]]);
  // Back arrow points left
  assert.notEqual(await page.$eval('#back-btn svg', (s) => getComputedStyle(s).transform), 'none');

  // Signature: resize handle on the bottom-right corner; resizing keeps the left edge
  await drawNewSignatureAndPlace();
  const sig = page.locator('.ov-sig');
  const box = await sig.boundingBox();
  const handle = await page.locator('.ov-sig .ov-resize').boundingBox();
  assert.ok(Math.abs(handle.x + handle.width / 2 - (box.x + box.width)) < 2, 'handle at the right edge');
  await dragBy(page.locator('.ov-sig .ov-resize'), 30, 0);
  const bigger = await sig.boundingBox();
  assert.ok(Math.abs(bigger.x - box.x) < 1, 'left edge stays');
  assert.ok(bigger.width > box.width + 20, `wider: ${box.width} -> ${bigger.width}`);
  await sig.focus();
  await page.keyboard.press('+');
  assert.ok(Math.abs((await sig.boundingBox()).x - box.x) < 1, 'keyboard resize keeps the left edge');

  // A new text box starts left to right
  await page.click('#add-text');
  const p1 = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.click(p1.x + 60, p1.y + 300);
  assert.equal(await page.getAttribute('.ov-text-content', 'dir'), 'ltr');
  await page.keyboard.type('Hello');
  await page.keyboard.press('Escape');

  // Drawing tray and the exported file name
  await page.click('#draw-btn');
  assert.equal(await hebrewOnScreen(), null, 'no Hebrew in drawing mode');
  assert.equal((await page.textContent('#draw-tray-toggle')).trim(), 'Hide tools');
  await page.click('#draw-done');
  const { name } = await exportViaDownload();
  assert.equal(name, 'test-signed.pdf');
});

test('signature: size slider, and ink colour picked from the document', async () => {
  await openInEditor();
  await drawNewSignatureAndPlace();
  const sig = page.locator('.ov-sig');
  const pageBox = await page.locator('.page[data-page="1"]').boundingBox();

  // Slider = width in % of the page; the top-right corner (Hebrew) stays put
  assert.equal(await page.isVisible('#sig-size'), true);
  assert.equal(await page.inputValue('#sig-size'), '35');
  const before = await sig.boundingBox();
  await page.$eval('#sig-size', (s) => { s.value = '60'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  const after = await sig.boundingBox();
  assert.ok(Math.abs(after.width / pageBox.width - 0.6) < 0.01, `60% of the page: ${after.width / pageBox.width}`);
  assert.ok(Math.abs(after.x + after.width - (before.x + before.width)) < 1, 'right edge stays');
  // Keyboard resize moves the slider too
  await sig.focus();
  await page.keyboard.press('-');
  assert.equal(await page.inputValue('#sig-size'), String(Math.round(60 / 1.1)));
  await page.click('#item-toolbar [data-action="delete"]');

  // Picking a colour: the red frame on page 1 (PDF x 200..400, top edge at y 360 of 842)
  await page.click('#add-sig');
  await page.waitForSelector('#sig-picker[open]');
  await page.click('#sig-picker [data-action="new"]');
  await page.waitForSelector('dialog.sig-dialog[open]');
  await page.click('dialog.sig-dialog [data-action="sample"]');
  await page.waitForSelector('#sample-hint', { state: 'visible' });
  assert.equal(await page.isVisible('dialog.sig-dialog'), false, 'the dialog steps aside');
  assert.equal(await page.isVisible('.bottom-bar'), false);
  const at = async (fx, fy) => {
    const b = await page.locator('.page[data-page="1"]').boundingBox();
    return { x: b.x + b.width * fx, y: b.y + b.height * fy };
  };
  // Pressing shows the loupe (rim = colour under the ring); any colour counts, also the white paper
  assert.equal(await page.isDisabled('#sample-confirm'), true, 'nothing picked yet');
  let p = await at(0.1, 0.4);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  assert.equal(await page.isVisible('#loupe'), true, 'loupe while the finger is down');
  assert.equal(await page.$eval('#loupe', (l) => l.style.getPropertyValue('--c')), '#ffffff');
  // Drag onto the red frame line (PDF x 200..400, top edge at y 360 of 842)
  const line = await at(300 / 595, (842 - 360) / 842);
  await page.mouse.move(line.x, line.y, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.isVisible('#loupe'), false, 'loupe gone when the finger lifts');
  assert.equal(await page.isVisible('.page[data-page="1"] .sample-marker'), true, 'marker stays on the spot');
  assert.equal(await page.isVisible('#sample-swatch'), true);
  assert.equal(await page.isVisible('dialog.sig-dialog'), false, 'still picking until confirmed');
  await page.click('#sample-confirm');
  await page.waitForSelector('dialog.sig-dialog[open]');
  assert.equal(await page.isVisible('#sample-hint'), false);
  assert.equal(await page.locator('.sample-marker').count(), 0, 'marker removed');
  const sampled = await page.$eval('dialog.sig-dialog .ink-sampled', (l) => ({
    hidden: l.hidden, checked: l.querySelector('input').checked, color: l.style.getPropertyValue('--c')
  }));
  assert.equal(sampled.hidden, false);
  assert.equal(sampled.checked, true);
  const rgb = sampled.color.match(/[0-9a-f]{2}/g).map((h) => parseInt(h, 16));
  assert.ok(rgb[0] > 180 && rgb[1] < 120 && rgb[2] < 120, `red picked: ${sampled.color}`);

  // The new signature is drawn in that colour
  await drawSignature();
  await page.click('dialog.sig-dialog [data-action="confirm"]');
  await page.waitForSelector('dialog.sig-dialog', { state: 'detached' });
  await page.waitForSelector('.ov-sig img');
  const ink = await page.$eval('.ov-sig img', async (img) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let best = null;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) { best = [d[i], d[i + 1], d[i + 2]]; break; }
    return best;
  });
  assert.ok(ink && Math.abs(ink[0] - rgb[0]) < 3 && Math.abs(ink[1] - rgb[1]) < 3 && Math.abs(ink[2] - rgb[2]) < 3,
    `signature ink ${ink} = picked ${rgb}`);
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

test('editor: signatures and text can be moved, resized and deleted with the keyboard', async () => {
  await openInEditor();
  await drawNewSignatureAndPlace();
  const sig = page.locator('.ov-sig');
  assert.equal(await sig.evaluate((el) => el === document.activeElement), true, 'new signature gets focus');

  const style = () => sig.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width) }));
  const before = await style();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown');
  let after = await style();
  assert.ok(Math.abs(after.left - (before.left - 1)) < 0.01, `moved left by 1%: ${before.left} -> ${after.left}`);
  assert.ok(Math.abs(after.top - (before.top + 5)) < 0.01, `moved down by 5%: ${before.top} -> ${after.top}`);

  await page.keyboard.press('+');
  const bigger = await style();
  assert.ok(Math.abs(bigger.width / after.width - 1.1) < 0.01, 'grew by 10%');
  assert.ok(Math.abs((bigger.left + bigger.width) - (after.left + after.width)) < 0.01, 'right edge stays put');

  await page.keyboard.press('Delete');
  assert.equal(await page.locator('.ov').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'add-sig', 'focus returns to the toolbar');

  // Text box: Escape leaves editing and keeps it focused, + changes the font size
  await page.click('#add-text');
  const p1 = await page.locator('.page[data-page="1"]').boundingBox();
  await page.mouse.click(p1.x + 60, p1.y + 60);
  await page.keyboard.type('שלום');
  await page.keyboard.press('Escape');
  const text = page.locator('.ov-text');
  assert.equal(await text.evaluate((el) => el === document.activeElement && !el.classList.contains('is-editing')), true);
  await page.keyboard.press('+');
  assert.equal(await page.textContent('#item-toolbar .font-size'), '16pt');
  await page.keyboard.press('Enter');
  assert.equal(await text.evaluate((el) => el.classList.contains('is-editing')), true, 'Enter edits the text');
});

test('legal pages: linked from home, every document renders, works offline', async () => {
  await page.goto(server.baseUrl);
  const links = await page.$$eval('.site-footer a', (as) => as.map((a) => [a.textContent, a.getAttribute('href')]));
  assert.deepEqual(links.map((l) => l[1]), [
    'legal.html?doc=privacy', 'legal.html?doc=terms', 'legal.html?doc=cookies', 'legal.html?doc=accessibility'
  ]);

  const expected = { privacy: 'מדיניות פרטיות', terms: 'תנאי שימוש', cookies: 'מדיניות עוגיות', accessibility: 'הצהרת נגישות' };
  for (const [doc, title] of Object.entries(expected)) {
    await page.goto(`${server.baseUrl}legal.html?doc=${doc}`);
    await page.waitForSelector('#legal-content h1');
    assert.equal(await page.textContent('#legal-content h1'), title);
    assert.equal(await page.title(), `${title} - EasyPen`);
    assert.equal(await page.getAttribute(`#legal-nav a[data-doc="${doc}"]`, 'aria-current'), 'page');
    const raw = await page.$$eval('#legal-content p, #legal-content li, #legal-content td', (els) =>
      els.map((e) => e.textContent).filter((t) => /(^#|\*\*|\|---|\]\()/.test(t)));
    assert.deepEqual(raw, [], `${doc}: no unrendered Markdown`);
    assert.equal(await page.locator('#legal-content mark.placeholder').count(), 0, `${doc}: no unfilled placeholders`);
  }
  // Tables render as tables, links between documents point back to this page
  await page.goto(`${server.baseUrl}legal.html?doc=cookies`);
  await page.waitForSelector('#legal-content table');
  assert.equal(await page.getAttribute('#legal-content a[href*="privacy"]', 'href'), 'legal.html?doc=privacy');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto(`${server.baseUrl}legal.html?doc=accessibility`);
  await page.waitForSelector('#legal-content table');
  assert.equal(await page.textContent('#legal-content h1'), 'הצהרת נגישות');
});

test('english: legal pages in English, also offline', async () => {
  await useEnglish();
  const expected = { privacy: 'Privacy Policy', terms: 'Terms of Use', cookies: 'Cookie Policy', accessibility: 'Accessibility Statement' };
  for (const [doc, title] of Object.entries(expected)) {
    await page.goto(`${server.baseUrl}legal.html?doc=${doc}`);
    await page.waitForSelector('#legal-content h1');
    assert.equal(await page.textContent('#legal-content h1'), title);
    assert.equal(await page.title(), `${title} - EasyPen`);
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
    assert.equal(await hebrewOnScreen(), null, `${doc}: no Hebrew`);
    const raw = await page.$$eval('#legal-content p, #legal-content li, #legal-content td', (els) =>
      els.map((e) => e.textContent).filter((t) => /(^#|\*\*|\|---|\]\()/.test(t)));
    assert.deepEqual(raw, [], `${doc}: no unrendered Markdown`);
  }
  // Links between the English documents stay on this page
  await page.goto(`${server.baseUrl}legal.html?doc=cookies`);
  await page.waitForSelector('#legal-content table');
  assert.equal(await page.getAttribute('#legal-content a[href*="privacy"]', 'href'), 'legal.html?doc=privacy');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto(`${server.baseUrl}legal.html?doc=terms`);
  await page.waitForSelector('#legal-content h1');
  assert.equal(await page.textContent('#legal-content h1'), 'Terms of Use');
});

test('legal pages: Markdown renderer never outputs markup from the text', async () => {
  await page.goto(`${server.baseUrl}legal.html?doc=privacy`);
  await page.waitForSelector('#legal-content h1');
  const result = await page.evaluate(() => {
    const html = EasyPenLegal.renderMarkdown([
      '# <img src=x onerror=alert(1)>',
      '[click](javascript:alert(1)) [ok](https://example.com) [local](other.html)',
      '| <script>x</script> | b |',
      '|---|---|',
      '| "q" | [NAME_HERE] |'
    ].join('\n'));
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return {
      dangerous: doc.querySelectorAll('img, script, [onerror]').length,
      hrefs: [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      heading: doc.querySelector('h1').textContent,
      placeholder: doc.querySelector('mark.placeholder')?.textContent
    };
  });
  assert.equal(result.dangerous, 0, 'no elements created from the text');
  assert.equal(result.heading, '<img src=x onerror=alert(1)>', 'shown as plain text');
  assert.deepEqual(result.hrefs, ['https://example.com'], 'javascript: and relative links are dropped');
  assert.equal(result.placeholder, '[NAME_HERE]');
});

test('service worker: share target opens shared PDFs, combines several files, rejects other types, works offline', async () => {
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

  // Several files (JPG + PNG + PDF): stored by the SW, combined into one PDF by the home screen
  const jpg = await makeJpeg(600, 800, '#c0392b');
  const png = await makeJpeg(1200, 900, '#2980b9', { type: 'image/png' });
  await page.goto(server.baseUrl);
  await page.evaluate(({ files }) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = 'share-target/';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'file';
    const dt = new DataTransfer();
    files.forEach(({ name, type, b64 }) => dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], name, { type })));
    input.files = dt.files;
    form.append(input);
    document.body.append(form);
    form.submit();
  }, { files: [
    { name: 'IMG_1.jpg', type: 'image/jpeg', b64: jpg.toString('base64') },
    { name: 'Screenshot.png', type: 'image/png', b64: png.toString('base64') },
    { name: 'form.pdf', type: 'application/pdf', b64: pdfBytes.toString('base64') }
  ] });
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-name'), 'IMG_1.pdf');
  assert.equal(await page.textContent('#doc-pages'), '6 עמודים');
  assert.equal(await page.evaluate(() => EasyPenStorage.takeSharedFiles()), null, 'shared files used once');

  await page.goto(server.baseUrl);
  await share('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('x').toString('base64'));
  await page.waitForURL(/index\.html/);
  assert.equal(await page.textContent('#upload-error'), 'כרגע נתמכים קבצי PDF ותמונות JPG או PNG בלבד');

  await context.setOffline(true);
  await page.goto(server.baseUrl);
  await page.setInputFiles('#file-input', pdfFile());
  await page.waitForURL(/viewer\.html/);
  await page.waitForSelector('.page.is-rendered');
  assert.equal(await page.textContent('#doc-pages'), '4 עמודים');
});

test('service worker: works offline behind a host that redirects .html to pretty URLs (Cloudflare)', async () => {
  const cf = await start({ prettyUrls: true });
  try {
    await page.goto(cf.baseUrl);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'page controlled by SW');

    await context.setOffline(true);
    for (const target of ['index.html', 'legal.html?doc=terms', 'legal?doc=cookies']) {
      await page.goto(cf.baseUrl + target);
      await page.waitForSelector('.brand');
    }
    assert.equal(await page.textContent('#legal-content h1'), 'מדיניות עוגיות');

    await page.goto(cf.baseUrl + 'index.html');
    await page.setInputFiles('#file-input', pdfFile());
    await page.waitForURL(/viewer\.html/);
    await page.waitForSelector('.page.is-rendered');
  } finally {
    await cf.close();
  }
});
