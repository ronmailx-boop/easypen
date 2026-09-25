/*
 * EasyPen - home screen: upload a PDF and manage saved signatures.
 */
(function () {
  'use strict';

  const Storage = window.EasyPenStorage;
  const { toast } = window.EasyPenUI;

  const fileInput = document.getElementById('file-input');
  const uploadError = document.getElementById('upload-error');
  const sigList = document.getElementById('sig-list');
  const sigEmpty = document.getElementById('sig-empty');
  const sigCount = document.getElementById('sig-count');
  const addSigBtn = document.getElementById('add-sig-btn');
  const installBtn = document.getElementById('install-btn');

  const MSG_PDF_ONLY = 'כרגע נתמכים קבצי PDF בלבד';

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
    else if (error === 'share') showUploadError('לא התקבל קובץ מהשיתוף. נסו שוב או העלו את הקובץ ידנית.');
    if (error) history.replaceState(null, '', location.pathname);
  }

  function looksLikePdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  }

  async function onFileSelected() {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    showUploadError('');
    if (!file) return;
    if (!looksLikePdf(file)) {
      showUploadError(MSG_PDF_ONLY);
      return;
    }
    try {
      await Storage.setCurrentDocument(file.name || 'document.pdf', file);
      location.href = 'viewer.html';
    } catch (err) {
      console.error(err);
      showUploadError('לא ניתן לפתוח את הקובץ. ייתכן שהאחסון בדפדפן חסום (למשל בגלישה בסתר).');
    }
  }

  async function renderSignatures() {
    let list = [];
    try {
      list = await Storage.listSignatures();
    } catch (err) {
      console.error(err);
      toast('לא ניתן לטעון את החתימות השמורות', 'error');
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
      img.alt = 'תצוגה מקדימה של חתימה שמורה';
      const actions = document.createElement('div');
      actions.className = 'sig-card-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-ghost btn-sm';
      edit.textContent = 'עריכה';
      edit.addEventListener('click', () => editSignature(sig));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm danger-text';
      del.textContent = 'מחיקה';
      del.addEventListener('click', () => deleteSignature(sig));
      actions.append(edit, del);
      li.append(img, actions);
      sigList.appendChild(li);
    }

    const max = Storage.MAX_SIGNATURES;
    sigEmpty.hidden = list.length > 0;
    sigCount.textContent = list.length ? `${list.length} מתוך ${max}` : '';
    addSigBtn.hidden = list.length >= max;
  }

  async function addSignature() {
    const result = await window.openSignatureDialog({ title: 'חתימה חדשה', confirmLabel: 'שמור לשימוש חוזר' });
    if (!result) return;
    try {
      await Storage.addSignature(result.blob);
      toast('החתימה נשמרה', 'success');
    } catch (err) {
      toast(err.code === 'LIMIT' ? 'אפשר לשמור עד 3 חתימות. מחקו חתימה קיימת כדי להוסיף חדשה.' : 'שמירת החתימה נכשלה', 'error');
    }
    renderSignatures();
  }

  async function editSignature(sig) {
    const result = await window.openSignatureDialog({
      title: 'עריכת חתימה',
      initialBlob: sig.blob,
      confirmLabel: 'שמור'
    });
    if (!result) return;
    try {
      await Storage.updateSignature(sig.id, result.blob);
      toast('החתימה עודכנה', 'success');
    } catch (err) {
      toast('עדכון החתימה נכשל', 'error');
    }
    renderSignatures();
  }

  async function deleteSignature(sig) {
    if (!confirm('למחוק את החתימה?')) return;
    try {
      await Storage.deleteSignature(sig.id);
      toast('החתימה נמחקה');
    } catch (err) {
      toast('מחיקת החתימה נכשלה', 'error');
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
