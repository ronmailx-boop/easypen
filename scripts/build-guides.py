# Builds the guide pages under guides/ (static HTML for search engines).
# Edit the GUIDES list, then run: python3 scripts/build-guides.py
# New guides also go into sitemap.xml (the e2e test checks it).
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://easypen.vplusstudio.app/'
DATE = '2026-10-15'

GUIDES = [
  dict(slug='sign-pdf-on-phone',
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

HEAD = '''<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <script src="{up}js/analytics.js" defer></script>
  <meta name="theme-color" content="#2f4fc4">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="EasyPen">
  <meta property="og:locale" content="he_IL">
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
  </header>

  <main class="legal-content guide-content">
    <nav class="breadcrumbs" aria-label="מיקום באתר">
{crumbs}
    </nav>
'''

CTA = '''
    <div class="guide-cta">
      <a class="btn btn-primary btn-xl" href="{up}">לחתימה על מסמך</a>
      <p class="muted small">בחינם, בלי הרשמה. הקבצים לא עוזבים את המכשיר.</p>
    </div>
'''

FOOT = '''  </main>

  <footer class="site-footer">
    <nav class="footer-links" aria-label="מידע משפטי">
      <div class="footer-row">
        <a href="{up}guides/">מדריכים</a>
        <span class="footer-dot" aria-hidden="true">·</span>
        <a href="{up}legal.html?doc=privacy">מדיניות פרטיות</a>
        <span class="footer-dot" aria-hidden="true">·</span>
        <a href="{up}legal.html?doc=terms">תנאי שימוש</a>
      </div>
    </nav>
    <p class="footer-copy" dir="ltr">© 2026 vplus studio</p>
  </footer>
</body>
</html>
'''

def crumbs(items, up):
    out = []
    for i, (name, href) in enumerate(items):
        if href is None:
            out.append(f'      <span aria-current="page">{name}</span>')
        else:
            out.append(f'      <a href="{href}">{name}</a>')
        if i < len(items) - 1:
            out.append('      <span class="crumb-sep" aria-hidden="true">‹</span>')
    return '\n'.join(out)

def ld(objs):
    return '\n'.join('  ' + l for l in json.dumps(objs, ensure_ascii=False, indent=2).splitlines())

def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def related(current, up):
    lis = [f'      <li><a href="{up}guides/{g["slug"]}/">{g["short"]}</a></li>' for g in GUIDES if g['slug'] != current]
    return '    <section class="guide-related">\n      <h2>מדריכים נוספים</h2>\n      <ul>\n' + '\n'.join(lis) + '\n      </ul>\n    </section>\n'

# guide pages
for g in GUIDES:
    up = '../../'
    url = f'{SITE}guides/{g["slug"]}/'
    items_ld = [('EasyPen', SITE), ('מדריכים', SITE + 'guides/'), (g['short'], url)]
    data = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": g['title'], "description": g['desc'], "inLanguage": "he",
         "datePublished": DATE, "dateModified": DATE, "mainEntityOfPage": url,
         "image": SITE + "icons/og-image.png",
         "author": {"@type": "Organization", "name": "vplus studio"},
         "publisher": {"@type": "Organization", "name": "vplus studio"}},
        breadcrumb_ld(items_ld)]}
    html = HEAD.format(title=g['title'] + ' | EasyPen', desc=g['desc'], url=url, up=up, ld=ld(data),
                       crumbs=crumbs([('EasyPen', up), ('מדריכים', up + 'guides/'), (g['short'], None)], up))
    html += f'    <article>\n      <h1>{g["title"]}</h1>\n' + g['body'].strip('\n').replace('../../', up) + '\n    </article>\n'
    html += CTA.format(up=up) + related(g['slug'], up) + FOOT.format(up=up)
    d = os.path.join(ROOT, 'guides', g['slug']); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w').write(html)

# index page
up = '../'
url = SITE + 'guides/'
title = 'מדריכים: חתימה על מסמכים מהטלפון'
desc = 'מדריכים קצרים לחתימה על PDF, חוזים וטפסים מהטלפון עם EasyPen: בחינם, בלי הרשמה, והקבצים לא עוזבים את המכשיר.'
data = {"@context": "https://schema.org", "@graph": [
    {"@type": "CollectionPage", "name": title, "description": desc, "inLanguage": "he", "url": url},
    breadcrumb_ld([('EasyPen', SITE), ('מדריכים', url)])]}
cards = '\n'.join(f'''      <li>
        <a href="{g["slug"]}/">
          <strong>{g["short"]}</strong>
          <span class="muted">{g["desc"]}</span>
        </a>
      </li>''' for g in GUIDES)
html = HEAD.format(title=title + ' | EasyPen', desc=desc, url=url, up=up, ld=ld(data),
                   crumbs=crumbs([('EasyPen', up), ('מדריכים', None)], up))
html += f'''    <h1>{title}</h1>
    <p class="lead">איך חותמים על מסמך מהטלפון, ממלאים טופס ושולחים אותו בחזרה, בלי מדפסת ובלי סורק.</p>
    <ul class="guide-list">
{cards}
    </ul>
''' + CTA.format(up=up) + FOOT.format(up=up)
open(os.path.join(ROOT, 'guides', 'index.html'), 'w').write(html)
print('ok')
