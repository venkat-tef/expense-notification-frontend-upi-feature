import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemePicker } from '../../../shared/components/theme-picker/theme-picker';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FirebaseMessagingService } from '../../../services/firebase-messaging';

interface FutureConfigCategory {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-configuration-tab',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, ThemePicker],
  templateUrl: './configuration-tab.html',
  styleUrl: './configuration-tab.scss',
})
export class ConfigurationTab {
  private readonly auth = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly firebaseMessaging = inject(FirebaseMessagingService);

  // Placeholder cards only — no functionality yet. This is the "expandable architecture"
  // the spec asked for: each of these becomes a real section later without restructuring
  // the page, exactly like Appearance already is.
  //
  // "Notifications" was removed from this list — it now has a real card above (see
  // enableNotifications() below), because it needed an explicit tap target.
  readonly futureCategories: FutureConfigCategory[] = [
    { icon: 'apartment', title: 'Community', description: 'Building details, contact info' },
    { icon: 'autorenew', title: 'Rotation & Responsibilities', description: 'Water/garbage rules' },
    { icon: 'admin_panel_settings', title: 'Users & Access', description: 'Roles, permissions' },
    { icon: 'settings_suggest', title: 'System', description: 'Backup, export, general' },
  ];

  readonly notifPermission = this.notificationService.permission;

  readonly notifStatusText = computed(() => {
    switch (this.notifPermission()) {
      case 'granted':
        return 'Push notifications are enabled on this device.';
      case 'denied':
        return 'Notifications are blocked for this device in system settings. Enable them from your phone\u2019s Settings app, then reopen Nestly.';
      case 'unsupported':
        return 'This browser does not support push notifications.';
      default:
        return 'Push notifications are not enabled on this device yet.';
    }
  });

  readonly enabling = signal(false);

  /**
   * Explicit, tap-triggered notification opt-in.
   *
   * WHY THIS EXISTS (do not remove / do not replace the automatic attempt in app.ts —
   * this is additive, both paths stay):
   *
   * app.ts already calls NotificationService.requestPermissionOnce() automatically on
   * load. That works fine on Android/Chrome, but iOS Safari requires
   * Notification.requestPermission() to be invoked directly inside a real user gesture
   * (a tap/click handler) — if it's called from inside a .then()/async chain like the
   * app-boot flow, iOS silently refuses to ever show the system permission dialog. No
   * error is thrown, permission just stays "default" forever, and the app never appears
   * in iPhone Settings > Notifications at all. That's the "floating push doesn't arrive
   * on iOS, Android is fine" symptom.
   *
   * This button's click handler calls Notification.requestPermission() as the first
   * awaited call, directly from the tap, which satisfies iOS's user-activation
   * requirement and lets the OS permission dialog actually appear.
   */
  async enableNotifications(): Promise<void> {
    const user = this.auth.user();
    if (!user || this.enabling()) {
      return;
    }

    this.enabling.set(true);
    try {
      await this.notificationService.requestPermission();

      if (this.notifPermission() === 'granted') {
        await this.firebaseMessaging.requestPermission(user.uid);
        this.firebaseMessaging.listen();
      }
    } catch (err) {
      console.error('Manual notification enable failed', err);
    } finally {
      this.enabling.set(false);
    }
  }
}