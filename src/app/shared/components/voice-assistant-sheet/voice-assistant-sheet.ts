// features/.../voice-assistant-sheet/voice-assistant-sheet.ts
import { Component, OnDestroy, inject, signal } from '@angular/core';
import {
  MatBottomSheetRef,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { VoiceRecognitionService } from '../../../core/services/voice-recognition.service';
import { VoiceCommandService } from '../../../core/services/voice-command.service';
import { VoiceSpeechService } from '../../../core/services/voice-speech.service';
import {
  VoiceCommand,
  VoiceRecognitionLanguage,
  VoiceUiState,
} from '../../../core/models/voice-command.model';

/** Delay after Nestly finishes speaking before the mic reopens — long enough
 *  that the tail of the TTS audio doesn't bleed into the next recognition
 *  session on the iPhone speaker, short enough to still feel hands-free. */
const RELISTEN_DELAY_MS = 450;

/**
 * PHASE 2 — "Hey Nestly" assistant UI.
 *
 * Handles:
 * - Voice recognition
 * - Gemini/AI command interpretation
 * - Command execution
 * - Displaying results
 * - 🔊 Speaking results via VoiceSpeechService (iOS-safe TTS)
 * - Hands-free continuation: after Nestly finishes speaking, the mic
 *   reopens automatically until the sheet is closed/dismissed.
 */
@Component({
  selector: 'app-voice-assistant-sheet',
  standalone: true,
  imports: [
    MatBottomSheetModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './voice-assistant-sheet.html',
  styleUrl: './voice-assistant-sheet.scss',
})
export class VoiceAssistantSheet implements OnDestroy {
  private readonly sheetRef =
    inject(MatBottomSheetRef<VoiceAssistantSheet>);

  private readonly recognition =
    inject(VoiceRecognitionService);

  private readonly commands =
    inject(VoiceCommandService);

  private readonly speech =
    inject(VoiceSpeechService);

  readonly supported = this.recognition.supported;
  readonly language = this.recognition.language;

  readonly state = signal<VoiceUiState>('idle');
  readonly heardText = signal<string>('');
  readonly resultMessage = signal<string>('');

  /** Set only while a data-changing command is awaiting confirmation. */
  readonly pendingCommand = signal<VoiceCommand | null>(null);
  readonly confirmPrompt = signal<string>('');

  /** Prevents the same transcript from being processed twice. */
  private processingTranscript = false;

  /** True once the sheet has been closed/dismissed — stops the hands-free
   *  loop from ever calling startListening() again after that point. */
  private dismissed = false;

  private relistenTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    if (!this.supported()) {
      this.state.set('error');
      this.resultMessage.set(
        "Voice commands aren't supported on this browser yet. Try Chrome on Android or desktop."
      );
    }

    // Safety net: catches dismissal by backdrop click / swipe-down / any
    // programmatic dismiss() elsewhere — not just this component's close().
    this.sheetRef.afterDismissed().subscribe(() => {
      this.dismissed = true;
      this.clearRelistenTimeout();
      this.recognition.cancel();
      this.speech.stop();
    });
  }

  ngOnDestroy(): void {
    this.dismissed = true;
    this.clearRelistenTimeout();
    this.recognition.cancel();
    this.speech.stop();
  }

  // ============================================================
  // LANGUAGE
  // ============================================================

  setLanguage(lang: VoiceRecognitionLanguage): void {
    this.recognition.setLanguage(lang);
  }

  // ============================================================
  // 🔊 SPEAK + HANDS-FREE CONTINUATION
  // ============================================================

  /**
   * Speaks `text`, then — unless the sheet has been closed in the meantime —
   * automatically reopens the mic so the conversation continues hands-free.
   * Every "final" message in this component (a command result, an error, a
   * cancellation) routes through here instead of calling VoiceSpeechService
   * directly, so hands-free continuation happens in exactly one place.
   */
  private speakAndContinue(text: string): void {
    this.speech.speak(text, () => {
      if (this.dismissed) return;

      this.clearRelistenTimeout();
      this.relistenTimeout = setTimeout(() => {
        if (this.dismissed) return;
        this.startListening();
      }, RELISTEN_DELAY_MS);
    });
  }

  /** Speaks once with no automatic mic restart — used for recognition-level
   *  problems (mic denied, nothing heard) where auto-looping could spam the
   *  user with repeated failed attempts. */
  private speakOnly(text: string): void {
    this.speech.speak(text);
  }

  private clearRelistenTimeout(): void {
    if (this.relistenTimeout) {
      clearTimeout(this.relistenTimeout);
      this.relistenTimeout = undefined;
    }
  }

  // ============================================================
  // MIC TAP
  // ============================================================

  async startListening(): Promise<void> {
    if (
      this.dismissed ||
      !this.supported() ||
      this.state() === 'listening' ||
      this.state() === 'processing'
    ) {
      return;
    }

    // MUST run synchronously, before any `await` below — iOS Safari only
    // "unlocks" speechSynthesis when it's invoked directly inside a user
    // gesture. The very first tap on the mic (a real gesture) is caught
    // here; every later automatic re-listen call passes through the same
    // line but is a harmless no-op since it's already unlocked.
    this.speech.unlock();

    this.clearRelistenTimeout();

    // Stop Nestly's previous response before listening again.
    this.speech.stop();

    this.pendingCommand.set(null);
    this.confirmPrompt.set('');

    this.state.set('listening');
    this.heardText.set('');
    this.resultMessage.set('');

    try {
      const transcript = await this.recognition.start();

      console.log('🎙️ Transcript:', transcript);

      this.heardText.set(transcript);

      if (!transcript.trim()) {
        const message = "I didn't catch that. Try again.";
        this.state.set('error');
        this.resultMessage.set(message);
        this.speakOnly(message);
        return;
      }

      await this.routeTranscript(transcript);
    } catch (err) {
      console.error('🎤 Recognition error:', err);

      const message =
        typeof err === 'string' ? err : 'Something went wrong. Try again.';

      this.state.set('error');
      this.resultMessage.set(message);
      this.speakOnly(message);
    }
  }

  // ============================================================
  // CANCEL LISTENING
  // ============================================================

  cancelListening(): void {
    this.clearRelistenTimeout();
    this.recognition.cancel();
    this.speech.stop();
    this.state.set('idle');
  }

  // ============================================================
  // TRANSCRIPT ROUTING
  // ============================================================

  /**
   * A pending yes/no confirmation is resolved locally — never sent to the
   * command interpreter/Gemini. This is what makes voice confirmation work
   * hands-free, and it guarantees confirming/declining never fires a
   * duplicate AI call for what is really just "yes" or "no".
   */
  private async routeTranscript(transcript: string): Promise<void> {
    if (this.pendingCommand()) {
      const decision = this.matchYesNo(transcript);

      if (decision === 'yes') {
        await this.confirmPendingCommand();
        return;
      }

      if (decision === 'no') {
        this.declinePendingCommand();
        return;
      }

      const prompt = this.confirmPrompt() || 'Please say yes or no.';
      this.state.set('result');
      this.speakAndContinue(prompt);
      return;
    }

    await this.handleTranscript(transcript);
  }

  private matchYesNo(raw: string): 'yes' | 'no' | null {
    const t = raw.trim().toLowerCase();

    if (/^(yes|yeah|yep|yup|sure|correct|confirm|avunu|ha|ok|okay)\b/.test(t)) {
      return 'yes';
    }

    if (/^(no|nope|nah|cancel|vaddu|ledu|kadu)\b/.test(t)) {
      return 'no';
    }

    return null;
  }

  // ============================================================
  // COMMAND HANDLING
  // ============================================================

  private async handleTranscript(transcript: string): Promise<void> {
    if (this.processingTranscript) {
      console.warn(
        '⚠️ handleTranscript called while already processing — ignoring duplicate call.'
      );
      return;
    }

    this.processingTranscript = true;
    this.state.set('processing');

    try {
      const command = await this.commands.interpret(transcript);

      console.log('🤖 AI command:', command);

      if (command.intent === 'UNRECOGNIZED') {
        const message = this.commands.aiCallFailed()
          ? "I couldn't process that command right now. Please try again."
          : "I couldn't understand that command.";

        this.state.set('error');
        this.resultMessage.set(message);
        this.speakAndContinue(message);
        return;
      }

  
      if (this.commands.needsConfirmation(command)) {
  this.pendingCommand.set(command);

  const prompt = this.commands.confirmationPrompt(command);
  this.confirmPrompt.set(prompt);

  this.state.set('result');

  // 🔊 Speak confirmation question
  // ❌ Do NOT automatically restart listening
  // User must click Yes or No
  this.speakOnly(prompt);

  return;
}

      await this.runCommand(command);
    } finally {
      this.processingTranscript = false;
    }
  }

  // ============================================================
  // CONFIRM / DECLINE PENDING COMMAND
  // ============================================================

  async confirmPendingCommand(): Promise<void> {
    const command = this.pendingCommand();
    if (!command) return;

    this.pendingCommand.set(null);
    this.state.set('processing');

    await this.runCommand(command);
  }

  declinePendingCommand(): void {
    this.pendingCommand.set(null);

    const message = 'Okay, cancelled.';
    this.resultMessage.set(message);
    this.state.set('idle');

    this.speakAndContinue(message);
  }

  // ============================================================
  // EXECUTE COMMAND  - auomatic listenning is commented
  // ============================================================

  // private async runCommand(command: VoiceCommand): Promise<void> {
  //   console.log('⚙️ Executing command:', command);

  //   try {
  //     const result = await this.commands.execute(command);

  //     console.log('✅ Command result:', result);

  //     this.resultMessage.set(result.message);
  //     this.state.set(result.isError ? 'error' : 'result');

  //     if (result.message?.trim()) {
  //       this.speakAndContinue(result.message);
  //     }
  //   } catch (err) {
  //     console.error('❌ Voice command execution failed', err);

  //     const message = 'Something went wrong performing that action.';
  //     this.resultMessage.set(message);
  //     this.state.set('error');
  //     this.speakAndContinue(message);
  //   }
  // }
private async runCommand(command: VoiceCommand): Promise<void> {
  console.log('⚙️ Executing command:', command);

  try {
    const result = await this.commands.execute(command);

    console.log('✅ Command result:', result);

    this.resultMessage.set(result.message);
    this.state.set(result.isError ? 'error' : 'result');

    if (!result.message?.trim()) {
      return;
    }

    // Inventory queries show data to the user.
    // Speak the result, but DO NOT automatically start listening again.
    if (
      command.intent === 'INVENTORY_QUERY' ||
      command.intent === 'EXPENSE_QUERY'
    ) {
      this.speakAndContinue(result.message);
      return;
    }

    // For other successful commands, also stop at the result screen.
    // User can manually click "Ask something else".
    this.speakAndContinue(result.message);

  } catch (err) {
    console.error('❌ Voice command execution failed', err);

    const message = 'Something went wrong performing that action.';
    this.resultMessage.set(message);
    this.state.set('error');

    this.speakOnly(message);
  }
}


  // ============================================================
  // TRY AGAIN
  // ============================================================

  tryAgain(): void {
    this.clearRelistenTimeout();
    this.speech.stop();
    this.state.set('idle');
    this.heardText.set('');
    this.resultMessage.set('');
    this.pendingCommand.set(null);
    this.confirmPrompt.set('');
  }

  // ============================================================
  // CLOSE
  // ============================================================

  close(): void {
    this.dismissed = true;
    this.clearRelistenTimeout();
    this.recognition.cancel();
    this.speech.stop();
    this.sheetRef.dismiss();
  }
}