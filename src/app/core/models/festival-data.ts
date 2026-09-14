import { Festival } from './festival.model';

export interface FestivalDefinition {
  id: string;
  panchangNames: string[];
  festival: Festival;
}

export const FESTIVAL_DEFINITIONS: FestivalDefinition[] = [
  // =========================================================
  // NEW YEAR
  // =========================================================
  {
    id: 'new-year',
    panchangNames: ['New Year'],
    festival: {
      id: 'new-year',
      name: 'New Year',
      teluguName: 'నూతన సంవత్సరం',
      greeting: 'Happy New Year!',
      teluguGreeting: 'నూతన సంవత్సర శుభాకాంక్షలు!',
      deity: 'ganesha',
      image: 'assets/festivals/ganesh.png',
      theme: {
        primary: '#00897b',
        secondary: '#80cbc4',
      },
      decorations: ['flowers'],
    },
  },

  // =========================================================
  // MAKAR SANKRANTI
  // =========================================================
  {
    id: 'sankranti',
    panchangNames: [
      'Makar Sankranti',
      'Makara Sankranti',
      'Sankranti',
      'Pongal',
    ],
    festival: {
      id: 'sankranti',
      name: 'Makar Sankranti',
      teluguName: 'మకర సంక్రాంతి',
      greeting: 'Happy Sankranti!',
      teluguGreeting: 'సంక్రాంతి శుభాకాంక్షలు!',
      deity: 'ganesha',
      image: 'assets/festivals/ganesh.png',
      theme: {
        primary: '#e67e22',
        secondary: '#f6d365',
      },
      decorations: ['flowers', 'leaves'],
    },
  },

  // =========================================================
  // MAHA SHIVARATRI
  // =========================================================
  {
    id: 'maha-shivaratri',
    panchangNames: [
      'Maha Shivaratri',
      'Maha Shivratri',
      'Mahashivaratri',
      'Shivaratri',
    ],
    festival: {
      id: 'maha-shivaratri',
      name: 'Maha Shivaratri',
      teluguName: 'మహా శివరాత్రి',
      greeting: 'Om Namah Shivaya!',
      teluguGreeting: 'మహా శివరాత్రి శుభాకాంక్షలు!',
      deity: 'shiva',
      image: 'assets/festivals/shiva.png',
      theme: {
        primary: '#5e35b1',
        secondary: '#b39ddb',
      },
      decorations: ['bells', 'flowers'],
    },
  },

  // =========================================================
  // HOLI
  // =========================================================
  {
    id: 'holi',
    panchangNames: [
      'Holi',
      'Holika Dahan',
    ],
    festival: {
      id: 'holi',
      name: 'Holi',
      teluguName: 'హోళీ',
      greeting: 'Happy Holi!',
      teluguGreeting: 'హోళీ శుభాకాంక్షలు!',
      deity: 'krishna',
      image: 'assets/festivals/krishna.png',
      theme: {
        primary: '#e91e63',
        secondary: '#ffca28',
      },
      decorations: ['flowers'],
    },
  },

  // =========================================================
  // UGADI
  // =========================================================
  {
    id: 'ugadi',
    panchangNames: [
      'Ugadi',
      'Yugadi',
      'Gudi Padwa',
      'Chaitra Shukla Pratipada',
    ],
    festival: {
      id: 'ugadi',
      name: 'Ugadi',
      teluguName: 'ఉగాది',
      greeting: 'Happy Ugadi!',
      teluguGreeting: 'ఉగాది శుభాకాంక్షలు!',
      deity: 'ganesha',
      image: 'assets/festivals/ganesh.png',
      theme: {
        primary: '#2e7d32',
        secondary: '#a5d6a7',
      },
      decorations: ['leaves', 'flowers'],
    },
  },

  // =========================================================
  // RAMA NAVAMI
  // =========================================================
  {
    id: 'rama-navami',
    panchangNames: [
      'Rama Navami',
      'Ram Navami',
      'Sri Rama Navami',
    ],
    festival: {
      id: 'rama-navami',
      name: 'Rama Navami',
      teluguName: 'శ్రీరామ నవమి',
      greeting: 'Jai Shri Ram!',
      teluguGreeting: 'శ్రీరామ నవమి శుభాకాంక్షలు!',
      deity: 'rama',
      image: 'assets/festivals/rama.png',
      theme: {
        primary: '#ef6c00',
        secondary: '#ffcc80',
      },
      decorations: ['flowers', 'bells'],
    },
  },

  // =========================================================
  // HANUMAN JAYANTI
  // =========================================================
  {
    id: 'hanuman-jayanti',
    panchangNames: [
      'Hanuman Jayanti',
      'Hanuman Janmotsav',
      'Hanuman Jayanti (Chaitra)',
    ],
    festival: {
      id: 'hanuman-jayanti',
      name: 'Hanuman Jayanti',
      teluguName: 'హనుమాన్ జయంతి',
      greeting: 'Jai Hanuman!',
      teluguGreeting: 'హనుమాన్ జయంతి శుభాకాంక్షలు!',
      deity: 'hanuman',
      image: 'assets/festivals/hanuman.png',
      theme: {
        primary: '#d84315',
        secondary: '#ffab91',
      },
      decorations: ['bells', 'flowers'],
    },
  },

  // =========================================================
  // AKSHAYA TRITIYA
  // =========================================================
  {
    id: 'akshaya-tritiya',
    panchangNames: [
      'Akshaya Tritiya',
      'Akha Teej',
    ],
    festival: {
      id: 'akshaya-tritiya',
      name: 'Akshaya Tritiya',
      teluguName: 'అక్షయ తృతీయ',
      greeting: 'Happy Akshaya Tritiya!',
      teluguGreeting: 'అక్షయ తృతీయ శుభాకాంక్షలు!',
      deity: 'lakshmi',
      image: 'assets/festivals/lakshmi.png',
      theme: {
        primary: '#b8860b',
        secondary: '#ffe082',
      },
      decorations: ['flowers'],
    },
  },

  // =========================================================
  // VARALAKSHMI VRATAM
  // =========================================================
  {
    id: 'varalakshmi-vratam',
    panchangNames: [
      'Varalakshmi Vratam',
      'Varalakshmi Vratham',
      'Varalakshmi Puja',
    ],
    festival: {
      id: 'varalakshmi-vratam',
      name: 'Varalakshmi Vratam',
      teluguName: 'వరలక్ష్మీ వ్రతం',
      greeting: 'Happy Varalakshmi Vratam!',
      teluguGreeting: 'వరలక్ష్మీ వ్రత శుభాకాంక్షలు!',
      deity: 'lakshmi',
      image: 'assets/festivals/lakshmi.png',
      theme: {
        primary: '#ad1457',
        secondary: '#f48fb1',
      },
      decorations: ['flowers', 'diyas'],
    },
  },

  // =========================================================
  // RAKSHA BANDHAN
  // =========================================================
  {
    id: 'raksha-bandhan',
    panchangNames: [
      'Raksha Bandhan',
      'Raksha Bandhan Purnima',
      'Rakhi',
    ],
    festival: {
      id: 'raksha-bandhan',
      name: 'Raksha Bandhan',
      teluguName: 'రక్షా బంధన్',
      greeting: 'Happy Raksha Bandhan!',
      teluguGreeting: 'రక్షా బంధన్ శుభాకాంక్షలు!',
      deity: 'krishna',
      image: 'assets/festivals/krishna.png',
      theme: {
        primary: '#8e24aa',
        secondary: '#ce93d8',
      },
      decorations: ['flowers'],
    },
  },

  // =========================================================
  // JANMASHTAMI
  // =========================================================
  {
    id: 'janmashtami',
    panchangNames: [
      'Krishna Janmashtami',
      'Janmashtami',
      'Krishna Jayanti',
      'Gokulashtami',
    ],
    festival: {
      id: 'janmashtami',
      name: 'Krishna Janmashtami',
      teluguName: 'శ్రీకృష్ణ జన్మాష్టమి',
      greeting: 'Jai Shri Krishna!',
      teluguGreeting: 'శ్రీకృష్ణ జన్మాష్టమి శుభాకాంక్షలు!',
      deity: 'krishna',
      image: 'assets/festivals/krishna.png',
      theme: {
        primary: '#1565c0',
        secondary: '#90caf9',
      },
      decorations: ['flowers', 'bells'],
    },
  },

  // =========================================================
  // GANESH CHATURTHI
  // =========================================================
  {
    id: 'ganesh-chaturthi',
    panchangNames: [
      'Ganesh Chaturthi',
      'Ganesha Chaturthi',
      'Vinayaka Chaturthi',
      'Ganapati Chaturthi',
    ],
    festival: {
      id: 'ganesh-chaturthi',
      name: 'Ganesh Chaturthi',
      teluguName: 'వినాయక చవితి',
      greeting: 'Happy Ganesh Chaturthi!',
      teluguGreeting: 'వినాయక చవితి శుభాకాంక్షలు!',
      deity: 'ganesha',
      image: 'assets/festivals/ganesh.png',
      theme: {
        primary: '#ef6c00',
        secondary: '#ffcc80',
      },
      decorations: ['flowers', 'diyas'],
    },
  },

  // =========================================================
  // NAVARATRI
  // =========================================================
  {
    id: 'navaratri',
    panchangNames: [
      'Navaratri',
      'Navratri',
      'Sharad Navaratri',
      'Durga Navaratri',
    ],
    festival: {
      id: 'navaratri',
      name: 'Navaratri',
      teluguName: 'నవరాత్రులు',
      greeting: 'Happy Navaratri!',
      teluguGreeting: 'నవరాత్రి శుభాకాంక్షలు!',
      deity: 'durga',
      image: 'assets/festivals/durga.png',
      theme: {
        primary: '#c62828',
        secondary: '#ef9a9a',
      },
      decorations: ['flowers', 'diyas'],
    },
  },

  // =========================================================
  // DASARA / VIJAYADASHAMI
  // =========================================================
  {
    id: 'dasara',
    panchangNames: [
      'Vijayadashami',
      'Vijaya Dashami',
      'Dussehra',
      'Dasara',
    ],
    festival: {
      id: 'dasara',
      name: 'Vijayadashami',
      teluguName: 'విజయదశమి',
      greeting: 'Happy Dasara!',
      teluguGreeting: 'విజయదశమి శుభాకాంక్షలు!',
      deity: 'durga',
      image: 'assets/festivals/durga.png',
      theme: {
        primary: '#d84315',
        secondary: '#ffab91',
      },
      decorations: ['flowers', 'diyas'],
    },
  },

  // =========================================================
  // DEEPAVALI
  // =========================================================
  {
    id: 'deepavali',
    panchangNames: [
      'Diwali',
      'Deepavali',
      'Deepawali',
      'Lakshmi Puja',
    ],
    festival: {
      id: 'deepavali',
      name: 'Deepavali',
      teluguName: 'దీపావళి',
      greeting: 'Happy Deepavali!',
      teluguGreeting: 'దీపావళి శుభాకాంక్షలు!',
      deity: 'lakshmi',
      image: 'assets/festivals/lakshmi.png',
      theme: {
        primary: '#6a1b9a',
        secondary: '#ce93d8',
      },
      decorations: ['diyas'],
    },
  },

  // =========================================================
  // CHRISTMAS
  // =========================================================
  {
    id: 'christmas',
    panchangNames: ['Christmas'],
    festival: {
      id: 'christmas',
      name: 'Christmas',
      teluguName: 'క్రిస్మస్',
      greeting: 'Merry Christmas!',
      teluguGreeting: 'క్రిస్మస్ శుభాకాంక్షలు!',
      deity: 'krishna',
      theme: {
        primary: '#c62828',
        secondary: '#81c784',
      },
      decorations: ['flowers'],
    },
  },
];