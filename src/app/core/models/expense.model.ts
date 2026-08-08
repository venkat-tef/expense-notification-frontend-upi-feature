export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Vegetables',
  'Gas',
  'Water Can',
  'Internet',
  'Cleaning',
  'Others',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Groceries: 'local_grocery_store',
  Vegetables: 'eco',
  Gas: 'propane_tank',
  'Water Can': 'water_drop',
  Internet: 'wifi',
  Cleaning: 'cleaning_services',
  Others: 'category',
};

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidByMemberId: string;
  /** YYYY-MM-DD */
  expenseDate: string;
  /** YYYY-MM — derived from expenseDate, used to group expenses by month. */
  monthKey: string;
  notes?: string;
  billImageUrl?: string;
  /** Firebase Storage path (not the download URL) — needed to delete the file later. */
  billImagePath?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * One document per month (id = monthKey, "YYYY-MM"). Holds the two costs that
 * aren't per-expense records: room rent and the electricity bill. The electricity
 * bill is entered later (it arrives the following month) but is still attributed
 * to this month — `electricityBillSet` distinguishes "not entered yet" from "₹0".
 */
export interface MonthlySummary {
  monthKey: string;
  roomRent: number;
  electricityBill: number;
  electricityBillSet: boolean;
  settlementCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Derived per-member settlement for a given month — never stored, always computed. */
export interface MemberSettlement {
  memberId: string;
  memberName: string;
  paid: number;
  share: number;
  /** share - paid. Positive = still owes; negative = overpaid (should receive); ~0 = settled. */
  remaining: number;
}

/**
 * UPI Settlement feature.
 * - 'pending': nothing recorded yet — the implicit default for any member who owes money
 *   and has no settlement_payments doc for this month (see SettlementPaymentService.statusFor).
 * - 'payment_pending_confirmation': member tapped "I've Paid"; waiting on the payment approver.
 * - 'settled': the payment approver tapped "Confirm Received".
 */
export type PaymentStatus = 'pending' | 'payment_pending_confirmation' | 'settled';

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending',
  payment_pending_confirmation: 'Payment Pending Confirmation',
  settled: 'Settled',
};

/**
 * One doc per (monthKey, memberId) who owes money — tracks their UPI payment lifecycle.
 * Doc id = `${monthKey}_${memberId}`. Never created for members who are owed money (remaining < 0);
 * those still just wait to receive funds, tracked the same way settlement always has been.
 */
export interface SettlementPayment {
  id: string;
  monthKey: string;
  memberId: string;
  memberName: string;
  /** Snapshot of what was owed at the time of the last status change. */
  amount: number;
  status: PaymentStatus;
  markedPaidAt?: number;
  confirmedAt?: number;
  /** uid of whoever confirmed — should always be the payment approver. */
  confirmedByUid?: string;
  createdAt: number;
  updatedAt: number;
}
