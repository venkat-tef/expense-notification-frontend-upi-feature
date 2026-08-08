import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MemberService } from '../../core/services/member.service';
import { Member } from '../../core/models/member.model';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatSelectModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly memberService = inject(MemberService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly savingUpi = signal(false);
  readonly savingApproverId = signal<string | null>(null);

  readonly notificationService = inject(NotificationService); // renamed + made public for the template

  readonly announcementForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    body: ['', Validators.required],
  });

  async sendAnnouncement(): Promise<void> {
    if (this.announcementForm.invalid) {
      this.announcementForm.markAllAsTouched();
      return;
    }
    const { title, body } = this.announcementForm.getRawValue();
    await this.notificationService.sendAnnouncement(title, body); // renamed here too
    this.announcementForm.reset({ title: '', body: '' });
    this.snackBar.open('Announcement sent.', undefined, { duration: 1800 });
  }

  readonly addForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    tempPassword: ['', [Validators.required, Validators.minLength(6)]],
    phone: [''],
    role: ['member' as 'admin' | 'member' | 'guest', Validators.required],
    status: ['active' as 'active' | 'inactive', Validators.required],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    role: ['member' as 'admin' | 'member' | 'guest', Validators.required],
    status: ['active' as 'active' | 'inactive', Validators.required],
  });

  async addMember(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.addForm.getRawValue();
      await this.memberService.addMember(value);
      this.addForm.reset({ name: '', email: '', tempPassword: '', phone: '', role: 'member', status: 'active' });
      this.snackBar.open(`${value.name} added.`, undefined, { duration: 1800 });
    } catch (err: any) {
      this.snackBar.open(this.mapError(err?.code), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  startEdit(member: Member): void {
    this.editingId.set(member.id);
    this.editForm.setValue({
      name: member.name,
      phone: member.phone ?? '',
      role: member.role ?? 'member',
      status: member.status ?? 'active',
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    await this.memberService.updateMember(id, this.editForm.getRawValue());
    this.cancelEdit();
    this.snackBar.open('Member updated.', undefined, { duration: 1800 });
  }

  async deleteMember(member: Member): Promise<void> {
    const confirmed = confirm(
      `Remove ${member.name}? Note: this removes their app profile but does not delete their login account.`
    );
    if (!confirmed) return;
    await this.memberService.deleteMember(member.id);
    this.snackBar.open(`${member.name} removed.`, undefined, { duration: 1800 });
  }

  // --- UPI Settlement: "My UPI ID" (self-service) -----------------------

  readonly editingUpi = signal(false);
  readonly upiDraft = signal('');

  startEditUpi(): void {
    this.upiDraft.set(this.memberService.currentMember()?.upiId ?? '');
    this.editingUpi.set(true);
  }

  async saveUpi(): Promise<void> {
    const value = this.upiDraft().trim();
    if (!value || !value.includes('@')) {
      this.snackBar.open('Enter a valid UPI ID, e.g. name@bank.', 'OK', { duration: 3000 });
      return;
    }
    this.savingUpi.set(true);
    try {
      await this.memberService.updateOwnUpiId(value);
      this.editingUpi.set(false);
      this.snackBar.open('UPI ID saved.', undefined, { duration: 1800, panelClass: 'rm-snack-success' });
    } finally {
      this.savingUpi.set(false);
    }
  }

  // --- UPI Settlement: Payment Approver (admin-only) ---------------------

  async makeApprover(member: Member): Promise<void> {
    if (member.isPaymentApprover) return;
    this.savingApproverId.set(member.id);
    try {
      await this.memberService.setPaymentApprover(member.id);
      this.snackBar.open(`${member.name} is now the payment approver.`, undefined, { duration: 2000 });
    } finally {
      this.savingApproverId.set(null);
    }
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
        return 'Could not add member. Please try again.';
    }
  }
}