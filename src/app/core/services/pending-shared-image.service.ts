import { Injectable } from '@angular/core';

// Mirrors the constants in public/share-target-sw.js exactly — both sides
// read/write the same IndexedDB database, so the names must match.
const DB_NAME = 'nestly-share-target';
const DB_VERSION = 1;
const STORE_NAME = 'pending-image';
const RECORD_KEY = 'pending';

// Anything older than this is treated as a stale, abandoned share intent
// (e.g. the user shared an image, then never actually reopened Nestly until
// much later) rather than the one that just triggered this app launch.
const MAX_PENDING_AGE_MS = 5 * 60 * 1000;

interface StoredShareRecord {
  blob: Blob;
  type: string;
  name: string;
  createdAt: number;
}

/**
 * Reads the image that public/share-target-sw.js stashed in IndexedDB when
 * the user shared it into Nestly from the Android Share Sheet, so it can be
 * handed to the existing Add Expense dialog exactly as if it had been picked
 * manually.
 */
@Injectable({ providedIn: 'root' })
export class PendingSharedImageService {
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Reads and immediately clears whatever pending shared image is stored
   * (there is ever at most one — a newer share always overwrites an older,
   * unread one), returning it as a real `File` so it behaves identically to
   * a manually-selected file in the Add Expense dialog.
   *
   * Returns `null` — never throws — for any of: nothing pending, a stale
   * (too-old) pending image, or a read failure. Callers should treat `null`
   * as "just open normally, no shared image", never as an error to surface.
   */
  async takePendingImage(): Promise<File | null> {
    let db: IDBDatabase;
    try {
      db = await this.openDb();
    } catch (err) {
      console.warn('Could not open share-target IndexedDB', err);
      return null;
    }

    let record: StoredShareRecord | undefined;
    try {
      record = await new Promise<StoredShareRecord | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(RECORD_KEY);

        getReq.onsuccess = () => {
          const value = getReq.result as StoredShareRecord | undefined;
          // Always clear on read, whether or not it turns out to be usable —
          // a pending shared image is a one-shot handoff, never re-shown.
          store.delete(RECORD_KEY);
          resolve(value);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      console.warn('Could not read pending shared image', err);
      db.close();
      return null;
    }

    db.close();

    if (!record || !record.blob || record.blob.size === 0) {
      return null;
    }

    if (Date.now() - record.createdAt > MAX_PENDING_AGE_MS) {
      return null; // stale — silently discard rather than surprising the user later
    }

    const type = record.type || record.blob.type;
    if (!type || !type.startsWith('image/')) {
      return null; // invalid/missing file safety net
    }

    return new File([record.blob], record.name || 'shared-image', { type });
  }
}
