/*
 * EasyPen - PDF loading, rendering (pdf.js) and export (pdf-lib).
 * Exposes a global `PdfHandler`.
 *
 * Coordinate model
 * ----------------
 * Every overlay (signature / text) is stored in *normalised page coordinates*:
 *   fx, fy, fw, fh in 0..1, relative to the page as it is displayed
 *   (top-left origin, after the page's /Rotate is applied).
 * This makes positions independent of screen size, zoom and scroll.
 * On export they are mapped into PDF user space using the page's CropBox and
 * rotation (see `displayToPdf`).
 */
(function (global) {
  'use strict';

  const base = document.baseURI;
  const PDFJS_URL = new URL('vendor/pdfjs/pdf.min.mjs', base).href;
  const WORKER_URL = new URL('vendor/pdfjs/pdf.worker.min.mjs', base).href;

  let pdfjsPromise = null;
  function getPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_URL).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
        return lib;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }

  function isPdfBytes(bytes) {
    // "%PDF" may be preceded by a few junk bytes; the spec allows it within the first 1KB
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
    return head.includes('%PDF-');
  }

  class PdfDocument {
    constructor(bytes, pdf) {
      this.bytes = bytes;        // original file bytes (kept untouched for export)
      this.pdf = pdf;            // pdf.js PDFDocumentProxy
      this.numPages = pdf.numPages;
      this._pages = new Map();
    }

    async getPage(n) {
      if (!this._pages.has(n)) this._pages.set(n, this.pdf.getPage(n));
      return this._pages.get(n);
    }

    // Displayed size in PDF points (rotation applied)
    async getPageSize(n) {
      const page = await this.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      return { width: vp.width, height: vp.height };
    }

    /*
     * Renders page `n` into `canvas` so it is sharp at `cssWidth` CSS pixels.
     * Returns the pdf.js RenderTask promise; cancel via the returned `cancel`.
     */
    async render(n, canvas, cssWidth) {
      const page = await this.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(global.devicePixelRatio || 1, 3);
      // Extra resolution so light pinch-zoom still looks crisp, capped for memory
      let scale = (cssWidth * dpr * 1.25) / base.width;
      const maxPixels = 16e6;
      const pixels = base.width * base.height * scale * scale;
      if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, viewport });
      return task.promise;
    }

    // Frees the worker's copy of the document (pdf.js: through its loading task)
    destroy() {
      this._pages.clear();
      return this.pdf.loadingTask.destroy();
    }
  }

  // options.password: for a password protected PDF (kept only in memory)
  async function load(bytes, { password } = {}) {
    if (!isPdfBytes(bytes)) {
      const err = new Error('Not a PDF');
      err.code = 'NOT_PDF';
      throw err;
    }
    const pdfjs = await getPdfjs();
    const task = pdfjs.getDocument({
      // pdf.js may transfer (detach) the buffer to its worker - give it a copy
      data: bytes.slice(),
      cMapUrl: new URL('vendor/pdfjs/cmaps/', base).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', base).href,
      wasmUrl: new URL('vendor/pdfjs/wasm/', base).href,
      isEvalSupported: false,
      enableXfa: false,
      password
    });
    try {
      const pdf = await task.promise;
      const doc = new PdfDocument(bytes, pdf);
      doc.locked = !!password;
      return doc;
    } catch (e) {
      const err = new Error(e && e.message ? e.message : 'PDF load failed');
      err.code = e && e.name === 'PasswordException' ? 'PASSWORD' : 'INVALID';
      // pdf.js PasswordResponses: 1 = a password is needed, 2 = the password given is wrong
      err.wrongPassword = err.code === 'PASSWORD' && e.code === 2;
      throw err;
    }
  }

  /*
   * Maps a point from display space (points, top-left origin, rotation applied)
   * to PDF user space for a page with CropBox {x, y, width, height} and /Rotate `rot`.
   */
  function displayToPdf(dx, dy, box, rot) {
    const { x: bx, y: by, width: cw, height: ch } = box;
    switch (rot) {
      case 90: return { x: bx + dy, y: by + dx };
      case 180: return { x: bx + cw - dx, y: by + dy };
      case 270: return { x: bx + cw - dy, y: by + ch - dx };
      default: return { x: bx + dx, y: by + ch - dy };
    }
  }

  function normRotation(r) {
    return ((Math.round(r / 90) * 90) % 360 + 360) % 360;
  }

  /*
   * Draws PNG overlays onto a pdf-lib page.
   * overlays: [{ png: Uint8Array, fx, fy, fw, fh }]
   */
  async function drawOverlaysOnPage(pdfDoc, page, overlays) {
    const { degrees } = global.PDFLib;
    const rot = normRotation(page.getRotation().angle || 0);
    const box = page.getCropBox();
    const displayW = rot === 90 || rot === 270 ? box.height : box.width;
    const displayH = rot === 90 || rot === 270 ? box.width : box.height;

    for (const o of overlays) {
      const image = await pdfDoc.embedPng(o.png);
      const w = o.fw * displayW;
      const h = o.fh * displayH;
      // pdf-lib rotates around the image's bottom-left corner (counter-clockwise),
      // which is the overlay's bottom-left corner in display space.
      const anchor = displayToPdf(o.fx * displayW, o.fy * displayH + h, box, rot);
      page.drawImage(image, { x: anchor.x, y: anchor.y, width: w, height: h, rotate: degrees(rot) });
    }
  }

  function groupByPage(overlays) {
    const map = new Map();
    for (const o of overlays) {
      if (!map.has(o.page)) map.set(o.page, []);
      map.get(o.page).push(o);
    }
    return map;
  }

  /*
   * Embeds overlays into the original PDF and returns the new bytes.
   * Overlays are flattened: drawn directly into the page content stream.
   * Encrypted PDFs (also ones opened with a password) cannot be modified by
   * pdf-lib, so they are re-built from rendered page images instead (see rasterizeExport).
   * The result has no password.
   */
  /*
   * A small line at the bottom of each page as it is shown (the free version).
   * Latin text in a standard font, so nothing has to be embedded. With /Rotate the
   * shown bottom is another edge of the page: the line turns with it.
   */
  async function drawFooter(pdfDoc, text) {
    const { StandardFonts, rgb, degrees } = global.PDFLib;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const page of pdfDoc.getPages()) {
      const box = page.getCropBox();
      const rot = normRotation(page.getRotation().angle);
      const shownWidth = rot % 180 ? box.height : box.width;
      const size = Math.max(5, Math.min(8, shownWidth / 75));
      const w = font.widthOfTextAtSize(text, size);
      const m = size * 1.2;  // distance from the edge
      const right = box.x + box.width;
      const top = box.y + box.height;
      const at = {
        0: { x: box.x + (box.width - w) / 2, y: box.y + m },
        90: { x: right - m, y: box.y + (box.height - w) / 2 },
        180: { x: box.x + (box.width + w) / 2, y: top - m },
        270: { x: box.x + m, y: box.y + (box.height + w) / 2 }
      }[rot];
      page.drawText(text, { ...at, size, font, color: rgb(0.45, 0.47, 0.55), rotate: degrees(rot) });
    }
  }

  // order: original page numbers in the order the pages should come out (optional)
  // options.footer: a line for the bottom of every page (the free version)
  async function exportPdf(doc, overlays, order, options = {}) {
    const { PDFDocument } = global.PDFLib;
    if (doc.locked) return rasterizeExport(doc, overlays, order, options);
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(doc.bytes, { updateMetadata: false });
    } catch (e) {
      if (e && /encrypt/i.test(e.message || '')) return rasterizeExport(doc, overlays, order, options);
      throw e;
    }
    const pages = pdfDoc.getPages();
    for (const [pageNum, list] of groupByPage(overlays)) {
      const page = pages[pageNum - 1];
      if (page) await drawOverlaysOnPage(pdfDoc, page, list);
    }
    // A new order, or files removed (their pages are left out of the order)
    if (order && (order.length !== pages.length || order.some((num, i) => num !== i + 1))) {
      // Same page objects in a new order: content, images and overlays are untouched
      for (let i = pages.length - 1; i >= 0; i--) pdfDoc.removePage(i);
      order.forEach((num) => pdfDoc.addPage(pages[num - 1]));
    }
    if (options.footer) await drawFooter(pdfDoc, options.footer);
    pdfDoc.setModificationDate(new Date());
    pdfDoc.setProducer('EasyPen');
    return pdfDoc.save();
  }

  // Fallback: new PDF whose pages are high resolution images of the original pages.
  async function rasterizeExport(doc, overlays, order, options = {}) {
    const { PDFDocument } = global.PDFLib;
    const out = await PDFDocument.create();
    const byPage = groupByPage(overlays);
    const canvas = document.createElement('canvas');
    const nums = order || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (const n of nums) {
      const page = await doc.getPage(n);
      const size = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, Math.sqrt(12e6 / (size.width * size.height)));
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
      const jpg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      const image = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      const newPage = out.addPage([size.width, size.height]);
      newPage.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
      if (byPage.has(n)) await drawOverlaysOnPage(out, newPage, byPage.get(n));
    }
    if (options.footer) await drawFooter(out, options.footer);
    out.setProducer('EasyPen');
    return out.save();
  }

  global.PdfHandler = { load, exportPdf, displayToPdf, isPdfBytes };
})(window);
