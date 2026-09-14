import { Injectable } from '@angular/core';
import { Festival } from '../models/festival.model';

/**
 * Festival Artwork Service
 *
 * Festival dates are calculated dynamically by FestivalService/Panchangam.
 * This service only resolves:
 *
 *   Festival -> Deity -> Local PNG
 *
 * No remote image URLs are used.
 */

type FestivalWithArtwork = Festival & {
  image?: string;
  artworkUrl?: string;
  deity?: string;
};

type Deity =
  | 'ganesha'
  | 'durga'
  | 'krishna'
  | 'shiva'
  | 'rama'
  | 'hanuman'
  | 'lakshmi'
  | 'saraswati';

@Injectable({
  providedIn: 'root',
})
export class FestivalArtworkService {

  // ============================================================
  // LOCAL DEITY PNGs
  // ============================================================
  //
  // All artwork is served from the Angular assets folder.
  // No external/CDN dependency.
  //
  // If your actual filenames are different, change ONLY these
  // paths. Nothing else in this service needs to change.
  // ============================================================

  private readonly DEITY_PNGS: Record<Deity, string> = {

    ganesha:
      'assets/festivals/ganesh.png',

    durga:
      'assets/festivals/durga.png',

    krishna:
      'assets/festivals/krishna.png',

    shiva:
      'assets/festivals/shiva.png',

    rama:
      'assets/festivals/rama.png',

    hanuman:
      'assets/festivals/hanuman.png',

    lakshmi:
      'assets/festivals/lakshmi.png',

    saraswati:
      'assets/festivals/saraswati.png',
  };

  // ============================================================
  // FESTIVAL -> DEITY
  // ============================================================
  //
  // Panchangam decides WHEN the festival occurs.
  // This map decides WHICH deity artwork to display.
  // ============================================================

  private readonly FESTIVAL_DEITY: Record<string, Deity> = {

    // ----------------------------------------------------------
    // GANESHA
    // ----------------------------------------------------------

    'ganesh chaturthi': 'ganesha',
    'ganesha chaturthi': 'ganesha',
    'vinayaka chaturthi': 'ganesha',
    'vinayaka chavithi': 'ganesha',
    'vinayaka chavithi vratam': 'ganesha',

    // ----------------------------------------------------------
    // SHIVA
    // ----------------------------------------------------------

    'maha shivaratri': 'shiva',
    'maha shivratri': 'shiva',
    'shivaratri': 'shiva',
    'shivratri': 'shiva',

    // ----------------------------------------------------------
    // KRISHNA
    // ----------------------------------------------------------

    'janmashtami': 'krishna',
    'janmashtami jayanti': 'krishna',
    'krishna janmashtami': 'krishna',
    'krishna jayanti': 'krishna',
    'holi': 'krishna',

    // ----------------------------------------------------------
    // RAMA
    // ----------------------------------------------------------

    'rama navami': 'rama',
    'ram navami': 'rama',
    'sri rama navami': 'rama',
    'shri rama navami': 'rama',

    // ----------------------------------------------------------
    // HANUMAN
    // ----------------------------------------------------------

    'hanuman jayanti': 'hanuman',
    'hanuman jayanthi': 'hanuman',

    // ----------------------------------------------------------
    // DURGA
    // ----------------------------------------------------------

    'navaratri': 'durga',
    'navratri': 'durga',
    'shardiya navaratri': 'durga',
    'sharad navaratri': 'durga',

    'dasara': 'durga',
    'dussehra': 'durga',
    'vijayadashami': 'durga',
    'vijaya dashami': 'durga',
    

    // ----------------------------------------------------------
    // LAKSHMI
    // ----------------------------------------------------------

    'varalakshmi vratam': 'lakshmi',
    'varalakshmi vratham': 'lakshmi',
    'varalakshmi vrat': 'lakshmi',

    'deepavali': 'lakshmi',
    'diwali': 'lakshmi',
    'deepawali': 'lakshmi',
    'lakshmi puja': 'lakshmi',
    'lakshmi pooja': 'lakshmi',

    // ----------------------------------------------------------
    // SARASWATI
    // ----------------------------------------------------------

    'vasant panchami': 'saraswati',
    'vasanta panchami': 'saraswati',
    'saraswati puja': 'saraswati',
    'saraswati pooja': 'saraswati',
  };

  // ============================================================
  // MATERIAL ICON FALLBACK
  // ============================================================

  private readonly DEITY_ICONS: Record<Deity, string> = {

    ganesha:
      'celebration',

    durga:
      'auto_awesome',

    krishna:
      'music_note',

    shiva:
      'spa',

    rama:
      'shield',

    hanuman:
      'bolt',

    lakshmi:
      'currency_rupee',

    saraswati:
      'menu_book',
  };

  // ============================================================
  // DECORATIVE GLYPHS
  // ============================================================

  private readonly DECORATION_GLYPHS: Record<string, string> = {

    leaves:
      '🍃',

    flowers:
      '✿',

    sparkles:
      '✦',

    bells:
      '🔔',

    diyas:
      '🪔',

    lamps:
      '🪔',

    stars:
      '✦',
  };

  // ============================================================
  // RESOLVE DEITY
  // ============================================================

  resolveDeity(
    festival: Festival
  ): Deity | undefined {

    const item = festival as FestivalWithArtwork;

    // ----------------------------------------------------------
    // 1. Explicit deity configured on festival
    // ----------------------------------------------------------

    if (item.deity?.trim()) {

      const deity = item.deity
        .toLowerCase()
        .trim();

      if (
        Object.prototype.hasOwnProperty.call(
          this.DEITY_PNGS,
          deity
        )
      ) {
        return deity as Deity;
      }
    }

    // ----------------------------------------------------------
    // 2. Detect deity from festival name
    // ----------------------------------------------------------

    const name = festival.name
      .toLowerCase()
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    for (
      const [festivalName, deity]
      of Object.entries(this.FESTIVAL_DEITY)
    ) {

      if (
        name === festivalName ||
        name.includes(festivalName) ||
        festivalName.includes(name)
      ) {
        return deity;
      }
    }

    return undefined;
  }

  // ============================================================
  // RESOLVE ARTWORK
  // ============================================================
  //
  // Priority:
  //
  // 1. Explicit local festival image
  // 2. Explicit artworkUrl
  // 3. Festival -> deity mapping
  // 4. Deity -> local PNG
  //
  // No remote fallback.
  // ============================================================

  resolveArtworkUrl(
    festival: Festival
  ): string | undefined {

    const item = festival as FestivalWithArtwork;

    // ----------------------------------------------------------
    // 1. Explicit image configured on festival
    // ----------------------------------------------------------

    if (item.image?.trim()) {
      return item.image.trim();
    }

    // ----------------------------------------------------------
    // 2. Explicit artwork URL/path
    // ----------------------------------------------------------

    if (item.artworkUrl?.trim()) {
      return item.artworkUrl.trim();
    }

    // ----------------------------------------------------------
    // 3. Find deity
    // ----------------------------------------------------------

    const deity = this.resolveDeity(festival);

    if (!deity) {
      return undefined;
    }

    // ----------------------------------------------------------
    // 4. Return local PNG
    // ----------------------------------------------------------

    return this.DEITY_PNGS[deity];
  }

  // ============================================================
  // RESOLVE MATERIAL ICON
  // ============================================================

  resolveIcon(
    festival: Festival
  ): string {

    const deity = this.resolveDeity(festival);

    if (deity) {
      return this.DEITY_ICONS[deity];
    }

    return 'celebration';
  }

  // ============================================================
  // RESOLVE DECORATION
  // ============================================================

  resolveDecorationGlyph(
    decoration: string
  ): string {

    return (
      this.DECORATION_GLYPHS[
        decoration.toLowerCase()
      ] ?? '✦'
    );
  }
}