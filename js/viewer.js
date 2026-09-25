/*
 * EasyPen - editor screen.
 * Renders the PDF pages, manages signature/text overlays (drag, resize, edit)
 * and exports the flattened, signed PDF.
 *
 * Overlay positions are kept as fractions of the page (see pdf-handler.js),
 * so they stay correct while scrolling, zooming or rotating the phone.
 */
(function () {
  'use strict';

  const Storage = window.EasyPenStorage;
  const { toast } = window.EasyPenUI;

  const TEXT_FONT = 'Arial, Helvetica, "Noto Sans Hebrew", sans-serif';
  const TEXT_COLOR = '#111827';
  const FONT_SIZES = [8, 10, 12, 14, 16, 20, 24, 32];   // in PDF points
  const DEFAULT_FONT_INDEX = 3;
  const TEXT_LINE_HEIGHT = 1.3;                          // must match .ov-text in CSS
  const TEXT_PAD_Y = 0.15, TEXT_PAD_X = 0.3;             // em, must match CSS
  const TEXT_EXPORT_PX_PER_PT = 4;                       // raster resolution of exported text
  const SIG_DEFAULT_WIDTH = 0.35;                        // fraction of page width
  const MIN_SIZE_PX = 24;

  const el = {
    pages: document.getElementById('pages'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    statusHome: document.getElementById('status-home'),
    docName: document.getElementById('doc-name'),
    docPages: document.getElementById('doc-pages'),
    addSig: document.getElementById('add-sig'),
    addText: document.getElementById('add-text'),
    saveShare: document.getElementById('save-share'),
    modeHint: document.getElementById('mode-hint'),
    modeCancel: document.getElementById('mode-cancel'),
    toolbar: document.getElementById('item-toolbar'),
    textTools: document.querySelector('#item-toolbar .text-tools'),
    fontSizeLabel: document.querySelector('#item-toolbar .font-size'),
    sigPicker: document.getElementById('sig-picker'),
    readyDialog: document.getElementById('ready-dialog'),
    busy: document.getElementById('busy'),
    backBtn: document.getElementById('back-btn')
  };

  const state = {
    doc: null,            // PdfDocument
    fileName: 'document.pdf',
    pages: [],            // { num, el, canvas, layer, widthPt, heightPt, rendered, renderedWidth, rendering }
    items: [],            // overlay items
    selected: null,
    textMode: false,
    dirty: false,
    nextId: 1
  };

  /* ------------------------------------------------------------------ */
  /* Loading                                                            */
  /* ------------------------------------------------------------------ */

  function showStatus(text, { error = false } = {}) {
    el.status.hidden = false;
    el.status.classList.toggle('is-error', error);
    el.statusText.textContent = text;
    el.statusHome.hidden = !error;
  }

  async function init() {
    let record;
    try {
      record = await Storage.getCurrentDocument();
    } catch (err) {
      console.error(err);
      showStatus('לא ניתן לגשת לאחסון המקומי בדפדפן.', { error: true });
      return;
    }
    if (!record || !record.blob) {
      showStatus('לא נמצא מסמך פתוח. חזרו למסך הבית ובחרו קובץ PDF.', { error: true });
      return;
    }

    state.fileName = record.name || 'document.pdf';
    el.docName.textContent = state.fileName;

    try {
      const bytes = new Uint8Array(await record.blob.arrayBuffer());
      state.doc = await window.PdfHandler.load(bytes);
    } catch (err) {
      console.error(err);
      const messages = {
        NOT_PDF: 'כרגע נתמכים קבצי PDF בלבד',
        PASSWORD: 'המסמך מוגן בסיסמה ולא ניתן לפתוח אותו כרגע.'
      };
      const offline = !navigator.onLine ? ' ייתכן שהאפליקציה עדיין לא נשמרה לשימוש ללא חיבור.' : '';
      showStatus(messages[err.code] || ('לא ניתן לפתוח את הקובץ. ייתכן שהוא פגום.' + offline), { error: true });
      return;
    }

    el.docPages.textContent = state.doc.numPages === 1 ? 'עמוד אחד' : `${state.doc.numPages} עמודים`;
    await buildPages();
    el.status.hidden = true;
    [el.addSig, el.addText, el.saveShare].forEach((b) => { b.disabled = false; });
  }

  /* ------------------------------------------------------------------ */
  /* Page rendering (lazy, releases far-away pages to save memory)       */
  /* ------------------------------------------------------------------ */

  let io = null;
  let ro = null;

  async function buildPages() {
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= state.doc.numPages; n++) {
      const size = await state.doc.getPageSize(n);
      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      pageEl.dataset.page = String(n);
      pageEl.style.aspectRatio = `${size.width} / ${size.height}`;
      pageEl.setAttribute('aria-label', `עמוד ${n}`);
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const layer = document.createElement('div');
      layer.className = 'overlay-layer';
      pageEl.append(canvas, layer);
      frag.appendChild(pageEl);
      const page = {
        num: n, el: pageEl, canvas, layer,
        widthPt: size.width, heightPt: size.height,
        visible: false, rendered: false, renderedWidth: 0, rendering: null
      };
      state.pages.push(page);
      layer.addEventListener('pointerdown', (e) => onLayerPointerDown(e, page));
    }
    el.pages.appendChild(frag);

    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const page = pageFromEl(entry.target);
        page.visible = entry.isIntersecting;
        if (page.visible) renderPage(page);
        else releasePage(page);
      }
    }, { root: null, rootMargin: '150% 0px' });

    ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const page = pageFromEl(entry.target);
        const width = entry.contentRect.width;
        // CSS pixels per PDF point, used by text overlays' font-size
        page.el.style.setProperty('--pt', String(width / page.widthPt));
        if (page.visible && page.rendered && Math.abs(width - page.renderedWidth) / width > 0.2) {
          page.rendered = false;
          renderPage(page);
        }
      }
    });

    state.pages.forEach((p) => { io.observe(p.el); ro.observe(p.el); });
  }

  function pageFromEl(node) {
    return state.pages[Number(node.dataset.page) - 1];
  }

  async function renderPage(page) {
    if (page.rendered || page.rendering) return;
    const width = page.el.clientWidth;
    if (!width) return;
    page.rendering = state.doc.render(page.num, page.canvas, width)
      .then(() => {
        page.rendered = true;
        page.renderedWidth = width;
        page.el.classList.add('is-rendered');
      })
      .catch((err) => {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error(err);
          toast(`שגיאה בהצגת עמוד ${page.num}`, 'error');
        }
      })
      .finally(() => {
        page.rendering = null;
        // Scrolled away while rendering
        if (!page.visible) releasePage(page);
      });
  }

  function releasePage(page) {
    if (!page.rendered || page.rendering) return;
    page.canvas.width = 0;
    page.canvas.height = 0;
    page.rendered = false;
    page.el.classList.remove('is-rendered');
  }

  // The page that is "most" on screen (visible share of the page, or of the screen for
  // pages taller than it), and the middle of its visible part in page fractions
  function currentPageAndPoint() {
    // Leave out the sticky header and the bottom action bar
    const viewTop = document.querySelector('.app-header').getBoundingClientRect().bottom;
    const viewBottom = document.querySelector('.bottom-bar').getBoundingClientRect().top;
    let best = state.pages[0];
    let bestVisible = -1;
    for (const p of state.pages) {
      const r = p.el.getBoundingClientRect();
      const visible = (Math.min(r.bottom, viewBottom) - Math.max(r.top, viewTop)) /
        Math.min(r.height, viewBottom - viewTop);
      if (visible > bestVisible) { bestVisible = visible; best = p; }
    }
    const r = best.el.getBoundingClientRect();
    const midY = (Math.max(r.top, viewTop) + Math.min(r.bottom, viewBottom)) / 2;
    const fy = Math.min(Math.max((midY - r.top) / r.height, 0), 1);
    return { page: best, fx: 0.5, fy };
  }

  /* ------------------------------------------------------------------ */
  /* Overlay items                                                      */
  /* ------------------------------------------------------------------ */

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), Math.max(min, max));
  }

  function applyPosition(item) {
    item.el.style.left = `${item.fx * 100}%`;
    item.el.style.top = `${item.fy * 100}%`;
    if (item.type === 'signature') {
      item.el.style.width = `${item.fw * 100}%`;
      item.el.style.height = `${item.fh * 100}%`;
    }
  }

  // Current size of an item as page fractions (text boxes size themselves to the content)
  function itemFractionSize(item) {
    if (item.type === 'signature') return { fw: item.fw, fh: item.fh };
    const pr = item.page.el.getBoundingClientRect();
    return { fw: item.el.offsetWidth / pr.width, fh: item.el.offsetHeight / pr.height };
  }

  function keepInside(item) {
    const { fw, fh } = itemFractionSize(item);
    item.fx = clamp(item.fx, 0, 1 - fw);
    item.fy = clamp(item.fy, 0, 1 - fh);
    applyPosition(item);
  }

  function markDirty() {
    state.dirty = true;
  }

  async function addSignatureItem(blob) {
    const img = await window.loadImageFromBlob(blob);
    const pngBytes = new Uint8Array(await blob.arrayBuffer());
    const { page, fy } = currentPageAndPoint();
    const aspect = img.height / img.width;
    const fw = SIG_DEFAULT_WIDTH;
    const fh = fw * aspect * (page.widthPt / page.heightPt);

    const node = document.createElement('div');
    node.className = 'ov ov-sig';
    const blobUrl = URL.createObjectURL(blob);
    const imgEl = document.createElement('img');
    imgEl.src = blobUrl;
    imgEl.alt = 'חתימה';
    imgEl.draggable = false;
    const handle = document.createElement('span');
    handle.className = 'ov-resize';
    handle.setAttribute('aria-hidden', 'true');
    node.append(imgEl, handle);

    const item = {
      id: state.nextId++, type: 'signature', page, el: node,
      fx: (1 - fw) / 2, fy: fy - fh / 2, fw, fh, aspect, pngBytes, blobUrl
    };
    page.layer.appendChild(node);
    keepInside(item);
    wireItem(item);
    state.items.push(item);
    select(item);
    markDirty();
  }

  function detectDir(text) {
    const m = /[֐-ࣿיִ-﷿ﹰ-﻿]|[A-Za-zÀ-ɏ]/.exec(text);
    return m && /[A-Za-zÀ-ɏ]/.test(m[0]) ? 'ltr' : 'rtl';
  }

  function addTextItem(page, fx, fy) {
    const node = document.createElement('div');
    node.className = 'ov ov-text';
    const content = document.createElement('div');
    content.className = 'ov-text-content';
    content.dir = 'rtl';
    content.setAttribute('role', 'textbox');
    content.setAttribute('aria-multiline', 'true');
    content.setAttribute('aria-label', 'טקסט במסמך');
    content.spellcheck = false;
    const handle = document.createElement('span');
    handle.className = 'ov-move';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '✥';
    node.append(content, handle);

    const item = {
      id: state.nextId++, type: 'text', page, el: node, content,
      fx, fy, fontIndex: DEFAULT_FONT_INDEX
    };
    applyFont(item);
    page.layer.appendChild(node);
    applyPosition(item);
    wireItem(item);
    wireText(item);
    state.items.push(item);
    select(item);
    startEditing(item);
    markDirty();
  }

  function applyFont(item) {
    item.el.style.setProperty('--fs', String(FONT_SIZES[item.fontIndex]));
    if (state.selected === item) updateToolbar();
  }

  function wireText(item) {
    const { content } = item;
    // Plain text only - never let pasted HTML into the document (XSS / formatting)
    content.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    content.addEventListener('drop', (e) => e.preventDefault());
    content.addEventListener('input', () => {
      content.dir = detectDir(content.textContent);
      keepInside(item);
      markDirty();
    });
    content.addEventListener('blur', () => stopEditing(item));
  }

  function startEditing(item) {
    const { content } = item;
    try {
      content.contentEditable = 'plaintext-only';
    } catch (e) {
      content.contentEditable = 'true';
    }
    if (content.contentEditable !== 'plaintext-only') content.contentEditable = 'true';
    item.el.classList.add('is-editing');
    content.focus({ preventScroll: true });
    // Caret at the end
    const range = document.createRange();
    range.selectNodeContents(content);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    setTimeout(() => item.el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  }

  function stopEditing(item) {
    if (!item.el.classList.contains('is-editing')) return;
    item.content.contentEditable = 'false';
    item.el.classList.remove('is-editing');
    if (!item.content.textContent.trim()) removeItem(item);
  }

  function removeItem(item) {
    const i = state.items.indexOf(item);
    if (i === -1) return;
    state.items.splice(i, 1);
    item.el.remove();
    if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    if (state.selected === item) select(null);
  }

  function select(item) {
    if (state.selected && state.selected !== item) {
      state.selected.el.classList.remove('is-selected');
      if (state.selected.type === 'text') stopEditing(state.selected);
    }
    state.selected = item;
    if (item) {
      item.el.classList.add('is-selected');
      // Bring to front
      item.page.layer.appendChild(item.el);
      if (item.type === 'text' && item.el.classList.contains('is-editing')) item.content.focus({ preventScroll: true });
    }
    updateToolbar();
  }

  function updateToolbar() {
    const item = state.selected;
    el.toolbar.hidden = !item;
    if (!item) return;
    el.textTools.hidden = item.type !== 'text';
    if (item.type === 'text') el.fontSizeLabel.textContent = `${FONT_SIZES[item.fontIndex]}pt`;
  }

  /* ---------------- drag / resize (Pointer Events) ------------------ */

  function wireItem(item) {
    item.el.addEventListener('pointerdown', (e) => onItemPointerDown(e, item));
  }

  function onItemPointerDown(e, item) {
    if (e.button > 0) return;
    e.stopPropagation();
    const isResize = e.target.classList.contains('ov-resize');
    const isMoveHandle = e.target.classList.contains('ov-move');
    const editing = item.type === 'text' && item.el.classList.contains('is-editing');

    // While editing text, taps inside the text place the caret - only the handle drags
    if (editing && !isMoveHandle) return;

    e.preventDefault();
    select(item);

    const pr = item.page.el.getBoundingClientRect();
    const start = {
      x: e.clientX, y: e.clientY,
      fx: item.fx, fy: item.fy,
      fw: item.fw, fh: item.fh,
      pw: pr.width, ph: pr.height,
      moved: false
    };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      start.moved = true;
      item.el.classList.add('is-dragging');
      if (isResize) {
        // Handle sits on the bottom-left corner (RTL): the top-right corner stays put
        const minFw = MIN_SIZE_PX / start.pw;
        const rightEdge = start.fx + start.fw;
        let fw = clamp(start.fw - dx / start.pw, minFw, rightEdge);
        let fh = fw * item.aspect * (start.pw / start.ph);
        if (start.fy + fh > 1) {
          fh = 1 - start.fy;
          fw = fh / (item.aspect * (start.pw / start.ph));
        }
        item.fw = fw;
        item.fh = fh;
        item.fx = rightEdge - fw;
        applyPosition(item);
      } else {
        item.fx = start.fx + dx / start.pw;
        item.fy = start.fy + dy / start.ph;
        keepInside(item);
      }
    };

    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      item.el.classList.remove('is-dragging');
      if (start.moved) markDirty();
      // A tap (no drag) on a text box enters edit mode
      else if (item.type === 'text' && !isMoveHandle) startEditing(item);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function onLayerPointerDown(e, page) {
    if (e.target !== page.layer) return;
    if (state.textMode) {
      e.preventDefault();
      const r = page.el.getBoundingClientRect();
      // Put the caret roughly where the user tapped
      const fontPx = FONT_SIZES[DEFAULT_FONT_INDEX] * (r.width / page.widthPt);
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top - fontPx * 0.7) / r.height;
      setTextMode(false);
      addTextItem(page, clamp(fx, 0, 0.95), clamp(fy, 0, 0.97));
      return;
    }
    select(null);
  }

  function setTextMode(on) {
    state.textMode = on;
    el.modeHint.hidden = !on;
    document.body.classList.toggle('text-mode', on);
    el.addText.setAttribute('aria-pressed', String(on));
    if (on) select(null);
  }

  /* ------------------------------------------------------------------ */
  /* Signatures: picker / draw                                          */
  /* ------------------------------------------------------------------ */

  async function onAddSignature() {
    setTextMode(false);
    let saved = [];
    try {
      saved = await Storage.listSignatures();
    } catch (err) {
      console.warn(err);
    }
    if (!saved.length) return drawNewSignature(saved.length);
    openPicker(saved);
  }

  function openPicker(saved) {
    const list = el.sigPicker.querySelector('.sig-choices');
    const urls = [];
    list.replaceChildren();
    for (const sig of saved) {
      const url = URL.createObjectURL(sig.blob);
      urls.push(url);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sig-choice';
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'חתימה שמורה';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        close();
        addSignatureItem(sig.blob).catch(onPlaceError);
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
    const newBtn = el.sigPicker.querySelector('[data-action="new"]');
    const closeBtn = el.sigPicker.querySelector('[data-action="close"]');
    const onNew = () => { close(); drawNewSignature(saved.length); };
    const onClose = () => close();
    function close() {
      newBtn.removeEventListener('click', onNew);
      closeBtn.removeEventListener('click', onClose);
      if (el.sigPicker.open) el.sigPicker.close();
      urls.forEach((u) => URL.revokeObjectURL(u));
    }
    newBtn.addEventListener('click', onNew);
    closeBtn.addEventListener('click', onClose);
    el.sigPicker.showModal();
  }

  async function drawNewSignature(savedCount) {
    const canSave = savedCount < Storage.MAX_SIGNATURES;
    const result = await window.openSignatureDialog({
      title: 'חתימה חדשה',
      showSaveOption: canSave,
      saveChecked: canSave,
      confirmLabel: 'הוסף למסמך'
    });
    if (!result) return;
    if (canSave && result.save) {
      Storage.addSignature(result.blob).catch((err) => {
        console.warn(err);
        toast('החתימה נוספה למסמך אך לא נשמרה לשימוש חוזר', 'error');
      });
    }
    addSignatureItem(result.blob).catch(onPlaceError);
  }

  function onPlaceError(err) {
    console.error(err);
    toast('לא ניתן להוסיף את החתימה', 'error');
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                             */
  /* ------------------------------------------------------------------ */

  // Renders a text overlay to a transparent PNG (keeps Hebrew/RTL shaping exact
  // without embedding a font into the PDF).
  async function textToOverlay(item) {
    const page = item.page;
    const pr = page.el.getBoundingClientRect();
    const r = item.el.getBoundingClientRect();
    const fx = (r.left - pr.left) / pr.width;
    const fy = (r.top - pr.top) / pr.height;
    const fw = r.width / pr.width;
    const fh = r.height / pr.height;

    const k = TEXT_EXPORT_PX_PER_PT;
    const fontPx = FONT_SIZES[item.fontIndex] * k;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(fw * page.widthPt * k));
    canvas.height = Math.max(1, Math.round(fh * page.heightPt * k));
    const ctx = canvas.getContext('2d');
    const dir = item.content.dir === 'ltr' ? 'ltr' : 'rtl';
    ctx.font = `${fontPx}px ${TEXT_FONT}`;
    ctx.fillStyle = TEXT_COLOR;
    ctx.textBaseline = 'middle';
    ctx.direction = dir;
    ctx.textAlign = dir === 'rtl' ? 'right' : 'left';
    const padX = TEXT_PAD_X * fontPx;
    const padY = TEXT_PAD_Y * fontPx;
    const lineH = TEXT_LINE_HEIGHT * fontPx;
    const x = dir === 'rtl' ? canvas.width - padX : padX;
    const lines = item.content.innerText.replace(/\n$/, '').split('\n');
    lines.forEach((line, i) => ctx.fillText(line, x, padY + lineH * (i + 0.5)));

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { page: page.num, png: new Uint8Array(await blob.arrayBuffer()), fx, fy, fw, fh };
  }

  async function collectOverlays() {
    const out = [];
    for (const item of state.items) {
      if (item.type === 'signature') {
        out.push({ page: item.page.num, png: item.pngBytes, fx: item.fx, fy: item.fy, fw: item.fw, fh: item.fh });
      } else if (item.content.textContent.trim()) {
        out.push(await textToOverlay(item));
      }
    }
    return out;
  }

  function signedFileName() {
    const baseName = state.fileName.replace(/\.pdf$/i, '');
    return `${baseName}-חתום.pdf`;
  }

  let lastFile = null;

  async function onSaveShare() {
    setTextMode(false);
    select(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!state.items.length) {
      toast('עדיין לא הוספתם חתימה או טקסט למסמך', 'info');
      return;
    }
    el.busy.hidden = false;
    el.saveShare.disabled = true;
    try {
      // Let the busy indicator paint before the heavy work
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const overlays = await collectOverlays();
      const bytes = await window.PdfHandler.exportPdf(state.doc, overlays);
      lastFile = new File([bytes], signedFileName(), { type: 'application/pdf' });
    } catch (err) {
      console.error(err);
      toast('יצירת המסמך החתום נכשלה. נסו שוב.', 'error', 5000);
      return;
    } finally {
      el.busy.hidden = true;
      el.saveShare.disabled = false;
    }
    await deliver(lastFile);
  }

  async function deliver(file) {
    const result = await window.EasyPenShare.shareOrDownload(file);
    if (result === 'shared') {
      state.dirty = false;
      toast('המסמך שותף בהצלחה', 'success');
    } else if (result === 'downloaded') {
      state.dirty = false;
      toast('המסמך החתום נשמר בהורדות', 'success');
    } else if (result === 'needs-gesture') {
      // Preparing took too long for the browser's "user tap" window - ask for one more tap
      el.readyDialog.showModal();
    }
  }

  function wireReadyDialog() {
    const d = el.readyDialog;
    d.querySelector('[data-action="close"]').addEventListener('click', () => d.close());
    d.querySelector('[data-action="share"]').addEventListener('click', () => {
      d.close();
      if (lastFile) deliver(lastFile);
    });
    d.querySelector('[data-action="download"]').addEventListener('click', () => {
      d.close();
      if (!lastFile) return;
      window.EasyPenShare.download(lastFile);
      state.dirty = false;
      toast('המסמך החתום נשמר בהורדות', 'success');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Wiring                                                             */
  /* ------------------------------------------------------------------ */

  el.addSig.addEventListener('click', onAddSignature);
  el.addText.addEventListener('click', () => setTextMode(!state.textMode));
  el.modeCancel.addEventListener('click', () => setTextMode(false));
  el.saveShare.addEventListener('click', onSaveShare);

  el.toolbar.addEventListener('pointerdown', (e) => {
    // Keep the text box focused (and the keyboard open) while using the toolbar
    if (e.target.closest('button')) e.preventDefault();
  });
  el.toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const item = state.selected;
    if (!btn || !item) return;
    const action = btn.dataset.action;
    if (action === 'delete') {
      removeItem(item);
      markDirty();
    } else if (action === 'done') {
      select(null);
    } else if (action === 'font-up' || action === 'font-down') {
      const delta = action === 'font-up' ? 1 : -1;
      item.fontIndex = clamp(item.fontIndex + delta, 0, FONT_SIZES.length - 1);
      applyFont(item);
      keepInside(item);
      markDirty();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.textMode) setTextMode(false);
      else if (state.selected) select(null);
    }
  });

  el.backBtn.addEventListener('click', (e) => {
    if (state.dirty && !confirm('השינויים במסמך לא נשמרו. לצאת בכל זאת?')) e.preventDefault();
  });
  window.addEventListener('beforeunload', (e) => {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  wireReadyDialog();
  init();
})();
