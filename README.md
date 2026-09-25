# EasyPen - חתימה דיגיטלית

PWA לחתימה על מסמכי PDF מהנייד. כל העיבוד מתבצע בדפדפן — הקבצים לא נשלחים לשום שרת.

## זרימה
1. מסך הבית: "העלה מסמך" או שיתוף PDF לאפליקציה (Web Share Target) מוואטסאפ/ג'ימייל.
2. עורך: עמודים בגלילה אנכית, "הוסף חתימה" / "הוסף טקסט" / "שמור ושתף".
3. הייצוא משטח את החתימות והטקסט לתוך ה-PDF (pdf-lib) ופותח את תפריט השיתוף (או מוריד את הקובץ).

## מבנה
| קובץ | תפקיד |
|---|---|
| `index.html`, `js/home.js` | מסך הבית + ניהול "החתימות שלי" (עד 3) |
| `viewer.html`, `js/viewer.js` | עורך: רינדור עמודים, גרירה/שינוי גודל, ייצוא |
| `share-target/index.html` | כתובת ה-Share Target (הבקשה עצמה מטופלת ב-`sw.js`) |
| `js/pdf-handler.js` | pdf.js (תצוגה) + pdf-lib (ייצוא), המרת קואורדינטות |
| `js/signature-pad.js` | ציור חתימה (Pointer Events) ודיאלוג |
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

## פריסה ל-GitHub Pages
Settings → Pages → Deploy from branch → `main` / root. כל הנתיבים יחסיים, כך שהאתר עובד גם תחת `https://<user>.github.io/easypen/`.
בכל שינוי בקבצי האפליקציה יש להעלות את `VERSION` ב-`sw.js` כדי שהמשתמשים יקבלו את הגרסה החדשה.
