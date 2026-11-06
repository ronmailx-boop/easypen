# הגדרת הסודות מהטלפון עם Termux (Galaxy S25 FE)

כל הסודות נכנסים ל-GitHub ישירות מהטלפון, בעזרת `gh` (הכלי הרשמי של GitHub). הם לא עוברים בצ'אט ולא נשמרים בריפו. מפתח ההעלאה נוצר **בטלפון עצמו**, כך שהוא לא עובר דרך GitHub Actions בכלל (לכן אין צורך ב-workflow "Android - create upload key").

> Termux: להתקין מ-**F-Droid** או מ-GitHub של Termux. הגרסה ב-Google Play ישנה, וחלק מהחבילות לא יעבדו בה.
> הדבקה ב-Termux: לחיצה ארוכה על המסך → Paste.
> הפקודות כתובות לפי הסדר. אפשר להדביק כל בלוק בבת אחת.

## 1. התקנה (פעם אחת)
```bash
pkg update -y && pkg upgrade -y
pkg install -y gh openssl
termux-setup-storage
```
`termux-setup-storage` יבקש הרשאה לקבצים. מאשרים. מעכשיו תיקיית ההורדות של הטלפון נגישה בנתיב `~/storage/downloads`.

## 2. התחברות ל-GitHub
```bash
gh auth login
```
בוחרים: `GitHub.com` → `HTTPS` → `Y` → `Login with a web browser`.
יופיע קוד בן 8 תווים. מעתיקים אותו, פותחים בדפדפן את `https://github.com/login/device`, מדביקים ומאשרים.

בדיקה:
```bash
gh auth status
REPO=ronmailx-boop/easypen
```

## 3. מפתח ההעלאה לאפליקציה
**א. סיסמה אקראית.** הפקודה מציגה אותה על המסך. מעתיקים אותה **מיד** למנהל הסיסמאות (Google Password Manager / Bitwarden) תחת השם "EasyPen upload key":
```bash
PASS=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 28); echo "$PASS"
```

**ב. יצירת המפתח** עם `openssl`. ב-Termux על Android 15 ומעלה, `keytool` נכשל עם `ProtoLogNative ... Aborted`. כל פקודה מדביקים לבד:
```bash
export PASS
mkdir -p ~/easypen-key && cd ~/easypen-key
```
```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes -keyout key.pem -out cert.pem -subj "/CN=vplus studio/O=vplus studio/C=IL"
```
```bash
openssl pkcs12 -export -inkey key.pem -in cert.pem -name upload -out upload-keystore.p12 -passout env:PASS
```
```bash
rm key.pem && ls -l upload-keystore.p12
```

**ג. שמירה ב-GitHub כסודות:**
```bash
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD -R $REPO
base64 -w0 upload-keystore.p12 | gh secret set ANDROID_KEYSTORE_BASE64 -R $REPO
gh secret list -R $REPO
```
ברשימה צריכים להופיע `ANDROID_KEYSTORE_BASE64` ו-`ANDROID_KEYSTORE_PASSWORD`.

**ד. טביעת האצבע (ציבורית, לא סוד).** את השורה `sha256 Fingerprint=...` שולחים לי:
```bash
openssl x509 -in cert.pem -noout -fingerprint -sha256
```

**ה. גיבוי.** מעתיקים את המפתח לתיקיית ההורדות, ומשם מעלים אותו ל-Google Drive **הפרטי** (או למנהל הסיסמאות כקובץ מצורף):
```bash
cp upload-keystore.p12 ~/storage/downloads/easypen-upload-keystore.p12
unset PASS
```
אחרי שהגיבוי עלה, מוחקים את הקובץ מההורדות. אם המפתח אובד, Google יכולה לאשר מפתח העלאה חדש, והאפליקציה לא נפגעת.

## 4. בניית האפליקציה והורדה לטלפון
```bash
gh workflow run build-android.yml -R $REPO
sleep 10
RUN=$(gh run list -R $REPO -w build-android.yml -L 1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN -R $REPO --exit-status
gh run download -R $REPO -n easypen-aab -D ~/storage/downloads
```
הקובץ `easypen-1.0.0-1.aab` יופיע בתיקיית ההורדות. משם מעלים אותו ב-Play Console (בדפדפן): Internal testing → Create new release.

## 5. חשבון השירות של Google Play (אחרי שהוא נוצר, ראו `store/README.md` שלב 5)
קובץ ה-JSON שהורד מ-Google Cloud נמצא בתיקיית ההורדות. בודקים מה השם שלו:
```bash
ls ~/storage/downloads/*.json
```
שומרים אותו ב-GitHub (מחליפים את `XXXX.json` בשם האמיתי), ומוחקים אותו מהטלפון:
```bash
gh secret set PLAY_SERVICE_ACCOUNT -R $REPO < ~/storage/downloads/XXXX.json
rm ~/storage/downloads/XXXX.json
gh workflow run deploy-cloudflare.yml -R $REPO
```
ה-workflow "Deploy to Cloudflare" מעתיק את הסוד ל-Worker. לא צריך להיכנס ל-Cloudflare.

## בעיות נפוצות
| הודעה | פתרון |
|---|---|
| `gh: command not found` | `pkg install gh` (וודאו ש-Termux מ-F-Droid) |
| `[200~` בתחילת שורה / `command not found` אחרי הדבקה | לסגור את Termux (התראה → Exit), לפתוח מחדש, להגדיר שוב `REPO`, להדביק פקודה אחת בכל פעם |
| `HTTP 403` ב-`gh secret set` | `gh auth refresh -s repo,workflow` |
| `could not find any workflows named` | הקוד עדיין לא מוזג ל-main |
| `Permission denied` ב-`~/storage` | להריץ שוב `termux-setup-storage` ולאשר |
