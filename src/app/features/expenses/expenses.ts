import {
  Component,
  computed,
  inject,
  signal,
  Inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatDialog,
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';

import { MemberService } from '../../core/services/member.service';
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlySummaryService } from '../../core/services/monthly-summary.service';
import { SettlementPaymentService } from '../../core/services/settlement-payment.service';

import {
  Expense,
  EXPENSE_CATEGORY_ICONS,
  MemberSettlement,
  PaymentStatus,
} from '../../core/models/expense.model';

import {
  ExpenseDialog,
  ExpenseDialogData,
  ExpenseDialogResult,
} from './expense-dialog/expense-dialog';

import { ImagePreviewDialog } from './image-preview-dialog/image-preview-dialog';
import { PendingSharedImageService } from '../../core/services/pending-shared-image.service';


function currentMonthKey(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}`;

  // return '2027-01';
}


function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey
    .split('-')
    .map(Number);

  return new Date(
    y,
    m - 1,
    1
  ).toLocaleDateString(
    'en-US',
    {
      month: 'long',
      year: 'numeric',
    }
  );
}


/**
 * ------------------------------------------------------------
 * iOS UPI APP PICKER
 * ------------------------------------------------------------
 *
 * Used from UpiQrPaymentDialog's "Open UPI App Instead" button when on
 * iPhone/iPad, since iOS does not reliably give the Android-style chooser
 * for a generic upi://pay URL.
 *
 * The dialog simply returns which UPI app the user selected.
 */
@Component({
  standalone: true,

  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
  ],

  template: `
  <h2 mat-dialog-title class="upi-title">
    Choose UPI App
  </h2>

  <mat-dialog-content class="upi-content">
    <div class="upi-app-list">

      <!-- Google Pay -->
      <button
        type="button"
        class="upi-app-row"
        (click)="select('gpay')"
      >
        <span class="upi-app-icon">
          <img src="/icons/upi/google-pay.png" alt="Google Pay" />
        </span>
        <span class="upi-app-name">Google Pay</span>
        <mat-icon class="upi-chevron">chevron_right</mat-icon>
      </button>

      <!-- PhonePe -->
      <button
        type="button"
        class="upi-app-row"
        (click)="select('phonepe')"
      >
        <span class="upi-app-icon">
          <img src="/icons/upi/phonepe.png" alt="PhonePe" />
        </span>
        <span class="upi-app-name">PhonePe</span>
        <mat-icon class="upi-chevron">chevron_right</mat-icon>
      </button>

      <!-- Paytm -->
      <button
        type="button"
        class="upi-app-row"
        (click)="select('paytm')"
      >
        <span class="upi-app-icon">
          <img src="/icons/upi/paytm.png" alt="Paytm" />
        </span>
        <span class="upi-app-name">Paytm</span>
        <mat-icon class="upi-chevron">chevron_right</mat-icon>
      </button>

      <!-- BHIM -->
      <button
        type="button"
        class="upi-app-row"
        (click)="select('bhim')"
      >
        <span class="upi-app-icon">
          <img src="/icons/upi/bhim.png" alt="BHIM" />
        </span>
        <span class="upi-app-name">BHIM</span>
        <mat-icon class="upi-chevron">chevron_right</mat-icon>
      </button>

      <!-- CRED -->
      <button
        type="button"
        class="upi-app-row"
        (click)="select('cred')"
      >
        <span class="upi-app-icon">
          <img src="/icons/upi/cred.png" alt="CRED" />
        </span>
        <span class="upi-app-name">CRED</span>
        <mat-icon class="upi-chevron">chevron_right</mat-icon>
      </button>

    </div>
  </mat-dialog-content>

  <mat-dialog-actions align="end" class="upi-actions">
    <button
      mat-button
      type="button"
      class="upi-cancel-btn"
      (click)="close()"
    >
      Cancel
    </button>
  </mat-dialog-actions>
`,

  styles: [`
:host {
  display: block;
}

.upi-title {
  color: var(--rm-text);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  padding: 4px 0 2px;
}

.upi-content {
  padding: 0 !important;
}

.upi-app-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  min-width: 280px;
  padding: 6px 0 8px;
}

/* Plain native button, fully custom — no Material button internals to fight */
.upi-app-row {
  all: unset;
  box-sizing: border-box;

  display: flex;
  align-items: center;
  gap: 14px;

  width: 100%;
  min-height: 60px;
  padding: 10px 14px;

  border-radius: var(--rm-radius-md, 14px);
  border: 1px solid var(--rm-border);
  background: var(--rm-surface-alt);

  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease, box-shadow 150ms ease;
}

.upi-app-row:hover {
  background: var(--rm-surface);
  box-shadow: var(--rm-shadow);
}

.upi-app-row:active {
  transform: scale(0.98);
}

.upi-app-row:focus-visible {
  outline: 2px solid var(--rm-primary);
  outline-offset: 2px;
}

.upi-app-icon {
  flex: 0 0 40px;

  width: 40px;
  height: 40px;
  border-radius: 10px;

  background: var(--rm-surface);
  border: 1px solid var(--rm-border);

  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.upi-app-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.upi-app-name {
  flex: 1;

  font-family: inherit;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.2;

  color: var(--rm-text);

  /* vertical centering without the mdc label fighting us */
  display: flex;
  align-items: center;
}

.upi-chevron {
  flex: 0 0 auto;
  font-size: 20px;
  width: 20px;
  height: 20px;
  color: var(--rm-text-muted);
}

.upi-actions {
  padding: 8px 4px 4px !important;
}

.upi-cancel-btn {
  color: var(--rm-text-muted) !important;
  font-weight: 700;
}
`],
})
export class UpiAppPickerDialog {

  constructor(
    private readonly dialogRef:
      MatDialogRef<UpiAppPickerDialog>,

    @Inject(MAT_DIALOG_DATA)
    public readonly data: unknown
  ) { }

  select(
    app:
      | 'gpay'
      | 'phonepe'
      | 'paytm'
      | 'bhim'
      | 'cred'
  ): void {
    this.dialogRef.close(app);
  }

  close(): void {
    this.dialogRef.close();
  }
}


/**
 * ------------------------------------------------------------
 * UPI QR PAYMENT DIALOG (NEW — primary payment flow)
 * ------------------------------------------------------------
 *
 * WHY THIS EXISTS:
 * PhonePe (and increasingly other UPI apps) actively blocks generic
 * `upi://pay` deep links opened FROM A BROWSER/PWA for peer-to-peer
 * transfers, as a fraud measure against phishing payment links. This is
 * a deliberate policy decision on their end, not a bug in how we built
 * the link — manual "Send Money" inside the PhonePe app never hits this
 * check at all. The error PhonePe shows literally tells the user the
 * sanctioned alternative: "please try using a mobile number, UPI ID, or
 * QR code."
 *
 * So this dialog leads with exactly those two officially-suggested paths:
 *   1. A scannable UPI QR code (same payment params, rendered as an image
 *      instead of a deep link — scanning is treated as a trusted flow).
 *   2. The payee's UPI ID with one-tap copy, for manual entry.
 *
 * The old direct-deep-link behavior (Android generic link / iOS app
 * picker) is kept as a secondary "Open UPI App Instead" option, since
 * apps other than PhonePe (GPay, Paytm, etc.) may still open it fine.
 */
interface UpiQrPaymentDialogData {
  link: string;
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
  isIOS: boolean;
}

@Component({
  standalone: true,

  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
  ],

  template: `
  <h2 mat-dialog-title class="upi-qr-title">Pay via UPI</h2>

  <mat-dialog-content class="upi-qr-content">
    <div class="upi-qr-amount">₹{{ data.amount.toFixed(2) }}</div>
    <div class="upi-qr-payee">to {{ data.payeeName }}</div>

    <div class="upi-qr-image-wrap">
      @if (qrDataUrl()) {
        <img [src]="qrDataUrl()!" alt="UPI QR code" class="upi-qr-image" />
      } @else {
        <div class="upi-qr-placeholder">Generating QR…</div>
      }
    </div>

    <p class="upi-qr-hint">Scan this with your UPI app's camera to pay.</p>

    <div class="upi-qr-id-row">
      <span class="upi-qr-id">{{ data.upiId }}</span>
      <button
        mat-icon-button
        type="button"
        (click)="copyUpiId()"
        aria-label="Copy UPI ID"
      >
        <mat-icon>content_copy</mat-icon>
      </button>
    </div>
  </mat-dialog-content>

  <mat-dialog-actions align="end" class="upi-qr-actions">
    <button mat-button type="button" (click)="close()">Cancel</button>
    <button
      mat-flat-button
      color="primary"
      type="button"
      (click)="openDirectly()"
    >
      Open UPI App Instead
    </button>
  </mat-dialog-actions>
`,

  styles: [`
:host {
  display: block;
}

.upi-qr-title {
  color: var(--rm-text);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  padding: 4px 0 2px;
  text-align: center;
}

.upi-qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0 8px !important;
  min-width: 260px;
}

.upi-qr-amount {
  font-size: 26px;
  font-weight: 800;
  color: var(--rm-text);
  margin-top: 4px;
}

.upi-qr-payee {
  font-size: 13.5px;
  color: var(--rm-text-muted);
  margin-bottom: 10px;
}

.upi-qr-image-wrap {
  width: 220px;
  height: 220px;
  border-radius: var(--rm-radius-md, 14px);
  border: 1px solid var(--rm-border);
  background: #fff;

  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.upi-qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.upi-qr-placeholder {
  font-size: 13px;
  color: var(--rm-text-muted);
}

.upi-qr-hint {
  font-size: 12.5px;
  color: var(--rm-text-muted);
  margin: 10px 0 6px;
  text-align: center;
}

.upi-qr-id-row {
  display: flex;
  align-items: center;
  gap: 6px;

  padding: 6px 10px 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--rm-border);
  background: var(--rm-surface-alt);
}

.upi-qr-id {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rm-text);
}

.upi-qr-actions {
  padding: 8px 4px 4px !important;
}
`],
})
export class UpiQrPaymentDialog implements OnInit {

  private readonly dialogRef =
    inject(MatDialogRef<UpiQrPaymentDialog>);

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly data: UpiQrPaymentDialogData =
    inject(MAT_DIALOG_DATA);

  readonly qrDataUrl = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(this.data.link, {
        width: 240,
        margin: 1,
      });

      this.qrDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate UPI QR code', err);
    }
  }

  async copyUpiId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.upiId);

      this.snackBar.open('UPI ID copied.', undefined, {
        duration: 1800,
      });
    } catch {
      this.snackBar.open(
        'Could not copy — please copy manually.',
        'OK',
        { duration: 2500 }
      );
    }
  }

  /**
   * Secondary path — the old direct deep-link behavior. Still useful for
   * UPI apps other than PhonePe that don't block browser-initiated links.
   */
  openDirectly(): void {
    if (!this.data.isIOS) {
      window.location.href = this.data.link;
      this.dialogRef.close();
      return;
    }

    const pickerRef = this.dialog.open(UpiAppPickerDialog, {
      width: '340px',
      maxWidth: '90vw',
      autoFocus: false,
    });

    pickerRef.afterClosed().subscribe(
      (
        selectedApp:
          | 'gpay'
          | 'phonepe'
          | 'paytm'
          | 'bhim'
          | 'cred'
          | undefined
      ) => {
        if (!selectedApp) {
          return;
        }

        const query = this.data.link.replace(/^upi:\/\/pay\?/, '');

        const schemeMap: Record<string, string> = {
          gpay: `gpay://upi/pay?${query}`,
          phonepe: `phonepe://pay?${query}`,
          paytm: `paytmmp://pay?${query}`,
          bhim: `bhim://pay?${query}`,
          cred: `cred://pay?${query}`,
        };

        window.location.href = schemeMap[selectedApp] ?? this.data.link;
        this.dialogRef.close();
      }
    );
  }

  close(): void {
    this.dialogRef.close();
  }
}


/**
 * ------------------------------------------------------------
 * EXPENSES
 * ------------------------------------------------------------
 */
@Component({
  selector: 'app-expenses',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
  ],

  templateUrl: './expenses.html',
  styleUrl: './expenses.scss',
})
export class Expenses implements OnInit {

  readonly memberService =
    inject(MemberService);

  readonly expenseService =
    inject(ExpenseService);

  readonly summaryService =
    inject(MonthlySummaryService);

  readonly paymentService =
    inject(SettlementPaymentService);

  private readonly dialog =
    inject(MatDialog);

  private readonly snackBar =
    inject(MatSnackBar);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly pendingSharedImage =
    inject(PendingSharedImageService);


  readonly categoryIcons =
    EXPENSE_CATEGORY_ICONS;

  readonly selectedMonth =
    signal(currentMonthKey());

  readonly selectedMemberFilter =
    signal('');


  /**
   * Current month always shows up even with no data yet,
   * plus every month that has data.
   */
  readonly monthOptions = computed(() => {
    const set = new Set<string>([
      currentMonthKey(),
      this.selectedMonth(),
    ]);

    for (
      const e of this.expenseService.expenses()
    ) {
      set.add(e.monthKey);
    }

    for (
      const s of this.summaryService.summaries()
    ) {
      set.add(s.monthKey);
    }

    return Array.from(set)
      .sort()
      .reverse();
  });


  readonly summary = computed(
    () =>
      this.summaryService.forMonth(
        this.selectedMonth()
      ) ??
      this.summaryService.emptyFor(
        this.selectedMonth()
      )
  );


  // ==========================================================
  // EXPENSES
  // ==========================================================

  /**
   * ALL expenses for the selected month.
   *
   * This is the source of truth for financial calculations.
   * The member filter must NEVER affect this list.
   */
  readonly allMonthExpenses = computed(() => {
    return this.expenseService.forMonth(
      this.selectedMonth()
    );
  });


  /**
   * Filtered expenses — used ONLY for displaying
   * the expense list.
   */
  readonly monthExpenses = computed(() => {
    const expenses =
      this.allMonthExpenses();

    const memberId =
      this.selectedMemberFilter();

    if (!memberId) {
      return expenses;
    }

    return expenses.filter(
      (e) =>
        e.paidByMemberId === memberId
    );
  });


  /**
   * Financial total must ALWAYS use ALL expenses.
   */
  readonly otherExpensesTotal = computed(
    () =>
      this.allMonthExpenses().reduce(
        (sum, e) =>
          sum + e.amount,
        0
      )
  );


  readonly grandTotal = computed(() => {
    const s = this.summary();

    return (
      s.roomRent +
      s.electricityBill +
      this.otherExpensesTotal()
    );
  });


  /**
   * Settlement must ALWAYS use ALL expenses.
   *
   * Selecting a member in the expense filter must
   * never change anyone's share or amount owed.
   */
  readonly settlement =
    computed<MemberSettlement[]>(() => {

      const members =
        this.memberService
          .members()
          .filter(
            (m) => m.role !== 'guest'
          );

      if (!members.length) {
        return [];
      }

      const share =
        this.grandTotal() /
        members.length;

      const paidMap =
        new Map<string, number>();

      /**
       * IMPORTANT:
       * Use allMonthExpenses(), NOT monthExpenses().
       */
      for (
        const e of this.allMonthExpenses()
      ) {
        paidMap.set(
          e.paidByMemberId,
          (
            paidMap.get(
              e.paidByMemberId
            ) ?? 0
          ) + e.amount
        );
      }

      return members.map((m) => {

        const paid =
          paidMap.get(m.id) ?? 0;

        return {
          memberId: m.id,
          memberName: m.name,
          paid,
          share,
          remaining:
            share - paid,
        };
      });
    });


  // ==========================================================
  // EDITING ROOM RENT / ELECTRICITY
  // ==========================================================

  readonly editingRoomRent =
    signal(false);

  readonly roomRentDraft =
    signal('');

  readonly editingElectricity =
    signal(false);

  readonly electricityDraft =
    signal('');


  monthLabel(key: string): string {
    return formatMonthLabel(key);
  }


  selectMonth(key: string): void {
    this.selectedMonth.set(key);

    this.editingRoomRent.set(false);
    this.editingElectricity.set(false);
  }


  startEditRoomRent(): void {
    const current =
      this.summary().roomRent;

    this.roomRentDraft.set(
      current
        ? String(current)
        : ''
    );

    this.editingRoomRent.set(true);
  }


  async saveRoomRent(): Promise<void> {
    const value =
      Number(
        this.roomRentDraft()
      );

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      this.snackBar.open(
        'Enter a valid amount.',
        'OK',
        {
          duration: 2500,
        }
      );

      return;
    }

    await this.summaryService.setRoomRent(
      this.selectedMonth(),
      value
    );

    this.editingRoomRent.set(false);
  }


  startEditElectricity(): void {
    const current =
      this.summary().electricityBill;

    this.electricityDraft.set(
      current
        ? String(current)
        : ''
    );

    this.editingElectricity.set(true);
  }


  async saveElectricity(): Promise<void> {
    const value =
      Number(
        this.electricityDraft()
      );

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      this.snackBar.open(
        'Enter a valid amount.',
        'OK',
        {
          duration: 2500,
        }
      );

      return;
    }

    await this.summaryService.setElectricityBill(
      this.selectedMonth(),
      value
    );

    this.editingElectricity.set(false);
  }


  async deleteElectricityBill(): Promise<void> {
    const current =
      this.summary().electricityBill;

    if (!current) {
      return;
    }

    const confirmed =
      confirm(
        `Delete the electricity bill of ₹${current.toFixed(
          2
        )} for ${this.monthLabel(
          this.selectedMonth()
        )}? This can't be undone.`
      );

    if (!confirmed) {
      return;
    }

    const monthKey =
      this.selectedMonth();

    // 1. Clear the electricity bill itself
    await this.summaryService.clearElectricityBill(
      monthKey
    );

    // 2. IMPORTANT:
    // Clear all old settlement/payment records
    // for this month.
    await this.paymentService.resetMonth(
      monthKey
    );

    // 3. Reset local edit state
    this.electricityDraft.set('');
    this.editingElectricity.set(false);

    // 4. Inform the user
    this.snackBar.open(
      'Electricity bill deleted and settlement reset.',
      undefined,
      {
        duration: 2200,
      }
    );
  }


  async toggleSettlementCompleted(): Promise<void> {
    await this.summaryService.toggleSettlementCompleted(
      this.selectedMonth(),
      !this.summary().settlementCompleted
    );
  }


  // ==========================================================
  // SHARE TARGET (Android "Share to Nestly" from Gallery/Photos)
  // ==========================================================

  /**
   * public/share-target-sw.js redirects here (`/expenses?shared=1`) after
   * stashing a shared image in IndexedDB. The `shared=1` param is just a
   * hint — the actual check (pull the pending image out of IndexedDB, if
   * any) always runs when this page loads, because the `authGuard` redirect
   * to /login on a cold, logged-out start does not preserve query params.
   * PendingSharedImageService.takePendingImage() is cheap and safe to call
   * unconditionally: it resolves to null (and does nothing further here)
   * whenever there's nothing pending, or it's missing/invalid/stale, so a
   * normal visit to Expenses is unaffected.
   */
  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('shared') === '1') {
        // Strip the param immediately (replaceUrl, no history entry) so a
        // page refresh can't re-trigger anything from a stale URL.
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });

    this.handleSharedImageIntent();
  }

  private async handleSharedImageIntent(): Promise<void> {
    const file = await this.pendingSharedImage.takePendingImage();

    // Nothing usable was actually shared (missing/invalid/stale) — do
    // nothing further; the app has just opened normally.
    if (!file) {
      return;
    }

    // Members may still be loading when a cold app-start lands here; wait
    // for the same data openAddExpense() itself depends on.
    await this.memberService.whenLoaded();

    this.openAddExpense(file);
  }

  // ==========================================================
  // ADD EXPENSE
  // ==========================================================

  openAddExpense(initialFile?: File): void {
    if (
      !this.memberService.members().length
    ) {
      this.snackBar.open(
        'Add roommates in Settings first.',
        'OK',
        {
          duration: 3000,
        }
      );

      return;
    }

    const data: ExpenseDialogData = {
      members:
        this.memberService.members(),

      monthKey:
        this.selectedMonth(),

      initialFile,
    };

    const ref =
      this.dialog.open(
        ExpenseDialog,
        {
          data,
          width: '480px',
          maxWidth: '95vw',
          autoFocus: false,
        }
      );

    ref.afterClosed().subscribe(
      async (
        result:
          | ExpenseDialogResult
          | undefined
      ) => {

        if (!result) {
          return;
        }

        await this.expenseService.addExpense(
          result
        );

        this.snackBar.open(
          'Expense added.',
          undefined,
          {
            duration: 1800,
            panelClass:
              'rm-snack-success',
          }
        );
      }
    );
  }


  // ==========================================================
  // EXPENSE PERMISSIONS
  // ==========================================================

  /**
   * Owner/admin permission check, reused for
   * both Edit and Delete.
   */
  canManageExpense(
    expense: Expense
  ): boolean {
    return (
      this.memberService.isAdmin() ||
      this.memberService.currentMember()
        ?.id === expense.paidByMemberId
    );
  }


  // ==========================================================
  // EDIT EXPENSE
  // ==========================================================

  openEditExpense(
    expense: Expense
  ): void {

    if (
      !this.canManageExpense(expense)
    ) {
      this.snackBar.open(
        'You can only edit your own expenses.',
        'OK',
        {
          duration: 2500,
        }
      );

      return;
    }

    const data: ExpenseDialogData = {
      members:
        this.memberService.members(),

      monthKey:
        expense.monthKey,

      expense,
    };

    const ref =
      this.dialog.open(
        ExpenseDialog,
        {
          data,
          width: '480px',
          maxWidth: '95vw',
          autoFocus: false,
        }
      );

    ref.afterClosed().subscribe(
      async (
        result:
          | ExpenseDialogResult
          | undefined
      ) => {

        if (!result) {
          return;
        }

        await this.expenseService.updateExpense(
          expense.id,
          result
        );

        this.snackBar.open(
          'Expense updated.',
          undefined,
          {
            duration: 1800,
            panelClass:
              'rm-snack-success',
          }
        );
      }
    );
  }


  // ==========================================================
  // DELETE EXPENSE
  // ==========================================================

  async deleteExpense(
    expense: Expense
  ): Promise<void> {

    if (
      !this.canManageExpense(expense)
    ) {
      this.snackBar.open(
        'You can only delete your own expenses.',
        'OK',
        {
          duration: 2500,
        }
      );

      return;
    }

    const confirmed =
      confirm(
        `Delete "${expense.title}" (₹${expense.amount})? This can't be undone.`
      );

    if (!confirmed) {
      return;
    }

    await this.expenseService.deleteExpense(
      expense
    );

    this.snackBar.open(
      'Expense deleted.',
      undefined,
      {
        duration: 1800,
      }
    );
  }


  // ==========================================================
  // IMAGE
  // ==========================================================

  viewImage(
    url: string
  ): void {

    this.dialog.open(
      ImagePreviewDialog,
      {
        data: {
          url,
        },

        panelClass:
          'rm-image-dialog-panel',

        maxWidth:
          '100vw',
      }
    );
  }


  // ==========================================================
  // MEMBER / DATE HELPERS
  // ==========================================================

  memberName(
    id: string
  ): string {
    return (
      this.memberService
        .members()
        .find(
          (m) => m.id === id
        )?.name ??
      'Unknown'
    );
  }


  formatDate(
    dateKey: string
  ): string {

    const [
      y,
      m,
      d,
    ] =
      dateKey
        .split('-')
        .map(Number);

    return new Date(
      y,
      m - 1,
      d
    ).toLocaleDateString(
      'en-US',
      {
        day: 'numeric',
        month: 'short',
      }
    );
  }


  // ==========================================================
  // UPI SETTLEMENT
  // ==========================================================

  paymentStatusFor(
    memberId: string
  ): PaymentStatus {
    return this.paymentService.statusFor(
      this.selectedMonth(),
      memberId
    );
  }


  /** True for the current user's own settlement card. */
  isSelf(
    memberId: string
  ): boolean {
    return (
      this.memberService.currentMember()
        ?.id === memberId
    );
  }


  /**
   * True only for the approver's own settlement card.
   */
  isApproverSelf(
    memberId: string
  ): boolean {
    return (
      this.isSelf(memberId) &&
      this.memberService.isPaymentApprover()
    );
  }


  /**
   * Only the assigned approver sees
   * "Confirm Received".
   */
  canConfirm(
    memberId: string
  ): boolean {
    return this.memberService
      .isPaymentApprover();
  }


  /**
   * True when the "Send Reminder" button should be shown at all: the current
   * viewer is the payment approver, AND this card belongs to someone else who
   * still owes money (the approver's own card is "Settle My Share" instead —
   * see isApproverSelf() — and a member always sees their own "Pay via
   * UPI"/"I've Paid" buttons on their own card).
   *
   * Whether the button is enabled or disabled (6-hour cooldown) is a separate
   * question — see reminderDisabled().
   */
canSendReminder(
  memberId: string
): boolean {
  return (
    (this.memberService.isPaymentApprover() || this.memberService.isAdmin()) &&
    !this.isSelf(memberId)
  );
}


  /**
   * True while the reminder button for this member should be disabled — a
   * reminder was already sent within the last 6 hours. Becomes false again
   * (button re-enables) once the cooldown elapses.
   */
  reminderDisabled(
    memberId: string
  ): boolean {
    return this.paymentService.reminderOnCooldown(
      this.selectedMonth(),
      memberId
    );
  }


  // ==========================================================
  // PAY VIA UPI
  // ==========================================================

  /**
   * Opens UPI payment.
   *
   * PRIMARY FLOW (both Android and iOS): show UpiQrPaymentDialog — a
   * scannable QR code plus one-tap "copy UPI ID". This matches exactly
   * what PhonePe's own decline message tells users to do instead of a
   * browser-initiated `upi://pay` deep link ("please try using a mobile
   * number, UPI ID, or QR code"), and sidesteps their fraud check on
   * generic web-invoked payment links entirely.
   *
   * The dialog itself still offers "Open UPI App Instead" as a secondary
   * path (Android generic link / iOS app picker), for UPI apps that don't
   * impose this restriction.
   */
  payViaUpi(
    s: MemberSettlement
  ): void {

    const approver =
      this.memberService.paymentApprover();

    if (!approver?.upiId) {
      this.snackBar.open(
        'The payment approver hasn’t set a UPI ID yet.',
        'OK',
        {
          duration: 3500,
        }
      );

      return;
    }

    const note =
      `Nestly Settlement - ${this.monthLabel(
        this.selectedMonth()
      )}`;

    const link =
      this.paymentService.buildUpiLink(
        approver.upiId,
        approver.name,
        s.remaining,
        note
      );

    this.dialog.open(UpiQrPaymentDialog, {
      data: {
        link,
        upiId: approver.upiId,
        payeeName: approver.name,
        amount: s.remaining,
        note,
        isIOS: this.isIOS(),
      } as UpiQrPaymentDialogData,
      width: '360px',
      maxWidth: '92vw',
      autoFocus: false,
    });
  }


  // ==========================================================
  // iOS DETECTION
  // ==========================================================

  private isIOS(): boolean {

    /*
     * Normal iPhone / iPad / iPod detection.
     */
    const iosDevice =
      /iPad|iPhone|iPod/.test(
        navigator.userAgent
      );

    /*
     * Newer iPads can identify themselves
     * as Macintosh, so detect touch-enabled
     * MacIntel devices too.
     */
    const iPadOS =
      navigator.platform ===
      'MacIntel' &&
      navigator.maxTouchPoints > 1;

    return (
      iosDevice ||
      iPadOS
    );
  }


  // ==========================================================
  // MARK PAID
  // ==========================================================

  async markPaid(
    s: MemberSettlement
  ): Promise<void> {

    await this.paymentService.markPaid(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(
        this.selectedMonth()
      )
    );

    this.snackBar.open(
      'Marked as paid — waiting for confirmation.',
      undefined,
      {
        duration: 2200,
      }
    );
  }


  // ==========================================================
  // CONFIRM RECEIVED
  // ==========================================================

  async confirmReceived(
    s: MemberSettlement
  ): Promise<void> {

    await this.paymentService.confirmReceived(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(
        this.selectedMonth()
      )
    );

    this.snackBar.open(
      `${s.memberName}'s payment marked as settled.`,
      undefined,
      {
        duration: 2200,

        panelClass:
          'rm-snack-success',
      }
    );
  }


  // ==========================================================
  // SEND REMINDER (approver -> one member who still owes)
  // ==========================================================

  async sendReminder(
    s: MemberSettlement
  ): Promise<void> {

    if (this.reminderDisabled(s.memberId)) {
      // Guards against a stray click landing between the button visually
      // disabling and this handler running (e.g. a queued double-tap).
      return;
    }

    try {
      await this.paymentService.sendReminder(
        this.selectedMonth(),
        s.memberId,
        s.memberName,
        s.remaining,
        this.monthLabel(
          this.selectedMonth()
        )
      );

      this.snackBar.open(
        `Reminder sent to ${s.memberName}.`,
        undefined,
        {
          duration: 2200,
        }
      );
    } catch (err) {
      console.error('sendReminder failed', err);

      this.snackBar.open(
        'Could not send the reminder — please try again.',
        'OK',
        {
          duration: 3000,
        }
      );
    }
  }


  // ==========================================================
  // APPROVER SETTLES OWN SHARE
  // ==========================================================

  /**
   * Approver settling their own share directly.
   *
   * Since the approver is the payee, routing this through
   * a UPI deep link or pending-confirmation step is pointless.
   */
  async settleOwnShare(
    s: MemberSettlement
  ): Promise<void> {

    await this.paymentService.confirmReceived(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(
        this.selectedMonth()
      )
    );

    this.snackBar.open(
      'Your share marked as settled.',
      undefined,
      {
        duration: 2200,

        panelClass:
          'rm-snack-success',
      }
    );
  }
}