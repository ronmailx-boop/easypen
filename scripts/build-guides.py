# Builds the guide pages under guides/ (Hebrew), en/guides/ (English) and ru/guides/ (Russian):
# static HTML for search engines. Edit the GUIDES lists, then run: python3 scripts/build-guides.py
# New guides also go into sitemap.xml (the e2e test checks it).
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://easypen.vplusstudio.app/'
DATE = '2026-10-15'

GUIDES = [
  dict(slug='sign-pdf-on-phone', video=True,
    title='איך לחתום על PDF בטלפון – בחינם ובלי הרשמה',
    short='איך לחתום על PDF בטלפון',
    desc='מדריך קצר: חותמים על קובץ PDF מהטלפון תוך פחות מדקה, בחינם, בלי להתקין אפליקציה ובלי להירשם. הקובץ לא עוזב את המכשיר.',
    body='''
<p class="lead">קיבלתם קובץ PDF שצריך לחתום עליו, ואין מדפסת או סורק בהישג יד? אפשר לחתום עליו ישירות מהטלפון, תוך פחות מדקה. כך עושים את זה עם EasyPen, בחינם ובלי הרשמה.</p>

<h2>מה צריך</h2>
<ul>
  <li>טלפון (אנדרואיד או אייפון) עם דפדפן, למשל כרום או ספארי.</li>
  <li>קובץ ה-PDF שמור בטלפון, או פתוח בוואטסאפ או במייל.</li>
</ul>

<h2>שלב אחר שלב</h2>
<ol class="guide-steps">
  <li><strong>פותחים את EasyPen</strong> בכתובת <a href="../../">easypen.vplusstudio.app</a>. אין צורך להירשם או להתקין.</li>
  <li><strong>לוחצים "העלה מסמך"</strong> ובוחרים את קובץ ה-PDF. אפשר לבחור גם תמונה של מסמך (JPG או PNG), או כמה קבצים שיאוחדו למסמך אחד.</li>
  <li><strong>לוחצים "חתימה"</strong> בתחתית המסך ומציירים את החתימה באצבע בתוך המסגרת. אם מסמנים "שמור לשימוש חוזר", בפעם הבאה החתימה תהיה מוכנה בלחיצה אחת.</li>
  <li><strong>ממקמים את החתימה:</strong> גוררים אותה למקום הנכון, ומשנים את הגודל במשיכת הפינה שלה או בסרגל הגודל.</li>
  <li><strong>צריך למלא פרטים?</strong> "טקסט" מוסיף שם, תאריך או תעודת זהות בכל מקום בעמוד. "ציור" מאפשר לסמן V או לכתוב ביד חופשית.</li>
  <li><strong>לוחצים "שמור ושתף"</strong>, בוחרים שם לקובץ, ושולחים אותו ישר לוואטסאפ, למייל או לכל אפליקציה אחרת.</li>
</ol>

<h2>האם המסמך שלי עולה לאינטרנט?</h2>
<p>לא. כל העבודה נעשית בתוך הדפדפן בטלפון שלכם: המסמך והחתימה לא נשלחים לשום שרת. זה גם הסיבה שאין צורך בחשבון.</p>

<h2>טיפים</h2>
<ul>
  <li>מסמך של כמה עמודים? גוללים לעמוד שבו צריך לחתום לפני שלוחצים "חתימה", והיא תתווסף לעמוד שעל המסך.</li>
  <li>טעיתם? "בטל" בראש המסך מחזיר צעד אחורה, ו"חזור" מחזיר אותו שוב.</li>
  <li>אפשר להתקין את EasyPen כאפליקציה על מסך הבית, והיא תעבוד גם בלי חיבור לאינטרנט.</li>
</ul>
'''),
  dict(slug='sign-document-from-whatsapp',
    title='איך לחתום על מסמך שקיבלתם בוואטסאפ ולשלוח אותו בחזרה',
    short='חתימה על מסמך מוואטסאפ',
    desc='קיבלתם חוזה או טופס בוואטסאפ? כך חותמים עליו מהטלפון ושולחים אותו חתום בחזרה לאותה שיחה, תוך דקה, בחינם.',
    body='''
<p class="lead">הרבה מסמכים מגיעים היום בוואטסאפ: חוזה, הצעת מחיר, טופס הרשמה. במקום להדפיס, לחתום ולסרוק, אפשר לחתום ישר מהטלפון ולשלוח את המסמך החתום בחזרה לאותה שיחה.</p>

<h2>שלב אחר שלב</h2>
<ol class="guide-steps">
  <li><strong>שומרים את הקובץ:</strong> בוואטסאפ פותחים את המסמך. באנדרואיד הוא נשמר בדרך כלל לבד בתיקיית ההורדות או במסמכים. באייפון לוחצים על כפתור השיתוף ובוחרים "שמור בקבצים".</li>
  <li><strong>פותחים את <a href="../../">EasyPen</a></strong> ולוחצים "העלה מסמך". בוחרים את הקובץ ששמרתם.</li>
  <li><strong>חותמים:</strong> לוחצים "חתימה", מציירים באצבע וממקמים את החתימה במקום הנכון.</li>
  <li><strong>שולחים בחזרה:</strong> לוחצים "שמור ושתף", בוחרים וואטסאפ ואת אותה שיחה. המסמך החתום נשלח כקובץ PDF.</li>
</ol>

<h2>קיצור דרך באנדרואיד: שיתוף ישיר מוואטסאפ</h2>
<p>אם מתקינים את EasyPen כאפליקציה (בכרום: "התקנת האפליקציה" במסך הבית של EasyPen, או בתפריט ⋮ ← "הוספה למסך הבית"), היא מופיעה ברשימת השיתוף של הטלפון. אז אפשר בוואטסאפ ללחוץ לחיצה ארוכה על המסמך, לבחור "שיתוף" ואז EasyPen, והמסמך נפתח ישר לחתימה, בלי לחפש אותו בקבצים.</p>
<p>באייפון האפשרות הזו לא קיימת כרגע, ולכן שומרים את הקובץ ופותחים אותו מ-EasyPen כמו בשלבים למעלה.</p>

<h2>קיבלתם תמונה של מסמך ולא PDF?</h2>
<p>גם זה עובד: EasyPen מקבלת תמונות JPG ו-PNG, וגם כמה תמונות יחד, שיאוחדו למסמך PDF אחד לפי הסדר. אחרי החתימה נשלח קובץ PDF מסודר.</p>

<h2>פרטיות</h2>
<p>המסמך לא עולה לשום שרת: הפתיחה, החתימה ויצירת הקובץ החתום נעשות כולן בטלפון שלכם.</p>
'''),
  dict(slug='sign-rental-contract',
    title='איך לחתום על חוזה שכירות מהנייד',
    short='חתימה על חוזה שכירות מהנייד',
    desc='חותמים על חוזה שכירות מהטלפון: חתימה על כל עמוד, מילוי שם, תעודת זהות ותאריך, ושליחה לבעל הדירה או לשוכר. בחינם ובלי הרשמה.',
    body='''
<p class="lead">חוזה שכירות הוא בדרך כלל מסמך של כמה עמודים, ולפעמים צריך לחתום על כל עמוד ולמלא פרטים אישיים. כך עושים את זה מהטלפון עם EasyPen, בלי מדפסת ובלי סורק.</p>

<h2>שלב אחר שלב</h2>
<ol class="guide-steps">
  <li><strong>פותחים את החוזה ב-<a href="../../">EasyPen</a>:</strong> "העלה מסמך" ובוחרים את קובץ ה-PDF של החוזה.</li>
  <li><strong>שומרים חתימה לשימוש חוזר:</strong> בפעם הראשונה שלוחצים "חתימה" מסמנים "שמור לשימוש חוזר". מעכשיו כל חתימה נוספת היא לחיצה אחת.</li>
  <li><strong>חותמים על כל עמוד:</strong> גוללים לעמוד, לוחצים "חתימה" ובוחרים את החתימה השמורה. היא נוספת לעמוד שעל המסך, ואז גוררים אותה למקום.</li>
  <li><strong>ממלאים פרטים:</strong> "טקסט" ואז נגיעה במקום שבו צריך לכתוב: שם מלא, מספר תעודת זהות, כתובת ותאריך. אפשר להגדיל או להקטין את הכתב.</li>
  <li><strong>מסמנים סעיפים:</strong> אם צריך לסמן V או להקיף סעיף, "ציור" מאפשר לכתוב ביד חופשית.</li>
  <li><strong>שולחים:</strong> "שמור ושתף", ושולחים לבעל הדירה, לשוכר או למתווך בוואטסאפ או במייל.</li>
</ol>

<h2>צריך לצרף מסמכים נוספים?</h2>
<p>אפשר להוסיף לחוזה קבצים ותמונות, למשל צילום תעודת זהות או נספח, כדי לשלוח הכול כקובץ PDF אחד. גוללים לסוף המסמך ולוחצים על "הוספת קבצים או תמונות", ואפשר לשנות את סדר העמודים.</p>

<h2>האם חתימה כזו תקפה?</h2>
<p>חתימה שמוסיפים למסמך מהטלפון היא חתימה אלקטרונית, ובמקרים רבים, כמו חוזה בין שני צדדים פרטיים שמסכימים לחתום כך, היא מקובלת. עם זאת, יש גופים ומסמכים שדורשים חתימה אלקטרונית מאושרת או חתימה על נייר. אם יש ספק, כדאי לברר מראש עם הצד השני או עם עורך דין. המדריך הזה אינו ייעוץ משפטי.</p>

<h2>פרטיות</h2>
<p>חוזה שכירות כולל פרטים אישיים. ב-EasyPen המסמך לא עולה לשום שרת: הכול נעשה בטלפון שלכם, והקובץ החתום נשלח רק למי שאתם בוחרים.</p>
'''),
  dict(slug='sign-school-form',
    title='איך לחתום על טופס אישור לבית ספר או לגן מהטלפון',
    short='חתימה על טופס לבית הספר או לגן',
    desc='טופס אישור לטיול, הצהרת בריאות או טופס הרשמה מבית הספר או מהגן? כך ממלאים וחותמים מהטלפון ושולחים בחזרה, בלי להדפיס.',
    body='''
<p class="lead">טופס אישור לטיול, הצהרת בריאות, טופס הרשמה לחוג: הם מגיעים מבית הספר או מהגן בקבוצת הוואטסאפ, ובדרך כלל צריך להחזיר אותם עוד באותו יום. אין צורך להדפיס: ממלאים וחותמים מהטלפון.</p>

<h2>שלב אחר שלב</h2>
<ol class="guide-steps">
  <li><strong>שומרים את הטופס</strong> מהוואטסאפ או מהמייל לטלפון. אם קיבלתם צילום של טופס, גם זה עובד.</li>
  <li><strong>פותחים את <a href="../../">EasyPen</a></strong>, לוחצים "העלה מסמך" ובוחרים את הטופס.</li>
  <li><strong>ממלאים את הפרטים:</strong> "טקסט" ואז נגיעה בשדה: שם הילד, הכיתה, מספר טלפון ותאריך.</li>
  <li><strong>מסמנים תשובות:</strong> "ציור" מאפשר לסמן V בתיבות "מאשר/ת" או "לא מאשר/ת".</li>
  <li><strong>חותמים:</strong> "חתימה", מציירים באצבע וממקמים במקום של חתימת ההורה.</li>
  <li><strong>מחזירים:</strong> "שמור ושתף", ושולחים למורה, לגננת או למזכירות.</li>
</ol>

<h2>טיפ להורים</h2>
<p>שמרו את החתימה עם "שמור לשימוש חוזר". בפעם הבאה שיגיע טופס, החתימה מוכנה בלחיצה אחת. אפשר לשמור עד שלוש חתימות, למשל של שני ההורים.</p>

<h2>פרטיות</h2>
<p>טפסים כאלה כוללים פרטים על ילדים, ולכן חשוב לדעת: ב-EasyPen הטופס לא עולה לשום שרת. הכול נעשה בטלפון שלכם, והקובץ נשלח רק למי שאתם בוחרים.</p>
'''),
]

EN_GUIDES = [
  dict(slug='sign-pdf-on-phone', video=True,
    title='How to sign a PDF on your phone – free, no sign-up',
    short='Sign a PDF on your phone',
    desc='A quick guide: sign a PDF on your phone in under a minute, free, with no app to install and no account. The file never leaves your device.',
    body='''
<p class="lead">Got a PDF you need to sign, and no printer or scanner nearby? You can sign it right on your phone in under a minute. Here is how to do it with EasyPen – free, with no sign-up.</p>

<h2>What you need</h2>
<ul>
  <li>A phone (Android or iPhone) with a browser, such as Chrome or Safari.</li>
  <li>The PDF saved on your phone, or open in WhatsApp or your email.</li>
</ul>

<h2>Step by step</h2>
<ol class="guide-steps">
  <li><strong>Open EasyPen</strong> at <a href="../../../">easypen.vplusstudio.app</a>. No account and nothing to install. The app is in English when your phone is set to English.</li>
  <li><strong>Tap "Upload document"</strong> and choose the PDF. You can also pick a photo of a document (JPG or PNG), or several files to combine into one document.</li>
  <li><strong>Tap "Signature"</strong> at the bottom of the screen and draw your signature with your finger inside the frame. Tick "Save for reuse" and next time your signature is one tap away.</li>
  <li><strong>Place the signature:</strong> drag it into position, and resize it by pulling its corner or with the size slider.</li>
  <li><strong>Need to fill in details?</strong> "Text" adds your name, a date or an ID number anywhere on the page. "Draw" lets you tick a box or write freehand.</li>
  <li><strong>Tap "Save &amp; Share"</strong>, choose a file name, and send it straight to WhatsApp, email or any other app.</li>
</ol>

<h2>Is my document uploaded anywhere?</h2>
<p>No. Everything happens inside the browser on your phone: the document and your signature are never sent to any server. That is also why no account is needed.</p>

<h2>Tips</h2>
<ul>
  <li>Several pages? Scroll to the page you need to sign before tapping "Signature" – it is added to the page on screen.</li>
  <li>Made a mistake? "Undo" at the top goes back a step, and "Redo" brings it back.</li>
  <li>You can install EasyPen on your home screen like an app, and it works offline too.</li>
</ul>
'''),
  dict(slug='sign-document-from-whatsapp',
    title='How to sign a document you got on WhatsApp and send it back',
    short='Sign a document from WhatsApp',
    desc='Got a contract or a form on WhatsApp? Sign it on your phone and send it back to the same chat in about a minute, for free.',
    body='''
<p class="lead">Many documents arrive on WhatsApp these days: a contract, a quote, a registration form. Instead of printing, signing and scanning, sign it on your phone and send the signed copy back to the same chat.</p>

<h2>Step by step</h2>
<ol class="guide-steps">
  <li><strong>Save the file:</strong> open the document in WhatsApp. On Android it is usually saved to Downloads or Documents automatically. On iPhone, tap the share button and choose "Save to Files".</li>
  <li><strong>Open <a href="../../../">EasyPen</a></strong> and tap "Upload document". Choose the file you saved.</li>
  <li><strong>Sign:</strong> tap "Signature", draw it with your finger and place it in the right spot.</li>
  <li><strong>Send it back:</strong> tap "Save &amp; Share", choose WhatsApp and the same chat. The signed document is sent as a PDF.</li>
</ol>

<h2>Android shortcut: share straight from WhatsApp</h2>
<p>If you install EasyPen as an app (in Chrome: "Install app" on the EasyPen home screen, or the ⋮ menu → "Add to Home screen"), it appears in your phone's share menu. Then in WhatsApp you can long-press the document, tap "Share", pick EasyPen, and the document opens ready to sign – no searching through your files.</p>
<p>On iPhone this option isn't available at the moment, so save the file and open it from EasyPen as in the steps above.</p>

<h2>Got a photo of a document instead of a PDF?</h2>
<p>That works too: EasyPen accepts JPG and PNG photos, including several at once, which are combined into one PDF in order. After signing you send a tidy PDF.</p>

<h2>Privacy</h2>
<p>The document is never uploaded: opening, signing and creating the signed file all happen on your phone.</p>
'''),
  dict(slug='sign-rental-contract',
    title='How to sign a lease or rental agreement on your phone',
    short='Sign a rental agreement on your phone',
    desc='Sign a lease on your phone: a signature on every page, your name, ID number and date filled in, and sent to the landlord or tenant. Free, no sign-up.',
    body='''
<p class="lead">A lease is usually several pages long, and you may need to sign every page and fill in personal details. Here is how to do it on your phone with EasyPen – no printer, no scanner.</p>

<h2>Step by step</h2>
<ol class="guide-steps">
  <li><strong>Open the lease in <a href="../../../">EasyPen</a>:</strong> tap "Upload document" and choose the PDF.</li>
  <li><strong>Save your signature for reuse:</strong> the first time you tap "Signature", tick "Save for reuse". Every signature after that is a single tap.</li>
  <li><strong>Sign every page:</strong> scroll to a page, tap "Signature" and pick your saved signature. It is added to the page on screen – drag it into place.</li>
  <li><strong>Fill in your details:</strong> tap "Text", then the spot where you need to write: full name, ID or passport number, address and date. You can make the text larger or smaller.</li>
  <li><strong>Mark clauses:</strong> to tick a box or circle a clause, "Draw" lets you write freehand.</li>
  <li><strong>Send it:</strong> "Save &amp; Share", then send it to the landlord, tenant or agent on WhatsApp or by email.</li>
</ol>

<h2>Need to attach other documents?</h2>
<p>You can add files and photos to the lease – a copy of your ID or an annex, for example – and send everything as one PDF. Scroll to the end of the document and tap "Add files or photos"; you can also change the page order.</p>

<h2>Is a signature like this valid?</h2>
<p>A signature you add to a document on your phone is an electronic signature. In many countries it is commonly accepted for agreements between private parties who agree to sign this way. However, some organisations and documents require a certified (qualified) electronic signature or a signature on paper, and the rules differ from country to country. If in doubt, check with the other party or a lawyer before signing. This guide is not legal advice.</p>

<h2>Privacy</h2>
<p>A lease contains personal details. With EasyPen the document is never uploaded: everything happens on your phone, and the signed file goes only to the people you choose.</p>
'''),
  dict(slug='sign-school-form',
    title='How to sign a school permission slip or form on your phone',
    short='Sign a school form on your phone',
    desc='Permission slip for a trip, health form or registration form from school or kindergarten? Fill it in and sign it on your phone and send it back – no printing.',
    body='''
<p class="lead">A permission slip for a trip, a health form, a club registration form: they arrive from school in the parents' group chat or by email, and often have to go back the same day. No need to print – fill them in and sign them on your phone.</p>

<h2>Step by step</h2>
<ol class="guide-steps">
  <li><strong>Save the form</strong> from WhatsApp or your email to your phone. A photo of a paper form works too.</li>
  <li><strong>Open <a href="../../../">EasyPen</a></strong>, tap "Upload document" and choose the form.</li>
  <li><strong>Fill in the details:</strong> tap "Text", then the field: your child's name, class, phone number and date.</li>
  <li><strong>Tick the answers:</strong> "Draw" lets you tick the "I agree" or "I don't agree" boxes.</li>
  <li><strong>Sign:</strong> tap "Signature", draw it with your finger and place it where the parent signs.</li>
  <li><strong>Send it back:</strong> "Save &amp; Share", and send it to the teacher or the school office.</li>
</ol>

<h2>A tip for parents</h2>
<p>Save your signature with "Save for reuse". Next time a form arrives, your signature is ready in one tap. You can save up to three signatures – for both parents, for example.</p>

<h2>Privacy</h2>
<p>Forms like these contain details about children, so it matters: with EasyPen the form is never uploaded. Everything happens on your phone, and the file goes only to the people you choose.</p>
'''),
]

RU_GUIDES = [
  dict(slug='sign-pdf-on-phone', video=True,
    title='Как подписать PDF на телефоне – бесплатно и без регистрации',
    short='Как подписать PDF на телефоне',
    desc='Короткая инструкция: подпишите PDF на телефоне меньше чем за минуту, бесплатно, без установки приложения и без регистрации. Файл не покидает устройство.',
    body='''
<p class="lead">Нужно подписать PDF, а принтера и сканера под рукой нет? Подпишите его прямо на телефоне меньше чем за минуту. Вот как это сделать с EasyPen – бесплатно и без регистрации.</p>

<h2>Что понадобится</h2>
<ul>
  <li>Телефон (Android или iPhone) с браузером, например Chrome или Safari.</li>
  <li>PDF-файл, сохранённый на телефоне или открытый в WhatsApp, Telegram или почте.</li>
</ul>

<h2>Пошагово</h2>
<ol class="guide-steps">
  <li><strong>Откройте EasyPen</strong> по адресу <a href="../../../">easypen.vplusstudio.app</a>. Регистрироваться и что-то устанавливать не нужно. Если язык телефона русский, приложение откроется на русском.</li>
  <li><strong>Нажмите «Загрузить документ»</strong> и выберите PDF. Можно выбрать и фото документа (JPG или PNG) или несколько файлов – они объединятся в один документ.</li>
  <li><strong>Нажмите «Подпись»</strong> внизу экрана и нарисуйте подпись пальцем внутри рамки. Отметьте «Сохранить для повторного использования» – в следующий раз подпись будет готова одним нажатием.</li>
  <li><strong>Расположите подпись:</strong> перетащите её на нужное место и измените размер, потянув за угол или с помощью ползунка.</li>
  <li><strong>Нужно заполнить данные?</strong> «Текст» добавляет имя, дату или номер документа в любое место страницы. «Рисунок» позволяет поставить галочку или написать от руки.</li>
  <li><strong>Нажмите «Сохранить»</strong>, выберите имя файла и отправьте его в WhatsApp, Telegram, по почте или в любое другое приложение.</li>
</ol>

<h2>Мой документ загружается в интернет?</h2>
<p>Нет. Всё происходит в браузере на вашем телефоне: документ и подпись не отправляются ни на какой сервер. Поэтому и учётная запись не нужна.</p>

<h2>Советы</h2>
<ul>
  <li>Несколько страниц? Прокрутите до нужной страницы, прежде чем нажать «Подпись», – подпись добавится на страницу, которая на экране.</li>
  <li>Ошиблись? «Отменить» вверху экрана возвращает на шаг назад, а «Вернуть» – обратно.</li>
  <li>EasyPen можно установить на главный экран как приложение, и он будет работать даже без интернета.</li>
</ul>
'''),
  dict(slug='sign-document-from-whatsapp',
    title='Как подписать документ из WhatsApp и отправить его обратно',
    short='Подпись документа из WhatsApp',
    desc='Получили договор или заявление в WhatsApp? Подпишите его на телефоне и отправьте обратно в тот же чат примерно за минуту, бесплатно.',
    body='''
<p class="lead">Сегодня многие документы приходят в мессенджерах: договор, коммерческое предложение, заявление. Вместо того чтобы печатать, подписывать и сканировать, подпишите документ на телефоне и отправьте подписанную копию обратно в тот же чат. Так же это работает и с Telegram.</p>

<h2>Пошагово</h2>
<ol class="guide-steps">
  <li><strong>Сохраните файл:</strong> откройте документ в WhatsApp. На Android он обычно сам сохраняется в «Загрузки» или «Документы». На iPhone нажмите кнопку «Поделиться» и выберите «Сохранить в Файлы».</li>
  <li><strong>Откройте <a href="../../../">EasyPen</a></strong> и нажмите «Загрузить документ». Выберите сохранённый файл.</li>
  <li><strong>Подпишите:</strong> нажмите «Подпись», нарисуйте её пальцем и поставьте в нужное место.</li>
  <li><strong>Отправьте обратно:</strong> нажмите «Сохранить», выберите WhatsApp и тот же чат. Подписанный документ уйдёт в формате PDF.</li>
</ol>

<h2>Быстрый способ на Android: поделиться прямо из WhatsApp</h2>
<p>Если установить EasyPen как приложение (в Chrome: «Установить приложение» на главном экране EasyPen или меню ⋮ → «Добавить на главный экран»), он появится в меню «Поделиться» телефона. Тогда в WhatsApp можно долго нажать на документ, выбрать «Поделиться», затем EasyPen – и документ сразу откроется для подписи, без поиска в файлах.</p>
<p>На iPhone такой возможности пока нет, поэтому сохраните файл и откройте его в EasyPen, как описано выше.</p>

<h2>Прислали фото документа, а не PDF?</h2>
<p>Это тоже работает: EasyPen принимает фото JPG и PNG, в том числе несколько сразу, и объединяет их по порядку в один PDF. После подписи вы отправляете аккуратный PDF-файл.</p>

<h2>Конфиденциальность</h2>
<p>Документ никуда не загружается: открытие, подпись и создание подписанного файла происходят на вашем телефоне.</p>
'''),
  dict(slug='sign-rental-contract',
    title='Как подписать договор аренды на телефоне',
    short='Подпись договора аренды на телефоне',
    desc='Подпишите договор аренды на телефоне: подпись на каждой странице, ФИО, паспортные данные и дата – и отправка арендодателю или арендатору. Бесплатно и без регистрации.',
    body='''
<p class="lead">Договор аренды обычно занимает несколько страниц, и иногда нужно подписать каждую страницу и заполнить личные данные. Вот как сделать это на телефоне с EasyPen – без принтера и без сканера.</p>

<h2>Пошагово</h2>
<ol class="guide-steps">
  <li><strong>Откройте договор в <a href="../../../">EasyPen</a>:</strong> нажмите «Загрузить документ» и выберите PDF.</li>
  <li><strong>Сохраните подпись:</strong> когда в первый раз нажмёте «Подпись», отметьте «Сохранить для повторного использования». Дальше каждая подпись – одно нажатие.</li>
  <li><strong>Подпишите каждую страницу:</strong> прокрутите до страницы, нажмите «Подпись» и выберите сохранённую подпись. Она добавится на страницу на экране – перетащите её на место.</li>
  <li><strong>Заполните данные:</strong> нажмите «Текст», затем место, где нужно написать: ФИО, паспортные данные, адрес и дату. Размер текста можно увеличить или уменьшить.</li>
  <li><strong>Отметьте пункты:</strong> чтобы поставить галочку или обвести пункт, «Рисунок» позволяет писать от руки.</li>
  <li><strong>Отправьте:</strong> нажмите «Сохранить» и отправьте договор арендодателю, арендатору или риелтору в мессенджере или по почте.</li>
</ol>

<h2>Нужно приложить другие документы?</h2>
<p>К договору можно добавить файлы и фото – например, копию паспорта или приложение – и отправить всё одним PDF. Прокрутите до конца документа и нажмите «Добавить файлы или фото»; порядок страниц тоже можно изменить.</p>

<h2>Действительна ли такая подпись?</h2>
<p>Подпись, добавленная в документ на телефоне, – это простая электронная подпись. Во многих странах её принимают в договорах между частными лицами, которые согласились подписывать так. Однако некоторые организации и документы требуют квалифицированной электронной подписи или подписи на бумаге, и правила различаются от страны к стране. Если сомневаетесь, уточните заранее у другой стороны или у юриста. Эта инструкция не является юридической консультацией.</p>

<h2>Конфиденциальность</h2>
<p>В договоре аренды есть личные данные. В EasyPen документ никуда не загружается: всё происходит на вашем телефоне, а подписанный файл получают только те, кого вы выберете.</p>
'''),
  dict(slug='sign-school-form',
    title='Как подписать согласие для школы или детского сада на телефоне',
    short='Подпись документов для школы и садика',
    desc='Согласие на экскурсию, медицинская анкета или заявление из школы или детского сада? Заполните и подпишите на телефоне и отправьте обратно – без печати.',
    body='''
<p class="lead">Согласие на экскурсию, медицинская анкета, заявление в кружок: такие документы приходят из школы или детского сада в родительский чат или на почту, и часто их нужно вернуть в тот же день. Печатать не нужно – заполните и подпишите их на телефоне.</p>

<h2>Пошагово</h2>
<ol class="guide-steps">
  <li><strong>Сохраните документ</strong> из мессенджера или почты на телефон. Фото бумажного бланка тоже подойдёт.</li>
  <li><strong>Откройте <a href="../../../">EasyPen</a></strong>, нажмите «Загрузить документ» и выберите файл.</li>
  <li><strong>Заполните данные:</strong> нажмите «Текст», затем поле: имя ребёнка, класс или группу, номер телефона и дату.</li>
  <li><strong>Отметьте ответы:</strong> «Рисунок» позволяет поставить галочку в поле «Согласен» или «Не согласен».</li>
  <li><strong>Подпишите:</strong> нажмите «Подпись», нарисуйте её пальцем и поставьте там, где расписывается родитель.</li>
  <li><strong>Отправьте обратно:</strong> нажмите «Сохранить» и отправьте документ учителю, воспитателю или в канцелярию.</li>
</ol>

<h2>Совет для родителей</h2>
<p>Сохраните подпись с помощью «Сохранить для повторного использования». Когда придёт следующий документ, подпись будет готова одним нажатием. Можно сохранить до трёх подписей – например, для обоих родителей.</p>

<h2>Конфиденциальность</h2>
<p>В таких документах есть данные о детях, поэтому это важно: в EasyPen документ никуда не загружается. Всё происходит на вашем телефоне, а файл получают только те, кого вы выберете.</p>
'''),
]

T = {
  'he': dict(dir='rtl', locale='he_IL', guides='מדריכים', more='מדריכים נוספים', crumbs_label='מיקום באתר',
             cta='לחתימה על מסמך', cta_note='בחינם, בלי הרשמה. הקבצים לא עוזבים את המכשיר.',
             privacy='מדיניות פרטיות', terms='תנאי שימוש', footer_label='מידע משפטי',
             name='עברית', sep='‹',
             index_title='מדריכים: חתימה על מסמכים מהטלפון',
             index_desc='מדריכים קצרים לחתימה על PDF, חוזים וטפסים מהטלפון עם EasyPen: בחינם, בלי הרשמה, והקבצים לא עוזבים את המכשיר.',
             index_lead='איך חותמים על מסמך מהטלפון, ממלאים טופס ושולחים אותו בחזרה, בלי מדפסת ובלי סורק.'),
  'en': dict(dir='ltr', locale='en_US', guides='Guides', more='More guides', crumbs_label='Breadcrumb',
             cta='Sign a document', cta_note='Free, no sign-up. Your files never leave your device.',
             privacy='Privacy Policy', terms='Terms of Use', footer_label='Legal',
             name='English', sep='›',
             index_title='Guides: signing documents on your phone',
             index_desc='Short guides to signing PDFs, contracts and forms on your phone with EasyPen: free, no sign-up, and your files never leave your device.',
             index_lead='How to sign a document on your phone, fill in a form and send it back – without a printer or a scanner.'),
  'ru': dict(dir='ltr', locale='ru_RU', guides='Инструкции', more='Другие инструкции', crumbs_label='Навигация',
             cta='Подписать документ', cta_note='Бесплатно, без регистрации. Файлы не покидают устройство.',
             privacy='Конфиденциальность', terms='Условия использования', footer_label='Правовая информация',
             name='Русский', sep='›',
             index_title='Инструкции: как подписывать документы на телефоне',
             index_desc='Короткие инструкции по подписи PDF, договоров и заявлений на телефоне с EasyPen: бесплатно, без регистрации, файлы не покидают устройство.',
             index_lead='Как подписать документ на телефоне, заполнить бланк и отправить его обратно – без принтера и без сканера.'),
}
# The 30-second demo in each language (scripts/make-promo-video.js)
VIDEO = {
  'he': dict(file='media/easypen-promo-he', name='EasyPen בפעולה: חתימה על מסמך מהטלפון ב-30 שניות',
             desc='סרטון קצר: מעלים מסמך, חותמים באצבע, ממלאים שם, מסמנים V ושולחים – הכול מהטלפון עם EasyPen.'),
  'en': dict(file='media/easypen-promo-en', name='EasyPen in action: signing a document on your phone in 30 seconds',
             desc='A short video: upload a document, sign with your finger, fill in your name, tick a box and send it – all on your phone with EasyPen.'),
  'ru': dict(file='media/easypen-promo-ru', name='EasyPen в действии: подпись документа на телефоне за 30 секунд',
             desc='Короткое видео: загрузите документ, подпишите пальцем, впишите имя, поставьте галочку и отправьте – всё на телефоне с EasyPen.'),
}

def video_html(lang, up):
    v = VIDEO[lang]
    return f'''    <figure class="guide-video">
      <video controls muted playsinline preload="none" width="540" height="960" poster="{up}{v["file"]}.jpg">
        <source src="{up}{v["file"]}.mp4" type="video/mp4">
      </video>
      <figcaption class="muted small">{v["name"]}</figcaption>
    </figure>
'''

def video_ld(lang, page_url):
    v = VIDEO[lang]
    return {"@type": "VideoObject", "name": v['name'], "description": v['desc'], "inLanguage": lang,
            "thumbnailUrl": SITE + v['file'] + '.jpg', "contentUrl": SITE + v['file'] + '.mp4',
            "uploadDate": "2026-10-16", "duration": "PT30S", "embedUrl": page_url}

SETS = {'he': GUIDES, 'en': EN_GUIDES, 'ru': RU_GUIDES}
PREFIX = {'he': 'guides/', 'en': 'en/guides/', 'ru': 'ru/guides/'}

HEAD = '''<!DOCTYPE html>
<html lang="{lang}" dir="{dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <!-- The same page in every language (search engines show each reader theirs) -->
{alternates}
  <script src="{up}js/analytics.js" defer></script>
  <meta name="theme-color" content="#2f4fc4">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="EasyPen">
  <meta property="og:locale" content="{locale}">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://easypen.vplusstudio.app/icons/og-image.png">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="{up}icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="{up}icons/icon-192.png">
  <link rel="stylesheet" href="{up}css/style.css">
  <script type="application/ld+json">
{ld}
  </script>
</head>
<body class="legal guide">
  <header class="app-header">
    <a href="{up}" class="brand brand-link">
      <img src="{up}icons/icon.svg" alt="" width="28" height="28">
      <span>EasyPen</span>
    </a>
    <div class="lang-switch">
{switch}
    </div>
  </header>

  <main class="legal-content guide-content">
    <nav class="breadcrumbs" aria-label="{crumbs_label}">
{crumbs}
    </nav>
'''

CTA = '''
    <div class="guide-cta">
      <a class="btn btn-primary btn-xl" href="{up}">{cta}</a>
      <p class="muted small">{cta_note}</p>
    </div>
'''

FOOT = '''  </main>

  <footer class="site-footer">
    <nav class="footer-links" aria-label="{footer_label}">
      <div class="footer-row">
        <a href="{up}{prefix}">{guides}</a>
        <span class="footer-dot" aria-hidden="true">·</span>
        <a href="{up}legal.html?doc=privacy">{privacy}</a>
        <span class="footer-dot" aria-hidden="true">·</span>
        <a href="{up}legal.html?doc=terms">{terms}</a>
      </div>
    </nav>
    <p class="footer-copy" dir="ltr">© 2026 vplus studio</p>
  </footer>
</body>
</html>
'''

def crumbs(items, sep):
    out = []
    for i, (name, href) in enumerate(items):
        out.append(f'      <span aria-current="page">{name}</span>' if href is None else f'      <a href="{href}">{name}</a>')
        if i < len(items) - 1:
            out.append(f'      <span class="crumb-sep" aria-hidden="true">{sep}</span>')
    return '\n'.join(out)

def ld(objs):
    return '\n'.join('  ' + l for l in json.dumps(objs, ensure_ascii=False, indent=2).splitlines())

def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def alternates(path):
    # path: the page's address under each language's guides/ ('' for the index)
    links = [f'  <link rel="alternate" hreflang="{l}" href="{SITE}{PREFIX[l]}{path}">' for l in PREFIX]
    links.append(f'  <link rel="alternate" hreflang="x-default" href="{SITE}{PREFIX["he"]}{path}">')
    return '\n'.join(links)

def switch(lang, up, path):
    return '\n'.join(f'      <a class="btn btn-ghost btn-sm" href="{up}{PREFIX[l]}{path}" hreflang="{l}" lang="{l}">{T[l]["name"]}</a>'
                     for l in PREFIX if l != lang)

def write(rel_dir, html):
    d = os.path.join(ROOT, rel_dir); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w').write(html)

for lang, guides in SETS.items():
    t = T[lang]
    prefix = PREFIX[lang]
    base_up = '../' * prefix.count('/')          # from guides/ (or en/guides/, ru/guides/) to the site root
    for g in guides:
        up = base_up + '../'
        url = SITE + prefix + g['slug'] + '/'
        items_ld = [('EasyPen', SITE), (t['guides'], SITE + prefix), (g['short'], url)]
        data = {"@context": "https://schema.org", "@graph": [
            {"@type": "Article", "headline": g['title'], "description": g['desc'], "inLanguage": lang,
             "datePublished": DATE, "dateModified": DATE, "mainEntityOfPage": url,
             "image": SITE + "icons/og-image.png",
             "author": {"@type": "Organization", "name": "vplus studio"},
             "publisher": {"@type": "Organization", "name": "vplus studio"}},
            breadcrumb_ld(items_ld)]}
        with_video = g.get('video') and lang in VIDEO
        if with_video:
            data['@graph'].append(video_ld(lang, url))
        html = HEAD.format(lang=lang, dir=t['dir'], title=g['title'] + ' | EasyPen', desc=g['desc'], url=url,
                           alternates=alternates(g['slug'] + '/'), switch=switch(lang, up, g['slug'] + '/'),
                           up=up, og_type='article', locale=t['locale'], ld=ld(data),
                           crumbs_label=t['crumbs_label'],
                           crumbs=crumbs([('EasyPen', up), (t['guides'], up + prefix), (g['short'], None)], t['sep']))
        body = g['body'].strip('\n').replace('href="../../../"', f'href="{up}"').replace('href="../../"', f'href="{up}"')
        if with_video:
            # Right after the opening paragraph
            lead_end = body.index('</p>') + len('</p>')
            body = body[:lead_end] + '\n\n' + video_html(lang, up).rstrip('\n') + body[lead_end:]
        html += f'    <article>\n      <h1>{g["title"]}</h1>\n' + body + '\n    </article>\n'
        html += CTA.format(up=up, **t)
        lis = [f'      <li><a href="{up}{prefix}{o["slug"]}/">{o["short"]}</a></li>' for o in guides if o['slug'] != g['slug']]
        html += f'    <section class="guide-related">\n      <h2>{t["more"]}</h2>\n      <ul>\n' + '\n'.join(lis) + '\n      </ul>\n    </section>\n'
        html += FOOT.format(up=up, prefix=prefix, **t)
        write(prefix + g['slug'], html)

    # index
    up = base_up
    url = SITE + prefix
    data = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": t['index_title'], "description": t['index_desc'], "inLanguage": lang, "url": url},
        breadcrumb_ld([('EasyPen', SITE), (t['guides'], url)])]}
    if lang in VIDEO:
        data['@graph'].append(video_ld(lang, url))
    cards = '\n'.join(f'''      <li>
        <a href="{g["slug"]}/">
          <strong>{g["short"]}</strong>
          <span class="muted">{g["desc"]}</span>
        </a>
      </li>''' for g in guides)
    html = HEAD.format(lang=lang, dir=t['dir'], title=t['index_title'] + ' | EasyPen', desc=t['index_desc'], url=url,
                       alternates=alternates(''), switch=switch(lang, up, ''), up=up,
                       og_type='website', locale=t['locale'], ld=ld(data), crumbs_label=t['crumbs_label'],
                       crumbs=crumbs([('EasyPen', up), (t['guides'], None)], t['sep']))
    html += f'''    <h1>{t["index_title"]}</h1>
    <p class="lead">{t["index_lead"]}</p>
{video_html(lang, up) if lang in VIDEO else ''}    <ul class="guide-list">
{cards}
    </ul>
''' + CTA.format(up=up, **t) + FOOT.format(up=up, prefix=prefix, **t)
    write(prefix, html)
print('ok')
