import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protects app routes — redirects to /login if not authenticated. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady(); // wait for Firebase to restore any existing session first

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};