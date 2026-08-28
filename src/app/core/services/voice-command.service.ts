import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { InventoryService } from './inventory.service';
import { WaterService } from './water.service';
import { CookingService } from './cooking.service';
import { MemberService } from './member.service';
import { ExpenseService } from './expense.service';
import { MonthlySummaryService } from './monthly-summary.service';
import { VoiceAiService } from './voice-ai.service';

import {
  InventoryCategory,
  InventoryStatus,
} from '../models/inventory.model';

import {
  VoiceCommand,
  VoiceExecutionResult,
} from '../models/voice-command.model';

// ============================================================
// NAVIGATION TARGETS
// ============================================================

const NAV_TARGETS: {
  path: string;
  label: string;
  keywords: string[];
}[] = [
  {
    path: '/dashboard',
    label: 'Home',
    keywords: [
      'home',
      'dashboard',
      'home page',
      'main page',
      'హోమ్',
      'డాష్‌బోర్డ్',
    ],
  },
  {
    path: '/inventory',
    label: 'Inventory',
    keywords: [
      'inventory',
      'kitchen',
      'fridge',
      'items',
      'inventory page',
      'ఇన్వెంటరీ',
      'కిచెన్',
      'ఫ్రిడ్జ్',
    ],
  },
  {
    path: '/expenses',
    label: 'Expenses',
    keywords: [
      'expense',
      'expenses',
      'spending',
      'expense page',
      'ఖర్చు',
      'ఖర్చులు',
    ],
  },
  {
    path: '/water',
    label: 'Water',
    keywords: [
      'water',
      'water duty',
      'నీరు',
      'వాటర్',
    ],
  },
  {
    path: '/cooking',
    label: 'Garbage',
    keywords: [
      'garbage',
      'garbage duty',
      'cooking',
      'cooking duty',
      'trash',
      'చెత్త',
      'గార్బేజ్',
      'వంట',
    ],
  },
  {
    path: '/history',
    label: 'History',
    keywords: [
      'history',
      'activity history',
      'హిస్టరీ',
      'చరిత్ర',
    ],
  },
  {
    path: '/settings',
    label: 'Settings',
    keywords: [
      'settings',
      'setting',
      'సెట్టింగ్స్',
    ],
  },
];

// ============================================================
// DATE HELPERS
// ============================================================

function currentMonthKey(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class VoiceCommandService {

  private readonly router = inject(Router);

  private readonly inventoryService =
    inject(InventoryService);

  private readonly waterService =
    inject(WaterService);

  private readonly cookingService =
    inject(CookingService);

  private readonly memberService =
    inject(MemberService);

  private readonly expenseService =
    inject(ExpenseService);

  private readonly summaryService =
    inject(MonthlySummaryService);

  private readonly voiceAiService =
    inject(VoiceAiService);

  readonly aiCallFailed =
    this.voiceAiService.lastCallFailed;

  // ============================================================
  // INTERPRETATION
  // ============================================================

  async interpret(
    rawTranscript: string
  ): Promise<VoiceCommand> {

    const transcript =
      this.normalize(rawTranscript);

    console.log(
      '⚡ Local voice parser checking:',
      transcript
    );

    // --------------------------------------------------------
    // IMPORTANT:
    // LOCAL PARSER FIRST
    // GEMINI ONLY IF NOTHING MATCHES
    // --------------------------------------------------------

    const local =
      this.matchNavigation(transcript) ??
      this.matchInventoryAdd(transcript) ??
      this.matchInventoryStatusUpdate(transcript) ??
      this.matchInventoryQuery(transcript) ??
      this.matchWaterQuery(transcript) ??
      this.matchGarbageQuery(transcript) ??
      this.matchExpenseQuery(transcript);

    if (local) {

      console.log(
        '✅ Local command understood:',
        local
      );

      this.voiceAiService.lastCallFailed.set(false);

      return local;
    }

    // --------------------------------------------------------
    // GEMINI FALLBACK
    // --------------------------------------------------------

    console.log(
      '🤖 Local parser did not understand. Sending to Gemini:',
      rawTranscript
    );

    const aiCommand =
      await this.voiceAiService.interpret(
        rawTranscript
      );

    console.log(
      '🤖 Gemini response:',
      aiCommand
    );

    return aiCommand;
  }

  // ============================================================
  // NORMALIZATION
  // ============================================================

  private normalize(text: string): string {

    return text
      .toLowerCase()
      .trim()

      // Remove wake phrase
      .replace(
        /^(hey|hi|hello|ok|okay)\s+nestly[,]?\s*/i,
        ''
      )

      // Remove common punctuation
      .replace(/[.!?,]+$/g, '')

      // Remove repeated spaces
      .replace(/\s+/g, ' ')

      .trim();
  }

  // ============================================================
  // INVENTORY ADD
  // ============================================================

private matchInventoryAdd(
  t: string
): VoiceCommand | null {

  // Helper: explicit category detection
  const detectCategory = (text: string): InventoryCategory => {
    const value = text.toLowerCase();

    // IMPORTANT: fridge gets priority when explicitly mentioned
    if (
      /\b(fridge|refrigerator)\b/i.test(value) ||
      /ఫ్రిజ్/.test(value)
    ) {
      return 'fridge';
    }

    return 'kitchen';
  };

  // ----------------------------------------
  // ENGLISH
  // Examples:
  // add milk to fridge
  // add milk into fridge
  // add milk in fridge
  // add milk to kitchen
  // ----------------------------------------

  let m = t.match(
    /^add\s+(.+?)\s+(?:in|to|into)\s+(?:the\s+)?(kitchen|fridge|refrigerator)\b/i
  );

  if (m) {
    const category: InventoryCategory =
      m[2].toLowerCase() === 'fridge' ||
      m[2].toLowerCase() === 'refrigerator'
        ? 'fridge'
        : 'kitchen';

    return {
      intent: 'INVENTORY_ADD',
      itemName: this.titleCase(
        this.cleanItemWords(m[1])
      ),
      category,
    };
  }

  // ----------------------------------------
  // ENGLISH
  // "add milk in fridge"
  // Safety handling for natural variations
  // ----------------------------------------

  m = t.match(
    /^add\s+(.+?)\s+(?:in|to|into)\s+(?:the\s+)?(.+)$/i
  );

  if (m) {
    const item = this.cleanItemWords(m[1]);
    const location = m[2];

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: this.titleCase(item),
        category: detectCategory(location),
      };
    }
  }

  // ----------------------------------------
  // "add milk"
  // No explicit location → default kitchen
  // ----------------------------------------

  m = t.match(/^add\s+(.+)$/i);

  if (m) {
    const item = this.cleanItemWords(m[1]);

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: this.titleCase(item),
        category: 'kitchen',
      };
    }
  }

  // ----------------------------------------
  // Tenglish
  //
  // milk add cheyyi
  // oil kitchen lo add cheyyi
  // milk fridge lo add cheyyi
  // fridge lo milk add cheyyi
  // ----------------------------------------

  // Pattern:
  // "oil kitchen lo add cheyyi"
  // "milk fridge lo add cheyyi"

  m = t.match(
    /^(.+?)\s+(kitchen|fridge|refrigerator)\s+lo\s+(?:add\s+cheyyi|add\s+chey|add\s+cheyy|add\s+cheyandi)$/i
  );

  if (m) {
    const item = this.cleanItemWords(m[1]);
    const category = detectCategory(m[2]);

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: this.titleCase(item),
        category,
      };
    }
  }

  // Pattern:
  // "fridge lo milk add cheyyi"
  // "kitchen lo oil add cheyyi"

  m = t.match(
    /^(kitchen|fridge|refrigerator)\s+lo\s+(.+?)\s+(?:add\s+cheyyi|add\s+chey|add\s+cheyy|add\s+cheyandi)$/i
  );

  if (m) {
    const category = detectCategory(m[1]);
    const item = this.cleanItemWords(m[2]);

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: this.titleCase(item),
        category,
      };
    }
  }

  // Original Tenglish:
  // milk add cheyyi
  //
  // No explicit category → kitchen default

  m = t.match(
    /^(.+?)\s+(?:add\s+cheyyi|add\s+chey|add\s+cheyy|add\s+cheyandi)$/i
  );

  if (m) {
    const item = this.cleanItemWords(m[1]);

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: this.titleCase(item),
        category: 'kitchen',
      };
    }
  }

  // ----------------------------------------
  // Telugu script
  //
  // పాలు యాడ్ చేయి
  // ఫ్రిజ్ లో పాలు యాడ్ చేయి
  // పాలు ఫ్రిజ్ లో యాడ్ చేయి
  // ----------------------------------------

  // ఫ్రిజ్ లో పాలు యాడ్ చేయి

  m = t.match(
    /^(ఫ్రిజ్|కిచెన్)\s+లో\s+(.+?)\s+(?:యాడ్ చేయి|యాడ్ చెయ్యి|చేర్చు)$/i
  );

  if (m) {
    const category: InventoryCategory =
      m[1] === 'ఫ్రిజ్' ? 'fridge' : 'kitchen';

    const item = m[2].trim();

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: item,
        category,
      };
    }
  }

  // పాలు ఫ్రిజ్ లో యాడ్ చేయి

  m = t.match(
    /^(.+?)\s+(ఫ్రిజ్|కిచెన్)\s+లో\s+(?:యాడ్ చేయి|యాడ్ చెయ్యి|చేర్చు)$/i
  );

  if (m) {
    const item = m[1].trim();

    const category: InventoryCategory =
      m[2] === 'ఫ్రిజ్' ? 'fridge' : 'kitchen';

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: item,
        category,
      };
    }
  }

  // Original Telugu:
  // పాలు యాడ్ చేయి
  //
  // No category → kitchen default

  m = t.match(
    /^(.+?)\s+(?:యాడ్ చేయి|యాడ్ చెయ్యి|చేర్చు)$/i
  );

  if (m) {
    const item = m[1].trim();

    if (item) {
      return {
        intent: 'INVENTORY_ADD',
        itemName: item,
        category: 'kitchen',
      };
    }
  }

  return null;
}

  // ============================================================
  // INVENTORY STATUS UPDATE
  // ============================================================

  private matchInventoryStatusUpdate(
    t: string
  ): VoiceCommand | null {

    // ----------------------------------------
    // ENGLISH
    // mark oil as low
    // ----------------------------------------

    let m = t.match(
      /^mark\s+(.+?)\s+as\s+(available|low|out)$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: this.titleCase(m[1].trim()),
        status: m[2].toLowerCase() as InventoryStatus,
      };
    }

    // ----------------------------------------
    // English natural phrases
    // oil is finished
    // milk is low
    // rice is available
    // ----------------------------------------

    m = t.match(
      /^(.+?)\s+(?:is|are)\s+(finished|finish|over|empty|out)$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: this.titleCase(m[1].trim()),
        status: 'out',
      };
    }

    m = t.match(
      /^(.+?)\s+(?:is|are)\s+low$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: this.titleCase(m[1].trim()),
        status: 'low',
      };
    }

    // ----------------------------------------
    // Tenglish
    // oil aipoyindi
    // mirchi aipoyindi
    // rice low undi
    // milk available undi
    // ----------------------------------------

    m = t.match(
      /^(.+?)\s+(?:aipoyindi|aipoindi|ayipoyindi|ayipoindi|finish ayyindi|finished ayyindi)$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: this.titleCase(
          this.cleanItemWords(m[1])
        ),
        status: 'out',
      };
    }

    m = t.match(
      /^(.+?)\s+(?:low\s+undi|takkuva\s+undi)$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: this.titleCase(
          this.cleanItemWords(m[1])
        ),
        status: 'low',
      };
    }

    // Telugu script
    m = t.match(
      /^(.+?)\s+(?:అయిపోయింది|ఖాళీ అయింది)$/i
    );

    if (m) {
      return {
        intent: 'INVENTORY_STATUS_UPDATE',
        itemName: m[1].trim(),
        status: 'out',
      };
    }

    return null;
  }

  // ============================================================
  // INVENTORY QUERY
  // ============================================================

private matchInventoryQuery(
  t: string
): VoiceCommand | null {

  // Normalize for safer matching
  const text = t.toLowerCase().trim();

  // --------------------------------------------------------
  // CATEGORY DETECTION
  // --------------------------------------------------------

  const detectCategory = (value: string): InventoryCategory | undefined => {
    if (
      /\b(fridge|refrigerator)\b/i.test(value) ||
      /ఫ్రిడ్జ్|ఫ్రిజ్/.test(value)
    ) {
      return 'fridge';
    }

    if (
      /\bkitchen\b/i.test(value) ||
      /కిచెన్/.test(value)
    ) {
      return 'kitchen';
    }

    return undefined;
  };

  // --------------------------------------------------------
  // INVENTORY AREA QUERIES
  //
  // what's in the kitchen
  // what is in the kitchen
  // show kitchen items
  // kitchen lo em unnayi
  //
  // what's in the fridge
  // what is in the fridge
  // show fridge items
  // fridge lo em unnayi
  // --------------------------------------------------------

  const asksForContents =
    /\bwhat'?s\s+in\b/i.test(text) ||
    /\bwhat\s+is\s+in\b/i.test(text) ||
    /\bwhat\s+in\b/i.test(text) ||
    /\bshow\b/i.test(text) ||
    /\blist\b/i.test(text) ||
    /\bitems?\b/i.test(text) ||
    /\bhave\b/i.test(text) ||
    /\bavailable\b/i.test(text) ||
    /\bem\s+unnayi\b/i.test(text) ||
    /\bemi\s+unnayi\b/i.test(text) ||
    /\bem\s+undi\b/i.test(text) ||
    /ఏమున్నాయి|ఏమి ఉన్నాయి|ఏముంది|ఉన్నాయి|ఉంది/.test(text);

  const explicitCategory = detectCategory(text);

  // IMPORTANT:
  // If user explicitly asks about fridge/kitchen contents,
  // category must always be respected.
  if (explicitCategory && asksForContents) {
    return {
      intent: 'INVENTORY_QUERY',
      category: explicitCategory,
    };
  }

  // --------------------------------------------------------
  // Tenglish CATEGORY QUERIES
  //
  // kitchen lo em unnayi
  // fridge lo em unnayi
  // refrigerator lo emi unnayi
  // --------------------------------------------------------

  let m = text.match(
    /^(kitchen|fridge|refrigerator)\s+lo\s+(?:em|emi)\s+(?:unnayi|undi)$/i
  );

  if (m) {
    return {
      intent: 'INVENTORY_QUERY',
      category:
        m[1] === 'fridge' || m[1] === 'refrigerator'
          ? 'fridge'
          : 'kitchen',
    };
  }

  // --------------------------------------------------------
  // TELUGU CATEGORY QUERIES
  //
  // ఫ్రిజ్‌లో ఏమున్నాయి
  // కిచెన్‌లో ఏమున్నాయి
  // --------------------------------------------------------

  if (
    /ఫ్రిడ్జ్|ఫ్రిజ్/.test(text) &&
    /ఏమున్నాయి|ఏమి ఉన్నాయి|ఏముంది|ఉన్నాయి|ఉంది/.test(text)
  ) {
    return {
      intent: 'INVENTORY_QUERY',
      category: 'fridge',
    };
  }

  if (
    /కిచెన్/.test(text) &&
    /ఏమున్నాయి|ఏమి ఉన్నాయి|ఏముంది|ఉన్నాయి|ఉంది/.test(text)
  ) {
    return {
      intent: 'INVENTORY_QUERY',
      category: 'kitchen',
    };
  }

  // --------------------------------------------------------
  // GENERAL INVENTORY
  //
  // show my inventory
  // show all items
  // what do we have
  // inventory lo em unnayi
  // --------------------------------------------------------

  if (
    /show\s+(my\s+)?inventory/i.test(text) ||
    /show\s+(all\s+)?items/i.test(text) ||
    /what\s+do\s+we\s+have/i.test(text) ||
    /inventory\s+lo\s+(?:em|emi)\s+unnayi/i.test(text)
  ) {
    return {
      intent: 'INVENTORY_QUERY',
    };
  }

  // --------------------------------------------------------
  // ITEM AVAILABILITY — ENGLISH
  //
  // is mirchi available
  // is oil available in kitchen
  // is milk available in fridge
  // mirchi available in refrigerator
  // --------------------------------------------------------

  m = text.match(
    /^(?:is\s+)?(.+?)\s+(?:available|there|in stock)(?:\s+in\s+(?:the\s+)?(kitchen|fridge|refrigerator))?\??$/i
  );

  if (m) {
    const item = this.cleanItemWords(m[1]);

    if (item) {
      const location = m[2]?.toLowerCase();

      return {
        intent: 'INVENTORY_QUERY',
        itemName: this.titleCase(item),
        ...(location
          ? {
              category:
                location === 'fridge' || location === 'refrigerator'
                  ? 'fridge'
                  : 'kitchen',
            }
          : {}),
      };
    }
  }

  // --------------------------------------------------------
  // ITEM AVAILABILITY — Tenglish
  //
  // oil unda
  // mirchi unda kitchen lo
  // milk unda fridge lo
  // --------------------------------------------------------

  m = text.match(
    /^(.+?)\s+unda(?:\s+(kitchen|fridge|refrigerator)\s+lo)?$/i
  );

  if (m) {
    const item = this.cleanItemWords(m[1]);

    if (item && item.length < 60) {
      const location = m[2]?.toLowerCase();

      return {
        intent: 'INVENTORY_QUERY',
        itemName: this.titleCase(item),
        ...(location
          ? {
              category:
                location === 'fridge' || location === 'refrigerator'
                  ? 'fridge'
                  : 'kitchen',
            }
          : {}),
      };
    }
  }

  // --------------------------------------------------------
  // TELUGU SCRIPT ITEM QUERY
  //
  // నూనె ఉందా
  // పాలు ఫ్రిజ్‌లో ఉందా
  // --------------------------------------------------------

  m = text.match(
    /^(.+?)\s+(?:ఉందా|ఉన్నదా)$/i
  );

  if (m) {
    let item = m[1].trim();
    const category = detectCategory(item);

    // Remove location words from the item name
    item = item
      .replace(/ఫ్రిడ్జ్‌లో|ఫ్రిజ్‌లో|ఫ్రిడ్జ్ లో|ఫ్రిజ్ లో/g, '')
      .replace(/కిచెన్‌లో|కిచెన్ లో/g, '')
      .trim();

    if (item) {
      return {
        intent: 'INVENTORY_QUERY',
        itemName: item,
        ...(category ? { category } : {}),
      };
    }
  }

  return null;
}

  // ============================================================
  // WATER
  // ============================================================

  private matchWaterQuery(
    t: string
  ): VoiceCommand | null {

    const hasWater =
      /\bwater\b/.test(t) ||
      /నీరు/.test(t) ||
      /వాటర్/.test(t);

    const hasQuestion =
      /(duty|turn|who|today|ivala|evaridi|schedule|duty evaridi|ఎవరిది|ఈరోజు)/.test(t);

    if (hasWater && hasQuestion) {
      return {
        intent: 'WATER_QUERY',
      };
    }

    // Tenglish without explicit English water
    if (
      /(water duty evaridi|ivala water duty|na water turn)/.test(t)
    ) {
      return {
        intent: 'WATER_QUERY',
      };
    }

    return null;
  }

  // ============================================================
  // GARBAGE
  // ============================================================

  private matchGarbageQuery(
    t: string
  ): VoiceCommand | null {

    const hasGarbage =
      /\bgarbage\b/.test(t) ||
      /\btrash\b/.test(t) ||
      /చెత్త/.test(t) ||
      /గార్బేజ్/.test(t);

    const hasQuestion =
      /(duty|turn|who|today|ivala|evaridi|schedule|ఎవరిది|ఈరోజు)/.test(t);

    if (hasGarbage && hasQuestion) {
      return {
        intent: 'GARBAGE_QUERY',
      };
    }

    if (
      /(garbage duty evaridi|ivala garbage duty)/.test(t)
    ) {
      return {
        intent: 'GARBAGE_QUERY',
      };
    }

    return null;
  }

  // ============================================================
  // EXPENSES
  // ============================================================

  private matchExpenseQuery(
    t: string
  ): VoiceCommand | null {

    if (
      /\bexpense\b/.test(t) ||
      /\bexpenses\b/.test(t) ||
      /how much.*spend/.test(t) ||
      /entha kharchu/.test(t) ||
      /kharchulu/.test(t) ||
      /ఖర్చు/.test(t) ||
      /ఖర్చులు/.test(t)
    ) {
      return {
        intent: 'EXPENSE_QUERY',
      };
    }

    return null;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  private matchNavigation(
    t: string
  ): VoiceCommand | null {

    const navigationWords =
      /^(open|go to|go|show|take me to|vell|vellu|ki vellu|open cheyyi)/;

    const teluguNavigation =
      /(తెరువు|వెళ్ళు|చూపించు)/;

    const isNavigation =
      navigationWords.test(t) ||
      teluguNavigation.test(t) ||
      t === 'home';

    if (!isNavigation) {
      return null;
    }

    for (const target of NAV_TARGETS) {

      const found =
        target.keywords.some(
          keyword => t.includes(keyword)
        );

      if (found) {
        return {
          intent: 'NAVIGATION',
          path: target.path,
          label: target.label,
        };
      }
    }

    return null;
  }

  // ============================================================
  // CLEAN ITEM NAME
  // ============================================================

  private cleanItemWords(
    text: string
  ): string {

    return text
      .replace(
        /\b(is|it|the|a|an|available|in|kitchen|fridge|lo|please|cheyyi|chey)\b/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private titleCase(text: string): string {

    return text.replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
  }

  // ============================================================
  // CONFIRMATION
  // ============================================================

  needsConfirmation(
    command: VoiceCommand
  ): boolean {

    return (
      command.intent === 'INVENTORY_ADD' ||
      command.intent === 'INVENTORY_STATUS_UPDATE'
    );
  }

  confirmationPrompt(
    command: VoiceCommand
  ): string {

    switch (command.intent) {

      case 'INVENTORY_ADD':
        return `Add "${command.itemName}" to ${this.categoryLabel(
          command.category
        )} inventory?`;

      case 'INVENTORY_STATUS_UPDATE': {

        const item =
          this.findInventoryItem(
            command.itemName
          );

        if (!item) {
          return `I couldn't find "${command.itemName}" in your inventory.`;
        }

        return `Mark ${item.name} as ${command.status}?`;
      }

      default:
        return 'Continue?';
    }
  }

  // ============================================================
  // EXECUTION
  // ============================================================

  async execute(
    command: VoiceCommand
  ): Promise<VoiceExecutionResult> {

    switch (command.intent) {

      case 'INVENTORY_QUERY':
        return this.executeInventoryQuery(
          command.category,
          command.itemName
        );

      case 'INVENTORY_ADD':
        return this.executeInventoryAdd(
          command.itemName,
          command.category
        );

      case 'INVENTORY_STATUS_UPDATE':
        return this.executeInventoryStatusUpdate(
          command.itemName,
          command.status
        );

      case 'WATER_QUERY':
        return this.executeWaterQuery();

      case 'GARBAGE_QUERY':
        return this.executeGarbageQuery();

      case 'EXPENSE_QUERY':
        return this.executeExpenseQuery();

      case 'NAVIGATION':

        await this.router.navigateByUrl(
          command.path
        );

        return {
          message: `Opening ${command.label}.`,
          navigateTo: command.path,
        };

      case 'UNRECOGNIZED':
      default:

        return {
          message:
            "I couldn't understand that command.",
          isError: true,
        };
    }
  }

  // ============================================================
  // INVENTORY HELPERS
  // ============================================================

  private categoryLabel(
    category: InventoryCategory
  ): string {

    return category === 'fridge'
      ? 'Fridge'
      : 'Kitchen';
  }

  private findInventoryItem(
    name: string
  ) {

    const target =
      name.trim().toLowerCase();

    const items =
      this.inventoryService.items();

    return (
      items.find(
        item =>
          item.name.toLowerCase() === target
      ) ??

      items.find(
        item =>
          item.name.toLowerCase().includes(target) ||
          target.includes(
            item.name.toLowerCase()
          )
      )
    );
  }

  // ============================================================
  // INVENTORY QUERY EXECUTION
  // ============================================================

  private executeInventoryQuery(
    category?: InventoryCategory,
    itemName?: string
  ): VoiceExecutionResult {

    // Specific item
    if (itemName) {

      const item =
        this.findInventoryItem(itemName);

      if (!item) {

        return {
          message: `I couldn't find "${itemName}" in your inventory.`,
          navigateTo: '/inventory',
        };
      }

      return {
        message:
          `${item.name} is ${item.status}.`,
        navigateTo: '/inventory',
      };
    }

    // Category/general query
    const items = category
      ? this.inventoryService.forCategory(category)
      : this.inventoryService.items();

    if (!items.length) {

      const where = category
        ? this.categoryLabel(category)
        : 'Your inventory';

      return {
        message:
          `${where} is empty right now.`,
        navigateTo: '/inventory',
      };
    }

    const names =
      items
        .slice(0, 6)
        .map(item => item.name);

    const more =
      items.length > 6
        ? ` and ${items.length - 6} more`
        : '';

    const where = category
      ? this.categoryLabel(category)
      : 'inventory';

    return {
      message:
        `You have ${items.length} ${where} items: ${names.join(
          ', '
        )}${more}.`,
      navigateTo: '/inventory',
    };
  }

  // ============================================================
  // INVENTORY ADD
  // ============================================================

  private async executeInventoryAdd(
    itemName: string,
    category: InventoryCategory
  ): Promise<VoiceExecutionResult> {

    if (!itemName) {

      return {
        message:
          "I didn't catch the item name. Try again.",
        isError: true,
      };
    }

    await this.inventoryService.addItem({
      name: itemName,
      category,
      status: 'available',
    });

    return {
      message:
        `${itemName} added to ${this.categoryLabel(
          category
        )}.`,
      navigateTo: '/inventory',
    };
  }

  // ============================================================
  // INVENTORY STATUS UPDATE
  // ============================================================

  private async executeInventoryStatusUpdate(
    itemName: string,
    status: InventoryStatus
  ): Promise<VoiceExecutionResult> {

    const item =
      this.findInventoryItem(itemName);

    if (!item) {

      return {
        message:
          `I couldn't find "${itemName}" in your inventory.`,
        isError: true,
      };
    }

    await this.inventoryService.updateStatus(
      item,
      status
    );

    return {
      message:
        `${item.name} is marked as ${status}.`,
      navigateTo: '/inventory',
    };
  }

  // ============================================================
  // WATER
  // ============================================================

  private executeWaterQuery(): VoiceExecutionResult {

    const members =
      this.memberService.rotationEligibleMembers();

    const record =
      this.waterService.recordForDate(
        todayKey()
      );

    const assigned = record
      ? this.memberService.members().find(
          member =>
            member.id === record.memberId
        )
      : this.waterService.getNextMember(
          members
        );

    const message = assigned
      ? `Today's water turn is ${assigned.name}.`
      : 'No one is assigned to water duty yet.';

    return {
      message,
      navigateTo: '/water',
    };
  }

  // ============================================================
  // GARBAGE
  // ============================================================

  private executeGarbageQuery(): VoiceExecutionResult {

    const members =
      this.memberService.rotationEligibleMembers();

    const record =
      this.cookingService.recordForDate(
        todayKey()
      );

    const assigned = record
      ? this.memberService.members().find(
          member =>
            member.id === record.memberId
        )
      : this.cookingService.getNextMember(
          members
        );

    const message = assigned
      ? `Today's garbage turn is ${assigned.name}.`
      : 'No one is assigned to garbage duty yet.';

    return {
      message,
      navigateTo: '/cooking',
    };
  }

  // ============================================================
  // EXPENSES
  // ============================================================

  private executeExpenseQuery(): VoiceExecutionResult {

    const monthKey =
      currentMonthKey();

    const expenses =
      this.expenseService.forMonth(
        monthKey
      );

    const summary =
      this.summaryService.forMonth(
        monthKey
      );

    const otherTotal =
      expenses.reduce(
        (sum, expense) =>
          sum + expense.amount,
        0
      );

    const total =
      (summary?.roomRent ?? 0) +
      (summary?.electricityBill ?? 0) +
      otherTotal;

    const me =
      this.memberService.currentMember();

    let mySpend:
      | number
      | undefined;

    if (me) {

      mySpend =
        expenses
          .filter(
            expense =>
              expense.paidByMemberId === me.id
          )
          .reduce(
            (sum, expense) =>
              sum + expense.amount,
            0
          );
    }

    const totalDisplay =
      `₹${Math.round(total).toLocaleString(
        'en-IN'
      )}`;

    const message =
      mySpend != null
        ? `This month's total is ${totalDisplay}. You've paid ₹${Math.round(
            mySpend
          ).toLocaleString('en-IN')} so far.`
        : `This month's total is ${totalDisplay}.`;

    return {
      message,
      navigateTo: '/expenses',
    };
  }
}