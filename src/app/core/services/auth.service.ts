import { Injectable, signal, computed, NgZone, inject } from '@angular/core';
import {
  User,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly zone = inject(NgZone);

  /** True once Firebase has finished restoring any existing session from storage. */
  readonly ready = signal(false);
  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readyResolve!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor() {
    // Keeps the session alive across refreshes and browser restarts until explicit logout.
    setPersistence(firebaseAuth, browserLocalPersistence).catch((err) =>
      console.error('Failed to set auth persistence', err)
    );

    // Same reasoning as NotificationService's onSnapshot: Firebase Auth's internal session
    // restore (IndexedDB/fetch under the hood) isn't reliably zone-patched on every
    // browser/WebView — notably mobile Safari and installed-PWA standalone mode. Without this,
    // `user` updates correctly but Angular doesn't always repaint, which is what made this
    // device-dependent instead of a consistent bug.
    this.zone.runOutsideAngular(() => {
      onAuthStateChanged(firebaseAuth, (user) => {
        this.zone.run(() => {
          this.user.set(user);
          if (!this.ready()) {
            this.ready.set(true);
            this.readyResolve();
          }
        });
      });
    });
  }

  /** Guards await this so they never redirect before Firebase has restored the session. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async login(email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return true;
    } catch (err: any) {
      this.error.set(this.mapAuthError(err?.code));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
  }

  clearError(): void {
    this.error.set(null);
  }

  private mapAuthError(code?: string): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'That email address looks invalid.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error — please check your connection and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}