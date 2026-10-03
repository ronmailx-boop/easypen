/*
 * EasyPen - interface language (Hebrew or English), picked from the device language.
 * Exposes a global `EasyPenI18n`. Loaded first (in <head>), also by the Service Worker.
 *
 * Hebrew stays written in the HTML; on an English device every element marked
 * data-i18n / data-i18n-aria / data-i18n-alt gets the English text (as plain text,
 * never markup). Pages switch direction only when <html data-i18n-page> marks them translated.
 */
(function (global) {
  'use strict';

  const STRINGS = {
    he: {
      'app.title': 'EasyPen - חתימה דיגיטלית',
      'home.install': 'התקנת האפליקציה',
      'home.heading': 'חתימה על מסמך',
      'home.intro': 'בחרו קובץ PDF, הוסיפו חתימה או טקסט ושתפו הלאה.',
      'home.upload': 'העלה מסמך',
      'home.privacy': 'כל העיבוד מתבצע במכשיר שלכם. הקבצים לא נשלחים לשום שרת.',
      'home.sigs': 'החתימות שלי',
      'home.sigsEmpty': 'עדיין אין חתימות שמורות. אפשר לשמור עד 3 חתימות לשימוש חוזר.',
      'home.addSig': '+ חתימה חדשה',
      'home.sigCount': '{n} מתוך {max}',
      'home.pdfOnly': 'כרגע נתמכים קבצי PDF בלבד',
      'home.shareError': 'לא התקבל קובץ מהשיתוף. נסו שוב או העלו את הקובץ ידנית.',
      'home.openError': 'לא ניתן לפתוח את הקובץ. ייתכן שהאחסון בדפדפן חסום (למשל בגלישה בסתר).',
      'home.sigsLoadError': 'לא ניתן לטעון את החתימות השמורות',
      'home.sigPreview': 'תצוגה מקדימה של חתימה שמורה',
      'home.edit': 'עריכה',
      'home.delete': 'מחיקה',
      'home.newSig': 'חתימה חדשה',
      'home.saveForReuse': 'שמור לשימוש חוזר',
      'home.sigSaved': 'החתימה נשמרה',
      'home.sigLimit': 'אפשר לשמור עד 3 חתימות. מחקו חתימה קיימת כדי להוסיף חדשה.',
      'home.sigSaveError': 'שמירת החתימה נכשלה',
      'home.editSig': 'עריכת חתימה',
      'home.save': 'שמור',
      'home.sigUpdated': 'החתימה עודכנה',
      'home.sigUpdateError': 'עדכון החתימה נכשל',
      'home.deleteConfirm': 'למחוק את החתימה?',
      'home.sigDeleted': 'החתימה נמחקה',
      'home.sigDeleteError': 'מחיקת החתימה נכשלה',
      'footer.legal': 'מידע משפטי',
      'footer.privacy': 'מדיניות פרטיות',
      'footer.terms': 'תנאי שימוש',
      'footer.cookies': 'מדיניות עוגיות',
      'footer.accessibility': 'הצהרת נגישות',
      'footer.version': 'גרסה',
      'pad.title': 'ציור חתימה',
      'pad.close': 'סגור',
      'pad.hint': 'ציירו את החתימה בתוך המסגרת בעזרת האצבע',
      'pad.inkColor': 'צבע דיו',
      'pad.black': 'שחור',
      'pad.blue': 'כחול',
      'pad.clear': 'נקה',
      'pad.saveForReuse': 'שמור לשימוש חוזר',
      'pad.cancel': 'ביטול',
      'pad.save': 'שמור',
      'pad.empty': 'יש לצייר חתימה לפני השמירה',
      'share.title': 'קבלת מסמך - EasyPen',
      'share.heading': 'לא הצלחנו לקבל את הקובץ',
      'share.text': 'פתחו את EasyPen פעם אחת כשיש חיבור לרשת, ואז נסו לשתף שוב. אפשר גם להעלות את הקובץ ידנית.',
      'share.home': 'מעבר ל-EasyPen',
      'sw.offline': 'אין חיבור לרשת'
    },
    en: {
      'app.title': 'EasyPen - Digital Signature',
      'home.install': 'Install app',
      'home.heading': 'Sign a document',
      'home.intro': 'Choose a PDF, add a signature or text, and share it.',
      'home.upload': 'Upload document',
      'home.privacy': 'Everything is processed on your device. Files are never sent to any server.',
      'home.sigs': 'My signatures',
      'home.sigsEmpty': 'No saved signatures yet. You can save up to 3 signatures to reuse.',
      'home.addSig': '+ New signature',
      'home.sigCount': '{n} of {max}',
      'home.pdfOnly': 'Only PDF files are supported for now',
      'home.shareError': 'No file was received from the share. Try again or upload the file manually.',
      'home.openError': 'The file could not be opened. Browser storage may be blocked (for example in private browsing).',
      'home.sigsLoadError': 'Could not load the saved signatures',
      'home.sigPreview': 'Preview of a saved signature',
      'home.edit': 'Edit',
      'home.delete': 'Delete',
      'home.newSig': 'New signature',
      'home.saveForReuse': 'Save for reuse',
      'home.sigSaved': 'Signature saved',
      'home.sigLimit': 'You can save up to 3 signatures. Delete one to add a new one.',
      'home.sigSaveError': 'Saving the signature failed',
      'home.editSig': 'Edit signature',
      'home.save': 'Save',
      'home.sigUpdated': 'Signature updated',
      'home.sigUpdateError': 'Updating the signature failed',
      'home.deleteConfirm': 'Delete this signature?',
      'home.sigDeleted': 'Signature deleted',
      'home.sigDeleteError': 'Deleting the signature failed',
      'footer.legal': 'Legal information',
      'footer.privacy': 'Privacy Policy',
      'footer.terms': 'Terms of Use',
      'footer.cookies': 'Cookie Policy',
      'footer.accessibility': 'Accessibility Statement',
      'footer.version': 'Version',
      'pad.title': 'Draw signature',
      'pad.close': 'Close',
      'pad.hint': 'Draw your signature inside the frame with your finger',
      'pad.inkColor': 'Ink colour',
      'pad.black': 'Black',
      'pad.blue': 'Blue',
      'pad.clear': 'Clear',
      'pad.saveForReuse': 'Save for reuse',
      'pad.cancel': 'Cancel',
      'pad.save': 'Save',
      'pad.empty': 'Draw a signature before saving',
      'share.title': 'Receiving a document - EasyPen',
      'share.heading': 'We couldn\'t receive the file',
      'share.text': 'Open EasyPen once while online, then try sharing again. You can also upload the file manually.',
      'share.home': 'Go to EasyPen',
      'sw.offline': 'No network connection'
    }
  };

  // Hebrew for a Hebrew device ("iw" is the old Android code), English for any other language
  function pick(language) {
    return /^(he|iw)\b/i.test(language || '') ? 'he' : 'en';
  }

  const nav = global.navigator || {};
  const lang = pick(nav.language || (nav.languages && nav.languages[0]));
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  // Text for `key`, with {name} placeholders filled from `vars`
  function t(key, vars) {
    const text = STRINGS[lang][key] ?? STRINGS.he[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text;
  }

  // Puts the English texts into `root` (the Hebrew ones are already in the HTML)
  function apply(root) {
    if (lang === 'he' || !root) return;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    root.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  }

  if (global.document) {
    const html = global.document.documentElement;
    if (html.hasAttribute('data-i18n-page')) {
      html.lang = lang;
      html.dir = dir;
      if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => apply(global.document));
      } else {
        apply(global.document);
      }
    }
  }

  global.EasyPenI18n = { lang, dir, t, apply, pick, STRINGS };
})(self);
