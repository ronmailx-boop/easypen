/*
 * EasyPen - home screen: upload a PDF (or files to combine) and manage saved signatures.
 */
(function () {
  'use strict';

  const Storage = window.EasyPenStorage;
  const { toast } = window.EasyPenUI;
  const { t } = window.EasyPenI18n;

  const fileInput = document.getElementById('file-input');
  const uploadError = document.getElementById('upload-error');
  const sigList = document.getElementById('sig-list');
  const sigEmpty = document.getElementById('sig-empty');
  const sigCount = document.getElementById('sig-count');
  const addSigBtn = document.getElementById('add-sig-btn');
  const installBtn = document.getElementById('install-btn');
  const uploadBtn = document.querySelector('.upload-btn');
  const uploadStatus = document.getElementById('upload-status');
  const Combine = window.EasyPenCombine;

  const MSG_PDF_ONLY = t('home.pdfOnly');

  // Object URLs of the previews currently on screen (revoked on re-render)
  let previewUrls = [];

  function showUploadError(msg) {
    uploadError.textContent = msg;
  }

  // Messages passed from the share target / viewer via the query string
  function handleQueryErrors() {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error === 'type') showUploadError(MSG_PDF_ONLY);
    else if (error === 'share') showUploadError(t('home.shareError'));
    if (error) history.replaceState(null, '', location.pathname);
  }

  // One PDF opens as it is; several files (PDFs and JPG / PNG images, up to MAX_FILES)
  // or a single image become one PDF, in the order they were chosen
  async function onFileSelected() {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    showUploadError('');
    if (!files.length) return;
    if (!files.every((f) => Combine.isPdf(f) || Combine.isImage(f))) {
      showUploadError(MSG_PDF_ONLY);
      return;
    }
    if (files.length === 1 && Combine.isPdf(files[0])) {
      await openDocument(files[0].name || 'document.pdf', files[0]);
      return;
    }
    await openCombined(files);
  }

  // files: File objects or { name, blob } (shared to the app, see sw.js)
  async function openCombined(files) {
    const { MAX_FILES } = Combine;
    if (files.length > MAX_FILES) {
      showUploadError(t('home.tooManyFiles', { max: MAX_FILES }));
      return;
    }
    uploadBtn.classList.add('is-busy');
    uploadStatus.textContent = t('home.combining');
    let blob;
    try {
      blob = new Blob([await Combine.combineToPdf(files)], { type: 'application/pdf' });
    } catch (err) {
      console.error(err);
      const name = err.fileName;
      showUploadError(err.code === 'LOCKED' ? t('home.lockedPdf', { name })
        : err.code === 'BAD_FILE' ? t('home.fileError', { name }) : t('home.openError'));
      return;
    } finally {
      uploadBtn.classList.remove('is-busy');
      uploadStatus.textContent = '';
    }
    // Combined: the editor offers arrows to change the page order
    const base = (files[0].name || 'document').replace(/\.(pdf|jpe?g|png)$/i, '');
    await openDocument(`${base}.pdf`, blob, { combined: true });
  }

  async function openDocument(name, blob, options) {
    try {
      await Storage.setCurrentDocument(name, blob, options);
      location.href = 'viewer.html';
    } catch (err) {
      console.error(err);
      showUploadError(t('home.openError'));
    }
  }

  // Files shared to the app together wait in storage until this screen combines them
  async function openSharedFiles() {
    if (new URLSearchParams(location.search).get('source') !== 'share-files') return false;
    history.replaceState(null, '', location.pathname);
    let files = null;
    try {
      files = await Storage.takeSharedFiles();
    } catch (err) {
      console.error(err);
    }
    if (!files || !files.length) {
      showUploadError(t('home.shareError'));
      return true;
    }
    await openCombined(files);
    return true;
  }

  async function renderSignatures() {
    let list = [];
    try {
      list = await Storage.listSignatures();
    } catch (err) {
      console.error(err);
      toast(t('home.sigsLoadError'), 'error');
    }
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    previewUrls = [];
    sigList.replaceChildren();

    for (const sig of list) {
      const url = URL.createObjectURL(sig.blob);
      previewUrls.push(url);
      const li = document.createElement('li');
      li.className = 'sig-card';
      const img = document.createElement('img');
      img.src = url;
      img.alt = t('home.sigPreview');
      const actions = document.createElement('div');
      actions.className = 'sig-card-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-ghost btn-sm';
      edit.textContent = t('home.edit');
      edit.addEventListener('click', () => editSignature(sig));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm danger-text';
      del.textContent = t('home.delete');
      del.addEventListener('click', () => deleteSignature(sig));
      actions.append(edit, del);
      li.append(img, actions);
      sigList.appendChild(li);
    }

    const max = Storage.MAX_SIGNATURES;
    sigEmpty.hidden = list.length > 0;
    sigCount.textContent = list.length ? t('home.sigCount', { n: list.length, max }) : '';
    addSigBtn.hidden = list.length >= max;
  }

  async function addSignature() {
    const result = await window.openSignatureDialog({ title: t('home.newSig'), confirmLabel: t('home.saveForReuse') });
    if (!result) return;
    try {
      await Storage.addSignature(result.blob);
      toast(t('home.sigSaved'), 'success');
    } catch (err) {
      toast(err.code === 'LIMIT' ? t('home.sigLimit') : t('home.sigSaveError'), 'error');
    }
    renderSignatures();
  }

  async function editSignature(sig) {
    const result = await window.openSignatureDialog({
      title: t('home.editSig'),
      initialBlob: sig.blob,
      confirmLabel: t('home.save')
    });
    if (!result) return;
    try {
      await Storage.updateSignature(sig.id, result.blob);
      toast(t('home.sigUpdated'), 'success');
    } catch (err) {
      toast(t('home.sigUpdateError'), 'error');
    }
    renderSignatures();
  }

  async function deleteSignature(sig) {
    if (!confirm(t('home.deleteConfirm'))) return;
    try {
      await Storage.deleteSignature(sig.id);
      toast(t('home.sigDeleted'));
    } catch (err) {
      toast(t('home.sigDeleteError'), 'error');
    }
    renderSignatures();
  }

  // Optional "install app" button (Chromium's beforeinstallprompt)
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null;
    installBtn.hidden = true;
  });

  fileInput.addEventListener('change', onFileSelected);
  addSigBtn.addEventListener('click', addSignature);

  handleQueryErrors();
  renderSignatures();
  // Each document is a one-off local session: leaving the editor discards it
  // (cleared first, so it can't remove a document made from shared files)
  Storage.clearCurrentDocument().catch(() => {}).then(openSharedFiles);
})();
