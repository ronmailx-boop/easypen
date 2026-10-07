/*
 * EasyPen - combines PDF files and JPG / PNG images into one PDF, in the given order:
 * every page of each PDF, and a page per image. Exposes a global `EasyPenCombine`.
 *
 * PDF pages are copied as they are (text, fonts and images untouched, text stays searchable).
 * Form fields keep their look but may stop being fillable.
 *
 * Image quality: JPG bytes go into the PDF unchanged (DCTDecode stream, no re-encoding).
 * PNG is lossless: its pixels are stored compressed without loss (FlateDecode, same
 * size, transparency kept). Exporting the signed PDF copies both as they are.
 * The page size only sets how big the image is shown, not its resolution.
 * Orientation: phone photos are often stored sideways with an EXIF "rotate" tag, which
 * PDF viewers ignore. The tag is reset to "normal" (2 bytes of metadata, pixels untouched)
 * and the page gets the same rotation as /Rotate instead.
 */
(function (global) {
  'use strict';

  const MAX_FILES = 20;
  const PAGE_LONG_SIDE = 842;   // points: the long side of A4, so text and signatures get usual sizes
  const PDF_LIB_URL = new URL('vendor/pdf-lib/pdf-lib.min.js', document.baseURI).href;

  // EXIF orientation -> clockwise page rotation (mirrored variants lose only the mirroring)
  const EXIF_ROTATION = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

  function isImage(file) {
    return /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name || '');
  }

  function isPdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  }

  // By content, not by name: JPG starts with FF D8, PNG with 89 'PNG', PDF has '%PDF-' near the start
  function kindOf(b) {
    if (b[0] === 0xFF && b[1] === 0xD8) return 'jpg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    const head = String.fromCharCode.apply(null, b.subarray(0, 1024));
    if (head.includes('%PDF-')) return 'pdf';
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

  function fileError(code, file, cause) {
    const err = new Error(cause ? cause.message : code);
    err.code = code;
    err.fileName = file.name || '';
    return err;
  }

  async function addImage(pdf, PDFLib, bytes, kind) {
    let image;
    if (kind === 'jpg') {
      const rotation = takeExifRotation(bytes);
      image = await pdf.embedJpg(bytes);
      image.rotation = rotation;
    } else {
      image = await pdf.embedPng(bytes);
    }
    const k = PAGE_LONG_SIDE / Math.max(image.width, image.height);
    const w = image.width * k;
    const h = image.height * k;
    const page = pdf.addPage([w, h]);
    page.drawImage(image, { x: 0, y: 0, width: w, height: h });
    if (image.rotation) page.setRotation(PDFLib.degrees(image.rotation));
  }

  /*
   * files: PDF / JPG / PNG File objects (or { name, blob }), in order. Resolves with the PDF bytes.
   * Errors (with .fileName): code 'BAD_FILE' for a file that isn't a readable PDF, JPG or PNG,
   * 'LOCKED' for an encrypted PDF (its pages can't be copied).
   */
  async function combineToPdf(files) {
    const PDFLib = await loadPdfLib();
    const pdf = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const bytes = new Uint8Array(await (file.blob || file).arrayBuffer());
      const kind = kindOf(bytes);
      if (kind === 'pdf') {
        let src;
        let pages;
        try {
          src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
          if (!src.isEncrypted) pages = await pdf.copyPages(src, src.getPageIndices());
        } catch (e) {
          throw fileError('BAD_FILE', file, e);
        }
        if (src.isEncrypted) throw fileError('LOCKED', file);
        if (!pages.length) throw fileError('BAD_FILE', file);
        pages.forEach((p) => pdf.addPage(p));
      } else if (kind) {
        try {
          await addImage(pdf, PDFLib, bytes, kind);
        } catch (e) {
          throw fileError('BAD_FILE', file, e);
        }
      } else {
        throw fileError('BAD_FILE', file);
      }
    }
    pdf.setProducer('EasyPen');
    return pdf.save();
  }

  global.EasyPenCombine = { MAX_FILES, isImage, isPdf, combineToPdf, takeExifRotation };
})(window);
