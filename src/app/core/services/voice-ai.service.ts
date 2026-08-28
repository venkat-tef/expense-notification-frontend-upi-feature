import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { InventoryCategory, InventoryStatus } from '../models/inventory.model';
import { VoiceCommand } from '../models/voice-command.model';

const MAX_ITEM_NAME_LENGTH = 60;

/**
 * Mirrors NAV_TARGETS in voice-command.service.ts exactly (path + label
 * pairs only — the AI never needs the local parser's keyword lists).
 * Deliberately duplicated rather than imported to avoid a circular import
 * between the two voice services; same reasoning/pattern as the backend's
 * own copy in voiceAiService.js. If NAV_TARGETS in voice-command.service.ts
 * ever changes, mirror the change here too.
 */
const NAV_TARGETS: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Home' },
  { path: '/inventory', label: 'Inventory' },
  { path: '/expenses', label: 'Expenses' },
  { path: '/water', label: 'Water' },
  { path: '/cooking', label: 'Garbage' },
  { path: '/history', label: 'History' },
  { path: '/settings', label: 'Settings' },
];

/**
 * PHASE 4 — sends a transcript the local/regex parser in VoiceCommandService
 * couldn't confidently understand to the existing Nestly backend, which asks
 * Gemini to interpret it and returns a validated command. Gemini itself never
 * runs here or on the backend — this service only talks HTTP.
 *
 * Responsibility is intentionally narrow, per the Phase 4 spec:
 *   1. Send the transcript to the backend.
 *   2. Receive a structured response.
 *   3. Re-validate/map it into a safe VoiceCommand before returning it.
 *
 * No business logic, no Firestore access — mirrors CloudinaryService's plain
 * fetch()-based pattern, since this project has no HttpClient provider.
 *
 * Fails safe everywhere: missing config, no signed-in user, a network error,
 * a non-OK response, or a payload that doesn't validate all resolve to
 * UNRECOGNIZED rather than throwing — the assistant sheet's existing error
 * handling only expects VoiceCommandService.interpret() to reject on
 * recognition-service failures, not on AI-fallback failures.
 *
 * PROBLEM 2 / 6 fix — "UNRECOGNIZED" used to mean two very different things
 * that the UI couldn't tell apart: (a) the backend/Gemini call genuinely
 * failed (network error, non-200, bad payload), vs (b) the call succeeded
 * and Gemini legitimately couldn't classify the transcript. Both collapsed
 * into the same generic "I couldn't understand that command." message,
 * which is exactly the confusing symptom of "backend returns 200 but the
 * user gets no useful response." `lastCallFailed` lets the sheet show the
 * right message for each case (see VoiceAssistantSheet.handleTranscript()).
 *
 * PROBLEM 1 fix (defense in depth) — interpret() is only ever called from
 * one place (VoiceCommandService.interpret(), itself only called from
 * VoiceAssistantSheet.handleTranscript()), and nothing in that path can fire
 * twice for one tap. Still, per spec, this adds an explicit guard: if
 * interpret() is somehow invoked again for the SAME transcript while a
 * request for it is already in flight (double-tap race, a future caller,
 * etc.), the second call reuses the first call's in-flight promise instead
 * of firing a second network request — so POST /api/voice/interpret can
 * never fire twice for one transcript no matter what calls this.
 */
@Injectable({ providedIn: 'root' })
export class VoiceAiService {
  private readonly auth = inject(AuthService);

  /** True only when the LAST interpret() call failed to reach/parse the backend (not when Gemini validly returned UNRECOGNIZED). */
  readonly lastCallFailed = signal(false);

  private inFlight: { transcript: string; promise: Promise<VoiceCommand> } | null = null;

  interpret(transcript: string): Promise<VoiceCommand> {
    if (this.inFlight && this.inFlight.transcript === transcript) {
      console.warn('[VoiceAiService] duplicate interpret() call for the same transcript — reusing the in-flight request instead of firing a second one.');
      return this.inFlight.promise;
    }

    const promise = this.doInterpret(transcript).finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    });
    this.inFlight = { transcript, promise };
    return promise;
  }

  private async doInterpret(transcript: string): Promise<VoiceCommand> {
    const fallback: VoiceCommand = { intent: 'UNRECOGNIZED', transcript };

    const baseUrl = environment.voiceAiApiUrl;
    if (!baseUrl) {
      console.warn('[VoiceAiService] environment.voiceAiApiUrl is not configured — skipping AI fallback.');
      this.lastCallFailed.set(true);
      return fallback;
    }

    const user = this.auth.user();
    if (!user) {
      this.lastCallFailed.set(true);
      return fallback;
    }

    try {
      const idToken = await user.getIdToken();
      console.log('📤 Requesting AI interpretation:', transcript);
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/voice/interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ transcript }),
      });
      console.log('📥 Raw backend response:', response);

      if (!response.ok) {
        console.warn('[VoiceAiService] backend returned', response.status);
        this.lastCallFailed.set(true);
        return fallback;
      }

      const data = await response.json();
      const safe = this.toSafeCommand(data?.command, transcript);
      if (!safe) {
        // Backend responded 200 but the payload didn't match any known shape
        // (e.g. backend/frontend intent lists drifted out of sync) — treat
        // as a real failure, not a legitimate "Gemini didn't understand it".
        console.warn('[VoiceAiService] backend response failed local validation', data);
        this.lastCallFailed.set(true);
        return fallback;
      }

      this.lastCallFailed.set(false);
      return safe;
    } catch (err) {
      console.warn('[VoiceAiService] request failed', err);
      this.lastCallFailed.set(true);
      return fallback;
    }
  }

  /**
   * Defense in depth: the backend already validates Gemini's raw output
   * against the same shapes before responding, but this never trusts a
   * network response blindly either. `transcript` for the UNRECOGNIZED case
   * always comes from what THIS device actually heard — never from anything
   * the backend/AI echoed back.
   */
  private toSafeCommand(raw: unknown, localTranscript: string): VoiceCommand | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    const itemName = this.cleanItemName(c['itemName']);

    switch (c['intent']) {
      case 'INVENTORY_QUERY': {
        const category = this.asCategory(c['category']);
        return {
          intent: 'INVENTORY_QUERY',
          ...(category ? { category } : {}),
          ...(itemName ? { itemName } : {}),
        };
      }

      case 'INVENTORY_ADD': {
        const category = this.asCategory(c['category']);
        if (!itemName || !category) return null;
        return { intent: 'INVENTORY_ADD', itemName, category };
      }

      case 'INVENTORY_STATUS_UPDATE': {
        const status = this.asStatus(c['status']);
        if (!itemName || !status) return null;
        return { intent: 'INVENTORY_STATUS_UPDATE', itemName, status };
      }

      case 'WATER_QUERY':
        return { intent: 'WATER_QUERY' };

      case 'GARBAGE_QUERY':
        return { intent: 'GARBAGE_QUERY' };

      case 'EXPENSE_QUERY':
        return { intent: 'EXPENSE_QUERY' };

      case 'NAVIGATION': {
        const target = NAV_TARGETS.find((n) => n.path === c['path']);
        if (!target) return null;
        return { intent: 'NAVIGATION', path: target.path, label: target.label };
      }

      case 'UNRECOGNIZED':
        return { intent: 'UNRECOGNIZED', transcript: localTranscript };

      default:
        return null;
    }
  }

  private asCategory(value: unknown): InventoryCategory | undefined {
    return value === 'fridge' || value === 'kitchen' ? value : undefined;
  }

  private asStatus(value: unknown): InventoryStatus | undefined {
    return value === 'available' || value === 'low' || value === 'out' ? value : undefined;
  }

  private cleanItemName(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, MAX_ITEM_NAME_LENGTH);
    return trimmed || undefined;
  }
}