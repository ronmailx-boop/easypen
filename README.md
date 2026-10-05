# EasyPen - חתימה דיגיטלית

PWA לחתימה על מסמכי PDF מהנייד. כל העיבוד מתבצע בדפדפן — הקבצים לא נשלחים לשום שרת.

## זרימה
1. מסך הבית: "העלה מסמך" או שיתוף לאפליקציה (Web Share Target) מוואטסאפ/ג'ימייל/גלריה — PDF אחד, או עד 20 תמונות JPG/PNG שהופכות ל-PDF אחד, עמוד לכל תמונה. JPG נכנס כמו שהוא (בלי דחיסה מחדש, סיבוב EXIF הופך ל-/Rotate), PNG נשמר בלי אובדן (Flate, כולל שקיפות). תמונות ששותפו נשמרות ב-IndexedDB על ידי `sw.js` ומסך הבית ממיר אותן (`?source=share-images`). במסמך שנוצר מתמונות יש על כל עמוד בעורך חצים לשינוי הסדר; הייצוא שומר את הסדר שעל המסך.
2. עורך: עמודים בגלילה אנכית, "חתימה" / "טקסט" / "ציור" / "שמור ושתף".
   חתימה: סליידר גודל בסרגל של הפריט הנבחר; בציור חתימה חדשה "דגימה" לוקח את צבע הדיו מהמסמך עצמו (הקשה על חתימה קיימת).
   ציור: עט, טוש או מרקר הדגשה, 7 צבעים ועובי 1–20; אצבע אחת מציירת, שתי אצבעות מגדילות/מקטינות וגוללות; ביטול קו אחרון; ידית להסתרת המגש, ובמגש המוסתר כפתור "מצב גלילה" (גלילה בלי לצייר).
   הגדלה בצביטה (עד פי 4) נעשית בתוך האפליקציה ולא בזום של הדפדפן, כך שהסרגלים לא זזים בזמן הגדלה וגלילה.
3. הייצוא משטח את החתימות, הטקסט והציור לתוך ה-PDF (pdf-lib) ופותח את תפריט השיתוף (או מוריד את הקובץ).

## שפות
השפה נבחרת לפי שפת המכשיר, בלי כפתור החלפה: `he`/`iw` → עברית מימין לשמאל, כל שפה אחרת → אנגלית משמאל לימין.
כל הטקסטים בשתי השפות נמצאים ב-`js/i18n.js` (`t(key, vars)`). העברית כתובה גם ב-HTML, ובמכשיר באנגלית אלמנטים עם `data-i18n` / `data-i18n-aria` / `data-i18n-alt` מקבלים את הטקסט באנגלית. עמוד עובר לאנגלית רק כשמסומן `<html data-i18n-page>`.
טקסט חדש בממשק = מפתח חדש בשתי השפות (בדיקת e2e נכשלת אם חסר אחד). המסמכים המשפטיים באנגלית ב-`docs/legal/en/` — כל שינוי במסמך עברי צריך להיכנס גם לגרסה האנגלית.

## מבנה
| קובץ | תפקיד |
|---|---|
| `index.html`, `js/home.js` | מסך הבית + ניהול "החתימות שלי" (עד 3) |
| `viewer.html`, `js/viewer.js` | עורך: רינדור עמודים, גרירה/שינוי גודל, ציור חופשי, ייצוא |
| `legal.html`, `js/legal.js` | הצגת המסמכים המשפטיים מ-`docs/legal/*.md` (באנגלית: `docs/legal/en/`) |
| `js/i18n.js` | שפת הממשק (עברית/אנגלית) וכל הטקסטים |
| `share-target/index.html` | כתובת ה-Share Target (הבקשה עצמה מטופלת ב-`sw.js`) |
| `js/pdf-handler.js` | pdf.js (תצוגה) + pdf-lib (ייצוא), המרת קואורדינטות |
| `js/signature-pad.js` | ציור חתימה (Pointer Events) ודיאלוג |
| `js/images-to-pdf.js` | תמונות JPG/PNG → PDF (pdf-lib נטען רק כשצריך) |
| `js/storage.js` | IndexedDB (חתימות + המסמך הפתוח) |
| `js/share.js` | Web Share API + הורדה כגיבוי |
| `sw.js` | אופליין + קבלת קבצים משותפים |
| `vendor/` | pdf.js 6.3.289 (legacy build), pdf-lib 1.17.1 — מקומית, בלי CDN |

## פיתוח מקומי
אתר סטטי, ללא build:
```bash
npm run serve        # או: python3 -m http.server 8080
```
Service Worker ו-Share Target דורשים HTTPS (או localhost). Share Target עובד רק אחרי התקנת ה-PWA (אנדרואיד/כרום).

## בדיקות
```bash
npm install && npm test
```
פירוט ב-[`tests/README.md`](tests/README.md). `package.json` משמש לבדיקות בלבד — האתר עצמו לא דורש build.

## פריסה
כל הנתיבים יחסיים, כך שהאתר עובד גם בשורש הדומיין וגם תחת תת-תיקייה.

- **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root.
- **Cloudflare Workers** (https://easypen.vplusstudio.app, וגם https://easypen.ronmailx.workers.dev): פריסה דרך GitHub Actions — `.github/workflows/deploy-cloudflare.yml` מריץ `wrangler deploy` בכל push ל-`main` (או ידנית מלשונית Actions). ההגדרות ב-`wrangler.jsonc`, ו-`.assetsignore` מוציא מהפריסה את כל מה שאינו חלק מהאפליקציה.
  הגדרה חד-פעמית:
  1. Cloudflare → My Profile → API Tokens → Create Token → תבנית **Edit Cloudflare Workers** → Account Resources: החשבון, Zone Resources: **All zones** → Create Token.
  2. GitHub → Settings → Secrets and variables → Actions → New repository secret בשם `CLOUDFLARE_API_TOKEN`.
  3. Actions → Deploy to Cloudflare → Run workflow.

  חיבור Git דרך לוח הבקרה של Cloudflare לא עבד (לולאה במסך Connect GitHub), ולכן לא משתמשים בו.

בכל שינוי בקבצי האפליקציה יש להעלות את המספר ב-`js/version.js`, כדי שהמשתמשים יקבלו את הגרסה החדשה.
