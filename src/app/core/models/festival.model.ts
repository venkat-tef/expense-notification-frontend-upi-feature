/**
 * ADDITIVE — Festival Wishes Banner data model.
 *
 * Purely static application configuration (no Firestore). Adding a new
 * festival later only ever means adding one more object to
 * `FESTIVALS` in festival-data.ts — never a new component or service.
 */

/** Which built-in icon/motif family the artwork fallback should draw from. */
export type FestivalDeity =
  | 'ganesha'
  | 'lakshmi'
  | 'durga'
  | 'rama'
  | 'hanuman'
  | 'krishna'
  | 'shiva'
  | 'sun'
  | 'generic';

/** Lightweight decorative motifs — rendered as small glyphs, never image assets. */
export type FestivalDecoration =
  | 'diyas'
  | 'flowers'
  | 'leaves'
  | 'bells'
  | 'stars'
  | 'rangoli'
  | 'lamps'
  | 'modaks'
  | 'mango-leaves'
  | 'pattern';

export interface FestivalTheme {
  /** Hex accent used for the banner's dominant gradient stop, badges, CTA. */
  primary: string;

  /** Hex accent used for the banner's secondary gradient stop. */
  secondary: string;
}

export interface Festival {
  id: string;

  /** English festival name, e.g. "Ganesh Chaturthi". */
  name: string;

  /** Telugu festival name, e.g. "వినాయక చవితి". */
  teluguName: string;

  /** Inclusive range, 'YYYY-MM-DD', evaluated in Asia/Kolkata. */
  startDate: string;
  endDate: string;

  /** Short English greeting shown as the banner subtitle. */
  greeting: string;

  /** Telugu greeting shown as the banner's large title. */
  teluguGreeting: string;

  deity: FestivalDeity;

  /** Single emoji used alongside the icon in the artwork fallback. */
  emoji?: string;

  /** Local image path for the festival artwork. */
  image?: string;

  theme: FestivalTheme;

  decorations: FestivalDecoration[];

  /**
   * Optional trusted CDN artwork URL.
   * Omit unless you have a reliable source.
   */
  artworkUrl?: string;

  ctaLabel?: string;
  ctaLink?: string;
}