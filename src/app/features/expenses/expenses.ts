import {
  Component,
  computed,
  inject,
  signal,
  Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
 * This dialog is ONLY used on iPhone/iPad.
 *
 * Android keeps the existing generic `upi://pay` flow.
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
export class Expenses {

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
  // ADD EXPENSE
  // ==========================================================

  openAddExpense(): void {
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


  // ==========================================================
  // PAY VIA UPI
  // ==========================================================

  /**
   * Opens UPI payment.
   *
   * IMPORTANT:
   *
   * Android:
   *   Existing generic `upi://pay` behavior is preserved.
   *
   * iOS:
   *   We show our own UPI app picker first.
   *
   * No other expense/settlement logic is changed.
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

    /*
     * IMPORTANT:
     *
     * This is the EXACT same generic UPI link
     * your application was already creating.
     *
     * We do not modify the amount.
     * We do not modify the UPI ID.
     * We do not modify the note.
     */
    const link =
      this.paymentService.buildUpiLink(
        approver.upiId,
        approver.name,
        s.remaining,
        note
      );


    // --------------------------------------------------------
    // ANDROID / NON-iOS
    // --------------------------------------------------------

    if (!this.isIOS()) {
      /*
       * EXISTING BEHAVIOR.
       *
       * Do not change Android.
       */
      window.location.href = link;

      return;
    }


    // --------------------------------------------------------
    // iOS
    // --------------------------------------------------------

    /*
     * iOS does not reliably give the Android-style
     * chooser for a generic upi://pay URL.
     *
     * Therefore show our own chooser.
     */
    const dialogRef =
      this.dialog.open(
        UpiAppPickerDialog,
        {
          width: '340px',
          maxWidth: '90vw',

          autoFocus: false,
        }
      );


    dialogRef.afterClosed().subscribe(
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

        const appLink =
          this.buildIOSUpiLink(
            link,
            selectedApp
          );

        /*
         * Open only the selected UPI app.
         *
         * The generic upi://pay link is NOT opened
         * on iOS, so it cannot fall through to WhatsApp.
         */
        window.location.href =
          appLink;
      }
    );
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
  // BUILD APP-SPECIFIC iOS UPI LINK
  // ==========================================================

  private buildIOSUpiLink(
    genericLink: string,
    app:
      | 'gpay'
      | 'phonepe'
      | 'paytm'
      | 'bhim'
      | 'cred'
  ): string {

    /*
     * The payment parameters were already generated
     * by SettlementPaymentService.
     *
     * Example:
     *
     * upi://pay?pa=xxx&pn=xxx&am=100&cu=INR&tn=xxx
     *
     * We only replace the scheme.
     */
    const query =
      genericLink.replace(
        /^upi:\/\/pay\?/,
        ''
      );


    switch (app) {

      case 'gpay':
        return `gpay://upi/pay?${query}`;


      case 'phonepe':
        return `phonepe://pay?${query}`;


      case 'paytm':
        return `paytmmp://pay?${query}`;


      case 'bhim':
        return `bhim://pay?${query}`;

      case 'cred':
        return `cred://pay?${query}`;


      default:
        /*
         * Safety fallback.
         *
         * This should never be reached because
         * the picker only returns known values.
         */
        return genericLink;
    }
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