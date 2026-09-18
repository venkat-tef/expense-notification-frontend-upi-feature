import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { MemberService } from './member.service';
import { VoiceCommandService } from './voice-command.service';
import { VoiceSpeechService } from './voice-speech.service';
import { VoiceCommand } from '../models/voice-command.model';

/**
 * Siri/Apple Shortcuts bridge for the Nestly PWA.
 *
 * This is intentionally a browser/PWA bridge, not a fake native Siri API.
 * A Shortcut can use "Dictate Text" and then open a Nestly URL such as:
 *   https://<nestly-host>/?siri=1&command=<encoded text>
 *
 * The command is then handled by the SAME VoiceCommandService used by the
 * on-screen assistant. Nothing here writes Firestore directly.
 *
 * Safety rules:
 * - Authentication is required before anything executes.
 * - Reads/navigation execute normally.
 * - Data-changing inventory commands are held for confirmation unless the
 *   Shortcut explicitly supplies confirmed=1.
 * - A pending command is stored only for this signed-in browser session so a
 *   follow-up Siri/Shortcut "yes" or "no" can resolve it locally.
 * - The bridge consumes its URL parameters immediately so refresh cannot
 *   accidentally repeat the same command.
 */
@Injectable({ providedIn: 'root' })
export class SiriBridgeService {
  private readonly auth = inject(AuthService);
  private readonly members = inject(MemberService);
  private readonly commands = inject(VoiceCommandService);
  private readonly speech = inject(VoiceSpeechService);
  private readonly pendingKey = 'nestly.siri.pending-command.v1';
  private initialized = false;
  private processing = false;

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // Covers Safari/PWA navigation where a Shortcut opens a new URL in the
    // already-running app without a full reload.
    window.addEventListener('popstate', () => void this.processCurrentUrl());
    void this.processCurrentUrl();
  }

  private async processCurrentUrl(): Promise<void> {
    if (this.processing || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const isSiri = url.searchParams.get('siri') === '1' ||
      url.searchParams.has('siriCommand') ||
      url.searchParams.has('voiceCommand') ||
      url.searchParams.has('command');

    if (!isSiri) return;

    this.processing = true;

    // Consume first. If execution fails, the command can be re-issued by the
    // Shortcut instead of being silently replayed on a browser refresh.
    const commandText = (
      url.searchParams.get('command') ??
      url.searchParams.get('voiceCommand') ??
      url.searchParams.get('siriCommand') ??
      url.searchParams.get('text') ??
      ''
    ).trim().slice(0, 300);

    const confirmed = this.isTrue(url.searchParams.get('confirmed')) ||
      this.isTrue(url.searchParams.get('confirm'));

    this.clearBridgeParams(url);

    try {
      await this.auth.whenReady();

      if (!this.auth.user()) {
        await this.respond('Please open Nestly and sign in first.', true);
        return;
      }

      await this.members.whenLoaded();

      // A Shortcut can send the answer to a previous confirmation as a new
      // command. Resolve that locally; never send "yes"/"no" to Gemini.
      if (this.isAffirmative(commandText) || this.isNegative(commandText)) {
        const pending = this.readPending();
        if (pending) {
          if (this.isAffirmative(commandText)) {
            this.clearPending();
            const result = await this.commands.execute(pending);
            await this.respond(result.message, !!result.isError);
          } else {
            this.clearPending();
            await this.respond('Okay, cancelled.', false);
          }
          return;
        }
      }

      if (!commandText) {
        await this.respond('Please tell me what you want Nestly to do.', true);
        return;
      }

      const command = await this.commands.interpret(commandText);

      if (command.intent === 'UNRECOGNIZED') {
        await this.respond(
          this.commands.aiCallFailed()
            ? "I couldn't process that command right now. Please try again."
            : "I couldn't understand that command.",
          true
        );
        return;
      }

      if (this.commands.needsConfirmation(command) && !confirmed) {
        this.writePending(command);
        await this.respond(this.commands.confirmationPrompt(command), false);
        return;
      }

      this.clearPending();
      const result = await this.commands.execute(command);
      await this.respond(result.message, !!result.isError);
    } catch (error) {
      console.error('[SiriBridge] command failed', error);
      await this.respond('Something went wrong while processing that Nestly command.', true);
    } finally {
      this.processing = false;
    }
  }

  private clearBridgeParams(url: URL): void {
    ['siri', 'command', 'voiceCommand', 'siriCommand', 'text', 'confirmed', 'confirm'].forEach((key) => {
      url.searchParams.delete(key);
    });

    // Preserve every unrelated query parameter and hash. This is important
    // because the bridge must not interfere with existing app links.
    window.history.replaceState(window.history.state, '', url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
      url.hash);
  }

  private async respond(message: string, isError: boolean): Promise<void> {
    // Keep the bridge unobtrusive: navigate only when the normal executor
    // requested it. The command executor itself owns navigation.
    if (isError) console.warn('[SiriBridge]', message);

    // TTS is best-effort. Siri remains the Shortcut's own voice layer; this
    // makes the same bridge useful when the URL is opened manually from a
    // phone/PWA and provides an audible result there.
    try {
      this.speech.speak(message);
    } catch (error) {
      console.warn('[SiriBridge] speech failed', error);
    }

    // Make the result discoverable without changing any existing page UI.
    if (typeof document !== 'undefined') {
      document.title = isError ? `Nestly — ${message}` : `Nestly — ${message}`;
      window.setTimeout(() => {
        if (document.title.startsWith('Nestly — ')) document.title = 'Nestly';
      }, 5000);
    }
  }

  private writePending(command: VoiceCommand): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    try {
      window.localStorage.setItem(this.pendingKey, JSON.stringify({
        uid,
        command,
        createdAt: Date.now(),
      }));
    } catch (error) {
      console.warn('[SiriBridge] could not persist pending command', error);
    }
  }

  private readPending(): VoiceCommand | null {
    try {
      const raw = window.localStorage.getItem(this.pendingKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { uid?: string; command?: VoiceCommand; createdAt?: number };
      const currentUid = this.auth.user()?.uid;
      if (!currentUid || parsed.uid !== currentUid || !parsed.command || !parsed.createdAt || Date.now() - parsed.createdAt > 5 * 60 * 1000) {
        this.clearPending();
        return null;
      }
      return parsed.command;
    } catch {
      this.clearPending();
      return null;
    }
  }

  private clearPending(): void {
    try { window.localStorage.removeItem(this.pendingKey); } catch { /* ignore */ }
  }

  private isTrue(value: string | null): boolean {
    return !!value && /^(1|true|yes|confirmed)$/i.test(value.trim());
  }

  private isAffirmative(value: string): boolean {
    return /^(yes|yeah|yep|yup|sure|correct|confirm|confirmed|avunu|ha|haa|sare|అవును|అవునూ|సరే|ఓకే|ఓకే)$/i.test(value.trim());
  }

  private isNegative(value: string): boolean {
    return /^(no|nope|nah|cancel|cancelled|vaddu|ledu|kadu|కాదు|వద్దు|లేదు|రద్దు)$/i.test(value.trim());
  }
}
