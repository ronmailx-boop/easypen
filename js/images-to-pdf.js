/*
 * EasyPen - JPG / PNG images to one PDF, one page per image.
 * Exposes a global `EasyPenImages`.
 *
 * Quality: JPG bytes go into the PDF unchanged (DCTDecode stream, no re-encoding).
 * PNG is lossless: its pixels are stored compressed without loss (FlateDecode, same
 * size, transparency kept). Exporting the signed PDF copies both as they are.
 * The page size only sets how big the image is shown, not its resolution.
 * Orientation: phone photos are often stored sideways with an EXIF "rotate" tag, which
 * PDF viewers ignore. The tag is reset to "normal" (2 bytes of metadata, pixels untouched)
 * and the page gets the same rotation as /Rotate instead.
 */
(function (global) {
  'use strict';

  const MAX_IMAGES = 20;
  const PAGE_LONG_SIDE = 842;   // points: the long side of A4, so text and signatures get usual sizes
  const PDF_LIB_URL = new URL('vendor/pdf-lib/pdf-lib.min.js', document.baseURI).href;

  // EXIF orientation -> clockwise page rotation (mirrored variants lose only the mirroring)
  const EXIF_ROTATION = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

  function isImage(file) {
    return /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name || '');
  }

  // By content, not by name: JPG starts with FF D8, PNG with 89 'PNG'
  function kindOf(b) {
    if (b[0] === 0xFF && b[1] === 0xD8) return 'jpg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    return null;
  }

  let pdfLibPromise = null;
  function loadPdfLib() {
    if (global.PDFLib) return Promise.resolve(global.PDFLib);
    if (!pdfLibPromise) {
      pdfLibPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDF_LIB_URL;
        script.onload = () => resolve(global.PDFLib);
        script.onerror = () => { pdfLibPromise = null; reject(new Error('pdf-lib failed to load')); };
        document.head.appendChild(script);
      });
    }
    return pdfLibPromise;
  }

  /*
   * Finds the EXIF orientation tag, resets it to 1 (in `bytes`, in place) and returns the
   * page rotation it stood for. 0 when there is no tag.
   */
  function takeExifRotation(b) {
    let i = 2;
    while (i + 4 <= b.length && b[i] === 0xFF) {
      const marker = b[i + 1];
      const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
      if (marker === 0xDA || end > b.length) break;   // image data starts: no more metadata
      const isExif = marker === 0xE1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 &&
        b[i + 7] === 0x66 && b[i + 8] === 0 && b[i + 9] === 0;
      if (isExif) {
        const t = i + 10;   // TIFF header
        const le = b[t] === 0x49;
        const u16 = (o) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
        const u32 = (o) => (le
          ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
          : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
        if (t + 8 > end) return 0;
        const ifd = t + u32(t + 4);
        if (ifd + 2 > end) return 0;
        const count = u16(ifd);
        for (let k = 0; k < count; k++) {
          const e = ifd + 2 + k * 12;
          if (e + 12 > end) break;
          if (u16(e) === 0x0112) {
            const rotation = EXIF_ROTATION[u16(e + 8)] || 0;
            b[e + 8] = le ? 1 : 0;
            b[e + 9] = le ? 0 : 1;
            return rotation;
          }
        }
        return 0;
      }
      i = end;
    }
    return 0;
  }

  /*
   * files: JPG / PNG File objects (or { name, blob }), in page order. Resolves with the PDF bytes.
   * Errors: code 'NOT_IMAGE' (with .fileName) for a file that isn't a readable JPG or PNG.
   */
  async function imagesToPdf(files) {
    const { PDFDocument, degrees } = await loadPdfLib();
    const pdf = await PDFDocument.create();
    for (const file of files) {
      const bytes = new Uint8Array(await (file.blob || file).arrayBuffer());
      let image;
      try {
        const kind = kindOf(bytes);
        if (kind === 'jpg') {
          const rotation = takeExifRotation(bytes);
          image = await pdf.embedJpg(bytes);
          image.rotation = rotation;
        } else if (kind === 'png') {
          image = await pdf.embedPng(bytes);
        } else {
          throw new Error('Not a JPG or PNG');
        }
      } catch (e) {
        const err = new Error(e.message);
        err.code = 'NOT_IMAGE';
        err.fileName = file.name || '';
        throw err;
      }
      const k = PAGE_LONG_SIDE / Math.max(image.width, image.height);
      const w = image.width * k;
      const h = image.height * k;
      const page = pdf.addPage([w, h]);
      page.drawImage(image, { x: 0, y: 0, width: w, height: h });
      if (image.rotation) page.setRotation(degrees(image.rotation));
    }
    pdf.setProducer('EasyPen');
    return pdf.save();
  }

  global.EasyPenImages = { MAX_IMAGES, isImage, imagesToPdf, takeExifRotation };
})(window);
