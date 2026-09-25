/*
 * EasyPen - legal documents page.
 * Renders docs/legal/*.md (the single source of truth) as HTML.
 * A tiny Markdown subset: headings, paragraphs, lists, tables, bold, code,
 * links, rules. All text is HTML-escaped before any formatting is applied.
 */
(function () {
  'use strict';

  const DOCS = {
    privacy: 'privacy-policy.md',
    terms: 'terms-of-service.md',
    cookies: 'cookie-policy.md',
    accessibility: 'accessibility-statement.md'
  };
  // Links between the documents point at the .md files; map them back to this page
  const FILE_TO_KEY = Object.fromEntries(Object.entries(DOCS).map(([k, f]) => [f, k]));

  const content = document.getElementById('legal-content');
  const nav = document.getElementById('legal-nav');

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function safeHref(url) {
    const file = url.split('/').pop();
    if (FILE_TO_KEY[file]) return `legal.html?doc=${FILE_TO_KEY[file]}`;
    if (/^(https:|mailto:|tel:)/i.test(url)) return url;
    return null;
  }

  // Inline formatting on already-escaped text
  function inline(escaped) {
    return escaped
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
        const href = safeHref(url.replace(/&amp;/g, '&'));
        return href ? `<a href="${escapeHtml(href)}">${text}</a>` : text;
      })
      // Details the site owner still has to fill in
      .replace(/\[([A-Z][A-Z0-9_]+)\]/g, '<mark class="placeholder">[$1]</mark>');
  }

  function renderMarkdown(md) {
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(escapeHtml(c.trim())));

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1].length;
        out.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`);
        i++;
        continue;
      }

      if (/^\s*(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = cells(line);
        // Plain header text, repeated on each cell for the stacked mobile layout
        const labels = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => escapeHtml(c.trim().replace(/\*\*/g, '')));
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
        out.push('<div class="table-wrap"><table><thead><tr>' +
          head.map((c) => `<th scope="col">${c}</th>`).join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + r.map((c, j) => `<td data-label="${labels[j] || ''}">${c}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      const list = /^\s*([-*]|\d+\.)\s+/;
      if (list.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && list.test(lines[i])) {
          items.push(`<li>${inline(escapeHtml(lines[i].replace(list, '')))}</li>`);
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${items.join('')}</${tag}>`);
        continue;
      }

      // Paragraph: consecutive plain lines
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) &&
             !list.test(lines[i]) && !isTableRow(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`);
    }
    return out.join('\n');
  }

  async function show() {
    const key = new URLSearchParams(location.search).get('doc');
    const file = DOCS[key] || DOCS.privacy;
    const current = DOCS[key] ? key : 'privacy';
    nav.querySelectorAll('a').forEach((a) => {
      if (a.dataset.doc === current) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    try {
      const res = await fetch(`docs/legal/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      content.innerHTML = renderMarkdown(await res.text());
      const h1 = content.querySelector('h1');
      if (h1) document.title = `${h1.textContent} - EasyPen`;
    } catch (err) {
      console.error(err);
      content.innerHTML = '<p class="form-error" role="alert">לא ניתן לטעון את המסמך. בדקו את החיבור לרשת ונסו שוב.</p>';
    }
  }

  window.EasyPenLegal = { renderMarkdown };
  show();
})();
