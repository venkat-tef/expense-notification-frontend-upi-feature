import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        // Auto-activate and reload — no manual tap required. Show a brief toast first
        // so a mid-action user isn't jarred by an instant reload with zero warning.
        this.snackBar.open('Updating Nestly to the latest version…', undefined, { duration: 2000 });
        setTimeout(() => this.activateAndReload(), 1500);
      });

    // Also actively poll every 30 minutes while the app stays open in the background —
    // versionUpdates only fires on its own after a fresh SW check, which by default only
    // happens on app startup. This catches long-lived open tabs too.
    setInterval(() => {
      this.swUpdate.checkForUpdate().catch((err) => console.warn('SW update check failed', err));
    }, 30 * 60 * 1000);

    this.swUpdate.checkForUpdate().catch((err) => console.warn('SW update check failed', err));
  }

  private async activateAndReload(): Promise<void> {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}