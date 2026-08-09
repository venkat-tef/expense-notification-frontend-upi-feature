import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MemberService } from '../../core/services/member.service';
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlySummaryService } from '../../core/services/monthly-summary.service';
import { SettlementPaymentService } from '../../core/services/settlement-payment.service';
import { Expense, EXPENSE_CATEGORY_ICONS, MemberSettlement, PaymentStatus } from '../../core/models/expense.model';
import { ExpenseDialog, ExpenseDialogData, ExpenseDialogResult } from './expense-dialog/expense-dialog';
import { ImagePreviewDialog } from './image-preview-dialog/image-preview-dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatMenuModule],
  templateUrl: './expenses.html',
  styleUrl: './expenses.scss',
})
export class Expenses {
  readonly memberService = inject(MemberService);
  readonly expenseService = inject(ExpenseService);
  readonly summaryService = inject(MonthlySummaryService);
  readonly paymentService = inject(SettlementPaymentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly categoryIcons = EXPENSE_CATEGORY_ICONS;
  readonly selectedMonth = signal(currentMonthKey());
  readonly selectedMemberFilter = signal('');

  /** Current month always shows up even with no data yet, plus every month that has data. */
  readonly monthOptions = computed(() => {
    const set = new Set<string>([currentMonthKey(), this.selectedMonth()]);
    for (const e of this.expenseService.expenses()) set.add(e.monthKey);
    for (const s of this.summaryService.summaries()) set.add(s.monthKey);
    return Array.from(set).sort().reverse();
  });

  readonly summary = computed(
    () => this.summaryService.forMonth(this.selectedMonth()) ?? this.summaryService.emptyFor(this.selectedMonth())
  );

  readonly monthExpenses = computed(() => {
    const expenses = this.expenseService.forMonth(this.selectedMonth());
    const memberId = this.selectedMemberFilter();

    if (!memberId) {
      return expenses;
    }

    return expenses.filter(e => e.paidByMemberId === memberId);
  });

  readonly otherExpensesTotal = computed(() => this.monthExpenses().reduce((sum, e) => sum + e.amount, 0));

  readonly grandTotal = computed(() => {
    const s = this.summary();
    return s.roomRent + s.electricityBill + this.otherExpensesTotal();
  });

  readonly settlement = computed<MemberSettlement[]>(() => {
    const members = this.memberService
      .members()
      .filter(m => m.role !== 'guest');
    if (!members.length) return [];
    const share = this.grandTotal() / members.length;
    const paidMap = new Map<string, number>();
    for (const e of this.monthExpenses()) {
      paidMap.set(e.paidByMemberId, (paidMap.get(e.paidByMemberId) ?? 0) + e.amount);
    }
    return members.map((m) => {
      const paid = paidMap.get(m.id) ?? 0;
      return { memberId: m.id, memberName: m.name, paid, share, remaining: share - paid };
    });
  });

  // Inline editing state for Room Rent / Electricity Bill on the summary card.
  readonly editingRoomRent = signal(false);
  readonly roomRentDraft = signal('');
  readonly editingElectricity = signal(false);
  readonly electricityDraft = signal('');

  monthLabel(key: string): string {
    return formatMonthLabel(key);
  }

  selectMonth(key: string): void {
    this.selectedMonth.set(key);
    this.editingRoomRent.set(false);
    this.editingElectricity.set(false);
  }

  startEditRoomRent(): void {
    const current = this.summary().roomRent;
    this.roomRentDraft.set(current ? String(current) : '');
    this.editingRoomRent.set(true);
  }

  async saveRoomRent(): Promise<void> {
    const value = Number(this.roomRentDraft());
    if (!Number.isFinite(value) || value < 0) {
      this.snackBar.open('Enter a valid amount.', 'OK', { duration: 2500 });
      return;
    }
    await this.summaryService.setRoomRent(this.selectedMonth(), value);
    this.editingRoomRent.set(false);
  }

  startEditElectricity(): void {
    const current = this.summary().electricityBill;
    this.electricityDraft.set(current ? String(current) : '');
    this.editingElectricity.set(true);
  }

  async saveElectricity(): Promise<void> {
    const value = Number(this.electricityDraft());
    if (!Number.isFinite(value) || value < 0) {
      this.snackBar.open('Enter a valid amount.', 'OK', { duration: 2500 });
      return;
    }
    await this.summaryService.setElectricityBill(this.selectedMonth(), value);
    this.editingElectricity.set(false);
  }

async deleteElectricityBill(): Promise<void> {
  const current = this.summary().electricityBill;

  if (!current) {
    return;
  }

  const confirmed = confirm(
    `Delete the electricity bill of ₹${current.toFixed(2)} for ${this.monthLabel(this.selectedMonth())}? This can't be undone.`
  );

  if (!confirmed) {
    return;
  }

  const monthKey = this.selectedMonth();

  // 1. Clear the electricity bill itself
  await this.summaryService.clearElectricityBill(monthKey);

  // 2. IMPORTANT:
  // Clear all old settlement/payment records for this month.
  // This makes the next electricity bill start with a fresh settlement.
  await this.paymentService.resetMonth(monthKey);

  // 3. Reset local edit state
  this.electricityDraft.set('');
  this.editingElectricity.set(false);

  // 4. Inform the user
  this.snackBar.open(
    'Electricity bill deleted and settlement reset.',
    undefined,
    { duration: 2200 }
  );
}

  async toggleSettlementCompleted(): Promise<void> {
    await this.summaryService.toggleSettlementCompleted(this.selectedMonth(), !this.summary().settlementCompleted);
  }

  openAddExpense(): void {
    if (!this.memberService.members().length) {
      this.snackBar.open('Add roommates in Settings first.', 'OK', { duration: 3000 });
      return;
    }
    const data: ExpenseDialogData = { members: this.memberService.members(), monthKey: this.selectedMonth() };
    const ref = this.dialog.open(ExpenseDialog, { data, width: '480px', maxWidth: '95vw', autoFocus: false });
    ref.afterClosed().subscribe(async (result: ExpenseDialogResult | undefined) => {
      if (!result) return;
      await this.expenseService.addExpense(result);
      this.snackBar.open('Expense added.', undefined, { duration: 1800, panelClass: 'rm-snack-success' });
    });
  }

  /**
   * Owner/admin permission check, reused for both Edit and Delete. Backed by
   * the same MemberService role/identity data used everywhere else in the
   * app (isAdmin / currentMember) — no second permission system.
   */
  canManageExpense(expense: Expense): boolean {
    return this.memberService.isAdmin() || this.memberService.currentMember()?.id === expense.paidByMemberId;
  }

  openEditExpense(expense: Expense): void {
    // Enforced here too, not just hidden in the template — refuses the action
    // itself in case this is ever reached without the button being visible
    // (e.g. a stale reference or a future template change).
    if (!this.canManageExpense(expense)) {
      this.snackBar.open('You can only edit your own expenses.', 'OK', { duration: 2500 });
      return;
    }

    const data: ExpenseDialogData = {
      members: this.memberService.members(),
      monthKey: expense.monthKey,
      expense,
    };
    const ref = this.dialog.open(ExpenseDialog, { data, width: '480px', maxWidth: '95vw', autoFocus: false });
    ref.afterClosed().subscribe(async (result: ExpenseDialogResult | undefined) => {
      if (!result) return;
      await this.expenseService.updateExpense(expense.id, result);
      this.snackBar.open('Expense updated.', undefined, { duration: 1800, panelClass: 'rm-snack-success' });
    });
  }

  async deleteExpense(expense: Expense): Promise<void> {
    if (!this.canManageExpense(expense)) {
      this.snackBar.open('You can only delete your own expenses.', 'OK', { duration: 2500 });
      return;
    }

    const confirmed = confirm(`Delete "${expense.title}" (₹${expense.amount})? This can't be undone.`);
    if (!confirmed) return;
    await this.expenseService.deleteExpense(expense);
    this.snackBar.open('Expense deleted.', undefined, { duration: 1800 });
  }

  viewImage(url: string): void {
    this.dialog.open(ImagePreviewDialog, {
      data: { url },
      panelClass: 'rm-image-dialog-panel',
      maxWidth: '100vw',
    });
  }

  memberName(id: string): string {
    return this.memberService.members().find((m) => m.id === id)?.name ?? 'Unknown';
  }

  formatDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  // --- UPI Settlement ---------------------------------------------------

  paymentStatusFor(memberId: string): PaymentStatus {
    return this.paymentService.statusFor(this.selectedMonth(), memberId);
  }

  /** True for the current user's own settlement card. */
  isSelf(memberId: string): boolean {
    return this.memberService.currentMember()?.id === memberId;
  }

  /**
   * True only for the approver's own settlement card. The approver never pays
   * themselves via UPI or waits on their own confirmation — they get a direct
   * "Settle My Share" action instead (see settleOwnShare).
   */
  isApproverSelf(memberId: string): boolean {
    return this.isSelf(memberId) && this.memberService.isPaymentApprover();
  }

  /**
   * Only the assigned approver sees "Confirm Received" — including on their
   * own card. There's no one else who could confirm the approver's own
   * payment, so excluding self here (the original bug) left it stuck in
   * "Payment Pending Confirmation" forever with nothing to click.
   */
  canConfirm(memberId: string): boolean {
    return this.memberService.isPaymentApprover();
  }

  payViaUpi(s: MemberSettlement): void {
    const approver = this.memberService.paymentApprover();
    if (!approver?.upiId) {
      this.snackBar.open('The payment approver hasn\u2019t set a UPI ID yet.', 'OK', { duration: 3500 });
      return;
    }
    const note = `Nestly Settlement - ${this.monthLabel(this.selectedMonth())}`;
    const link = this.paymentService.buildUpiLink(approver.upiId, approver.name, s.remaining, note);
    window.location.href = link;
  }

  async markPaid(s: MemberSettlement): Promise<void> {
    await this.paymentService.markPaid(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(this.selectedMonth())
    );
    this.snackBar.open('Marked as paid \u2014 waiting for confirmation.', undefined, { duration: 2200 });
  }

  async confirmReceived(s: MemberSettlement): Promise<void> {
    await this.paymentService.confirmReceived(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(this.selectedMonth())
    );
    this.snackBar.open(`${s.memberName}'s payment marked as settled.`, undefined, {
      duration: 2200,
      panelClass: 'rm-snack-success',
    });
  }

  /**
   * Approver settling their own share directly. Since the approver is the
   * payee, routing this through a UPI deep link or a pending-confirmation
   * step is pointless — they'd be paying themselves. This marks it settled
   * in one step, same underlying write as confirmReceived.
   */
  async settleOwnShare(s: MemberSettlement): Promise<void> {
    await this.paymentService.confirmReceived(
      this.selectedMonth(),
      s.memberId,
      s.memberName,
      s.remaining,
      this.monthLabel(this.selectedMonth())
    );
    this.snackBar.open('Your share marked as settled.', undefined, {
      duration: 2200,
      panelClass: 'rm-snack-success',
    });
  }
}