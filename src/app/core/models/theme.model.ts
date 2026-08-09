/** A palette overrides the same --rm-* custom properties already defined in styles.scss. */
export interface ThemeTokens {
  '--rm-primary': string;
  '--rm-primary-dark': string;
  '--rm-accent': string;
  '--rm-success': string;
  '--rm-success-bg': string;
  '--rm-surface': string;
  '--rm-surface-alt': string;
  '--rm-bg': string;
  '--rm-text': string;
  '--rm-text-muted': string;
  '--rm-border': string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  tagline: string;
  /** Small swatch dots shown on the theme card, most-prominent color first. */
  swatch: [string, string, string];
  tokens: ThemeTokens;
  colorScheme: 'light' | 'dark';
}
