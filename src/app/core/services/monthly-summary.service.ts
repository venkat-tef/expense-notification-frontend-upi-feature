import { Injectable, inject, signal } from '@angular/core';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { MonthlySummary } from '../models/expense.model';
import { MemberService } from './member.service';        // NEW
import { ExpenseService } from './expense.service';        // NEW
import { NotificationService } from './notification.service'; // NEW

const COLLECTION = 'monthly_summary';

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

@Injectable({ providedIn: 'root' })
export class MonthlySummaryService {
  readonly summaries = signal<MonthlySummary[]>([]);
  readonly loaded = signal(false);

  // NEW — needed only for the Settlement Ready notification fan-out below.
  private readonly memberService = inject(MemberService);
  private readonly expenseService = inject(ExpenseService);
  private readonly notifications = inject(NotificationService);

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION));
    onSnapshot(
      q,
      (snap) => {
        const list: MonthlySummary[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            monthKey: d.id,
            roomRent: data['roomRent'] ?? 0,
            electricityBill: data['electricityBill'] ?? 0,
            electricityBillSet: data['electricityBillSet'] ?? false,
            settlementCompleted: data['settlementCompleted'] ?? false,
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
          };
        });
        this.summaries.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error('monthly_summary onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  forMonth(monthKey: string): MonthlySummary | undefined {
    return this.summaries().find((s) => s.monthKey === monthKey);
  }

  /** Fallback for a month that has no summary doc yet — nothing has been entered so far. */
  emptyFor(monthKey: string): MonthlySummary {
    return {
      monthKey,
      roomRent: 0,
      electricityBill: 0,
      electricityBillSet: false,
      settlementCompleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private async upsert(monthKey: string, patch: Record<string, unknown>): Promise<void> {
    const exists = !!this.forMonth(monthKey);
    const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
    if (!exists) data['createdAt'] = serverTimestamp();
    await setDoc(doc(firestoreDb, COLLECTION, monthKey), data, { merge: true });
  }

  async setRoomRent(monthKey: string, amount: number): Promise<void> {
    await this.upsert(monthKey, { roomRent: amount });
  }

  /**
   * Electricity bills arrive the following month but still belong to `monthKey`.
   * Setting this is what unblocks that month's settlement.
   */
  async setElectricityBill(monthKey: string, amount: number): Promise<void> {
    await this.upsert(monthKey, { electricityBill: amount, electricityBillSet: true });

    // Feature: Power Bill Added. Fires every time the bill is set for this month —
    // previously this was gated behind "only if room rent was already set," which
    // silently skipped the notification (and therefore the push) whenever the bill
    // was entered before room rent for that month. Removed: the person adding the
    // bill should always notify everyone else, regardless of ordering.
    await this.notifyPowerBillAdded(monthKey, amount);
  }

  async toggleSettlementCompleted(monthKey: string, completed: boolean): Promise<void> {
    await this.upsert(monthKey, { settlementCompleted: completed });
  }

  /**
   * Fans out one individualized "Power bill added" notification per member (excluding
   * whoever just entered the bill), each with their own owed/owed-back amount for the
   * month so far. Reuses NotificationService exactly as the rest of the app does —
   * notifyOnce() so re-editing the electricity bill later doesn't spam duplicate
   * notifications per member. Type stays 'settlement_ready' — already wired end-to-end
   * (bell + push, via the existing Render announcementListener.js) and no model/backend
   * change is needed to reuse it here.
   */
  private async notifyPowerBillAdded(monthKey: string, electricityBill: number): Promise<void> {
    const members = this.memberService.members();
    if (!members.length) return;

    const roomRent = this.forMonth(monthKey)?.roomRent ?? 0;
    const monthExpenses = this.expenseService.forMonth(monthKey);
    const otherExpensesTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grandTotal = roomRent + electricityBill + otherExpensesTotal;
    const share = grandTotal / members.length;

    const paidMap = new Map<string, number>();
    for (const e of monthExpenses) {
      paidMap.set(e.paidByMemberId, (paidMap.get(e.paidByMemberId) ?? 0) + e.amount);
    }

    const enteredByMemberId = this.memberService.currentMember()?.id;
    const monthLabel = formatMonthLabel(monthKey);

    for (const m of members) {
      if (m.id === enteredByMemberId) continue; // never notify the person who entered the bill
      const uid = m.uid ?? m.id;
      if (!uid) continue;

      const paid = paidMap.get(m.id) ?? 0;
      const remaining = share - paid;
      const body =
        remaining < -0.5
          ? `Power bill added for ${monthLabel}. You'll get ₹${Math.abs(remaining).toFixed(2)} back.`
          : `Power bill added. You have to pay ₹${remaining.toFixed(2)}.`;

      await this.notifications.notifyOnce(
        `settlement_ready_${monthKey}_${m.id}`,
        uid,
        'settlement_ready',
        '⚡ Power Bill Added',
        body,
        '/expenses'
      );
    }
  }
}