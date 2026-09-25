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
  async function shareOrDownload(file, { title = '' } = {}) {
    if (!canShareFile(file)) {
      download(file);
      return 'downloaded';
    }
    try {
      await navigator.share({ files: [file], title: title || file.name });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      if (err && err.name === 'NotAllowedError') return 'needs-gesture';
      console.warn('Share failed, falling back to download', err);
      download(file);
      return 'downloaded';
    }
  }

  global.EasyPenShare = { canShareFile, download, shareOrDownload };
})(window);
