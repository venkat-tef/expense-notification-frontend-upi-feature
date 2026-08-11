import { Component, inject, signal, OnInit, OnDestroy, ApplicationRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MemberService } from '../../core/services/member.service';
import { WaterService } from '../../core/services/water.service';
import { CookingService } from '../../core/services/cooking.service';
import { AuthService } from '../../core/services/auth.service';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationSheet } from '../../shared/components/notification-sheet/notification-sheet';
import { MatBadgeModule } from '@angular/material/badge';
import { ThemeService } from '../../core/services/theme.service';

interface DashCard {
  path: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

const WATER_ACCENT = '#0288d1';
const COOKING_ACCENT = '#ef6c00';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatIconModule, MatBadgeModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly appRef = inject(ApplicationRef);
  readonly memberService = inject(MemberService);
  readonly waterService = inject(WaterService);
  readonly cookingService = inject(CookingService);
  readonly themeService = inject(ThemeService);

  readonly waterAccent = WATER_ACCENT;
  readonly cookingAccent = COOKING_ACCENT;

  readonly cards: DashCard[] = [
    { path: '/water', title: 'Water', subtitle: "See today's turn", icon: 'water_drop', color: WATER_ACCENT },
    { path: '/cooking', title: 'Garbage', subtitle: "See today's turn", icon: 'delete', color: COOKING_ACCENT },
    { path: '/expenses', title: 'Expenses', subtitle: 'Track & settle spending', icon: 'payments', color: '#7b1fa2' },
    { path: '/history', title: 'History', subtitle: 'Past records & stats', icon: 'history', color: '#00897b' },
    // { path: '/settings', title: 'Settings', subtitle: 'Manage roommates', icon: 'settings', color: '#455a64' },
  ];

  /** In-flight guards so a rapid double-tap can't fire two skips before the UI updates. */
  private readonly skippingWater = signal(false);
  private readonly skippingCooking = signal(false);

  readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);
  readonly notificationService = inject(NotificationService);

  private resumeRetryTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Forces an unconditional change-detection pass via ApplicationRef.tick() — not
   * NgZone.run(), which only helps if it's the outermost zone re-entry with an empty
   * microtask queue, and evidently wasn't reliably doing that here. tick() re-renders
   * every component's bindings against their current (already-correct) signal values
   * right now, regardless of zone/microtask state.
   *
   * Called twice on resume: once immediately, and once after a short delay — because on
   * app reopen there's often a brief network round trip before Firestore's onSnapshot
   * actually delivers the fresh doc, so a single immediate tick can fire before the real
   * data has arrived. The delayed tick catches that case without depending on the
   * snapshot callback's own zone re-entry timing.
   */
  private forceTick(): void {
    try {
      this.appRef.tick();
    } catch {
      // tick() can throw if called while a tick is already in progress; safe to ignore here.
    }
  }

  private readonly onResumeSignal = (): void => {
    this.forceTick();
    clearTimeout(this.resumeRetryTimeout);
    this.resumeRetryTimeout = setTimeout(() => this.forceTick(), 800);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.onResumeSignal();
    }
  };

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onResumeSignal);
    window.addEventListener('focus', this.onResumeSignal);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pageshow', this.onResumeSignal);
    window.removeEventListener('focus', this.onResumeSignal);
    clearTimeout(this.resumeRetryTimeout);
  }

  get nextWaterMember() {
    return this.waterService.getNextMember(
      this.memberService.rotationEligibleMembers()
    );
  }

  get nextCookingMember() {
    return this.cookingService.getNextMember(
      this.memberService.rotationEligibleMembers()
    );
  }

  private get todaysWaterRecord() {
    return this.waterService.recordForDate(this.todayKey());
  }

  private get todaysCookingRecord() {
    return this.cookingService.recordForDate(this.todayKey());
  }

  /**
   * Whoever is actually up for water today. Normally this is just `nextWaterMember`, but
   * once one or more people have already been skipped today it's whoever got reassigned
   * instead — so the dashboard (and the Skip button) always target the right person when
   * chaining multiple skips (2, 3, or more roommates unavailable in a row).
   */
  // get waterTurnMember() {
  //   const record = this.todaysWaterRecord;
  //   if (!record) return this.nextWaterMember;
  //   return this.memberService.members().find((m) => m.id === record.memberId) ?? this.nextWaterMember;
  // }
  get waterTurnMember() {
  const record = this.todaysWaterRecord;

  // No record yet → normal next turn
  if (!record) return this.nextWaterMember;

  // If today's duty was reassigned because of skips,
  // show the currently assigned member until the duty is completed.
  if (record.skippedMemberIds?.length && !this.waterDoneToday()) {
    return this.memberService.members().find(
      (m) => m.id === record.memberId
    ) ?? this.nextWaterMember;
  }

  // Today's duty is completed → show the NEXT person.
  return this.nextWaterMember;
}

  // get cookingTurnMember() {
  //   const record = this.todaysCookingRecord;
  //   if (!record) return this.nextCookingMember;
  //   return this.memberService.members().find((m) => m.id === record.memberId) ?? this.nextCookingMember;
  // }
  get cookingTurnMember() {
  const record = this.todaysCookingRecord;

  if (!record) return this.nextCookingMember;

  if (record.skippedMemberIds?.length && !this.cookingDoneToday()) {
    return this.memberService.members().find(
      (m) => m.id === record.memberId
    ) ?? this.nextCookingMember;
  }

  return this.nextCookingMember;
}

  /** True while today's water assignment is a pending reassignment from an earlier skip
   *  (not yet a confirmed manual pick) — used to show a "(reassigned)" hint in the UI. */
  waterWasReassignedToday(): boolean {
    return !!this.todaysWaterRecord?.skippedMemberIds?.length;
  }

  cookingWasReassignedToday(): boolean {
    return !!this.todaysCookingRecord?.skippedMemberIds?.length;
  }

  /**
   * Real display name for the header greeting — matched from `members` via the signed-in user's uid,
   * since Firebase Auth's displayName is never set for these accounts.
   */

logoSrc(): string {
  return this.themeService.activeThemeId() === 'midnight'
    ? 'assets/nestly-logo-dark.png'
    : 'assets/nestly-logo-light.png';
}
  
  get currentMemberName(): string | null {
    const uid = this.auth.user()?.uid;
    if (!uid) return null;

    const member = this.memberService.members().find((m) => m.uid === uid);
    return member?.name ?? null;
  }

  isSkippingWater(): boolean {
    return this.skippingWater();
  }

  isSkippingCooking(): boolean {
    return this.skippingCooking();
  }

  todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  waterDoneToday(): boolean {
    const record = this.waterService.recordForDate(this.todayKey());
    return !!record && !record.skippedMemberIds?.length;
  }

  cookingDoneToday(): boolean {
    const record = this.cookingService.recordForDate(this.todayKey());
    return !!record && !record.skippedMemberIds?.length;
  }

  async skipWater(): Promise<void> {
    const record = this.waterService.recordForDate(this.todayKey());
    const skipped = record
      ? this.memberService.members().find((m) => m.id === record.memberId) ?? this.nextWaterMember
      : this.nextWaterMember;
    if (!skipped || this.skippingWater() || this.waterDoneToday()) return;

    if (!confirm(`Skip ${skipped.name} for today's water turn?`)) return;

    this.skippingWater.set(true);

    try {
      const assigned = await this.waterService.skipMember(
        this.todayKey(),
        skipped.id,
        this.memberService.rotationEligibleMembers(),
        record?.skippedMemberIds ?? []
      );

      if (!assigned) {
        this.snackBar.open(
          'No other roommates available to reassign to.',
          'OK',
          { duration: 3000 }
        );
        return;
      }

      this.snackBar.open(
        `⏭️ ${skipped.name} skipped — water reassigned to ${assigned.name}`,
        undefined,
        {
          duration: 2200,
          panelClass: 'rm-snack-success',
        }
      );
    } finally {
      this.skippingWater.set(false);
    }
  }

  async skipCooking(): Promise<void> {
    const record = this.cookingService.recordForDate(this.todayKey());
    const skipped = record
      ? this.memberService.members().find((m) => m.id === record.memberId) ?? this.nextCookingMember
      : this.nextCookingMember;
    if (!skipped || this.skippingCooking() || this.cookingDoneToday()) return;

    if (!confirm(`Skip ${skipped.name} for today's cooking turn?`)) return;

    this.skippingCooking.set(true);

    try {
      const assigned = await this.cookingService.skipMember(
        this.todayKey(),
        skipped.id,
        this.memberService.rotationEligibleMembers(),
        record?.skippedMemberIds ?? []
      );

      if (!assigned) {
        this.snackBar.open(
          'No other roommates available to reassign to.',
          'OK',
          { duration: 3000 }
        );
        return;
      }

      this.snackBar.open(
        `⏭️ ${skipped.name} skipped — cooking reassigned to ${assigned.name}`,
        undefined,
        {
          duration: 2200,
          panelClass: 'rm-snack-success',
        }
      );
    } finally {
      this.skippingCooking.set(false);
    }
  }

  open(path: string): void {
    this.router.navigateByUrl(path);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openNotifications(): void {
    this.bottomSheet.open(NotificationSheet);
  }

  private checkDutyReminders(): void {
    const uid = this.auth.user()?.uid; // reuse whatever AuthService reference dashboard.ts already has
    if (!uid) return;

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    if (this.nextWaterMember?.id === uid && !this.waterDoneToday()) {
      this.notificationService.notifyOnce(
        `duty_water_${uid}_${today}`,
        uid,
        'duty_water',
        '💧 Water Duty',
        'Today is your water duty.',
        '/water'
      );
    }

    if (this.nextCookingMember?.id === uid && !this.cookingDoneToday()) {
      this.notificationService.notifyOnce(
        `duty_garbage_${uid}_${today}`,
        uid,
        'duty_garbage',
        '🗑 Garbage Duty',
        'Today is your garbage duty.',
        '/cooking'
      );
    }
  }
}