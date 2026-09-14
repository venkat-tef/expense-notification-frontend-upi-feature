import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Registers the dedicated Web Share Target service worker (see
// public/share-target-sw.js). This is intentionally separate from
// Angular's own `provideServiceWorker('ngsw-worker.js', ...)` registration
// in app.config.ts and from firebase-messaging-sw.js — it is scoped to
// '/share-target/' only, so it never intercepts any other request in the
// app and neither existing service worker needs to change. Harmless
// no-op on browsers/platforms (e.g. iOS Safari) that don't support Web
// Share Target — the manifest's `share_target` entry simply won't be
// used there, and the in-dialog file-picker fallback covers those users.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/share-target-sw.js', { scope: '/share-target/' })
    .catch((err) => console.error('share-target-sw registration failed', err));
} 

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
