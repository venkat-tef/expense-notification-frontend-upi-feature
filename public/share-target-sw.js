// ============================================================
// NESTLY — SHARE TARGET SERVICE WORKER
// ============================================================
//
// This is a SEPARATE, narrow-purpose service worker from the app's main
// ngsw-worker.js (Angular's build, handles app-shell caching) and from
// firebase-messaging-sw.js (push notifications). It does exactly one thing:
// intercept the Web Share Target POST that Android sends when a user shares
// an image into Nestly from Gallery/Photos, and hand that image off to the
// Angular app.
//
// It is registered with scope '/share-target/' (see main.ts), which is a
// sub-path of this file's own directory ('/'), so no extra
// Service-Worker-Allowed header is needed. Registering it at a narrow scope
// means it ONLY ever intercepts requests under '/share-target/' — it never
// competes with ngsw-worker.js or firebase-messaging-sw.js for any other URL
// in the app, and none of those existing service workers need to change.
//
// Flow:
//   1. Android POSTs the shared file(s) as multipart/form-data to
//      '/share-target/share' (the manifest's share_target.action).
//   2. This SW's fetch handler intercepts that POST, reads the first valid
//      image out of the form data (multiple shared images are explicitly
//      unsupported — only the first is ever used), and stores it in
//      IndexedDB so it survives the handoff to the Angular app.
//   3. It responds with a redirect into the Angular app, which then reads
//      the pending image back out of IndexedDB (see
//      PendingSharedImageService) and opens the existing Add Expense dialog
//      with it already attached.

const DB_NAME = 'nestly-share-target';
const DB_VERSION = 1;
const STORE_NAME = 'pending-image';
const RECORD_KEY = 'pending';

function openDb() {
  return new Promise((resolve, reject) => {
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

async function storePendingImage(file) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(
      { blob: file, type: file.type, name: file.name, createdAt: Date.now() },
      RECORD_KEY
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// Same rationale as firebase-messaging-sw.js: take control immediately so a
// newly deployed version of this file doesn't sit "waiting" behind an old
// instance.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target/share') {
    event.respondWith(handleShareTarget(event));
  }

  // Every other request under this SW's scope (there normally are none —
  // nothing else lives under /share-target/) falls through to the network
  // untouched, since we only call respondWith() for the exact share action.
});

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();

    // Requirement: multiple shared images -> use the first image only.
    const files = formData
      .getAll('images')
      .filter((f) => f instanceof File && f.size > 0 && f.type && f.type.startsWith('image/'));

    const file = files[0];

    if (file) {
      await storePendingImage(file);
      return Response.redirect('/expenses?shared=1', 303);
    }

    // Requirement: invalid/missing shared files -> fail safe, just open the
    // app normally instead of surfacing an error the OS share sheet has no
    // good UI for anyway.
    return Response.redirect('/expenses', 303);
  } catch (err) {
    console.error('[share-target-sw] failed to handle shared image', err);
    return Response.redirect('/expenses', 303);
  }
}
