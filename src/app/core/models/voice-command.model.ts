/**
 * "Hey Nestly" Voice Commands.
 *
 * PHASE 2 introduced deterministic (regex/keyword) command interpretation.
 * PHASE 4 added a Gemini-backed natural-language fallback (VoiceAiService)
 * for transcripts the deterministic parser can't confidently understand —
 * see VoiceCommandService.interpret(). Both paths produce this same
 * VoiceCommand union, so nothing downstream (execution, the UI) had to change.
 */

export const VOICE_COMMAND_INTENTS = [
  'INVENTORY_QUERY',
  'INVENTORY_ADD',
  'INVENTORY_STATUS_UPDATE',
  'WATER_QUERY',
  'GARBAGE_QUERY',
  'EXPENSE_QUERY',
  'NAVIGATION',
  'UNRECOGNIZED',
] as const;

export type VoiceCommandIntent = (typeof VOICE_COMMAND_INTENTS)[number];

export interface InventoryQueryCommand {
  intent: 'INVENTORY_QUERY';
  /** undefined = "show inventory" / "what do we have" (both categories). */
  category?: 'fridge' | 'kitchen';
  /** PHASE 4 — set when asking about a specific item, e.g. "Oil unda?" (do we have oil). */
  itemName?: string;
}

export interface InventoryAddCommand {
  intent: 'INVENTORY_ADD';
  itemName: string;
  category: 'fridge' | 'kitchen';
}

export interface InventoryStatusUpdateCommand {
  intent: 'INVENTORY_STATUS_UPDATE';
  itemName: string;
  status: 'available' | 'low' | 'out';
}

export interface WaterQueryCommand {
  intent: 'WATER_QUERY';
}

export interface GarbageQueryCommand {
  intent: 'GARBAGE_QUERY';
}

export interface ExpenseQueryCommand {
  intent: 'EXPENSE_QUERY';
}

export interface NavigationCommand {
  intent: 'NAVIGATION';
  path: string;
  label: string;
}

export interface UnrecognizedCommand {
  intent: 'UNRECOGNIZED';
  transcript: string;
}

export type VoiceCommand =
  | InventoryQueryCommand
  | InventoryAddCommand
  | InventoryStatusUpdateCommand
  | WaterQueryCommand
  | GarbageQueryCommand
  | ExpenseQueryCommand
  | NavigationCommand
  | UnrecognizedCommand;

/** Result of actually running a VoiceCommand against the existing Nestly services. */
export interface VoiceExecutionResult {
  /** Spoken/displayed response, e.g. "Oil is marked as low." */
  message: string;
  /** Route to navigate to, if any — always via the existing Router. */
  navigateTo?: string;
  /** True if this result represents a failure (shown with the error UI state). */
  isError?: boolean;
  /** True if this command needed confirmation and the user declined it. */
  cancelled?: boolean;
}

/** UI state machine for the assistant sheet — mirrors the states in the Phase 2 spec. */
export const VOICE_UI_STATES = ['idle', 'listening', 'processing', 'result', 'error'] as const;
export type VoiceUiState = (typeof VOICE_UI_STATES)[number];

/**
 * PROBLEM 3 fix — recognition language the user can pick before tapping the
 * mic. The browser's Web Speech API only ever transcribes in ONE BCP-47
 * language per session; it does not do true mixed-language recognition. So
 * "support Telugu-English mixed speech" means: let the user pick the
 * language closest to how they'll speak (Telugu-script speech recognizes
 * far better under 'te-IN'; Tenglish/English speech recognizes far better
 * under 'en-IN'), and let Gemini — which DOES handle mixed-language text
 * fluently — do the actual natural-language interpretation afterward. See
 * VoiceRecognitionService and voiceAiService.js's SYSTEM_INSTRUCTION.
 */
export const VOICE_RECOGNITION_LANGUAGES = ['en-IN', 'te-IN'] as const;
export type VoiceRecognitionLanguage = (typeof VOICE_RECOGNITION_LANGUAGES)[number];