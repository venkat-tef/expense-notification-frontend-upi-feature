import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FestivalService } from '../../../core/services/festival.service';
import { FestivalArtworkService } from '../../../core/services/festival-artwork.service';
import { Festival, FestivalDecoration } from '../../../core/models/festival.model';

const AUTO_ROTATE_MS = 6000;
const RESUME_AFTER_INTERACTION_MS = 10_000;
const SWIPE_THRESHOLD_PX = 40;

interface BannerItem {
  festival: Festival;
  /** True when there's no active festival today and this is the nearest upcoming one instead. */
  upcoming: boolean;
}

/**
 * ADDITIVE — reusable Festival Wishes Banner.
 *
 * Self-contained: reads festival/date state from the shared `FestivalService`
 * and resolves artwork/icons via `FestivalArtworkService`, so it carries no
 * hardcoded image logic and no date-matching logic of its own. Renders
 * nothing (`@if (current(); as item)`) when there's nothing to show, so it
 * costs zero layout space when unused.
 *
 * Drop `<app-festival-banner></app-festival-banner>` anywhere; no inputs
 * are required. Adding a new festival is purely a festival-data.ts edit —
 * this component never needs to change.
 */
@Component({
  selector: 'app-festival-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './festival-banner.html',
  styleUrl: './festival-banner.scss',
})
export class FestivalBanner implements OnInit, OnDestroy {
  private readonly festivalService = inject(FestivalService);
  private readonly artworkService = inject(FestivalArtworkService);

  private readonly index = signal(0);
  private readonly paused = signal(false);
  /** Per-festival-id flag set once a configured artworkUrl has failed to load, so we never retry a broken image. */
  private readonly artworkFailed = signal<Record<string, boolean>>({});

  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /** Active festivals today, or — if none — a single "Coming Soon" entry for the nearest upcoming one. */
  readonly items = computed<BannerItem[]>(() => {
    const active = this.festivalService.activeFestivals();
    if (active.length) return active.map((festival) => ({ festival, upcoming: false }));

    const next = this.festivalService.nextUpcoming();
    return next ? [{ festival: next, upcoming: true }] : [];
  });

  readonly showDots = computed(() => this.items().length > 1);
  readonly activeIndex = computed(() => this.index());

  readonly current = computed<BannerItem | undefined>(() => {
    const list = this.items();
    if (!list.length) return undefined;
    return list[this.index() % list.length];
  });

  readonly currentIcon = computed(() => {
    const item = this.current();
    return item ? this.artworkService.resolveIcon(item.festival) : 'celebration';
  });

  /** Trusted URL to try, or undefined to show the safe icon/emoji fallback (never a broken <img>). */
  readonly currentArtworkUrl = computed(() => {
    const item = this.current();
    if (!item) return undefined;
    if (this.artworkFailed()[item.festival.id]) return undefined;
    return this.artworkService.resolveArtworkUrl(item.festival);
  });

  private rotateTimer?: ReturnType<typeof setInterval>;
  private resumeTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // No auto-rotation at all when the user prefers reduced motion — manual
    // dot taps / swipe still work either way.
    if (this.prefersReducedMotion) return;

    this.rotateTimer = setInterval(() => {
      if (this.paused()) return;
      this.next();
    }, AUTO_ROTATE_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.rotateTimer);
    clearTimeout(this.resumeTimer);
  }

  decorationGlyph(decoration: FestivalDecoration): string {
    return this.artworkService.resolveDecorationGlyph(decoration);
  }

  next(): void {
    const count = this.items().length;
    if (count < 2) return;
    this.index.update((i) => (i + 1) % count);
  }

  prev(): void {
    const count = this.items().length;
    if (count < 2) return;
    this.index.update((i) => (i - 1 + count) % count);
  }

  goTo(i: number): void {
    this.index.set(i);
    this.pauseThenResume();
  }

  onArtworkError(): void {
    const item = this.current();
    if (!item) return;
    this.artworkFailed.update((m) => ({ ...m, [item.festival.id]: true }));
  }

  private pauseThenResume(): void {
    this.paused.set(true);
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => this.paused.set(false), RESUME_AFTER_INTERACTION_MS);
  }

  // ---- swipe support (touch only — dots cover pointer/keyboard nav) ----
  private touchStartX = 0;

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0]?.clientX ?? 0;
    this.pauseThenResume();
  }

  onTouchEnd(e: TouchEvent): void {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) this.next();
    else this.prev();
  }

  hasDecoration(decoration: FestivalDecoration): boolean {
  const item = this.current();
  return !!item?.festival.decorations?.includes(decoration);
}

festivalAccent(): string {
  const item = this.current();

  if (!item) {
    return '#f59e0b';
  }

  const name = item.festival.name.toLowerCase();
  const id = item.festival.id.toLowerCase();

  if (
    name.includes('ganesh') ||
    name.includes('vinayaka') ||
    id.includes('ganesh') ||
    id.includes('vinayaka')
  ) {
    return '#e67e22';
  }

  if (
    name.includes('deepavali') ||
    name.includes('diwali') ||
    id.includes('deepavali') ||
    id.includes('diwali')
  ) {
    return '#d4a017';
  }

  if (
    name.includes('sankranti') ||
    id.includes('sankranti')
  ) {
    return '#e6a21a';
  }

  if (
    name.includes('dasara') ||
    name.includes('dussehra') ||
    id.includes('dasara') ||
    id.includes('dussehra')
  ) {
    return '#9c3f32';
  }

  return item.festival.theme.primary;
}
}
