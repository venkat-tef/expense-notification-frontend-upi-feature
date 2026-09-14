/**
 * Festival Wishes Banner data model.
 *
 * Festival dates are resolved dynamically by FestivalService
 * using Panchangam. They are intentionally NOT stored in this model.
 */

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
  primary: string;
  secondary: string;
}

export interface Festival {
  id: string;

  /** English festival name. */
  name: string;

  /** Telugu festival name. */
  teluguName: string;

  /** English greeting. */
  greeting: string;

  /** Telugu greeting. */
  teluguGreeting: string;

  deity: FestivalDeity;

  /**
   * Emoji is retained only as an emergency fallback.
   * Real artwork should be used whenever available.
   */
  emoji?: string;

  /**
   * Local bundled artwork.
   *
   * Example:
   * assets/vinayaka_transparent.png
   */
  image?: string;

  /**
   * Optional trusted external artwork URL.
   */
  artworkUrl?: string;

  theme: FestivalTheme;

  decorations: FestivalDecoration[];

  ctaLabel?: string;
  ctaLink?: string;
}