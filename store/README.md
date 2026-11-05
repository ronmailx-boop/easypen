# EasyPen ב-Google Play - מדריך הקמה

האפליקציה בחנות היא **TWA** (Trusted Web Activity): מעטפת אנדרואיד שפותחת את `https://easypen.vplusstudio.app` במסך מלא. הקוד של האתר הוא הקוד של האפליקציה, כך ששינוי באתר מגיע לאפליקציה בלי בנייה חדשה. צריך לבנות מחדש רק כשמשנים את `twa-manifest.json` (שם, צבעים, אייקון, גרסה).

## ההחלטות (5.11.2026)
| נושא | החלטה |
|---|---|
| שם חבילה | `app.vplusstudio.easypen` |
| אתר | גרסה בסיסית בחינם: PDF אחד, טקסט, חתימה שמורה אחת, שורת "Signed with EasyPen" בתחתית העמודים |
| אפליקציה | גרסה מלאה במנוי, עם 30 יום ניסיון של Google Play (עם אמצעי תשלום) |
| אחרי הניסיון בלי מנוי | האפליקציה חוזרת ליכולות של האתר |
| משתמשים קיימים באתר | 30 יום של גרסה מלאה מהביקור הראשון אחרי ההשקה, עם הודעה |
| מחיר | ₪12.90 לחודש, ₪79 לשנה; מחוץ לישראל $3.99 / $24.99 |
| שפות בחנות | אנגלית (ברירת מחדל), עברית, רוסית - הטקסטים ב-`listing-*.md` |
| מפתח | vplus studio (חשבון ארגוני) |

## מה כבר מוכן בקוד
- `js/plan.js` - מי מקבל גרסה מלאה, חלון "הגרסה המלאה", רכישה דרך Google Play (Digital Goods API + Payment Request).
- `worker/index.mjs` - `POST /api/play/verify`: מאמת את הרכישה מול Google ו**מאשר אותה (acknowledge)**. בלי אישור תוך 3 ימים Google מחזירה את הכסף ומבטלת את המנוי. לא נשמר שום מידע.
- `worker/assetlinks.mjs` - `/.well-known/assetlinks.json` שמקשר את האפליקציה לאתר (בלעדיו האפליקציה נפתחת עם שורת כתובת של דפדפן).
- `android/` - פרויקט האנדרואיד (נוצר מ-`twa-manifest.json` עם `node scripts/android-generate.js`).
- `.github/workflows/android-upload-key.yml` - יצירת מפתח העלאה (פעם אחת).
- `.github/workflows/build-android.yml` - בניית קובץ `.aab` חתום.
- **המגבלות באתר עדיין כבויות** (`WEB_LIMITS = false` ב-`js/plan.js`), כדי שמשתמשי האתר לא יופנו לחנות לפני שהאפליקציה קיימת בה. באפליקציה עצמה הן פועלות כבר עכשיו.

## מה אתה עושה (לפי הסדר)

### 1. מפתח העלאה (פעם אחת)
**הדרך המומלצת: מהטלפון עם Termux**, לפי [`termux.md`](termux.md). המפתח נוצר בטלפון ונשמר ישירות כסודות ב-GitHub (`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEYSTORE_BASE64`). לא נוצר שום קובץ ב-GitHub Actions.

חלופה בלי Termux: ה-workflow "Android - create upload key". הוא יוצר את המפתח ב-GitHub ומעלה אותו כ-artifact ליום אחד. הריפו ציבורי, ולכן ה-artifact מוגן רק בסיסמה (16 תווים לפחות). אם המפתח אבד או דלף, Google יכולה לאשר מפתח העלאה חדש (Play App Signing).

### 2. בניית האפליקציה
Actions → **Android - build** → Run workflow. בסיום: Artifacts → `easypen-aab` → בתוכו `easypen-1.0.0-1.aab`.
בלוג הריצה מופיע **Upload key SHA-256 fingerprint**. אותו צריך לשלוח לי.

### 3. יצירת האפליקציה ב-Play Console
1. Create app → שם: `EasyPen`, שפת ברירת מחדל: **English (United States) - en-US**, App, **Free** (עם רכישות בתוך האפליקציה).
2. Settings → Payments profile: לוודא שפרופיל התשלומים של החשבון מוגדר (נדרש למכירת מנויים).
3. Test and release → Testing → **Internal testing** → Create new release → להעלות את קובץ ה-`.aab`.
   - כשנשאלים על **Play App Signing**: לאשר (Google שומרת את מפתח החתימה הסופי).
4. Test and release → App integrity → App signing → להעתיק את **SHA-256 certificate fingerprint** של **App signing key certificate** ולשלוח לי. אני מוסיף אותו ל-`worker/assetlinks.mjs`. בלי זה, אחרי ההתקנה מהחנות יופיע פס של דפדפן בראש המסך.

### 4. המנויים (Monetize with Play → Products → Subscriptions)
ליצור **שני** מנויים. המזהים חייבים להיות בדיוק כאלה:

| Product ID | Base plan ID | תקופה | מחיר בישראל | מחיר בסיס למדינות אחרות |
|---|---|---|---|---|
| `easypen_monthly` | `monthly` | 1 month, auto-renewing | ₪12.90 | $3.99 |
| `easypen_yearly` | `yearly` | 1 year, auto-renewing | ₪79.00 | $24.99 |

בכל base plan: Set prices → להזין USD → "Update exchange rates" לכל המדינות → לשנות את ישראל ידנית ל-ILS שבטבלה → Activate.

בכל מנוי: Add offer → Offer ID `trial-30d` → Eligibility: **New customer acquisition → Never had any subscription** (כך אי אפשר לקבל ניסיון פעמיים, גם לא דרך המסלול השני) → Phase: **Free trial, 30 days** → Activate.

### 5. חשבון שירות לאימות הרכישות
1. [Google Cloud Console](https://console.cloud.google.com/) → פרויקט (קיים או חדש) → APIs & Services → Enable **Google Play Android Developer API**.
2. IAM & Admin → Service Accounts → Create → שם `easypen-play` → Done → הקלקה עליו → Keys → Add key → JSON. יורד קובץ.
3. Play Console → Users and permissions → Invite new users → כתובת המייל של חשבון השירות (`...@...iam.gserviceaccount.com`) → App permissions → EasyPen → **View financial data** + **Manage orders and subscriptions** → Invite.
4. לשמור את קובץ ה-JSON כסוד `PLAY_SERVICE_ACCOUNT` ב-GitHub, מ-Termux ([`termux.md`](termux.md) שלב 5). ה-workflow "Deploy to Cloudflare" מעתיק אותו ל-Worker.
   - לא לשלוח את הקובץ בצ'אט ולא לשמור אותו בריפו. אחרי השמירה מוחקים אותו מהטלפון.

### 6. בדיקה לפני פרסום
1. Play Console → Settings → **License testing** → להוסיף את חשבון ה-Gmail שלך (ושל מי שבודק). רכישות של בודקים לא עולות כסף, והחידושים מואצים (חודש = 5 דקות).
2. Internal testing → Testers → להוסיף את אותם חשבונות → לפתוח את קישור ההצטרפות בטלפון → להתקין.
3. לבדוק: האפליקציה נפתחת בלי שורת כתובת → לחיצה על "ציור" מציגה את המסלולים במחירים מ-Google → הרשמה עם ניסיון → כל הכלים נפתחים → ביטול ב-Google Play → אחרי סיום התקופה האפליקציה חוזרת לגרסה הבסיסית.

### 7. דף החנות
- Store presence → Main store listing: הטקסטים מ-`listing-en.md`. Translations → Add: Hebrew, Russian, מ-`listing-he.md` / `listing-ru.md`.
- אייקון 512×512: `android/store_icon.png`.
- **צילומי מסך** (6 לטלפון, 1080×1920) ו-**Feature graphic** (1024×500), לכל שפה: `store/graphics/en|he|ru/`. ב-Main store listing מעלים את האנגליים, ובכל תרגום את אלה של אותה שפה (Phone screenshots: 01 עד 06 לפי הסדר). יצירה מחדש אחרי שינוי באפליקציה: `node scripts/make-store-assets.js` (צריך את הגופנים Heebo ו-Noto Sans).
- Privacy policy URL: `https://easypen.vplusstudio.app/legal.html?doc=privacy`
- Category: Productivity. Contact email: של vplus studio.

**App content** (תשובות מוצעות, לבדוק לפני שליחה):
- Ads: No.
- App access: All functionality available without special access.
- Target audience: 18+.
- Data safety:
  - Data collection: Yes. **App activity → App interactions** (ספירת ביקורים של Cloudflare Web Analytics, אנונימית): Collected, not shared, not required, purpose Analytics.
  - Encrypted in transit: Yes. Account deletion: לא רלוונטי (אין חשבונות).
  - אסימון הרכישה נבדק ולא נשמר (עיבוד חולף), ולכן אין צורך להצהיר עליו. Google Play מטפלת בתשלום בעצמה.
- Government app: No. Financial features: None. Health: No.

### 8. פרסום והשקה
1. Production → Create new release → אותו `.aab` (או חדש) → Countries: כל המדינות → Review → Rollout. חשבון ארגוני פטור מדרישת 12 הבודקים.
2. אחרי שהאפליקציה מופיעה בחנות, כותבים לי **"תפעיל את המגבלות באתר"**. אני משנה `WEB_LIMITS` ל-`true`, ומשתמשי האתר מקבלים את הגרסה הבסיסית. משתמשים קיימים מקבלים 30 יום של גרסה מלאה והודעה.

## גרסה חדשה של האפליקציה (רק כשמשנים את twa-manifest.json)
1. ב-`twa-manifest.json`: להעלות את `appVersionCode` ב-1 ולעדכן את `appVersionName`.
2. `npm i --no-save @bubblewrap/core@1.27.0 && node scripts/android-generate.js`
3. Push → **Android - build** רץ לבד → להעלות את ה-`.aab` החדש ב-Play Console.
