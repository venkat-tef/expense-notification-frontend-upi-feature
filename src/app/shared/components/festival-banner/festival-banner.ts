import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { FestivalService } from '../../../core/services/festival.service';
import { FestivalArtworkService } from '../../../core/services/festival-artwork.service';
import { Festival } from '../../../core/models/festival.model';

const AUTO_ROTATE_MS = 6000;
const RESUME_AFTER_INTERACTION_MS = 10_000;
const SWIPE_THRESHOLD_PX = 40;

interface BannerItem {
  festival: Festival;
  upcoming: false;
}

@Component({
  selector: 'app-festival-banner',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
  ],
  templateUrl: './festival-banner.html',
  styleUrl: './festival-banner.scss',
})
export class FestivalBanner
  implements OnInit, OnDestroy {

  private readonly festivalService =
    inject(FestivalService);

  private readonly artworkService =
    inject(FestivalArtworkService);

  private readonly index = signal(0);

  private readonly paused = signal(false);

  private readonly artworkFailed =
    signal<Record<string, boolean>>({});

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    !!window
      .matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      )
      .matches;

  /**
   * IMPORTANT:
   *
   * Only today's active festivals are displayed.
   *
   * There is intentionally NO nextUpcoming() here.
   *
   * Therefore:
   *
   * Future festival -> nothing
   * Today festival -> banner
   * Past festival -> nothing
   */
  readonly items = computed<BannerItem[]>(() => {
    const active =
      this.festivalService.activeFestivals();

    return active.map(
      (festival) => ({
        festival,
        upcoming: false,
      })
    );
  });

  readonly showDots = computed(
    () => this.items().length > 1
  );

  readonly activeIndex = computed(
    () => this.index()
  );

  readonly current =
    computed<BannerItem | undefined>(() => {

      const list = this.items();

      if (!list.length) {
        return undefined;
      }

      const currentIndex =
        this.index() % list.length;

      return list[currentIndex];
    });

  /**
   * Material icon fallback.
   */
  readonly currentIcon = computed(() => {

    const item = this.current();

    if (!item) {
      return 'celebration';
    }

    return this.artworkService
      .resolveIcon(item.festival);
  });

  /**
   * Actual deity PNG.
   */
  readonly currentArtworkUrl =
    computed(() => {

      const item = this.current();

      if (!item) {
        return undefined;
      }

      /**
       * If this festival's image already failed,
       * don't repeatedly request it.
       */
      if (
        this.artworkFailed()[
          item.festival.id
        ]
      ) {
        return undefined;
      }

      return this.artworkService
        .resolveArtworkUrl(
          item.festival
        );
    });

  private rotateTimer?:
    ReturnType<typeof setInterval>;

  private resumeTimer?:
    ReturnType<typeof setTimeout>;

  ngOnInit(): void {

    if (this.prefersReducedMotion) {
      return;
    }

    this.rotateTimer =
      setInterval(() => {

        if (!this.paused()) {
          this.next();
        }

      }, AUTO_ROTATE_MS);
  }

  ngOnDestroy(): void {

    clearInterval(
      this.rotateTimer
    );

    clearTimeout(
      this.resumeTimer
    );
  }

  next(): void {

    const count =
      this.items().length;

    if (count < 2) {
      return;
    }

    this.index.update(
      (i) => (i + 1) % count
    );
  }

  prev(): void {

    const count =
      this.items().length;

    if (count < 2) {
      return;
    }

    this.index.update(
      (i) =>
        (i - 1 + count) % count
    );
  }

  goTo(index: number): void {

    this.index.set(index);

    this.pauseThenResume();
  }

  onArtworkError(): void {

    const item =
      this.current();

    if (!item) {
      return;
    }

    console.warn(
      'Festival artwork failed:',
      item.festival.name
    );

    this.artworkFailed.update(
      (map) => ({
        ...map,
        [item.festival.id]: true,
      })
    );
  }

  private pauseThenResume(): void {

    this.paused.set(true);

    clearTimeout(
      this.resumeTimer
    );

    this.resumeTimer =
      setTimeout(() => {

        this.paused.set(false);

      }, RESUME_AFTER_INTERACTION_MS);
  }

  private touchStartX = 0;

  onTouchStart(
    event: TouchEvent
  ): void {

    this.touchStartX =
      event.changedTouches[0]
        ?.clientX ?? 0;

    this.pauseThenResume();
  }

  onTouchEnd(
    event: TouchEvent
  ): void {

    const currentX =
      event.changedTouches[0]
        ?.clientX ?? 0;

    const dx =
      currentX -
      this.touchStartX;

    if (
      Math.abs(dx) <
      SWIPE_THRESHOLD_PX
    ) {
      return;
    }

    if (dx < 0) {
      this.next();
    } else {
      this.prev();
    }
  }
}