import { Component, HostListener, inject, signal } from '@angular/core';
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
  /**
   * Present when this dialog is being opened from an incoming Web Share
   * Target image (see PendingSharedImageService) — attached automatically
   * on open via the exact same validated path as a manually-picked or
   * pasted file (handleIncomingFile), so it previews, can be removed/
   * replaced, and uploads on save exactly like any other selection.
   */
  initialFile?: File;
}

export type ExpenseDialogResult = ExpenseInput;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// HEIC/HEIF included for iOS photo-picker shares/uploads — not every browser
// can render them in the <img> preview, but they're still valid, uploadable
// files wherever the device/browser provides them (requirement: support
// JPEG/PNG/WebP/HEIC/HEIF "where the browser/device provides them").
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

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

  constructor() {
    // Auto-attach a shared image, if this dialog was opened from a Web Share
    // Target intent. Routed through the exact same validated path
    // (handleIncomingFile) as a manually-picked or pasted file, so it
    // previews/removes/replaces/uploads identically — no separate code path.
    if (this.data.initialFile) {
      this.handleIncomingFile(this.data.initialFile);
    }
  }

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
    this.handleIncomingFile(file);
  }

  // ============================================================
  // ADDITIVE — PASTE IMAGE FROM CLIPBOARD
  // ============================================================
  //
  // Two complementary paths, both funneling into the same validated
  // handleIncomingFile():
  //  1. A document-level `paste` listener — catches native Ctrl+V (desktop)
  //     or the OS "Paste" action from a long-press context menu (mobile),
  //     regardless of which field currently has focus. Only intercepts
  //     when the clipboard actually contains an image, so normal text
  //     pasting into Title/Notes/etc. is completely unaffected.
  //  2. An explicit "Paste image" button using the async Clipboard API,
  //     for browsers that support it (desktop Chrome/Edge, most Android
  //     Chrome) — a more discoverable one-tap alternative to Ctrl+V.
  //     Where unsupported (e.g. Safari), it just prompts the user to use
  //     the native paste gesture instead, which path 1 then picks up.
  @HostListener('document:paste', ['$event'])
  onDocumentPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          this.handleIncomingFile(file);
        }
        return;
      }
    }
  }

  private readonly clipboardReadSupported =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

  /** Whether to show the explicit "Paste image" button at all — hidden where the API can't work. */
  readonly canPasteViaButton = this.clipboardReadSupported;

  async pasteFromClipboard(): Promise<void> {
    if (!this.clipboardReadSupported) {
      this.snackBar.open('Long-press (or press Ctrl+V) and choose Paste to add a copied image.', 'OK', { duration: 4000 });
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], `pasted-image.${imageType.split('/')[1] ?? 'png'}`, { type: imageType });
          this.handleIncomingFile(file);
          return;
        }
      }
      this.snackBar.open('No image found on the clipboard.', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Long-press (or press Ctrl+V) and choose Paste to add a copied image.', 'OK', { duration: 4000 });
    }
  }

  private handleIncomingFile(file: File): void {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.snackBar.open('Only JPG, PNG, WEBP, HEIC, or HEIF images are allowed.', 'OK', { duration: 3000 });
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