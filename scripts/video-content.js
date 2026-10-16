// Shared by the promo videos (make-promo-video.js, make-hand-video.js): the texts in each language,
// the demo document and the handwritten signature.
// Everything that is said or typed in the video, per language
const LANGS = {
  he: {
    locale: 'he-IL', dir: 'rtl', font: 'Heebo, "Noto Sans Hebrew", sans-serif', shared: /שותף/,
    intro: 'חותמים על מסמכים<br>ישר מהטלפון',
    steps: ['מעלים PDF או תמונה', 'חותמים באצבע', 'ממלאים פרטים', 'מסמנים ✓', 'שומרים ושולחים'],
    pills: ['✓ בחינם, בלי הרשמה', '✓ הקבצים לא עוזבים את המכשיר'],
    file: 'הסכם שכירות.pdf', typed: 'רון כהן',
    hand: { caps: ['פותחים את EasyPen', 'בוחרים מסמך', 'מוסיפים חתימה שמורה'],
      apps: ['טלפון', 'הודעות', 'מצלמה', 'תמונות', 'שעון', 'מפות', 'מזג אוויר', 'מוזיקה', 'לוח שנה', 'הערות', 'מחשבון'] },
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
    hand: { caps: ['Open EasyPen', 'Pick a document', 'Add your saved signature'],
      apps: ['Phone', 'Messages', 'Camera', 'Photos', 'Clock', 'Maps', 'Weather', 'Music', 'Calendar', 'Notes', 'Calculator'] },
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
    hand: { caps: ['Откройте EasyPen', 'Выберите документ', 'Добавьте подпись'],
      apps: ['Телефон', 'Сообщения', 'Камера', 'Фото', 'Часы', 'Карты', 'Погода', 'Музыка', 'Календарь', 'Заметки', 'Калькулятор'] },
    doc: { title: 'Договор аренды', sub: 'Двухкомнатная квартира · ул. Парковая, 12',
      paras: ['Договор заключён между арендодателем и арендатором на 12 месяцев, начиная с 1 ноября 2026 г.',
        'Арендатор обязуется бережно относиться к квартире и вернуть её в исправном состоянии.'],
      name: 'ФИО арендатора:', agree: 'Согласен(на) с условиями договора', sig: 'Подпись арендатора:' }
  }
};
// The demo document (A5, large type so it reads on a phone)
const docHtml = (LANG, L) => `<!doctype html><html lang="${LANG}" dir="${L.dir}"><head><meta charset="utf-8"><style>
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

// A handwritten-looking signature: a tall initial, a run of joined letters and an underline, as
// control points (fractions of the drawing box) for smooth curves
const SIGNATURE = [
  [[0.13, 0.66], [0.17, 0.44], [0.21, 0.2], [0.235, 0.24], [0.215, 0.46], [0.18, 0.64], [0.165, 0.68], [0.2, 0.58],
    [0.28, 0.4], [0.32, 0.47], [0.27, 0.57], [0.245, 0.6], [0.3, 0.63], [0.345, 0.56], [0.365, 0.49], [0.385, 0.48], [0.395, 0.55],
    [0.405, 0.62], [0.43, 0.53], [0.45, 0.47], [0.47, 0.48], [0.48, 0.56], [0.495, 0.62], [0.53, 0.52], [0.565, 0.32], [0.575, 0.25],
    [0.56, 0.24], [0.545, 0.34], [0.55, 0.55], [0.565, 0.62], [0.6, 0.56], [0.625, 0.5], [0.645, 0.52], [0.65, 0.59], [0.67, 0.62],
    [0.71, 0.56], [0.75, 0.58], [0.81, 0.59], [0.88, 0.5]],
  [[0.2, 0.8], [0.45, 0.83], [0.7, 0.78], [0.86, 0.7]]
];
// Catmull-Rom curve through control points, `per` points per segment
const spline = (cp, per) => cp.slice(0, -1).flatMap((p1, i) => {
  const p0 = cp[i - 1] || p1, p2 = cp[i + 1], p3 = cp[i + 2] || p2;
  return Array.from({ length: per }, (_, s) => { const t = s / per, t2 = t * t, t3 = t2 * t;
    return [0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)); });
}).concat([cp[cp.length - 1]]);

module.exports = { LANGS, docHtml, SIGNATURE, spline };
