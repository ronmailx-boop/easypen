/*
 * EasyPen - home screen: upload a PDF and manage saved signatures.
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
  const Images = window.EasyPenImages;

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
    if (error === 'type') showUploadError(t('home.sharePdfOnly'));
    else if (error === 'share') showUploadError(t('home.shareError'));
    if (error) history.replaceState(null, '', location.pathname);
  }

  function looksLikePdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  }

  // One PDF, or up to MAX_IMAGES JPG photos that become one PDF (a page per photo)
  async function onFileSelected() {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    showUploadError('');
    if (!files.length) return;
    const { isJpeg, MAX_IMAGES } = Images;
    const photos = files.every(isJpeg);
    if (!photos && !(files.length === 1 && looksLikePdf(files[0]))) {
      showUploadError(files.some(looksLikePdf) || files.every((f) => looksLikePdf(f) || isJpeg(f))
        ? t('home.oneDocument', { max: MAX_IMAGES })
        : MSG_PDF_ONLY);
      return;
    }
    if (photos && files.length > MAX_IMAGES) {
      showUploadError(t('home.tooManyImages', { max: MAX_IMAGES }));
      return;
    }

    let name = files[0].name || 'document.pdf';
    let blob = files[0];
    if (photos) {
      uploadBtn.classList.add('is-busy');
      uploadStatus.textContent = t('home.converting');
      try {
        blob = new Blob([await Images.imagesToPdf(files)], { type: 'application/pdf' });
        name = `${(files[0].name || 'photos').replace(/\.jpe?g$/i, '')}.pdf`;
      } catch (err) {
        console.error(err);
        showUploadError(err.code === 'NOT_JPEG' ? t('home.imageError', { name: err.fileName }) : t('home.openError'));
        return;
      } finally {
        uploadBtn.classList.remove('is-busy');
        uploadStatus.textContent = '';
      }
    }
    try {
      await Storage.setCurrentDocument(name, blob);
      location.href = 'viewer.html';
    } catch (err) {
      console.error(err);
      showUploadError(t('home.openError'));
    }
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
  Storage.clearCurrentDocument().catch(() => {});
})();
