import { Injectable, OnDestroy, computed, signal } from '@angular/core';



import {
  FESTIVAL_DEFINITIONS,
  FestivalDefinition,
} from '../models/festival-data';

// FIX — import both from panchangam-js's own root entry, not from
// 'astronomy-engine' directly and not from the deep '/dist/core/panchangam'
// path. panchangam-js is CommonJS internally, so its own getPanchangam()
// verifies the observer you pass in against ITS require()'d copy of
// astronomy-engine's Observer class. Importing Observer separately from
// 'astronomy-engine' can resolve to a *different* physical build (ESM vs
// CJS) under bundler/module resolution — same class shape, different
// identity — which fails astronomy-engine's internal `instanceof Observer`
// check and throws "Not an instance of the Observer class", silently
// swallowed by the catch below (returns no festivals). panchangam-js
// re-exports Observer from its own root specifically to avoid this —
// importing both from here guarantees they're the same module instance.
import { getPanchangam, Observer } from '@ishubhamx/panchangam-js';

import { Festival } from '../models/festival.model';

@Injectable({
  providedIn: 'root',
})
export class FestivalService implements OnDestroy {

  /**
   * Nestly festival location:
   * Hyderabad, Telangana, India
   */
  private readonly observer = new Observer(
    17.3850,
    78.4867,
    542
  );

  private readonly clockTick = signal(new Date());

  private readonly timer = setInterval(() => {
    this.clockTick.set(new Date());
  }, 60_000);

  /**
   * ============================================================
   * TEMPORARY TEST MODE
   * ============================================================
   *
   * true  -> use TEST_DATE
   * false -> use today's actual date
   */
  // private readonly TEST_MODE = true;

  /**
   * Ganesh Chaturthi 2026 test date.
   *
   * Hyderabad:
   * September 14, 2026
   */
  // private readonly TEST_DATE = '2026-10-14';

  /**
   * Date used for Panchang calculation.
   */
  // private readonly calculationDate = computed(() => {

  //   if (this.TEST_MODE) {
  //     return new Date(
  //       `${this.TEST_DATE}T12:00:00+05:30`
  //     );
  //   }

  //   return this.clockTick();
  // });
  private readonly calculationDate = computed(() => {
  return this.clockTick();
});

  /**
   * Current/test date in YYYY-MM-DD format.
   */
  readonly todayKey = computed(() => {

    const date = this.calculationDate();

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(
      (part) => part.type === 'year'
    )?.value;

    const month = parts.find(
      (part) => part.type === 'month'
    )?.value;

    const day = parts.find(
      (part) => part.type === 'day'
    )?.value;

    return `${year}-${month}-${day}`;
  });

  /**
   * Festivals detected for the selected date.
   */
  readonly activeFestivals = computed<Festival[]>(() => {

    try {

      const date = this.calculationDate();

      /**
       * IMPORTANT:
       *
       * getPanchangam() calculates:
       *
       * - Tithi
       * - Paksha
       * - Masa
       * - Sunrise
       * - Sunset
       * - Vara
       * - Festival dates
       *
       * We then use panchang.festivals.
       */
      const panchang = getPanchangam(
        date,
        this.observer,
        {
          timezoneOffset: 330,
          calendarType: 'amanta',
        }
      );

      console.log(
        '[FestivalService] Date:',
        this.todayKey()
      );

      console.log(
        '[FestivalService] Panchang:',
        panchang
      );

      console.log(
        '[FestivalService] Panchang festivals:',
        panchang.festivals
      );

      const festivals =
        this.mapDetectedFestivals(
          panchang.festivals ?? []
        );

      console.log(
        '[FestivalService] Matched Nestly festivals:',
        festivals
      );

      return festivals;

    } catch (error) {

      console.error(
        '[FestivalService] Panchang calculation failed:',
        error
      );

      return [];
    }
  });

  /**
   * Used by dashboard and festival banner.
   */
  readonly hasActiveFestival = computed(
    () => this.activeFestivals().length > 0
  );

  /**
   * We intentionally do not show upcoming festivals.
   *
   * This preserves your requirement:
   *
   * Future festival -> NO banner
   * Festival today  -> SHOW banner
   * Past festival   -> NO banner
   */
  readonly nextUpcoming = computed<Festival | undefined>(
    () => undefined
  );

  /**
   * Convert Panchang library festivals into Nestly festivals.
   */
  private mapDetectedFestivals(
    detectedFestivals: unknown[]
  ): Festival[] {

    const resolved: Festival[] = [];

    for (const detected of detectedFestivals) {

      if (
        !detected ||
        typeof detected !== 'object'
      ) {
        continue;
      }

      const festivalRecord =
        detected as Record<string, unknown>;

      const name =
        typeof festivalRecord['name'] === 'string'
          ? festivalRecord['name']
          : '';

      if (!name) {
        continue;
      }

      console.log(
        '[FestivalService] Checking festival:',
        name
      );

      const definition =
        this.findFestivalDefinition(name);

      if (!definition) {
        console.log(
          '[FestivalService] No Nestly definition for:',
          name
        );

        continue;
      }

      resolved.push({
        ...definition.festival,
      });
    }

    return this.removeDuplicates(resolved);
  }

  /**
   * Match Panchang festival names against Nestly definitions.
   */
  private findFestivalDefinition(
    panchangName: string
  ): FestivalDefinition | undefined {

    const normalizedDetected =
      this.normalizeName(panchangName);

    if (!normalizedDetected) {
      return undefined;
    }

    return FESTIVAL_DEFINITIONS.find(
      (definition) =>
        definition.panchangNames.some(
          (name) => {

            const normalizedName =
              this.normalizeName(name);

            return (
              normalizedDetected === normalizedName ||
              normalizedDetected.includes(normalizedName) ||
              normalizedName.includes(normalizedDetected)
            );
          }
        )
    );
  }

  /**
   * Normalize names so that:
   *
   * Ganesh Chaturthi
   * Ganesha Chaturthi
   * GANESH-CHATURTHI
   *
   * can be compared safely.
   */
  private normalizeName(
    value: string
  ): string {

    return value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Remove duplicate festival IDs.
   */
  private removeDuplicates(
    festivals: Festival[]
  ): Festival[] {

    const seen = new Set<string>();

    return festivals.filter(
      (festival) => {

        if (seen.has(festival.id)) {
          return false;
        }

        seen.add(festival.id);

        return true;
      }
    );
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}