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

    destroy() {
      this.pdf.destroy();
    }
  }

  async function load(bytes) {
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
      enableXfa: false
    });
    try {
      const pdf = await task.promise;
      return new PdfDocument(bytes, pdf);
    } catch (e) {
      const err = new Error(e && e.message ? e.message : 'PDF load failed');
      err.code = e && e.name === 'PasswordException' ? 'PASSWORD' : 'INVALID';
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
   * Encrypted PDFs cannot be safely modified by pdf-lib, so they are
   * re-built from rendered page images instead (see rasterizeExport).
   */
  async function exportPdf(doc, overlays) {
    const { PDFDocument } = global.PDFLib;
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(doc.bytes, { updateMetadata: false });
    } catch (e) {
      if (e && /encrypt/i.test(e.message || '')) return rasterizeExport(doc, overlays);
      throw e;
    }
    const pages = pdfDoc.getPages();
    for (const [pageNum, list] of groupByPage(overlays)) {
      const page = pages[pageNum - 1];
      if (page) await drawOverlaysOnPage(pdfDoc, page, list);
    }
    pdfDoc.setModificationDate(new Date());
    pdfDoc.setProducer('EasyPen');
    return pdfDoc.save();
  }

  // Fallback: new PDF whose pages are high resolution images of the original pages.
  async function rasterizeExport(doc, overlays) {
    const { PDFDocument } = global.PDFLib;
    const out = await PDFDocument.create();
    const byPage = groupByPage(overlays);
    const canvas = document.createElement('canvas');
    for (let n = 1; n <= doc.numPages; n++) {
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
    out.setProducer('EasyPen');
    return out.save();
  }

  global.PdfHandler = { load, exportPdf, displayToPdf, isPdfBytes };
})(window);
