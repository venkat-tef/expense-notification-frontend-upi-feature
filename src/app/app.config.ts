import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideFirebaseApp } from '@angular/fire/app';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { provideFirestore } from '@angular/fire/firestore';
import { firebaseApp, firestoreDb } from './core/services/firebase'; // adjust path to your actual firebase.ts location

export const appConfig: ApplicationConfig = {
 providers: [
  provideZoneChangeDetection({ eventCoalescing: true }),
  provideRouter(routes, withComponentInputBinding()),
  provideAnimationsAsync(),

  // Reuse the SAME app + Firestore instance firebase.ts already created and that
  // firebaseAuth (used for actual sign-in) is attached to — instead of creating a second,
  // disconnected Firebase App via a duplicate initializeApp()/getFirestore() call.
  provideFirebaseApp(() => firebaseApp),
  provideFirestore(() => firestoreDb),
  provideMessaging(() => getMessaging(firebaseApp)),

  provideServiceWorker('ngsw-worker.js', {
    enabled: !isDevMode(),
    registrationStrategy: 'registerWhenStable:30000'
  }),
]
};