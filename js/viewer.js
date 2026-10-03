/*
 * EasyPen - editor screen.
 * Renders the PDF pages, manages signature/text overlays (drag, resize, edit),
 * free drawing, and exports the flattened, signed PDF.
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
  const KEY_STEP = 0.01, KEY_STEP_LARGE = 0.05;          // keyboard move, fraction of page
  const MIN_SIZE_PX = 24;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DRAW_TOOLS = {
    pen: { label: 'עט', mult: 1, opacity: 1, cap: 'round' },
    felt: { label: 'טוש', mult: 2, opacity: 1, cap: 'round' },
    marker: { label: 'מרקר הדגשה', mult: 4, opacity: 0.35, cap: 'butt' }
  };
  const STROKE_UNIT = 1 / 400;                           // stroke width per slider step, fraction of page width
  const INK_EXPORT_PX_PER_PT = 3;                        // raster resolution of exported drawings
  const DRAW_PREFS_KEY = 'easypen-draw';

  const el = {
    pages: document.getElementById('pages'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    statusHome: document.getElementById('status-home'),
    docName: document.getElementById('doc-name'),
    docPages: document.getElementById('doc-pages'),
    addSig: document.getElementById('add-sig'),
    addText: document.getElementById('add-text'),
    drawBtn: document.getElementById('draw-btn'),
    drawHeader: document.getElementById('draw-header'),
    drawTray: document.getElementById('draw-tray'),
    drawCancel: document.getElementById('draw-cancel'),
    drawDone: document.getElementById('draw-done'),
    drawUndo: document.getElementById('draw-undo'),
    drawWidth: document.getElementById('draw-width'),
    drawToolName: document.getElementById('draw-tool-name'),
    drawTrayToggle: document.getElementById('draw-tray-toggle'),
    drawTools: document.getElementById('draw-tools'),
    drawScroll: document.getElementById('draw-scroll'),
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
    drawMode: false,
    strokes: [],          // { page, color, widthPt, opacity, cap, points: [[x, y] in PDF points], el }
    drawSnapshot: null,   // strokes when drawing mode was entered, restored on cancel
    draw: { tool: 'pen', color: '#1c2033', width: 3 },
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
    [el.addSig, el.addText, el.drawBtn, el.saveShare].forEach((b) => { b.disabled = false; });
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
      // Drawings: SVG in PDF points, so strokes scale with the page
      const ink = document.createElementNS(SVG_NS, 'svg');
      ink.setAttribute('class', 'draw-layer');
      ink.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
      ink.setAttribute('preserveAspectRatio', 'none');
      ink.setAttribute('aria-hidden', 'true');
      const layer = document.createElement('div');
      layer.className = 'overlay-layer';
      pageEl.append(canvas, ink, layer);
      frag.appendChild(pageEl);
      const page = {
        num: n, el: pageEl, canvas, ink, layer,
        widthPt: size.width, heightPt: size.height,
        visible: false, rendered: false, renderedWidth: 0, rendering: null
      };
      state.pages.push(page);
      layer.addEventListener('pointerdown', (e) => onLayerPointerDown(e, page));
      wireInk(page);
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
        // Mid-pinch the page is only stretched; it is rendered again when the fingers lift
        if (page.visible && !pinch.active) renderPage(page);
      }
    });

    state.pages.forEach((p) => { io.observe(p.el); ro.observe(p.el); });
  }

  function pageFromEl(node) {
    return state.pages[Number(node.dataset.page) - 1];
  }

  // Renders the page, or renders it again when its size changed a lot (zoom, rotation)
  async function renderPage(page) {
    if (page.rendering) return;
    const width = page.el.clientWidth;
    if (!width) return;
    if (page.rendered && Math.abs(width - page.renderedWidth) / width <= 0.2) return;
    // Re-render into a new canvas and swap, so the page doesn't flash blank meanwhile
    const swap = page.rendered;
    const canvas = swap ? document.createElement('canvas') : page.canvas;
    canvas.setAttribute('aria-hidden', 'true');
    page.rendering = state.doc.render(page.num, canvas, width)
      .then(() => {
        if (swap) {
          page.canvas.replaceWith(canvas);
          page.canvas = canvas;
        }
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

  // Screen area not covered by the sticky header, bottom bar or on-screen keyboard
  function visibleBounds() {
    const viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return {
      top: document.querySelector('.app-header').getBoundingClientRect().bottom,
      bottom: Math.min(viewportH, document.querySelector('.bottom-bar').getBoundingClientRect().top)
    };
  }

  // The page under a screen Y coordinate (the nearest one when in a gap between pages)
  function pageAtY(y) {
    let best = null;
    let bestDist = Infinity;
    for (const p of state.pages) {
      const r = p.el.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  // The page that is "most" on screen (visible share of the page, or of the screen for
  // pages taller than it), and the middle of its visible part in page fractions
  function currentPageAndPoint() {
    const { top: viewTop, bottom: viewBottom } = visibleBounds();
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
    // Zoomed in, the page is wider than the screen: use the middle of its visible part
    const midX = (Math.max(r.left, 0) + Math.min(r.right, document.documentElement.clientWidth)) / 2;
    const fx = Math.min(Math.max((midX - r.left) / r.width, 0), 1);
    return { page: best, fx, fy };
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
    // A signature moved onto a smaller page may not fit - shrink it, keeping its proportions
    if (item.type === 'signature' && (item.fw > 1 || item.fh > 1)) {
      const k = 1 / Math.max(item.fw, item.fh);
      item.fw *= k;
      item.fh *= k;
    }
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
    node.tabIndex = 0;
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', 'חתימה. חיצים להזזה (Shift לצעד גדול), פלוס ומינוס לשינוי גודל, Delete למחיקה');
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
    node.focus({ preventScroll: true });
    markDirty();
  }

  function detectDir(text) {
    const m = /[֐-ࣿיִ-﷿ﹰ-﻿]|[A-Za-zÀ-ɏ]/.exec(text);
    return m && /[A-Za-zÀ-ɏ]/.test(m[0]) ? 'ltr' : 'rtl';
  }

  function addTextItem(page, fx, fy) {
    const node = document.createElement('div');
    node.className = 'ov ov-text';
    node.tabIndex = 0;
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', 'תיבת טקסט. Enter לעריכה, חיצים להזזה, פלוס ומינוס לגודל גופן, Delete למחיקה');
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
    // Once the keyboard has opened, scroll only if the box ended up hidden behind it or the bars
    setTimeout(() => {
      if (!item.el.classList.contains('is-editing')) return;
      const r = item.el.getBoundingClientRect();
      const { top, bottom } = visibleBounds();
      if (r.top < top || r.bottom > bottom) item.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
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
      // Bring to front (moving a node drops its focus, so only when needed)
      if (item.page.layer.lastElementChild !== item.el) item.page.layer.appendChild(item.el);
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
    item.el.addEventListener('focus', () => {
      if (state.selected !== item) select(item);
      if (document.activeElement !== item.el) item.el.focus({ preventScroll: true });
    });
    item.el.addEventListener('keydown', (e) => onItemKeyDown(e, item));
  }

  /* ---------------- keyboard (alternative to drag / resize) --------- */

  function resizeSignatureBy(item, factor) {
    const pr = item.page.el.getBoundingClientRect();
    const rightEdge = item.fx + item.fw;
    const minFw = MIN_SIZE_PX / pr.width;
    const fw = clamp(item.fw * factor, minFw, 1);
    item.fh = fw * item.aspect * (pr.width / pr.height);
    item.fw = fw;
    item.fx = rightEdge - fw;   // same anchor as the resize handle: top-right corner stays
    keepInside(item);
  }

  function onItemKeyDown(e, item) {
    if (e.target !== item.el) return;   // typing inside a text box being edited
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    let handled = true;
    if (moves[e.key]) {
      item.fx += moves[e.key][0];
      item.fy += moves[e.key][1];
      keepInside(item);
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      const bigger = e.key !== '-';
      if (item.type === 'signature') {
        resizeSignatureBy(item, bigger ? 1.1 : 1 / 1.1);
      } else {
        item.fontIndex = clamp(item.fontIndex + (bigger ? 1 : -1), 0, FONT_SIZES.length - 1);
        applyFont(item);
        keepInside(item);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      removeItem(item);
      el.addSig.focus();
    } else if (e.key === 'Enter' && item.type === 'text') {
      startEditing(item);
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      markDirty();
    }
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
      // Let the item be drawn above the following pages while it is dragged across them
      item.page.el.classList.add('has-dragging');
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
        // Free movement while dragging (may leave the page); clamped on drop
        item.fx = start.fx + dx / start.pw;
        item.fy = start.fy + dy / start.ph;
        applyPosition(item);
      }
    };

    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      item.el.classList.remove('is-dragging');
      item.page.el.classList.remove('has-dragging');
      if (start.moved && !isResize) dropItem(item);
      if (start.moved) markDirty();
      // A tap (no drag) on a text box enters edit mode
      else if (item.type === 'text' && !isMoveHandle) startEditing(item);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  // After a drag: move the item to the page under its center, then keep it inside that page
  function dropItem(item) {
    const r = item.el.getBoundingClientRect();
    const target = pageAtY(r.top + r.height / 2) || item.page;
    if (target !== item.page) {
      const pr = target.el.getBoundingClientRect();
      item.fx = (r.left - pr.left) / pr.width;
      item.fy = (r.top - pr.top) / pr.height;
      if (item.type === 'signature') {
        item.fw = r.width / pr.width;
        item.fh = r.height / pr.height;
      }
      item.page = target;
      target.layer.appendChild(item.el);
    }
    keepInside(item);
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
  /* Free drawing (one finger draws, two fingers zoom and scroll)       */
  /* ------------------------------------------------------------------ */

  const ink = { pointers: new Map(), stroke: null, panning: false };

  function loadDrawPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAW_PREFS_KEY) || 'null');
      if (!saved) return;
      if (DRAW_TOOLS[saved.tool]) state.draw.tool = saved.tool;
      if (el.drawTray.querySelector(`[data-color="${CSS.escape(String(saved.color))}"]`)) state.draw.color = saved.color;
      const w = Number(saved.width);
      if (w >= 1 && w <= 20) state.draw.width = Math.round(w);
    } catch (e) { /* storage unavailable - keep defaults */ }
  }

  function saveDrawPrefs() {
    try {
      localStorage.setItem(DRAW_PREFS_KEY, JSON.stringify(state.draw));
    } catch (e) { /* not critical */ }
  }

  function updateDrawTray() {
    const { tool, color, width } = state.draw;
    el.drawTray.style.setProperty('--ink', color);
    el.drawTray.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    el.drawTray.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === color)));
    el.drawWidth.value = String(width);
    el.drawToolName.textContent = `${DRAW_TOOLS[tool].label} · ${width}`;
    el.drawUndo.disabled = !state.strokes.length;
  }

  function setDrawMode(on) {
    if (on === state.drawMode) return;
    if (on) {
      setTextMode(false);
      select(null);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      state.drawSnapshot = state.strokes.slice();
      setTrayCollapsed(false, false);
      updateDrawTray();
      toast('מציירים באצבע אחת. בשתי אצבעות מגדילים, מקטינים וגוללים', 'info', 4000);
    } else {
      cancelStroke();
      ink.pointers.clear();
      ink.panning = false;
      state.drawSnapshot = null;
      setScrollMode(false);
    }
    state.drawMode = on;
    document.body.classList.toggle('draw-mode', on);
    el.drawHeader.hidden = !on;
    el.drawTray.hidden = !on;
    if (!on) el.drawBtn.focus({ preventScroll: true });
  }

  // "ביטול": bring back the drawing as it was when drawing mode was entered
  function cancelDrawing() {
    const snapshot = state.drawSnapshot || state.strokes;
    state.strokes.forEach((s) => s.el.remove());
    snapshot.forEach((s) => s.page.ink.appendChild(s.el));
    state.strokes = snapshot;
    setDrawMode(false);
  }

  function pointToPage(e, page) {
    const r = page.el.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * page.widthPt,
      ((e.clientY - r.top) / r.height) * page.heightPt
    ];
  }

  // Smooth path through the points (quadratic curves between midpoints)
  function strokePath(points) {
    const f = (n) => Math.round(n * 100) / 100;
    const [x0, y0] = points[0];
    if (points.length === 1) return `M${f(x0)} ${f(y0)}L${f(x0 + 0.01)} ${f(y0)}`;
    let d = `M${f(x0)} ${f(y0)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      const [nx, ny] = points[i + 1];
      d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
    }
    const [lx, ly] = points[points.length - 1];
    return `${d}L${f(lx)} ${f(ly)}`;
  }

  function startStroke(e, page) {
    const tool = DRAW_TOOLS[state.draw.tool];
    const stroke = {
      page,
      pointerId: e.pointerId,
      color: state.draw.color,
      widthPt: state.draw.width * tool.mult * STROKE_UNIT * page.widthPt,
      opacity: tool.opacity,
      cap: tool.cap,
      points: [],
      el: document.createElementNS(SVG_NS, 'path')
    };
    const path = stroke.el;
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', String(stroke.widthPt));
    path.setAttribute('stroke-opacity', String(stroke.opacity));
    path.setAttribute('stroke-linecap', stroke.cap);
    path.setAttribute('stroke-linejoin', 'round');
    page.ink.appendChild(path);
    ink.stroke = stroke;
    addStrokePoints(stroke, [e]);
  }

  function addStrokePoints(stroke, events) {
    const minStep = 0.5 * stroke.page.widthPt / stroke.page.el.getBoundingClientRect().width;   // half a screen pixel
    for (const ev of events) {
      const p = pointToPage(ev, stroke.page);
      const last = stroke.points[stroke.points.length - 1];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minStep) continue;
      stroke.points.push(p);
    }
    if (stroke.points.length) stroke.el.setAttribute('d', strokePath(stroke.points));
  }

  function finishStroke() {
    const stroke = ink.stroke;
    ink.stroke = null;
    if (!stroke) return;
    if (!stroke.points.length) {
      stroke.el.remove();
      return;
    }
    delete stroke.pointerId;
    state.strokes.push(stroke);
    markDirty();
    updateDrawTray();
  }

  function cancelStroke() {
    if (ink.stroke) ink.stroke.el.remove();
    ink.stroke = null;
  }

  function undoStroke() {
    const stroke = state.strokes.pop();
    if (!stroke) return;
    stroke.el.remove();
    markDirty();
    updateDrawTray();
  }

  function wireInk(page) {
    const svg = page.ink;
    svg.addEventListener('pointerdown', (e) => {
      if (!state.drawMode || e.button > 0) return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      ink.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ink.pointers.size > 1) {
        // Second finger: a zoom/scroll (pinch zoom below), not a line
        cancelStroke();
        ink.panning = true;
      } else if (!ink.panning) {
        startStroke(e, page);
      }
    });
    svg.addEventListener('pointermove', (e) => {
      const p = ink.pointers.get(e.pointerId);
      if (!p || ink.panning) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (ink.stroke && ink.stroke.pointerId === e.pointerId) {
        addStrokePoints(ink.stroke, e.getCoalescedEvents ? e.getCoalescedEvents() : [e]);
      }
    });
    const onEnd = (e) => {
      if (!ink.pointers.delete(e.pointerId)) return;
      if (ink.stroke && ink.stroke.pointerId === e.pointerId) {
        if (e.type === 'pointercancel') cancelStroke();
        else finishStroke();
      }
      if (!ink.pointers.size) ink.panning = false;
    };
    svg.addEventListener('pointerup', onEnd);
    svg.addEventListener('pointercancel', onEnd);
  }

  // Tucks the tray down to its handle so more of the page shows
  function setTrayCollapsed(collapsed, animate = true) {
    if (animate) {
      el.drawTray.classList.add('is-sliding');
      setTimeout(() => el.drawTray.classList.remove('is-sliding'), 250);
    }
    document.body.classList.toggle('tray-collapsed', collapsed);
    el.drawTools.inert = collapsed;
    el.drawTrayToggle.setAttribute('aria-expanded', String(!collapsed));
    el.drawTrayToggle.querySelector('.tray-handle-label').textContent = collapsed ? 'הצג כלים' : 'הסתר כלים';
  }

  // Scroll mode: the drawing layer lets touches through, so one finger scrolls the pages
  function setScrollMode(on) {
    if (on) {
      cancelStroke();
      ink.pointers.clear();
      ink.panning = false;
    }
    document.body.classList.toggle('scroll-mode', on);
    el.drawScroll.setAttribute('aria-pressed', String(on));
  }

  function toggleTray() {
    setTrayCollapsed(!document.body.classList.contains('tray-collapsed'));
  }

  function wireDrawTray() {
    loadDrawPrefs();
    el.drawBtn.addEventListener('click', () => setDrawMode(true));
    el.drawDone.addEventListener('click', () => setDrawMode(false));
    el.drawCancel.addEventListener('click', cancelDrawing);
    el.drawUndo.addEventListener('click', undoStroke);
    el.drawTrayToggle.addEventListener('click', toggleTray);
    el.drawScroll.addEventListener('click', () => setScrollMode(!document.body.classList.contains('scroll-mode')));
    el.drawTray.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tool], [data-color]');
      if (!btn) {
        // A tap on an empty part of the tray also tucks it away / brings it back
        if (!e.target.closest('button, input, label')) toggleTray();
        return;
      }
      if (btn.dataset.tool) state.draw.tool = btn.dataset.tool;
      else state.draw.color = btn.dataset.color;
      setScrollMode(false);   // picking a pen or colour means drawing again
      saveDrawPrefs();
      updateDrawTray();
    });
    el.drawWidth.addEventListener('input', () => {
      state.draw.width = Number(el.drawWidth.value);
      saveDrawPrefs();
      updateDrawTray();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Pinch zoom                                                         */
  /* ------------------------------------------------------------------ */

  // The pages are zoomed by the app (they get wider and the document scrolls natively),
  // not by the browser, whose zoom also moves the fixed bars (CSS: touch-action pan-x pan-y).
  const MAX_ZOOM = 4;
  const pinch = { active: false, dist: 0, zoom: 1, anchor: null, last: null, frame: 0 };
  let zoom = 1;

  function touchPair(touches) {
    const [a, b] = touches;
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    };
  }

  // Point on a page (as page fractions) that should stay under the screen point (x, y)
  function zoomAnchor(x, y) {
    const page = pageAtY(y);
    const r = page.el.getBoundingClientRect();
    return { page, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height };
  }

  // Zooms the pages, keeping `anchor` under the screen point (x, y)
  function setZoom(value, anchor, x, y) {
    zoom = clamp(value, 1, MAX_ZOOM);
    el.pages.style.setProperty('--zoom', String(zoom));
    const r = anchor.page.el.getBoundingClientRect();
    window.scrollBy(r.left + anchor.fx * r.width - x, r.top + anchor.fy * r.height - y);
  }

  function pinchFrame() {
    pinch.frame = 0;
    const { x, y, dist } = pinch.last;
    setZoom(pinch.zoom * dist / pinch.dist, pinch.anchor, x, y);
  }

  function endPinch() {
    if (!pinch.active) return;
    if (pinch.frame) {
      cancelAnimationFrame(pinch.frame);
      pinchFrame();
    }
    pinch.active = false;
    state.pages.forEach((p) => { if (p.visible) renderPage(p); });
  }

  function onPinchTouch(e) {
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (e.targetTouches.length < 2) endPinch();
      return;
    }
    if (e.targetTouches.length !== 2 || !state.pages.length) return;
    const t = touchPair(e.targetTouches);
    if (!pinch.active) {
      // Two fingers: start over from the current zoom (also when a finger was replaced)
      pinch.active = true;
      pinch.dist = Math.max(t.dist, 1);
      pinch.zoom = zoom;
      pinch.anchor = zoomAnchor(t.x, t.y);
    }
    // Stops the browser from scrolling the page as well (where it still can)
    if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
    pinch.last = t;
    if (!pinch.frame) pinch.frame = requestAnimationFrame(pinchFrame);
  }

  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => {
    el.pages.addEventListener(type, onPinchTouch, { passive: type !== 'touchmove' });
  });
  // iOS Safari zooms on its own gesture events too
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Trackpad pinch and Ctrl + mouse wheel on a computer
  el.pages.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (state.pages.length) setZoom(zoom * Math.exp(-e.deltaY / 200), zoomAnchor(e.clientX, e.clientY), e.clientX, e.clientY);
  }, { passive: false });

  /* ------------------------------------------------------------------ */
  /* Bars pinned to the visible screen while pinch-zoomed               */
  /* ------------------------------------------------------------------ */

  // Browsers keep fixed/sticky bars attached to the page, so on pinch-zoom they grow and
  // slide off screen. Counter-scale them and move them to the edges of the visible area
  // (CSS: transform var(--pin-top) / var(--pin-bottom), origin at the viewport edge).
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  let pinFrame = 0;

  function pinBars() {
    pinFrame = 0;
    const vv = window.visualViewport;
    const style = document.body.style;
    // Scale 1 includes the iOS keyboard case: bars stay where they always were
    if (!vv || Math.abs(vv.scale - 1) < 0.01) {
      style.removeProperty('--pin-top');
      style.removeProperty('--pin-bottom');
      return;
    }
    // Where fixed bars actually sit (the layout viewport), in the same coordinates as vv.offset*
    const layout = probe.getBoundingClientRect();
    const k = 1 / vv.scale;
    const dx = vv.offsetLeft + vv.width / 2 - (layout.left + layout.right) / 2;
    style.setProperty('--pin-top', `translate(${dx}px, ${vv.offsetTop}px) scale(${k})`);
    style.setProperty('--pin-bottom', `translate(${dx}px, ${vv.offsetTop + vv.height - layout.bottom}px) scale(${k})`);
  }

  function schedulePin() {
    if (!pinFrame) pinFrame = requestAnimationFrame(pinBars);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', schedulePin);
    window.visualViewport.addEventListener('scroll', schedulePin);
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

  // Renders a page's drawings to one transparent, page-sized PNG
  async function inkToOverlay(page, strokes) {
    const k = Math.min(INK_EXPORT_PX_PER_PT, Math.sqrt(12e6 / (page.widthPt * page.heightPt)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(page.widthPt * k));
    canvas.height = Math.max(1, Math.round(page.heightPt * k));
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / page.widthPt, canvas.height / page.heightPt);
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.widthPt;
      ctx.lineCap = s.cap;
      ctx.stroke(new Path2D(s.el.getAttribute('d')));
    }
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { page: page.num, png: new Uint8Array(await blob.arrayBuffer()), fx: 0, fy: 0, fw: 1, fh: 1 };
  }

  async function collectOverlays() {
    const out = [];
    // Drawings first: on screen they sit under signatures and text
    for (const page of state.pages) {
      const strokes = state.strokes.filter((s) => s.page === page);
      if (strokes.length) out.push(await inkToOverlay(page, strokes));
    }
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
    if (!state.items.length && !state.strokes.length) {
      toast('עדיין לא הוספתם חתימה, טקסט או ציור למסמך', 'info');
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
      if (state.drawMode) setDrawMode(false);
      else if (state.textMode) setTextMode(false);
      else if (state.selected && state.selected.el.classList.contains('is-editing')) {
        // Leave text editing but keep the box selected and focused for moving
        const item = state.selected;
        stopEditing(item);
        if (state.items.includes(item)) item.el.focus({ preventScroll: true });
      } else if (state.selected) select(null);
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
  wireDrawTray();
  init();
})();
