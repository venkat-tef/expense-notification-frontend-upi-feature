import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Member } from '../../../core/models/member.model';
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory } from '../../../core/models/expense.model';
import { ExpenseInput, ExpenseService } from '../../../core/services/expense.service';
import { MemberService } from '../../../core/services/member.service';

export interface ExpenseDialogData {
  members: Member[];
  monthKey: string;
  /** Present when editing an existing expense; absent when adding a new one. */
  expense?: Expense;
}

export type ExpenseDialogResult = ExpenseInput;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './expense-dialog.html',
  styleUrl: './expense-dialog.scss',
})
export class ExpenseDialog {
  private readonly ref = inject(MatDialogRef<ExpenseDialog>);
  private readonly expenseService = inject(ExpenseService);
  private readonly snackBar = inject(MatSnackBar);
  readonly memberService = inject(MemberService);
  readonly data = inject<ExpenseDialogData>(MAT_DIALOG_DATA);

  readonly categories = EXPENSE_CATEGORIES;
  readonly isEdit = !!this.data.expense;
  readonly today = todayDateKey();

  /**
   * Whoever is logged in sees only their own name in "Paid By" (fixed, not
   * editable) — the full members dropdown is admin-only. Reuses
   * MemberService.isAdmin()/currentMember(), same as everywhere else in the
   * app; no second permission system.
   */
  readonly isAdmin = this.memberService.isAdmin();
  private readonly selfMember = this.memberService.currentMember();

  readonly title = signal(this.data.expense?.title ?? '');
  readonly category = signal<ExpenseCategory>(this.data.expense?.category ?? 'Groceries');
  readonly amountInput = signal(this.data.expense?.amount != null ? String(this.data.expense.amount) : '');
  readonly paidByMemberId = signal(
    this.data.expense?.paidByMemberId
      ?? (this.isAdmin ? this.data.members[0]?.id ?? '' : this.selfMember?.id ?? this.data.members[0]?.id ?? '')
  );
  readonly expenseDate = signal(this.data.expense?.expenseDate ?? todayDateKey());
  readonly notes = signal(this.data.expense?.notes ?? '');

  private readonly existingImageUrl = this.data.expense?.billImageUrl ?? '';
  private readonly existingImagePath = this.data.expense?.billImagePath ?? '';
  private readonly existingImagePublicId = this.data.expense?.billImagePublicId ?? '';
  private selectedFile: File | null = null;
  private imageRemoved = false;
  readonly previewUrl = signal<string | null>(this.data.expense?.billImageUrl ?? null);

  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});

  /** Name shown in the read-only "Paid By" field for non-admins. */
  get selfMemberName(): string {
    return this.data.members.find((m) => m.id === this.paidByMemberId())?.name
      ?? this.selfMember?.name
      ?? 'You';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.snackBar.open('Only JPG, PNG, or WEBP images are allowed.', 'OK', { duration: 3000 });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.snackBar.open('Image must be 5 MB or smaller.', 'OK', { duration: 3000 });
      return;
    }

    this.selectedFile = file;
    this.imageRemoved = false;
    this.previewUrl.set(URL.createObjectURL(file));
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imageRemoved = true;
    this.previewUrl.set(null);
  }

  private validate(): boolean {
    const errs: Record<string, string> = {};

    const title = this.title().trim();
    if (!title) errs['title'] = 'Title is required.';
    else if (title.length > 50) errs['title'] = 'Maximum 50 characters.';

    const amountRaw = String(this.amountInput() ?? '').trim();
 const amount = Number(amountRaw);

if (!amountRaw) {
  errs['amount'] = 'Amount is required.';
} else if (isNaN(amount)) {
  errs['amount'] = 'Enter a valid amount.';
} else if (amount <= 0) {
  errs['amount'] = 'Amount must be greater than zero.';
} else if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
  errs['amount'] = 'Maximum two decimal places are allowed.';
}

    if (!this.paidByMemberId()) errs['paidByMemberId'] = 'Select who paid.';

    const date = this.expenseDate();
    if (!date) errs['expenseDate'] = 'Date is required.';
    else if (date > this.today) errs['expenseDate'] = 'Date cannot be in the future.';

    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  async save(): Promise<void> {
    if (!this.validate()) return;
    this.saving.set(true);
    try {
      let billImageUrl = this.existingImageUrl;
      let billImagePath = this.existingImagePath; // legacy Firebase Storage path, if any
      let billImagePublicId = this.existingImagePublicId; // Cloudinary metadata, if any
      const oldPath = this.existingImagePath; // only legacy files need explicit cleanup

      if (this.imageRemoved) {
        billImageUrl = '';
        billImagePath = '';
        billImagePublicId = '';
      }

      if (this.selectedFile) {
        const monthKey = this.expenseDate().slice(0, 7);
        const uploaded = await this.expenseService.uploadBillImage(this.selectedFile, monthKey);
        billImageUrl = uploaded.url;
        billImagePublicId = uploaded.publicId;
        billImagePath = ''; // a new upload always replaces any legacy Storage-backed image
      }

      const result: ExpenseDialogResult = {
        title: this.title().trim(),
        category: this.category(),
        amount: Number(this.amountInput()),
        paidByMemberId: this.paidByMemberId(),
        expenseDate: this.expenseDate(),
        notes: this.notes().trim() || undefined,
        billImageUrl: billImageUrl || undefined,
        billImagePath: billImagePath || undefined,
        billImagePublicId: billImagePublicId || undefined,
      };

      // Legacy cleanup only — pre-Cloudinary-migration images stored in Firebase
      // Storage still get deleted on replace/remove, exactly as before. New Cloudinary
      // uploads have no client-side delete (unsigned uploads never expose the API
      // secret needed for that), so a replaced/removed Cloudinary asset is simply no
      // longer referenced rather than deleted.
      if (oldPath && oldPath !== billImagePath) {
        this.expenseService.deleteStorageFile(oldPath).catch(() => {});
      }

      this.ref.close(result);
    } catch (err) {
      console.error('Failed to save expense', err);
      const message = err instanceof Error ? err.message : 'Could not save the expense. Please try again.';
      this.snackBar.open(message, 'OK', { duration: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.ref.close();
  }
}