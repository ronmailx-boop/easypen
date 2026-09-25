/*
 * Test PDF generated with the vendored pdf-lib.
 * Pages cover the coordinate-mapping edge cases:
 *   1 - plain A4, 2 - /Rotate 90, 3 - CropBox offset, 4 - /Rotate 270
 */
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require(path.resolve(__dirname, '../../vendor/pdf-lib/pdf-lib.min.js'));

async function createTestPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const addPage = (label, { rotate = 0, crop = null } = {}) => {
    const page = doc.addPage([595, 842]);
    page.drawText(label, { x: 60, y: 780, size: 28, font });
    page.drawRectangle({ x: 200, y: 300, width: 200, height: 60, borderColor: rgb(1, 0, 0), borderWidth: 2 });
    if (rotate) page.setRotation(degrees(rotate));
    if (crop) page.setCropBox(...crop);
  };
  addPage('Page 1 normal');
  addPage('Page 2 rotate 90', { rotate: 90 });
  addPage('Page 3 crop', { crop: [50, 100, 500, 700] });
  addPage('Page 4 rotate 270', { rotate: 270 });
  return Buffer.from(await doc.save());
}

module.exports = { createTestPdf };
