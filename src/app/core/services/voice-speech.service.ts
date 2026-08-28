// core/services/voice-speech.service.ts
import { Injectable, NgZone, inject } from '@angular/core';

/**
 * iOS Safari requires speechSynthesis to be "unlocked" by a synchronous
 * speak() call made directly inside a user gesture (a tap), before any
 * `await` runs. Once unlocked for the page's lifetime, later speak() calls
 * made from async code (after awaiting recognition/API results) work
 * normally. iOS also silently pauses long utterances after ~15s unless
 * resume() is pinged periodically — both are handled here so callers never
 * have to think about it.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSpeechService {
  private readonly zone = inject(NgZone);

  private unlocked = false;
  private resumeTimer?: ReturnType<typeof setInterval>;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  /**
   * Call synchronously inside a tap/click handler, BEFORE any `await`.
   * Speaks a near-silent utterance so iOS treats speechSynthesis as
   * "activated" for the rest of the session. Safe to call on every
   * startListening() invocation — it's a no-op after the first success.
   */
  unlock(): void {
    if (this.unlocked || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 10;
      window.speechSynthesis.speak(primer);
      this.unlocked = true;
    } catch (err) {
      console.warn('🔊 speechSynthesis unlock failed:', err);
    }
  }

  /**
   * Speaks `text` aloud. `onEnd` fires exactly once — whether the utterance
   * finished normally, errored, or was superseded by a later stop()/speak()
   * call — so callers can safely chain "start listening again" off it
   * without worrying about double-firing.
   */
  speak(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('🔊 Speech synthesis is not supported in this browser.');
      onEnd?.();
      return;
    }

    if (!text?.trim()) {
      onEnd?.();
      return;
    }

    // cancel() fires the PREVIOUS utterance's onend/onerror synchronously in
    // some browsers — null out activeUtterance first so that stale callback
    // can never also trigger the new utterance's onEnd.
    this.stopInternal();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.detectLanguage(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = this.pickVoice(utterance.lang);
    if (voice) utterance.voice = voice;

    this.activeUtterance = utterance;

    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      this.clearResumeTimer();
      if (this.activeUtterance === utterance) this.activeUtterance = null;
      this.zone.run(() => onEnd?.());
    };

    utterance.onstart = () => {
      console.log('🔊 Nestly started speaking:', text);

      // iOS Safari silently pauses speech after ~15s of continuous audio
      // unless resume() is pinged periodically.
      this.clearResumeTimer();
      this.resumeTimer = setInterval(() => {
        try {
          window.speechSynthesis.resume();
        } catch {
          // ignore
        }
      }, 5000);
    };

    utterance.onend = () => {
      console.log('🔊 Nestly finished speaking.');
      finish();
    };

    utterance.onerror = (event) => {
      console.error('🔊 Speech error:', event);
      finish();
    };

    console.log('🔊 Nestly speaking:', text);
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    this.stopInternal();
  }

  private stopInternal(): void {
    this.clearResumeTimer();
    this.activeUtterance = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  private clearResumeTimer(): void {
    if (this.resumeTimer) {
      clearInterval(this.resumeTimer);
      this.resumeTimer = undefined;
    }
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | undefined {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;

    // iOS Safari can return an empty voice list on the very first call —
    // that's fine, the utterance still plays using the system default for
    // `lang`; we only upgrade to a named voice when one is actually ready.
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return undefined;

    const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;

    const prefix = lang.split('-')[0].toLowerCase();
    return voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  }

  private detectLanguage(text: string): string {
    const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
    return hasTelugu ? 'te-IN' : 'en-IN';
  }
}