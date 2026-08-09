import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Announcement } from '../../../../core/models/announcement.model';
import { AnnouncementService } from '../../../../core/services/announcement.service';

export interface AnnouncementDialogData {
  announcement?: Announcement;
}

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './announcement-dialog.html',
  styleUrl: './announcement-dialog.scss',
})
export class AnnouncementDialog {
  private readonly ref = inject(MatDialogRef<AnnouncementDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly announcementService = inject(AnnouncementService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<AnnouncementDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.announcement;
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: [this.data.announcement?.title ?? '', Validators.required],
    body: [this.data.announcement?.body ?? '', Validators.required],
    status: [this.data.announcement?.status ?? ('active' as 'active' | 'inactive'), Validators.required],
  });

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      if (this.isEdit) {
        await this.announcementService.update(this.data.announcement!.id, value);
        this.snackBar.open('Announcement updated.', undefined, { duration: 1800 });
      } else {
        await this.announcementService.create(value);
        this.snackBar.open(
          value.status === 'active' ? 'Announcement sent.' : 'Draft saved.',
          undefined,
          { duration: 1800, panelClass: 'rm-snack-success' }
        );
      }
      this.ref.close(true);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.ref.close(false);
  }
}
