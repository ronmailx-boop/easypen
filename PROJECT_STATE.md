# PROJECT_STATE - EasyPen

## Current Focus
MVP ראשוני הושלם. חבילת בדיקות e2e נוספה ל-`tests/` (`npm test`, 10 בדיקות, יציבות).
**הצעד הבא:** פריסה ל-GitHub Pages ובדיקה על מכשיר אנדרואיד אמיתי (התקנה, שיתוף PDF מוואטסאפ, navigator.share עם קובץ).

## MVP - משימות
- [x] מבנה PWA סטטי (index / viewer / share-target), נתיבים יחסיים ל-GitHub Pages
- [x] manifest.json כולל share_target (POST multipart, PDF)
- [x] Service Worker: precache, אופליין, טיפול ב-POST של Share Target → IndexedDB → viewer
- [x] ספריות מקומיות: pdf.js 6.3.289 legacy + pdf-lib 1.17.1 (`vendor/`)
- [x] IndexedDB wrapper (חתימות + מסמך נוכחי)
- [x] מסך בית: העלאה, בדיקת PDF בלבד, "החתימות שלי" (עד 3, עריכה/מחיקה)
- [x] ציור חתימה (Pointer Events), נקה, צבע דיו, "שמור לשימוש חוזר", PNG שקוף וחתוך
- [x] עורך: רינדור עמודים עצל (IntersectionObserver) + שחרור זיכרון לעמודים רחוקים
- [x] חתימה: בחירה משמורות / ציור חדש, גרירה, שינוי גודל (ידית בפינה שמאלית-תחתונה)
- [x] טקסט: הקשה על העמוד, עריכה, גרירה, A-/A+ (בנקודות PDF), זיהוי כיוון RTL/LTR
- [x] ייצוא: pdf-lib, קואורדינטות מנורמלות → PDF כולל /Rotate 0/90/180/270 ו-CropBox
- [x] טקסט מיוצא כתמונה (שומר עברית/RTL בלי להטמיע פונט)
- [x] PDF מוצפן (owner password) → ייצוא דרך רסטור עמודים
- [x] שיתוף: navigator.share עם קובץ, טיפול ב-AbortError / NotAllowedError, fallback להורדה
- [x] אייקונים placeholder (192, 512, maskable)
- [x] מסמכים משפטיים ב-`docs/legal/`
- [x] בדיקות e2e ב-`tests/` (Playwright + node:test), כולל אימות מיקום מדויק בייצוא
- [x] גרירת חתימה/טקסט בין עמודים
- [x] תיקון: גלילה אוטומטית לתיבת טקסט רק אם היא מוסתרת (מקלדת/סרגלים)
- [x] מעבר לערכת צבעים "כחול לילה" (אייקונים, theme_color, UI)
- [x] מסמכים משפטיים מלאים (תיקון 13, GDPR, חוק חתימה אלקטרונית, ת"י 5568) + עמוד `legal.html` שמציג אותם, קישורים בתחתית מסך הבית, זמינים אופליין
- [x] נגישות מקלדת בעורך: Tab לפריטים, חיצים להזזה, +/- לגודל, Enter לעריכה, Delete, Esc
- [x] תיקוני נגישות: ניגודיות ירוק (5.3:1), כפתורים קטנים 44px
- [x] מספר גרסה בתחתית מסך הבית (מקור יחיד `js/version.js`), תחתית צמודה יותר לכרטיסים
- [x] פריסה ל-Cloudflare Workers: `wrangler.jsonc` + `.assetsignore` (225 קבצי אפליקציה בלבד); ה-SW שומר עותק נקי כשהשרת מפנה `page.html` → `/page`, ובדיקה שמחקה את Cloudflare
- [x] `.nojekyll` כדי ש-GitHub Pages יגיש את קובצי ה-md כמו שהם
- [x] פרטי המפעיל מולאו במסמכים המשפטיים (vplus studio)
- [x] תיקון: SW שמר ב-precache עותק ישן של style.css ממטמון ה-HTTP (`cache: 'reload'`), קישורי תחתית בעיצוב "נקודות מפרידות" (2 שורות של 2 + © vplus studio, נבחר מ-5 וריאציות), שוליים רחבים יותר במסמכים
- [x] ציור חופשי על המסמך (וריאציה 5 "קלמר עטים" מתוך 5): כפתור "ציור" בסרגל התחתון (התוויות קוצרו ל-חתימה/טקסט/ציור), כותרת ביטול/סיום, עט/טוש/מרקר הדגשה, 7 צבעים, עובי 1–20 (נשמר ב-localStorage), ביטול קו אחרון; אצבע אחת מציירת ושתי אצבעות גוללות; הקווים נשמרים בנקודות PDF (SVG) ומיוצאים כ-PNG שקוף בגודל העמוד מתחת לחתימות; בדיקת e2e (גרסה 11)
- [x] ציור נבדק בטלפון — עובד (3.10.2026)
- [x] ציור: הגדלה/הקטנה בצביטה וגלילה בשתי אצבעות (`touch-action: pinch-zoom` על שכבת הציור — אצבע אחת מציירת, שתיים לדפדפן, כמו מחוץ למצב ציור), גרסה 12
- [x] צביטה להגדלה בזמן ציור נבדקה בטלפון — עובדת (3.10.2026)
- [x] סרגלים קבועים בקצוות המסך גם כשמגדילים בצביטה (סרגל תחתון, מגש ציור, סרגל חתימה/טקסט, הודעות, כותרות): `pinBars` ב-viewer.js לפי `visualViewport` — הפוך את ההגדלה ומזיז לקצה הנראה; בזום 1 (כולל מקלדת ב-iOS) לא משנה כלום. ידית "הסתר/הצג כלים" במגש הציור (גם הקשה על אזור ריק במגש) — המגש יורד ונשארת רק הידית. בדיקת e2e עם visualViewport מדומה (גרסה 13)
- [ ] לבדוק בטלפון: סרגלים קבועים בזמן הגדלה + הסתרת מגש הציור
- [x] כפתור "מצב גלילה" ברצועה של מגש הציור המוסתר: כשהוא לחוץ שכבת הציור לא תופסת מגע (אצבע אחת גוללת, צביטה מגדילה) ואי אפשר לצייר; פתיחת הכלים או יציאה ממצב ציור מכבים אותו. הידית גבוהה יותר (44px) (גרסה 14)
- [ ] לבדוק בטלפון: מצב גלילה
- [x] הגדלה בצביטה בתוך האפליקציה במקום הזום של הדפדפן (הסרגל התחתון קפץ בזמן גלילה כשהיה מוגדל, כי `pinBars` מתעדכן פריים אחרי הדפדפן): `touch-action: pan-x pan-y` חוסם את זום הדפדפן, שתי אצבעות משנות את `--zoom` על `.pages` (עד פי 4) והעמודים מתרחבים וגוללים בגלילה רגילה, כך שהסרגלים לא זזים בכלל. במצב ציור שתי אצבעות מגדילות וגוללות (שכבת הציור `touch-action: none`). אחרי ההגדלה העמוד מצויר מחדש לקנבס חדש ומוחלף (בלי הבהוב); Ctrl+גלגלת במחשב. בדיקת e2e עם מגע אמיתי (CDP) (גרסה 15)
- [ ] לבדוק בטלפון: הסרגל התחתון לא זז בגלילה, צביטה להגדלה במצב רגיל ובמצב ציור

## פתוח / לשלב הבא
- [x] GitHub Actions לפריסה ל-Cloudflare Workers (`.github/workflows/deploy-cloudflare.yml`) — חיבור Git בלוח הבקרה נכשל בנייד (לולאת Connect GitHub ב-Pages וב-Workers)
- [x] Secret `CLOUDFLARE_API_TOKEN` נשמר, פריסה ראשונה הצליחה (30.9.2026, 225 קבצים) → https://easypen.ronmailx.workers.dev
- [x] נבדק בטלפון בכתובת Cloudflare — עובד (גרסה 10)
- [x] דומיין `vplusstudio.app` נקנה ב-Cloudflare (1.10.2026). `wrangler.jsonc` → `"routes": [{ "pattern": "easypen.vplusstudio.app", "custom_domain": true }]` — הפריסה יוצרת DNS + תעודה. (אם אין הרשאה — להוסיף הרשאה למפתח הקיים, לא מפתח חדש). המסמכים המשפטיים לא מזכירים כתובת.
- [x] נבדק בטלפון ב-https://easypen.vplusstudio.app — עובד (1.10.2026) `workers.dev` ממשיך לעבוד במקביל; מעבר כתובת = נתונים מקומיים לא עוברים, לכן לעבור לפני שיווק
- [ ] בדיקה על מכשירים אמיתיים (אנדרואיד כרום, iOS ספארי — ב-iOS אין Share Target)
- [ ] אפשרות: ביטול/חזרה (undo)
- [ ] אפשרות: PDF מוגן בסיסמת פתיחה (כרגע מוצגת הודעה)

## פרטי המפעיל (במסמכים המשפטיים)
- מפעיל ורכז/ת נגישות: vplus studio · מייל: vplus.studio.apps@gmail.com
- סמכות שיפוט: מחוז תל אביב · מענה לפניות נגישות: 14 ימי עסקים · בדיקת נגישות אחרונה: 25.9.2026
- אין טלפון בהצהרת הנגישות (לא נמסר) — להוסיף אם יתקבל.

## נהלי עבודה
- **PR ומיזוג אוטומטי:** בסיום כל שינוי (אחרי בדיקות ירוקות) — לפתוח PR ל-`main` ולמזג אותו מיד, בלי לשאול. אישור קבוע מהמשתמש (26.9.2026).

## פריסה ל-Cloudflare — השיטה שעובדת (אושר 30.9.2026)
**לא לנסות שוב** חיבור Git דרך לוח הבקרה (Pages → Import Git / Workers → Connect GitHub): בנייד זה נכנס ללולאה — GitHub נפתח בלשונית חדשה ולא חוזר ל-Cloudflare, גם אחרי התקנה מחדש של אפליקציית GitHub.

השיטה שעובדת: **GitHub Actions + wrangler + API Token**
1. בריפו: `wrangler.jsonc` (Worker של static assets בלבד, `assets.directory: "."`) + `.assetsignore` (מוציא `.git`, `node_modules`, `tests`, `package*.json`, קבצי תיעוד) + `.github/workflows/deploy-cloudflare.yml` (`npx --yes wrangler@4 deploy` ב-push ל-main וב-workflow_dispatch; מדלג אם אין Secret).
2. ב-Cloudflare: My Profile → API Tokens → Create Token → תבנית **Edit Cloudflare Workers** → Account Resources: Include + החשבון → Zone Resources: Include + **Specific zone** → `vplusstudio.app` → Create Token → Copy. (המפתח הקיים של easypen נוצר עם All zones — עובד, לא חובה להחליף.)
3. ב-GitHub: Settings → Secrets and variables → Actions → New repository secret → `CLOUDFLARE_API_TOKEN`.
4. הרצה ראשונה: אני יכול להפעיל בעצמי (`actions_run_trigger`, `run_workflow`) ולבדוק בלוג ה-job (הסביבה שלי לא יכולה לגשת ל-workers.dev ישירות).
- Account ID (לא סודי, בתוך ה-workflow): `1c9c1dd0e8a1d80f324b974ae6a617fb` · תת-דומיין: `ronmailx.workers.dev` · דומיין: `vplusstudio.app` (אפליקציות כתת-דומיין, למשל `easypen.vplusstudio.app`; לפרויקט חדש להוסיף `routes` עם `custom_domain` ב-`wrangler.jsonc`)
- ה-SW חייב להיות עמיד להפניות `page.html` → `/page` של Cloudflare (`unredirect` + `prettyToHtml` ב-`sw.js`), ויש לזה בדיקה (`prettyUrls` בשרת הבדיקות).
- **לפרויקטים חדשים:** אותה שיטה. להעתיק לריפו החדש את שלושת הקבצים:
  1. `wrangler.jsonc` — הגדרות Cloudflare: שם הפרויקט (קובע את הכתובת `<name>.ronmailx.workers.dev`) ותיקיית הקבצים שמוגשים. **לשנות את `name`.**
  2. `.assetsignore` — מה לא עולה לאתר (`node_modules`, בדיקות, `package.json`, תיעוד פנימי). **להתאים לקבצים של הפרויקט.**
  3. `.github/workflows/deploy-cloudflare.yml` — התהליך שמעלה ל-Cloudflare בכל מיזוג ל-`main` או ידנית. Account ID כבר בפנים — **אין מה לשנות.**
  - מהמשתמש צריך רק: API Token מהתבנית Edit Cloudflare Workers → Secret בשם `CLOUDFLARE_API_TOKEN` בריפו החדש.
  - **מפתח נפרד לכל פרויקט (החלטה, 30.9.2026).** לתת לו שם לפי הפרויקט (Token name, למשל `easypen-deploy`). הסיבה: זו ההמלצה המקובלת (נבדק ברשת 1.10.2026). זה **לא** מגביל הרשאות — כל מפתח מהתבנית יכול לשנות כל Worker בחשבון (`clickbyter-api`, `xmoney-auth`, `cheap-flights-agent`…); היתרון הוא שביטול/Roll של מפתח שדלף לא עוצר את הפריסה בשאר הפרויקטים, ולפי השם יודעים מאיפה דלף. Roll לפחות פעם בשנה. Cloudflare מציג מפתח רק פעם אחת; לא לשמור אותו בצ'אט, בקוד או בקובץ — רק כ-Secret ב-GitHub (ובמנהל סיסמאות אם רוצים).
  - אם האתר צריך לעבוד אופליין (Service Worker): לוודא שה-SW מתמודד עם ההפניות `page.html` → `/page` (כמו `unredirect` + `prettyToHtml` ב-`sw.js` כאן). זה תיקון קוד, לא קובץ נוסף.

## דומיין משלנו (תת-דומיין) — השיטה שעובדת (אושר 1.10.2026)
> ההוראות הכלליות לכל אפליקציה (פריסה + דומיין) נמצאות עכשיו ב-`CLAUDE.md`, בסעיף "פריסה ל-Cloudflare ודומיין". להעתיק את הסעיף ל-CLAUDE.md של כל ריפו.

הדומיין `vplusstudio.app` נקנה ב-Cloudflare **באותו חשבון** של ה-Workers. כל אפליקציה מקבלת תת-דומיין משלה.
1. ב-`wrangler.jsonc` של הפרויקט מוסיפים:
   `"workers_dev": true,`
   `"routes": [{ "pattern": "<app>.vplusstudio.app", "custom_domain": true }]`
2. PR + מיזוג → ה-workflow הקיים (`wrangler deploy`) יוצר לבד את רשומת ה-DNS ואת תעודת ה-HTTPS. **לא נוגעים בלוח הבקרה.**
3. אימות: בלוג ה-job של "Deploy to Cloudflare" מופיעה השורה `<app>.vplusstudio.app (custom domain)`. המשתמש בודק בטלפון (הסביבה שלי לא מגיעה לכתובת); תעודה חדשה יכולה לקחת 5–15 דקות.
- המפתח מהתבנית **Edit Cloudflare Workers** (נבדק עם All zones; למפתחות חדשים — Specific zone `vplusstudio.app`) מספיק — לא היה צריך הרשאה נוספת. אם פריסה נכשלת על הרשאה: להוסיף הרשאה למפתח הקיים, לא ליצור חדש.
- כתובת `workers.dev` ממשיכה לעבוד במקביל **רק עם `"workers_dev": true`** — בלי זה wrangler כיבה אותה ב-EasyPen אחרי הוספת `routes` (בלוג הופיע רק ה-custom domain). תוקן 1.10.2026 ונבדק בטלפון — שתי הכתובות עובדות; באימות לוודא ששתי הכתובות מופיעות בלוג. מעבר כתובת = נתונים מקומיים (IndexedDB) והתקנת PWA לא עוברים → לחבר דומיין לפני שמשווקים.
- דומיין `.app` מחייב HTTPS (HSTS) — Cloudflare מטפל בזה אוטומטית.

## החלטות
- המסמכים המשפטיים נשמרים רק כ-Markdown ב-`docs/legal/` (מקור אמת יחיד); `js/legal.js` מרנדר אותם בדפדפן עם escaping מלא.
- ערכת צבעים: "כחול לילה" — primary `#2f4fc4`, secondary `#1e1b6b` (במקום הסגול המקורי `#7367f0`/`#7c4ddb`). נבחרה מתוך 6 וריאציות אייקון.
- מיקום אלמנטים נשמר כשברים מגודל העמוד (0..1) → עמיד לזום, גלילה וסיבוב מסך.
- טקסט מרוסטר ל-PNG ב-4px לנקודה במקום הטמעת פונט עברי (pdf-lib לא תומך RTL/shaping).
- כל מסמך הוא session חד-פעמי: נמחק מ-IndexedDB בחזרה למסך הבית.
- `package.json` קיים לבדיקות בלבד; האתר נשאר סטטי ללא build.
- מספר הגרסה מוגדר במקום אחד: `js/version.js` (כרגע `15`). בכל שינוי בקבצי האפליקציה מעלים אותו — הוא קובע את שמות מטמוני ה-SW (`easypen-v15`) ומוצג בתחתית מסך הבית.
