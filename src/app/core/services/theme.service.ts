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
      '--rm-app-bg': '#f7f8fa',
      '--rm-water': '#0288d1',
      '--rm-garbage': '#ef6c00',
      '--rm-expenses': '#7b1fa2',
      '--rm-history': '#00897b',
      '--rm-shopping': '#2e7d32',
      '--rm-glow': 'rgba(0, 137, 123, 0.18)',
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
      '--rm-app-bg': '#f2f8fb',
      '--rm-water': '#0288d1',
      '--rm-garbage': '#ef6c00',
      '--rm-expenses': '#7b1fa2',
      '--rm-history': '#00897b',
      '--rm-shopping': '#2e7d32',
      '--rm-glow': 'rgba(2, 136, 209, 0.18)',
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
      '--rm-app-bg': '#f4f8f2',
      '--rm-water': '#0288d1',
      '--rm-garbage': '#ef6c00',
      '--rm-expenses': '#7b1fa2',
      '--rm-history': '#2e7d32',
      '--rm-shopping': '#2e7d32',
      '--rm-glow': 'rgba(46, 125, 50, 0.18)',
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
      '--rm-app-bg': '#fff8f2',
      '--rm-water': '#0288d1',
      '--rm-garbage': '#ef6c00',
      '--rm-expenses': '#9c27b0',
      '--rm-history': '#ef6c00',
      '--rm-shopping': '#2e7d32',
      '--rm-glow': 'rgba(239, 108, 0, 0.18)',
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
      '--rm-app-bg': '#f9f6fc',
      '--rm-water': '#0288d1',
      '--rm-garbage': '#ef6c00',
      '--rm-expenses': '#7e57c2',
      '--rm-history': '#5e35b1',
      '--rm-shopping': '#2e7d32',
      '--rm-glow': 'rgba(126, 87, 194, 0.18)',
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
      '--rm-app-bg': '#141816',
      '--rm-water': '#29b6f6',
      '--rm-garbage': '#ff8a65',
      '--rm-expenses': '#ce93d8',
      '--rm-history': '#4db6ac',
      '--rm-shopping': '#81c995',
      '--rm-glow': 'rgba(77, 182, 172, 0.26)',
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

  {
    id: 'vibrant-playful',
    name: 'Vibrant & Playful',
    tagline: 'Bright, friendly and energetic',
    swatch: ['#087cff', '#8b35d6', '#f4f8ff'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#087cff',
      '--rm-primary-dark': '#0756b8',
      '--rm-accent': '#8b35d6',
      '--rm-success': '#0b9f78',
      '--rm-success-bg': '#e5faf3',
      '--rm-surface': '#ffffff',
      '--rm-surface-alt': '#f2f6ff',
      '--rm-bg': '#f5f9ff',
      '--rm-text': '#14213d',
      '--rm-text-muted': '#63718b',
      '--rm-border': '#dce6f6',
      '--rm-app-bg': 'linear-gradient(180deg, #f4f9ff 0%, #f8f7ff 55%, #fff9f5 100%)',
      '--rm-water': '#0b8cff',
      '--rm-garbage': '#ff6b35',
      '--rm-expenses': '#8b35d6',
      '--rm-history': '#08a88b',
      '--rm-shopping': '#2878e8',
      '--rm-glow': 'rgba(8, 124, 255, 0.20)',
    },
  },
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    tagline: 'Dark, modern and luminous',
    swatch: ['#08bfff', '#a855f7', '#080d1b'],
    colorScheme: 'dark',
    tokens: {
      '--rm-primary': '#08bfff',
      '--rm-primary-dark': '#0094cc',
      '--rm-accent': '#a855f7',
      '--rm-success': '#35d39a',
      '--rm-success-bg': 'rgba(53, 211, 154, 0.16)',
      '--rm-surface': '#11182b',
      '--rm-surface-alt': '#172039',
      '--rm-bg': '#080d1b',
      '--rm-text': '#f5f8ff',
      '--rm-text-muted': '#9ba8c0',
      '--rm-border': '#263451',
      '--rm-app-bg': 'linear-gradient(180deg, #070b18 0%, #0b1022 52%, #0a0f20 100%)',
      '--rm-water': '#19c7ff',
      '--rm-garbage': '#ff8a3d',
      '--rm-expenses': '#c084fc',
      '--rm-history': '#35d3b0',
      '--rm-shopping': '#55a7ff',
      '--rm-glow': 'rgba(8, 191, 255, 0.28)',
    },
  },
  {
    id: 'fantasy-gradient',
    name: 'Fantasy Gradient',
    tagline: 'Dreamy, colourful and magical',
    swatch: ['#5b5ce2', '#ff5fa2', '#f5efff'],
    colorScheme: 'light',
    tokens: {
      '--rm-primary': '#5d67e8',
      '--rm-primary-dark': '#4149b8',
      '--rm-accent': '#ff5fa7',
      '--rm-success': '#19b79d',
      '--rm-success-bg': 'rgba(25, 183, 157, 0.14)',
      '--rm-surface': 'rgba(255, 255, 255, 0.90)',
      '--rm-surface-alt': 'rgba(255, 255, 255, 0.66)',
      '--rm-bg': '#6471d8',
      '--rm-text': '#202451',
      '--rm-text-muted': '#657094',
      '--rm-border': 'rgba(255, 255, 255, 0.42)',
      '--rm-app-bg': 'linear-gradient(180deg, #4566d9 0%, #5d69dc 38%, #8064d2 67%, #d878b7 100%)',
      '--rm-water': '#3c9dff',
      '--rm-garbage': '#ff7b59',
      '--rm-expenses': '#9b5de5',
      '--rm-history': '#19b79d',
      '--rm-shopping': '#4d86f4',
      '--rm-glow': 'rgba(255, 255, 255, 0.22)',
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
    if (!THEMES.some((theme) => theme.id === themeId)) return;

    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // Theme still changes for the current session if storage is unavailable.
    }

    this.activeThemeId.set(themeId);
  }

  private resolve(id: string): ThemeDefinition {
    return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
  }

  private readStoredThemeId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  }

  private applyToDocument(theme: ThemeDefinition): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    for (const [key, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(key, value);
    }

    root.style.colorScheme = theme.colorScheme;

    root.classList.toggle('rm-dark', theme.colorScheme === 'dark');
    root.classList.toggle('rm-light', theme.colorScheme === 'light');
    root.classList.toggle('rm-vibrant', theme.id === 'vibrant-playful');
    root.classList.toggle('rm-fantasy', theme.id === 'fantasy-gradient');

    // Keep iOS standalone status-bar treatment aligned with the selected theme.
    const statusBar = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBar) {
      statusBar.setAttribute('content', theme.colorScheme === 'dark' || theme.id === 'fantasy-gradient' ? 'black-translucent' : 'default');
    }

    this.applyMetaThemeColor(theme.tokens['--rm-app-bg'] ?? theme.tokens['--rm-bg']);
  }

  private applyMetaThemeColor(bgColor: string): void {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    // Browsers do not render gradients in theme-color; use the solid base token.
    meta.setAttribute('content', bgColor.startsWith('linear-gradient') ? themeFallbackBg(this.activeThemeId()) : bgColor);
  }
}

function themeFallbackBg(themeId: string): string {
  switch (themeId) {
    case 'vibrant-playful': return '#f5f9ff';
    case 'midnight-neon': return '#080d1b';
    case 'fantasy-gradient': return '#4566d9';
    default: return '#f7f8fa';
  }
}
