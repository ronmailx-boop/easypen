/*
 * EasyPen - signature drawing.
 *   SignaturePad       - finger/stylus/mouse drawing on a canvas (Pointer Events).
 *   openSignatureDialog - modal with the pad, "נקה" and "שמור לשימוש חוזר".
 * Exposes globals `SignaturePad` and `openSignatureDialog`.
 */
(function (global) {
  'use strict';

  const INK_COLORS = { black: '#111827', blue: '#1e3a8a' };

  class SignaturePad {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.strokes = [];          // [{ color, points: [{x, y}] }] - x/y normalised 0..1 of width
      this.current = null;
      this.baseImage = null;      // existing signature when editing
      this.color = INK_COLORS.black;
      this.onChange = null;

      this._down = this._down.bind(this);
      this._move = this._move.bind(this);
      this._up = this._up.bind(this);
      canvas.addEventListener('pointerdown', this._down);
      canvas.addEventListener('pointermove', this._move);
      canvas.addEventListener('pointerup', this._up);
      canvas.addEventListener('pointercancel', this._up);

      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(canvas);
      this.resize();
    }

    destroy() {
      this._resizeObserver.disconnect();
      this.canvas.removeEventListener('pointerdown', this._down);
      this.canvas.removeEventListener('pointermove', this._move);
      this.canvas.removeEventListener('pointerup', this._up);
      this.canvas.removeEventListener('pointercancel', this._up);
    }

    get isEmpty() {
      return this.strokes.length === 0 && !this.baseImage;
    }

    setBaseImage(img) {
      this.baseImage = img;
      this.redraw();
      this._changed();
    }

    clear() {
      this.strokes = [];
      this.baseImage = null;
      this.redraw();
      this._changed();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(global.devicePixelRatio || 1, 3);
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.redraw();
    }

    // Line width in canvas pixels, relative to canvas width so it survives resizes
    get lineWidth() {
      return Math.max(2, this.canvas.width * 0.008);
    }

    redraw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (this.baseImage) {
        const img = this.baseImage;
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1.5);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }
      for (const s of this.strokes) this._drawStroke(s);
    }

    _drawStroke(stroke) {
      const { ctx, canvas } = this;
      const pts = stroke.points.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.width }));
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = this.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, this.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      // Quadratic curves through midpoints for a smooth line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    _point(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.width };
    }

    _down(e) {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      this.current = { color: this.color, points: [this._point(e)] };
      this.strokes.push(this.current);
      this.redraw();
    }

    _move(e) {
      if (!this.current) return;
      e.preventDefault();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (events.length ? events : [e])) this.current.points.push(this._point(ev));
      this.redraw();
    }

    _up() {
      if (!this.current) return;
      this.current = null;
      this._changed();
    }

    _changed() {
      if (this.onChange) this.onChange();
    }

    // Returns a trimmed PNG blob with a transparent background, or null if empty.
    async toBlob() {
      if (this.isEmpty) return null;
      const { canvas } = this;
      const ctx = this.ctx;
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null;
      const pad = Math.round(this.lineWidth);
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width - 1, maxX + pad);
      maxY = Math.min(height - 1, maxY + pad);
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
      return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    }
  }

  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  /*
   * Opens the drawing dialog.
   * options:
   *   title        - dialog heading
   *   initialBlob  - existing signature to edit
   *   showSaveOption / saveChecked - show the "שמור לשימוש חוזר" checkbox (placing flow)
   *   confirmLabel - main button text
   * Resolves with { blob, save } or null when cancelled.
   */
  function openSignatureDialog(options = {}) {
    const {
      title = 'ציור חתימה',
      initialBlob = null,
      showSaveOption = false,
      saveChecked = true,
      confirmLabel = 'שמור'
    } = options;

    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'modal sig-dialog';
      dialog.setAttribute('aria-labelledby', 'sig-dialog-title');
      dialog.innerHTML = `
        <form method="dialog" class="modal-card">
          <header class="modal-header">
            <h2 id="sig-dialog-title"></h2>
            <button type="button" class="icon-btn" data-action="cancel" aria-label="סגור">✕</button>
          </header>
          <p class="modal-hint">ציירו את החתימה בתוך המסגרת בעזרת האצבע</p>
          <div class="sig-canvas-wrap">
            <canvas class="sig-canvas"></canvas>
            <span class="sig-baseline" aria-hidden="true"></span>
          </div>
          <div class="sig-tools">
            <div class="ink-colors" role="radiogroup" aria-label="צבע דיו">
              <label class="ink"><input type="radio" name="ink" value="black" checked><span class="ink-dot ink-black"></span>שחור</label>
              <label class="ink"><input type="radio" name="ink" value="blue"><span class="ink-dot ink-blue"></span>כחול</label>
            </div>
            <button type="button" class="btn btn-ghost" data-action="clear">נקה</button>
          </div>
          <label class="check save-option" hidden>
            <input type="checkbox" name="save"> שמור לשימוש חוזר
          </label>
          <p class="form-error" role="alert"></p>
          <footer class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">ביטול</button>
            <button type="submit" class="btn btn-primary" data-action="confirm" disabled></button>
          </footer>
        </form>`;
      document.body.appendChild(dialog);

      dialog.querySelector('h2').textContent = title;
      const confirmBtn = dialog.querySelector('[data-action="confirm"]');
      confirmBtn.textContent = confirmLabel;
      const saveOpt = dialog.querySelector('.save-option');
      const saveInput = saveOpt.querySelector('input');
      saveOpt.hidden = !showSaveOption;
      saveInput.checked = saveChecked;
      const errorEl = dialog.querySelector('.form-error');

      const pad = new SignaturePad(dialog.querySelector('canvas'));
      pad.onChange = () => {
        confirmBtn.disabled = pad.isEmpty;
        errorEl.textContent = '';
      };

      if (initialBlob) {
        loadImage(initialBlob).then((img) => pad.setBaseImage(img)).catch(() => {});
      }

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        pad.destroy();
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(value);
      };

      dialog.querySelectorAll('input[name="ink"]').forEach((r) => {
        r.addEventListener('change', () => { pad.color = INK_COLORS[r.value]; });
      });
      dialog.querySelector('[data-action="clear"]').addEventListener('click', () => pad.clear());
      dialog.querySelectorAll('[data-action="cancel"]').forEach((b) =>
        b.addEventListener('click', () => finish(null)));
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });

      dialog.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const blob = await pad.toBlob();
        if (!blob) {
          errorEl.textContent = 'יש לצייר חתימה לפני השמירה';
          return;
        }
        finish({ blob, save: showSaveOption ? saveInput.checked : true });
      });

      dialog.showModal();
      // Canvas has layout only after the dialog is shown
      requestAnimationFrame(() => pad.resize());
    });
  }

  global.SignaturePad = SignaturePad;
  global.openSignatureDialog = openSignatureDialog;
  global.loadImageFromBlob = loadImage;
})(window);
