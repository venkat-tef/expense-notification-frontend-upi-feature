import { Injectable, NgZone, inject, signal } from '@angular/core';

import {
  VoiceRecognitionLanguage,
  VOICE_RECOGNITION_LANGUAGES,
} from '../models/voice-command.model';

type BrowserSpeechRecognition = any;

const LANGUAGE_STORAGE_KEY = 'nestly.voice.recognitionLanguage';
const DEFAULT_LANGUAGE: VoiceRecognitionLanguage = 'en-IN';

function readStoredLanguage(): VoiceRecognitionLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    return (VOICE_RECOGNITION_LANGUAGES as readonly string[]).includes(
      stored ?? ''
    )
      ? (stored as VoiceRecognitionLanguage)
      : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

@Injectable({
  providedIn: 'root',
})
export class VoiceRecognitionService {
  private readonly zone = inject(NgZone);

  readonly supported = signal<boolean>(this.detectSupport());

  readonly listening = signal<boolean>(false);

  readonly transcript = signal<string>('');

  readonly errorMessage = signal<string | null>(null);

  readonly language = signal<VoiceRecognitionLanguage>(
    readStoredLanguage()
  );

  private recognition: BrowserSpeechRecognition | null = null;

  // ============================================================
  // LANGUAGE
  // ============================================================

  setLanguage(lang: VoiceRecognitionLanguage): void {
    console.log('🌐 Voice language selected:', lang);

    this.language.set(lang);

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors.
    }
  }

  // ============================================================
  // SUPPORT DETECTION
  // ============================================================

  private detectSupport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const w = window as any;

    const supported = !!(
      w.SpeechRecognition ||
      w.webkitSpeechRecognition
    );

    console.log('🎤 SpeechRecognition supported:', supported);

    return supported;
  }

  // ============================================================
  // CREATE RECOGNITION
  // ============================================================

private createRecognition(): BrowserSpeechRecognition | null {
  const w = window as any;

  const Ctor =
    w.SpeechRecognition ||
    w.webkitSpeechRecognition;

  if (!Ctor) return null;

  const recognition: BrowserSpeechRecognition = new Ctor();

  // IMPORTANT:
  // iPhone may not support Telugu SpeechRecognition reliably.
  // Use Indian English recognition for stable browser support.
  recognition.lang = 'en-IN';

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  return recognition;
}
  // ============================================================
  // START LISTENING
  // ============================================================

  start(): Promise<string> {
    if (!this.supported()) {
      const msg =
        "Voice recognition isn't supported on this browser.";

      this.errorMessage.set(msg);

      return Promise.reject(msg);
    }

    if (this.listening()) {
      return Promise.reject('Already listening.');
    }

    this.errorMessage.set(null);
    this.transcript.set('');

    return new Promise<string>((resolve, reject) => {
      const recognition = this.createRecognition();

      if (!recognition) {
        const msg =
          "Voice recognition isn't available on this browser.";

        this.errorMessage.set(msg);

        reject(msg);

        return;
      }

      this.recognition = recognition;

      let settled = false;

      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;

        this.zone.run(callback);
      };

      // ==========================================================
      // STARTED
      // ==========================================================

      recognition.onstart = () => {
        console.log(
          '🟢 Voice recognition started:',
          recognition.lang
        );

        this.zone.run(() => {
          this.listening.set(true);
        });
      };

      // ==========================================================
      // RESULT
      // ==========================================================

      recognition.onresult = (event: any) => {
        console.log('🎙️ Raw speech result:', event);

        const text =
          event?.results?.[0]?.[0]?.transcript ?? '';

        console.log('🎙️ Recognized transcript:', text);

        finish(() => {
          this.listening.set(false);

          this.transcript.set(text);

          resolve(text);
        });
      };

      // ==========================================================
      // ERROR
      // ==========================================================

      recognition.onerror = (event: any) => {
        console.error(
          '❌ SpeechRecognition ERROR:',
          event
        );

        console.error(
          '❌ Error code:',
          event?.error
        );

        console.error(
          '❌ Error message:',
          event?.message
        );

        const code = event?.error;

        const msg = this.mapError(
          code,
          this.language()
        );

        finish(() => {
          this.listening.set(false);

          this.errorMessage.set(msg);

          reject(msg);
        });
      };

      // ==========================================================
      // END
      // ==========================================================

      recognition.onend = () => {
        console.log(
          '🔴 Voice recognition ended. Settled:',
          settled
        );

        // If result/error already happened,
        // don't reject again.
        if (settled) {
          return;
        }

        finish(() => {
          this.listening.set(false);

          const msg =
            'No speech was detected. Please try again.';

          this.errorMessage.set(msg);

          reject(msg);
        });
      };

      // ==========================================================
      // START
      // ==========================================================

      try {
        console.log(
          '🚀 Starting recognition with language:',
          recognition.lang
        );

        recognition.start();
      } catch (error) {
        console.error(
          '❌ recognition.start() threw an error:',
          error
        );

        finish(() => {
          this.listening.set(false);

          const msg =
            'Could not start voice recognition. Please try again.';

          this.errorMessage.set(msg);

          reject(msg);
        });
      }
    });
  }

  // ============================================================
  // CANCEL
  // ============================================================

  cancel(): void {
    console.log('🛑 Cancelling voice recognition');

    try {
      this.recognition?.abort?.();
    } catch (error) {
      console.warn(
        'Could not abort recognition:',
        error
      );
    }

    this.listening.set(false);
  }

  // ============================================================
  // ERROR MAPPING
  // ============================================================

  private mapError(
    code: string | undefined,
    language: VoiceRecognitionLanguage
  ): string {

    console.error(
      '🎤 Speech recognition failed with:',
      code,
      'Language:',
      language
    );

    switch (code) {

      case 'not-allowed':
      case 'permission-denied':
        return (
          'Microphone access was denied. Please enable microphone access in Safari settings.'
        );

      case 'no-speech':
        return (
          "I didn't hear anything. Please try again."
        );

      case 'audio-capture':
        return (
          'No microphone was found on this device.'
        );

      case 'network':
        return (
          'Voice recognition network service is unavailable. Please check your internet connection.'
        );

      case 'aborted':
        return (
          'Listening was cancelled.'
        );

      case 'service-not-allowed':
        return (
          'Speech recognition service is not allowed on this browser.'
        );

      case 'language-not-supported':
        return (
          language === 'te-IN'
            ? 'Telugu speech recognition is not supported by this browser on this device.'
            : 'The selected speech language is not supported.'
        );

      default:
        return (
          `Voice recognition failed (${code || 'unknown error'}).`
        );
    }
  }
}