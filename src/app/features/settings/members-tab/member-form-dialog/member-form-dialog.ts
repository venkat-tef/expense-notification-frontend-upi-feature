import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Member, MemberRole, MemberStatus } from '../../../../core/models/member.model';
import { MemberService } from '../../../../core/services/member.service';

export interface MemberFormDialogData {
  /** Present when editing; absent when adding a new member. */
  member?: Member;
}

@Component({
  selector: 'app-member-form-dialog',
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
  templateUrl: './member-form-dialog.html',
  styleUrl: './member-form-dialog.scss',
})
export class MemberFormDialog {
  private readonly ref = inject(MatDialogRef<MemberFormDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<MemberFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.member;
  readonly saving = signal(false);

  // Same fields/validators as the original addForm/editForm in settings.ts, just merged
  // into one form since email/password only matter for add.
  readonly form = this.fb.nonNullable.group({
    name: [this.data.member?.name ?? '', Validators.required],
    email: ['', this.isEdit ? [] : [Validators.required, Validators.email]],
    tempPassword: ['', this.isEdit ? [] : [Validators.required, Validators.minLength(6)]],
    phone: [this.data.member?.phone ?? ''],
    role: [this.data.member?.role ?? ('member' as MemberRole), Validators.required],
    status: [this.data.member?.status ?? ('active' as MemberStatus), Validators.required],
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
        await this.memberService.updateMember(this.data.member!.id, {
          name: value.name,
          phone: value.phone,
          role: value.role,
          status: value.status,
        });
        this.snackBar.open('Member updated.', undefined, { duration: 1800 });
      } else {
        await this.memberService.addMember(value);
        this.snackBar.open(`${value.name} added.`, undefined, { duration: 1800 });
      }
      this.ref.close(true);
    } catch (err: any) {
      this.snackBar.open(this.mapError(err?.code), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.ref.close(false);
  }

  private mapError(code?: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That email is already registered.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/weak-password':
        return 'Temporary password is too weak (min 6 characters).';
      default:
        return 'Could not save member. Please try again.';
    }
  }
}
