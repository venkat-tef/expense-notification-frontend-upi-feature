import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

import { VoiceAssistantSheet } from '../voice-assistant-sheet/voice-assistant-sheet';

/**
 * PHASE 2 — global "Hey Nestly" entry point.
 *
 * A single floating button rendered once at the app-root level (see app.ts),
 * visible on every authenticated screen. Deliberately NOT added to
 * bottom-nav.ts — the spec calls out "do not overcrowd the existing bottom
 * navigation" and "do not create a duplicate navigation system". This reuses
 * the same MatBottomSheet mechanism already used for notifications
 * (see NotificationSheet), just with its own sheet component.
 */
@Component({
  selector: 'app-voice-assistant-fab',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './voice-assistant-fab.html',
  styleUrl: './voice-assistant-fab.scss',
})
export class VoiceAssistantFab {
  private readonly bottomSheet = inject(MatBottomSheet);

  open(): void {
    this.bottomSheet.open(VoiceAssistantSheet, {
      panelClass: 'rm-voice-sheet-panel',
    });
  }
}
