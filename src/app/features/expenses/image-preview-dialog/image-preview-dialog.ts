import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ImagePreviewData {
  url: string;
}

/**
 * Full-screen bill image viewer. The app's global viewport meta tag sets
 * maximum-scale=1, which disables native pinch-zoom everywhere — so zoom here
 * is implemented manually (two-finger pinch + double-tap) rather than relying
 * on the browser's built-in page zoom.
 */
@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './image-preview-dialog.html',
  styleUrl: './image-preview-dialog.scss',
})
export class ImagePreviewDialog {
  private readonly ref = inject(MatDialogRef<ImagePreviewDialog>);
  readonly data = inject<ImagePreviewData>(MAT_DIALOG_DATA);

  readonly scale = signal(1);

  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private lastTapTime = 0;

  close(): void {
    this.ref.close();
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.pinchStartDistance = this.distance(event.touches[0], event.touches[1]);
      this.pinchStartScale = this.scale();
    } else if (event.touches.length === 1) {
      const now = Date.now();
      if (now - this.lastTapTime < 300) {
        this.scale.set(this.scale() > 1 ? 1 : 2);
      }
      this.lastTapTime = now;
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.pinchStartDistance > 0) {
      event.preventDefault();
      const currentDistance = this.distance(event.touches[0], event.touches[1]);
      const ratio = currentDistance / this.pinchStartDistance;
      const next = Math.min(4, Math.max(1, this.pinchStartScale * ratio));
      this.scale.set(next);
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinchStartDistance = 0;
    }
  }

  /** Desktop fallback: double-click to toggle zoom. */
  onDoubleClick(): void {
    this.scale.set(this.scale() > 1 ? 1 : 2);
  }

  private distance(a: Touch, b: Touch): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
}
