import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BottomNav } from './shared/components/bottom-nav/bottom-nav';
import { AuthService } from './core/services/auth.service';
import { MemberService } from './core/services/member.service';
import { NotificationService } from './core/services/notification.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { FirebaseMessagingService } from './services/firebase-messaging';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BottomNav],
  template: `
  @if (ready()) {
  <div class="rm-app-scroll">
    <router-outlet />
  </div>

  @if (showBottomNav()) {
    <app-bottom-nav />
  }
}@else {
      <div class="rm-splash">
       
        <img class="rm-splash__logo" src="icons/icon-192x192.png" alt="Nestly" />
        <p class="rm-splash__title">Nestly</p>
        <p class="rm-splash__tagline">Smart. Simple. Connected.</p>
      </div>
    }
  `,
  styles: [`
    /*
     * Single scroll container for the whole app.
     * html/body are pinned (see styles.scss) so the document itself can
     * never be dragged/rubber-banded on iOS home-screen (standalone) PWAs.
     * This element is the ONLY thing that scrolls. If a page's content is
     * shorter than the viewport there is nothing to drag here at all, so
     * the iOS bounce effect cannot trigger. If a page's content is taller
     * (e.g. Expenses), it scrolls normally and contains its own bounce.
     */
    .rm-app-scroll {
      height: 100vh; /* fallback for older iOS Safari without dvh support */
      height: 100dvh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
    }
    .rm-splash {
      height: 100vh;
      width: 100%;
      background: #f5f7fa;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .rm-splash__wave {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      display: block;
    }
    .rm-splash__logo {
      width: 96px;
      height: 96px;
      border-radius: 22px;
      margin-bottom: 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      position: relative;
      z-index: 1;
    }
    .rm-splash__title {
      font-size: 34px;
      font-weight: 800;
      color: #111;
      margin: 0;
      letter-spacing: -0.01em;
      position: relative;
      z-index: 1;
    }
    .rm-splash__tagline {
      font-size: 14px;
      color: #666;
      margin-top: 6px;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
  `],
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);
  private readonly pwaUpdate = inject(PwaUpdateService);
  private readonly router = inject(Router);

readonly showBottomNav = signal(false);

  // NEW
  private readonly firebaseMessaging = inject(FirebaseMessagingService);

  readonly ready = signal(false);

  constructor() {
    this.pwaUpdate.init();

    this.auth.whenReady().then(() => {
      this.ready.set(true);
    });

    this.memberService.whenLoaded().then(async () => {
      await this.memberService.seedDefaultsIfEmpty();

      if (this.auth.user()) {
        this.notifications.requestPermissionOnce().catch((err) =>
          console.error('Notification prompt failed', err)
        );

        // NEW
        const user = this.auth.user();
        console.log(user);

if (user) {
  await this.firebaseMessaging.requestPermission(user.uid);
  this.firebaseMessaging.listen();
}
       
      }
    });

    this.router.events
  .pipe(filter(event => event instanceof NavigationEnd))
  .subscribe(() => {

    const hideRoutes = [
      '/login',
      '/signup',
      '/forgot-password',
      '/welcome'
    ];

    const hide =
      hideRoutes.some(r => this.router.url.startsWith(r));

    this.showBottomNav.set(!hide);
  });
  }
}