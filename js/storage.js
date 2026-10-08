/*
 * EasyPen - IndexedDB wrapper.
 * Classic script so it can be loaded both by pages and by the Service Worker
 * (importScripts). Exposes a global `EasyPenStorage`.
 *
 * Stores:
 *   signatures - { id, blob (PNG, transparent), createdAt, updatedAt }
 *   session    - key "current" -> { name, blob, createdAt }  (the one open document)
 */
(function (global) {
  'use strict';

  const DB_NAME = 'easypen';
  const DB_VERSION = 1;
  const MAX_SIGNATURES = 3;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('signatures')) {
          db.createObjectStore('signatures', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Allow a retry after a failure (e.g. private mode blocked the open)
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  // Runs `fn(store)` inside a transaction and resolves with the request result.
  async function withStore(name, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const store = tx.objectStore(name);
      let result;
      const req = fn(store);
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  const Storage = {
    MAX_SIGNATURES,

    async listSignatures() {
      const all = await withStore('signatures', 'readonly', (s) => s.getAll());
      return (all || []).sort((a, b) => a.createdAt - b.createdAt);
    },

    async getSignature(id) {
      return withStore('signatures', 'readonly', (s) => s.get(id));
    },

    // Adds a new signature. Throws { code: 'LIMIT' } when the limit is reached.
    async addSignature(blob) {
      const list = await this.listSignatures();
      if (list.length >= MAX_SIGNATURES) {
        const err = new Error('Signature limit reached');
        err.code = 'LIMIT';
        throw err;
      }
      const now = Date.now();
      return withStore('signatures', 'readwrite', (s) =>
        s.add({ blob, createdAt: now, updatedAt: now }));
    },

    async updateSignature(id, blob) {
      const existing = await this.getSignature(id);
      if (!existing) return this.addSignature(blob);
      existing.blob = blob;
      existing.updatedAt = Date.now();
      return withStore('signatures', 'readwrite', (s) => s.put(existing));
    },

    async deleteSignature(id) {
      return withStore('signatures', 'readwrite', (s) => s.delete(id));
    },

    // The single, local, one-off document session.
    // options.combined: combined from several files / images on the home screen (its pages can be reordered)
    // options.parts: [{ name, pages }] - the files it was combined from, in page order
    async setCurrentDocument(name, blob, options = {}) {
      const parts = Array.isArray(options.parts) ? options.parts : null;
      return withStore('session', 'readwrite', (s) =>
        s.put({ name, blob, combined: !!options.combined, parts, createdAt: Date.now() }, 'current'));
    },

    async getCurrentDocument() {
      return withStore('session', 'readonly', (s) => s.get('current'));
    },

    async clearCurrentDocument() {
      return withStore('session', 'readwrite', (s) => s.delete('current'));
    },

    // Files shared to the app together (sw.js), waiting for the home screen to combine them
    async setSharedFiles(files) {
      return withStore('session', 'readwrite', (s) => s.put({ files, createdAt: Date.now() }, 'shared-files'));
    },

    // Returns [{ name, blob }] once and removes them
    async takeSharedFiles() {
      const record = await withStore('session', 'readonly', (s) => s.get('shared-files'));
      await withStore('session', 'readwrite', (s) => s.delete('shared-files'));
      return record ? record.files : null;
    }
  };

  global.EasyPenStorage = Storage;
})(typeof self !== 'undefined' ? self : window);
