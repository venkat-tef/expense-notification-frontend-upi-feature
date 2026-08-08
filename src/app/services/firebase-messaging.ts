import { Injectable } from '@angular/core';
import { Messaging } from '@angular/fire/messaging';
import { getToken, onMessage } from 'firebase/messaging';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { getAuth } from 'firebase/auth';
import { firestoreDb } from '../core/services/firebase';

const SW_SCOPE = '/firebase-cloud-messaging-push-scope';
const SW_SCRIPT = '/firebase-messaging-sw.js';

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {

  constructor(
    private messaging: Messaging
  ) {}

  async requestPermission(userId: string) {
    try {
      // Clean up any OTHER service worker registration that also controls
      // firebase-messaging-sw.js — leftover from the era where this file existed in
      // both src/ and public/ and could get registered at more than one scope. An old
      // registration left running behind the current one is exactly what caused
      // notifications with no title/body preview to keep appearing even after the SW
      // source code was fixed: the browser was still executing the stale instance.
      const existing = await navigator.serviceWorker.getRegistrations();
      for (const reg of existing) {
        const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        const isOurScript = scriptUrl.includes('firebase-messaging-sw.js');
        const isCanonicalScope = reg.scope.endsWith(SW_SCOPE);
        if (isOurScript && !isCanonicalScope) {
          console.warn('Unregistering stale FCM service worker at scope', reg.scope);
          await reg.unregister();
        }
      }

      // Register the FCM service worker at a SEPARATE scope from ngsw-worker.js (which
      // already controls scope "/"). Without this, both service workers fight over the
      // same scope and background push delivery becomes unreliable/silent depending on
      // which one wins registration timing.
      //
      // updateViaCache: 'none' makes the browser always fetch this script fresh from the
      // network to check for changes, instead of potentially reusing an HTTP-cached copy
      // of the .js file — service worker scripts are otherwise easy to get "stuck" on an
      // old cached version even when the server has a newer one.
      const registration = await navigator.serviceWorker.register(SW_SCRIPT, {
        scope: SW_SCOPE,
        updateViaCache: 'none',
      });

      // Proactively check for a newer version right now rather than waiting for the
      // browser's own (much less frequent) background update check.
      registration.update().catch(() => {});

      const token = await getToken(this.messaging, {
        vapidKey: environment.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log('FCM Token:', token);
        console.log('Auth id', userId);
        console.log('Auth current user:', getAuth().currentUser);

        try {
          await setDoc(
            doc(firestoreDb, 'members', userId, 'fcmTokens', token),
            {
              token,
              createdAt: new Date(),
              platform: 'web'
            },
            { merge: true }
          );

          console.log('✅ Token saved successfully');

          // Remove any OTHER token docs for this member — old/dead tokens left behind
          // by previous SW registrations. Each one is a separate push subscription the
          // backend will happily send to, so leftover tokens are a direct cause of the
          // same device receiving more than one push for a single event.
          const tokensSnap = await getDocs(collection(firestoreDb, 'members', userId, 'fcmTokens'));
          const staleDeletes = tokensSnap.docs
            .filter((d) => d.id !== token)
            .map((d) => deleteDoc(doc(firestoreDb, 'members', userId, 'fcmTokens', d.id)));
          if (staleDeletes.length) {
            await Promise.all(staleDeletes);
            console.log(`🧹 removed ${staleDeletes.length} stale FCM token(s) for this member`);
          }
        } catch (e) {
          console.error('❌ Firestore save failed:', e);
        }
      } else {
        console.log('No registration token available.');
      }
    } catch (error) {
      console.error('FCM Error:', error);
    }
  }

  listen() {
    // Foreground messages are logged ONLY — never call showNotification()/new Notification()
    // here. The service worker (firebase-messaging-sw.js) is the single, canonical place a
    // browser notification is ever displayed, for both foreground and background delivery.
    // Adding a display call here was the exact cause of a THIRD notification appearing
    // whenever the app tab was open.
    onMessage(this.messaging, (payload) => {
      console.log('🔥 FCM onMessage (foreground) — not displaying, SW already handles this:', payload);
    });
  }
}