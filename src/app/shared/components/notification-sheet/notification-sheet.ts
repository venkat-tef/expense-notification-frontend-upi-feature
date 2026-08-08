import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';

const ICONS: Record<string, string> = {
  expense: 'payments', member_joined: 'person_add', skip: 'skip_next',
  announcement: 'campaign', duty_water: 'water_drop', duty_garbage: 'delete',
  settlement: 'account_balance_wallet',
  settlement_completed: 'task_alt', settlement_ready: 'receipt_long', // NEW
};

@Component({
  selector: 'app-notification-sheet',
  standalone: true,
  imports: [MatBottomSheetModule, MatIconModule],
  templateUrl: './notification-sheet.html',
  styleUrl: './notification-sheet.scss',
})
export class NotificationSheet {
  private readonly sheetRef = inject(MatBottomSheetRef<NotificationSheet>);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly notifications = inject(NotificationService);

  /** Current user's uid, used to check membership in a notification's readBy array. */
  uid(): string {
    return this.auth.user()?.uid ?? '';
  }

  /** Only show notifications this user hasn't read yet — read ones drop off the sheet. */
  readonly visible = computed(() =>
    this.notifications.notifications().filter((n) => !n.readBy.includes(this.uid()))
  );

  icon(type: string): string {
    return ICONS[type] ?? 'notifications';
  }

  timeAgo(ts: number): string {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  async open(n: AppNotification): Promise<void> {
    try {
      await this.notifications.markRead(n.id);
    } catch (err) {
      console.error('Failed to mark notification read', n.id, err);
    }
    this.sheetRef.dismiss();
    this.router.navigateByUrl(n.url);
  }

  async markAllRead(): Promise<void> {
    try {
      await this.notifications.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  }
}