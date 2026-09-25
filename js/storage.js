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
    async setCurrentDocument(name, blob) {
      return withStore('session', 'readwrite', (s) =>
        s.put({ name, blob, createdAt: Date.now() }, 'current'));
    },

    async getCurrentDocument() {
      return withStore('session', 'readonly', (s) => s.get('current'));
    },

    async clearCurrentDocument() {
      return withStore('session', 'readwrite', (s) => s.delete('current'));
    }
  };

  global.EasyPenStorage = Storage;
})(typeof self !== 'undefined' ? self : window);
