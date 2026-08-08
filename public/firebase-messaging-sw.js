importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAmXyY8D1NxqlBVrJpALiSxM-7qRB1inr4',
  authDomain: 'room-manager-9d417.firebaseapp.com',
  projectId: 'room-manager-9d417',
  storageBucket: 'room-manager-9d417.firebasestorage.app',
  messagingSenderId: '713880758367',
  appId: '1:713880758367:web:595534eb6d93c33e4ed3ea',
});

const messaging = firebase.messaging();

// CRITICAL: without these two listeners, a newly deployed version of this file installs
// into a "waiting" state and the PREVIOUS SW instance keeps running indefinitely — every
// tab has to be fully closed (not just refreshed) before the new code ever takes over.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage', payload);

  // The backend (pushService.js) sends DATA-ONLY messages on purpose — no top-level
  // `notification` block — so that THIS handler is the only place a notification can
  // ever be created. That means title/body/icon/badge MUST be read from payload.data,
  // never payload.notification (which is always undefined for a data-only payload —
  // reading it was the exact cause of the missing preview).
  const data = payload.data || {};

  self.registration.showNotification(data.title || 'Nestly', {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    // Stable tag per event: if this ever gets delivered twice, the browser REPLACES
    // the existing notification with the same tag instead of stacking a second one.
    tag: data.expenseId || data.type || undefined,
    data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});