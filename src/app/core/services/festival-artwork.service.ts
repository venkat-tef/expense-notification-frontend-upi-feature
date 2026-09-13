import { Injectable } from '@angular/core';
import { Festival, FestivalDecoration, FestivalDeity } from '../models/festival.model';

/**
 * ADDITIVE — resolves festival "artwork" without any local image assets.
 *
 * Strategy:
 *  - If a festival has a trusted `artworkUrl` (set in festival-data.ts), the
 *    banner may try it — but only ever a URL YOU added deliberately, never
 *    a guessed or random one.
 *  - Every festival also always has a safe, dynamically generated fallback:
 *    a Material icon (mapped from `deity`) plus its emoji, drawn inside a
 *    CSS glow — no network request, so it can never show a broken image.
 *    The banner shows this fallback whenever no `artworkUrl` is set, or if
 *    the URL fails to load.
 */
@Injectable({ providedIn: 'root' })
export class FestivalArtworkService {
  private readonly DEITY_ICONS: Record<FestivalDeity, string> = {
    ganesha: 'temple_hindu',
    lakshmi: 'spa',
    durga: 'shield',
    rama: 'military_tech',
    hanuman: 'bolt',
    krishna: 'music_note',
    shiva: 'brightness_7',
    sun: 'wb_sunny',
    generic: 'celebration',
  };

  private readonly DECORATION_GLYPHS: Record<FestivalDecoration, string> = {
    diyas: '🪔',
    flowers: '🌸',
    leaves: '🍃',
    bells: '🔔',
    stars: '✨',
    rangoli: '🌀',
    lamps: '🪔',
    modaks: '🥟',
    'mango-leaves': '🥭',
    pattern: '✦',
  };

  /** Safe fallback icon for a festival's deity — always defined, never a network call. */
  resolveIcon(festival: Festival): string {
    return this.DEITY_ICONS[festival.deity] ?? 'celebration';
  }

  /** Trusted CDN URL if one was deliberately configured for this festival, else undefined. */
  resolveArtworkUrl(festival: Festival): string | undefined {
    return festival.artworkUrl;
  }

  /** Small glyph for a decorative motif — used for the banner's lightweight corner decorations. */
  resolveDecorationGlyph(decoration: FestivalDecoration): string {
    return this.DECORATION_GLYPHS[decoration] ?? '✦';
  }
}
