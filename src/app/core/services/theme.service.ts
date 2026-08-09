import { Injectable, effect, signal } from '@angular/core';
import { ThemeDefinition } from '../models/theme.model';

const STORAGE_KEY = 'nestly-theme-id';
const DEFAULT_THEME_ID = 'nestly-classic';

/**
 * Every palette here only overrides the --rm-* tokens that already exist in styles.scss —
 * no component ever reads a new variable, so nothing else in the app needs to change for
 * a theme to apply everywhere at once.
 */
const THEMES: ThemeDefinition[] = [
  {
    id: 'nestly-classic',
    name: 'Nestly Classic',
    tagline: 'Clean, simple and fresh',
    swatch: ['#00897b', '#ff7043', '#f7f8fa'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#00897b',
      '--rm-primary-dark': '#00695c',
      '--rm-accent': '#ff7043',
      '--rm-success': '#2e7d32',
      '--rm-success-bg': '#e6f4ea',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#f4f6f7',
      '--rm-bg': '#f7f8fa',
      '--rm-text': '#1b1f1e',
      '--rm-text-muted': '#667169',
      '--rm-border': '#e2e6e4',
    },
  },
  {
    id: 'ocean-glass',
    name: 'Ocean Glass',
    tagline: 'Calm and cool ocean vibes',
    swatch: ['#0288d1', '#00acc1', '#f2f8fb'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#0288d1',
      '--rm-primary-dark': '#01579b',
      '--rm-accent': '#00acc1',
      '--rm-success': '#2e7d32',
      '--rm-success-bg': '#e3f2fd',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#eef6fb',
      '--rm-bg': '#f2f8fb',
      '--rm-text': '#132a33',
      '--rm-text-muted': '#5b7787',
      '--rm-border': '#dbeaf1',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    tagline: 'Natural and refreshing',
    swatch: ['#2e7d32', '#8bc34a', '#f4f8f2'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#2e7d32',
      '--rm-primary-dark': '#1b5e20',
      '--rm-accent': '#8bc34a',
      '--rm-success': '#33691e',
      '--rm-success-bg': '#eaf5e2',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#f1f7ec',
      '--rm-bg': '#f4f8f2',
      '--rm-text': '#1a2417',
      '--rm-text-muted': '#5e6e57',
      '--rm-border': '#dfe9d8',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    tagline: 'Warm and energetic',
    swatch: ['#ef6c00', '#f9a825', '#fff8f2'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#ef6c00',
      '--rm-primary-dark': '#c25400',
      '--rm-accent': '#f9a825',
      '--rm-success': '#2e7d32',
      '--rm-success-bg': '#fdece0',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#fdf3ea',
      '--rm-bg': '#fff8f2',
      '--rm-text': '#2a1c10',
      '--rm-text-muted': '#8a6b52',
      '--rm-border': '#f0e0d0',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    tagline: 'Soft and elegant',
    swatch: ['#7e57c2', '#ba68c8', '#f9f6fc'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#7e57c2',
      '--rm-primary-dark': '#5e35b1',
      '--rm-accent': '#ba68c8',
      '--rm-success': '#2e7d32',
      '--rm-success-bg': '#efe7f9',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#f5f0fa',
      '--rm-bg': '#f9f6fc',
      '--rm-text': '#241a2e',
      '--rm-text-muted': '#7c6d89',
      '--rm-border': '#e7dcf1',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    tagline: 'Easy on the eyes',
    swatch: ['#4db6ac', '#ffab91', '#141816'],
    colorScheme: 'dark',
    tokens: {
      '--rm-primary': '#4db6ac',
      '--rm-primary-dark': '#26a69a',
      '--rm-accent': '#ffab91',
      '--rm-success': '#81c995',
      '--rm-success-bg': '#16302090',
      '--rm-surface': '#1c211f',
      '--rm-surface-alt': '#232a27',
      '--rm-bg': '#141816',
      '--rm-text': '#eef1ef',
      '--rm-text-muted': '#a3aca6',
      '--rm-border': '#2c3532',
    },
  },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes: readonly ThemeDefinition[] = THEMES;

  readonly activeThemeId = signal<string>(this.readStoredThemeId());

  readonly activeTheme = signal<ThemeDefinition>(this.resolve(this.activeThemeId()));

  constructor() {
    effect(() => {
      const theme = this.resolve(this.activeThemeId());
      this.activeTheme.set(theme);
      this.applyToDocument(theme);
    });
  }

  select(themeId: string): void {
    if (!THEMES.some((t) => t.id === themeId)) return;
    localStorage.setItem(STORAGE_KEY, themeId);
    this.activeThemeId.set(themeId);
  }

  private resolve(id: string): ThemeDefinition {
    return THEMES.find((t) => t.id === id) ?? THEMES[0];
  }

  private readStoredThemeId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  }

private applyToDocument(theme: ThemeDefinition): void {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(key, value);
  }

  root.style.colorScheme = theme.colorScheme;

  const themeColorMeta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeColorMeta) {
    const backgroundColor = theme.tokens['--rm-bg'];

    if (backgroundColor) {
      themeColorMeta.setAttribute('content', backgroundColor);
    }
  }

  const isDark = theme.colorScheme === 'dark';

  root.classList.toggle('rm-dark', isDark);
  root.classList.toggle('rm-light', !isDark);
}

  private applyMetaThemeColor(bgColor: string): void {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      // Defensive fallback only — index.html already ships exactly one theme-color
      // meta tag, so this path shouldn't normally run.
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bgColor);
  }
}