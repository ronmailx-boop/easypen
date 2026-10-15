/*
 * EasyPen - sharing the signed file.
 * Web Share API level 2 (files) with a regular download as fallback.
 * Exposes a global `EasyPenShare`.
 */
(function (global) {
  'use strict';

  function canShareFile(file) {
    try {
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) {
      return false;
    }
  }

  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser time to start the download before revoking
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /*
   * Tries to share; falls back to download.
   * Resolves with one of:
   *   'shared'     - share sheet completed
   *   'cancelled'  - user closed the share sheet (not an error)
   *   'downloaded' - share not supported/failed, file was downloaded
   *   'needs-gesture' - browser refused because the click "expired" (long processing);
   *                     caller should ask the user to tap again.
   */
  // text (optional): goes with the file, e.g. as the caption in WhatsApp
  async function shareOrDownload(file, { title = '', text = '' } = {}) {
    if (!canShareFile(file)) {
      download(file);
      return 'downloaded';
    }
    const data = { files: [file], title: title || file.name };
    if (text) data.text = text;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      if (err && err.name === 'NotAllowedError') return 'needs-gesture';
      console.warn('Share failed, falling back to download', err);
      download(file);
      return 'downloaded';
    }
  }

  // The app's address on its own domain, also when opened from another address
  const APP_URL = 'https://easypen.vplusstudio.app/';

  /*
   * Shares the app itself ("tell a friend"). Without a share sheet the link is copied.
   * Resolves with 'shared', 'cancelled', 'copied' or 'failed'.
   */
  async function shareApp(text) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'EasyPen', text, url: APP_URL });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${APP_URL}`);
      return 'copied';
    } catch (e) {
      return 'failed';
    }
  }

  global.EasyPenShare = { APP_URL, canShareFile, download, shareOrDownload, shareApp };
})(window);
