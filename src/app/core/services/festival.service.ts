import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Festival } from '../models/festival.model';
import { FESTIVALS, getActiveFestivals, getNextUpcoming, istDateKey } from '../models/festival-data';

/**
 * ADDITIVE — the ONE festival/date service in the app. Both the dashboard's
 * festival thorana and the reusable FestivalBanner component read from this
 * same singleton (rather than each keeping their own date logic), so there
 * is a single source of truth and no duplicate timers.
 *
 * No Firestore — `FESTIVALS` is static app configuration. Date matching
 * always uses Asia/Kolkata, independent of the device's local timezone.
 */
@Injectable({ providedIn: 'root' })
export class FestivalService implements OnDestroy {
  private readonly clockTick = signal(new Date());
  private readonly timer: ReturnType<typeof setInterval> = setInterval(
    () => this.clockTick.set(new Date()),
    60_000
  );

  readonly todayKey = computed(() => istDateKey(this.clockTick()));

  /** All festivals whose [startDate, endDate] range includes today (IST). Usually 0 or 1, occasionally more. */
  readonly activeFestivals = computed<Festival[]>(() =>
    getActiveFestivals(FESTIVALS, this.todayKey())
  );

  readonly hasActiveFestival = computed(() => this.activeFestivals().length > 0);

  /** The nearest festival still ahead of today — used for the banner's "Coming Soon" fallback. */
  readonly nextUpcoming = computed<Festival | undefined>(() =>
    getNextUpcoming(FESTIVALS, this.todayKey())
  );

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
