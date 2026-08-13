import { Component, inject, signal, computed, OnInit, OnDestroy, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlySummaryService } from '../../core/services/monthly-summary.service';
import { AppNotification, NotificationType } from '../../core/models/notification.model';

interface DashCard {
  path: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

interface QuickAction {
  path: string;
  label: string;
  icon: string;
  color: string;
}

const WATER_ACCENT = '#0288d1';
const COOKING_ACCENT = '#ef6c00';

/**
 * ADDITIVE — Recent Activity icon map. Deliberately mirrors the same
 * type -> icon convention already used in notification-sheet.ts (kept as a
 * separate local const there too), rather than introducing a new shared
 * lookup that neither file currently depends on.
 */
const ACTIVITY_ICONS: Partial<Record<NotificationType, string>> = {
  expense: 'payments',
  member_joined: 'person_add',
  skip: 'skip_next',
  announcement: 'campaign',
  announcement_bell: 'campaign',
  duty_water: 'water_drop',
  duty_garbage: 'delete',
  settlement: 'account_balance_wallet',
  settlement_completed: 'task_alt',
  settlement_ready: 'receipt_long',
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatBadgeModule],
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

  // ADDITIVE — read-only, reuse the existing singleton services (same instances
  // already streaming data for the Expenses/History screens). No new Firestore
  // listeners are created by injecting them here.
  readonly expenseService = inject(ExpenseService);
  readonly summaryService = inject(MonthlySummaryService);

  readonly waterAccent = WATER_ACCENT;
  readonly cookingAccent = COOKING_ACCENT;

  readonly cards: DashCard[] = [
    { path: '/water', title: 'Water', subtitle: "See today's turn", icon: 'water_drop', color: WATER_ACCENT },
    { path: '/cooking', title: 'Garbage', subtitle: "See today's turn", icon: 'delete', color: COOKING_ACCENT },
    { path: '/expenses', title: 'Expenses', subtitle: 'Track & settle spending', icon: 'payments', color: '#7b1fa2' },
    { path: '/history', title: 'History', subtitle: 'Past records & stats', icon: 'history', color: '#00897b' },
    // { path: '/settings', title: 'Settings', subtitle: 'Manage roommates', icon: 'settings', color: '#455a64' },
  ];

  /** ADDITIVE — Quick Actions row. Reuses the same router.navigateByUrl path as open(). */
  readonly quickActions: QuickAction[] = [
    { path: '/expenses', label: 'Expense', icon: 'add', color: '#7b1fa2' },
    { path: '/water', label: 'Water', icon: 'water_drop', color: WATER_ACCENT },
    { path: '/cooking', label: 'Garbage', icon: 'delete', color: COOKING_ACCENT },
  ];

  /** In-flight guards so a rapid double-tap can't fire two skips before the UI updates. */
  private readonly skippingWater = signal(false);
  private readonly skippingCooking = signal(false);

  // ============================================================
  // ADDITIVE — GREETING (auto-updates through the day)
  // ============================================================
  //
  // `clockTick` is a plain writable signal ticked once a minute. Reading it
  // inside `greeting` (a computed) is what makes the greeting flip from
  // "Good morning" to "Good afternoon" etc. on its own while the dashboard
  // stays open — Angular's signal reactivity re-renders the template as
  // soon as the computed's value actually changes, no manual tick needed.
  private readonly clockTick = signal(new Date());
  private greetingTimer?: ReturnType<typeof setInterval>;

  readonly greeting = computed(() => {
    const hour = this.clockTick().getHours();
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  });

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

    this.clockTick.set(new Date());
    this.greetingTimer = setInterval(() => this.clockTick.set(new Date()), 60_000);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pageshow', this.onResumeSignal);
    window.removeEventListener('focus', this.onResumeSignal);
    clearTimeout(this.resumeRetryTimeout);
    clearInterval(this.greetingTimer);
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

  // ============================================================
  // ADDITIVE — THIS MONTH EXPENSE SUMMARY
  // ============================================================
  //
  // Mirrors the exact grandTotal/settlement formula in expenses.ts
  // (Expenses.grandTotal / Expenses.settlement) against the SAME
  // singleton services, so the numbers always agree with the Expenses
  // screen. This is intentionally NOT a second calculation system with
  // its own rules — settlement math has no shared service to import from
  // (it lives as a component-local `computed()` in expenses.ts), so this
  // mirrors that same formula rather than reimplementing new logic.
  // If that formula ever changes in expenses.ts, mirror the change here.

  private readonly monthExpenses = computed(() =>
    this.expenseService.forMonth(currentMonthKey())
  );

  readonly monthExpenseTotal = computed(() => {
    const summary = this.summaryService.forMonth(currentMonthKey());
    const otherTotal = this.monthExpenses().reduce((sum, e) => sum + e.amount, 0);
    return (summary?.roomRent ?? 0) + (summary?.electricityBill ?? 0) + otherTotal;
  });

  /** Per-member settlement for the current month — same shape/formula as Expenses.settlement. */
  private readonly monthSettlement = computed(() => {
    const members = this.memberService.rotationEligibleMembers();
    if (!members.length) return [];

    const share = this.monthExpenseTotal() / members.length;
    const paidMap = new Map<string, number>();
    for (const e of this.monthExpenses()) {
      paidMap.set(e.paidByMemberId, (paidMap.get(e.paidByMemberId) ?? 0) + e.amount);
    }

    return members.map((m) => {
      const paid = paidMap.get(m.id) ?? 0;
      return { memberId: m.id, memberName: m.name, paid, share, remaining: share - paid };
    });
  });

  /** The signed-in member's own settlement row for this month, if resolvable. */
  readonly myMonthSettlement = computed(() => {
    const me = this.memberService.currentMember();
    if (!me) return undefined;
    return this.monthSettlement().find((s) => s.memberId === me.id);
  });

  /** Positive amount the signed-in member still owes this month (0 if none / not resolvable). */
  readonly youOwe = computed(() => {
    const remaining = this.myMonthSettlement()?.remaining ?? 0;
    return remaining > 0.5 ? remaining : 0;
  });

  /** Positive amount the signed-in member is owed back this month (0 if none / not resolvable). */
  readonly youGet = computed(() => {
    const remaining = this.myMonthSettlement()?.remaining ?? 0;
    return remaining < -0.5 ? Math.abs(remaining) : 0;
  });

  /** Total amount the signed-in member has actually paid out so far this month. */
  readonly youSpent = computed(() => this.myMonthSettlement()?.paid ?? 0);

  readonly hasExpenseData = computed(
    () => this.monthExpenses().length > 0 || !!this.summaryService.forMonth(currentMonthKey())
  );

  // ============================================================
  // ADDITIVE — RECENT ACTIVITY
  // ============================================================
  //
  // Reuses NotificationService.notifications() — the SAME live, already-
  // per-user-filtered feed that powers the bell — so no duplicate Firestore
  // records or listeners are created just to show this section.

  readonly recentActivity = computed<AppNotification[]>(() =>
    this.notificationService.notifications().slice(0, 5)
  );

  activityIcon(type: NotificationType): string {
    return ACTIVITY_ICONS[type] ?? 'notifications';
  }

  timeAgo(ts: number): string {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
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