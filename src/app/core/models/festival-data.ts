import { Festival } from './festival.model';

/**
 * ADDITIVE — static festival configuration.
 *
 * No Firestore collection, no image assets. Most of these are lunisolar
 * and shift every year, so dates are refreshed per calendar year rather
 * than computed astronomically. This table currently covers 2026 —
 * extend it by appending new objects (with next year's dates) rather
 * than editing the banner component or the artwork service.
 */
export const FESTIVALS: Festival[] = [
  {
    id: 'new-year',
    name: 'New Year',
    teluguName: 'నూతన సంవత్సరం',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    greeting: 'Wishing your home a joyful and prosperous New Year.',
    teluguGreeting: 'నూతన సంవత్సర శుభాకాంక్షలు!',
    deity: 'generic',
    emoji: '🎉',
    theme: { primary: '#3b6fd6', secondary: '#8e9fc2' },
    decorations: ['stars', 'pattern'],
  },
  {
    id: 'sankranti',
    name: 'Makar Sankranti',
    teluguName: 'సంక్రాంతి',
    startDate: '2026-01-14',
    endDate: '2026-01-15',
    greeting: 'May this harvest festival bring joy and abundance to your home.',
    teluguGreeting: 'సంక్రాంతి శుభాకాంక్షలు!',
    deity: 'sun',
    emoji: '🌾',
    theme: { primary: '#f5a623', secondary: '#6a9c3f' },
    decorations: ['rangoli', 'pattern'],
  },
  {
    id: 'maha-shivaratri',
    name: 'Maha Shivaratri',
    teluguName: 'మహాశివరాత్రి',
    startDate: '2026-02-15',
    endDate: '2026-02-15',
    greeting: "May Lord Shiva's blessings bring peace and strength to your home.",
    teluguGreeting: 'మహాశివరాత్రి శుభాకాంక్షలు!',
    deity: 'shiva',
    emoji: '🔱',
    theme: { primary: '#3949ab', secondary: '#7e57c2' },
    decorations: ['stars', 'lamps'],
  },
  {
    id: 'holi',
    name: 'Holi',
    teluguName: 'హోళి',
    startDate: '2026-03-03',
    endDate: '2026-03-04',
    greeting: 'Wishing your home a colorful and joyful Holi.',
    teluguGreeting: 'హోళి శుభాకాంక్షలు!',
    deity: 'krishna',
    emoji: '🎨',
    theme: { primary: '#e91e63', secondary: '#43a047' },
    decorations: ['flowers', 'pattern'],
  },
  {
    id: 'ugadi',
    name: 'Ugadi',
    teluguName: 'ఉగాది',
    startDate: '2026-03-19',
    endDate: '2026-03-19',
    greeting: 'May this Ugadi bring a fresh start full of happiness.',
    teluguGreeting: 'ఉగాది శుభాకాంక్షలు!',
    deity: 'generic',
    emoji: '🥭',
    theme: { primary: '#43a047', secondary: '#c9a227' },
    decorations: ['mango-leaves', 'leaves'],
  },
  {
    id: 'ram-navami',
    name: 'Sri Rama Navami',
    teluguName: 'శ్రీరామ నవమి',
    startDate: '2026-03-26',
    endDate: '2026-03-27',
    greeting: "May Lord Rama's blessings fill your home with harmony.",
    teluguGreeting: 'శ్రీరామ నవమి శుభాకాంక్షలు!',
    deity: 'rama',
    emoji: '🏹',
    theme: { primary: '#ef6c00', secondary: '#3949ab' },
    decorations: ['flowers', 'stars'],
  },
  {
    id: 'hanuman-jayanti',
    name: 'Hanuman Jayanti',
    teluguName: 'హనుమాన్ జయంతి',
    startDate: '2026-04-02',
    endDate: '2026-04-02',
    greeting: 'May Lord Hanuman bless your home with strength and courage.',
    teluguGreeting: 'హనుమాన్ జయంతి శుభాకాంక్షలు!',
    deity: 'hanuman',
    emoji: '🪔',
    theme: { primary: '#d84315', secondary: '#f9a825' },
    decorations: ['flowers'],
  },
  {
    id: 'akshaya-tritiya',
    name: 'Akshaya Tritiya',
    teluguName: 'అక్షయ తృతీయ',
    startDate: '2026-04-19',
    endDate: '2026-04-19',
    greeting: 'Wishing your home prosperity that never fades.',
    teluguGreeting: 'అక్షయ తృతీయ శుభాకాంక్షలు!',
    deity: 'lakshmi',
    emoji: '✨',
    theme: { primary: '#c9a227', secondary: '#fdd835' },
    decorations: ['stars', 'pattern'],
  },
  {
    id: 'varalakshmi-vratam',
    name: 'Varalakshmi Vratam',
    teluguName: 'వరలక్ష్మి వ్రతం',
    startDate: '2026-08-21',
    endDate: '2026-08-21',
    greeting: 'May Goddess Lakshmi bring prosperity and well-being to your home.',
    teluguGreeting: 'వరలక్ష్మి వ్రత శుభాకాంక్షలు!',
    deity: 'lakshmi',
    emoji: '🪷',
    theme: { primary: '#ad1457', secondary: '#f9a825' },
    decorations: ['flowers', 'lamps'],
  },
  {
    id: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    teluguName: 'రక్షాబంధన్',
    startDate: '2026-08-28',
    endDate: '2026-08-28',
    greeting: 'Celebrating the bond of love and care in your home.',
    teluguGreeting: 'రక్షాబంధన్ శుభాకాంక్షలు!',
    deity: 'generic',
    emoji: '🎀',
    theme: { primary: '#c62828', secondary: '#f9a825' },
    decorations: ['pattern'],
  },
  {
    id: 'janmashtami',
    name: 'Krishna Janmashtami',
    teluguName: 'శ్రీకృష్ణ జన్మాష్టమి',
    startDate: '2026-09-04',
    endDate: '2026-09-04',
    greeting: 'May Lord Krishna bring joy and harmony to your home.',
    teluguGreeting: 'శ్రీకృష్ణ జన్మాష్టమి శుభాకాంక్షలు!',
    deity: 'krishna',
    emoji: '🦚',
    theme: { primary: '#1565c0', secondary: '#fdd835' },
    decorations: ['flowers', 'stars'],
  },
{
  id: 'ganesh-chaturthi',
  name: 'Ganesh Chaturthi',
  teluguName: 'వినాయక చవితి',

  startDate: '2026-09-13',
  endDate: '2026-09-14',

  greeting: 'May Bappa bring happiness and positivity to your home.',
  teluguGreeting: 'వినాయక చవితి శుభాకాంక్షలు!',

  deity: 'ganesha',
  emoji: '🙏',

  image: 'assets/vinayaka_transparent.png',

  theme: {
    primary: '#f4b942',
    secondary: '#7fb069'
  },

  decorations: [
    'flowers',
    'leaves',
    'modaks',
    'stars'
  ]
},
  {
    id: 'navaratri',
    name: 'Navaratri',
    teluguName: 'నవరాత్రి',
    startDate: '2026-10-11',
    endDate: '2026-10-19',
    greeting: 'Wishing your home nine nights of devotion and joy.',
    teluguGreeting: 'నవరాత్రి శుభాకాంక్షలు!',
    deity: 'durga',
    emoji: '🪘',
    theme: { primary: '#8e2431', secondary: '#c9a227' },
    decorations: ['lamps', 'pattern'],
  },
  {
    id: 'dasara',
    name: 'Dasara / Vijayadashami',
    teluguName: 'విజయదశమి',
    startDate: '2026-10-20',
    endDate: '2026-10-20',
    greeting: 'May good triumph over evil in your home, always.',
    teluguGreeting: 'విజయదశమి శుభాకాంక్షలు!',
    deity: 'durga',
    emoji: '🏹',
    theme: { primary: '#8e2431', secondary: '#c9a227' },
    decorations: ['flowers', 'stars'],
  },
  {
    id: 'deepavali',
    name: 'Deepavali',
    teluguName: 'దీపావళి',
    startDate: '2026-11-08',
    endDate: '2026-11-08',
    greeting: 'Wishing your home a bright and joyful Diwali.',
    teluguGreeting: 'దీపావళి శుభాకాంక్షలు!',
    deity: 'lakshmi',
    emoji: '🪔',
    theme: { primary: '#4a148c', secondary: '#c9a227' },
    decorations: ['diyas', 'stars', 'lamps'],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    teluguName: 'క్రిస్మస్',
    startDate: '2026-12-25',
    endDate: '2026-12-25',
    greeting: 'Wishing your home warmth and joy this Christmas.',
    teluguGreeting: 'క్రిస్మస్ శుభాకాంక్షలు!',
    deity: 'generic',
    emoji: '🎄',
    theme: { primary: '#2e7d32', secondary: '#c62828' },
    decorations: ['stars', 'pattern'],
  },
];

/** 'YYYY-MM-DD' for a Date, resolved in Asia/Kolkata regardless of device timezone. */
export function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Plain string comparison is valid here since every date is zero-padded ISO 'YYYY-MM-DD'. */
export function isFestivalActive(festival: Festival, todayKey: string): boolean {
  return todayKey >= festival.startDate && todayKey <= festival.endDate;
}

export function getActiveFestivals(all: Festival[], todayKey: string): Festival[] {
  return all.filter((f) => isFestivalActive(f, todayKey));
}

/** Nearest festival whose startDate is still ahead of today, or undefined past the last configured one. */
export function getNextUpcoming(all: Festival[], todayKey: string): Festival | undefined {
  return all
    .filter((f) => f.startDate > todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
}
