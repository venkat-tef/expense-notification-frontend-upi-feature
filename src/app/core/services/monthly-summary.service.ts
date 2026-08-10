import { Injectable, inject, signal } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc } from 'firebase/firestore';
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

  // NEW — needed only for the Settlement Ready / Power Bill notification fan-out below.
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
    await this.upsert(monthKey, {
      electricityBill: amount,
      electricityBillSet: true,
    });

    // FIX — deliberately NOT awaited. The notification fan-out is a side effect of
    // saving the bill, not part of the save itself: the UI (saveElectricity() in
    // expenses.ts) closes the input the instant upsert() above resolves, exactly like
    // before this fan-out existed. Any failure inside notifyPowerBillAdded() is caught
    // and logged there — it can never reject back to this method or its caller.
    this.notifyPowerBillAdded(monthKey, amount).catch((err) =>
      console.error('notifyPowerBillAdded failed', err)
    );
  }

  async clearElectricityBill(monthKey: string): Promise<void> {
    await this.upsert(monthKey, {
      electricityBill: 0,
      electricityBillSet: false,
    });

    // FIX — notifyOnce() dedupes on a fixed ID (`settlement_ready_${monthKey}_${memberId}`)
    // that only ever depends on the month and member, never on which specific bill or
    // amount triggered it. Deleting the bill reset the settlement payment records, but
    // left these "already notified" marker docs behind — so re-adding a bill for the
    // SAME month kept silently finding them and skipping every notification, forever,
    // for that month. Deleting the markers here means the next setElectricityBill() call
    // for this month starts clean and actually notifies again with the new amount.
    // deleteDoc() on a doc that doesn't exist is a no-op, not an error — safe to call
    // unconditionally for every current member, no existence check needed.
    const results = await Promise.allSettled(
      this.memberService
        .members()
        .map((m) => deleteDoc(doc(firestoreDb, 'notifications', `settlement_ready_${monthKey}_${m.id}`)))
    );
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.error('clearElectricityBill: failed to clear a notification marker', r.reason);
      }
    });
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
   *
   * FIX — each member's notifyOnce() is now individually try/caught. Previously, a
   * failure for ANY one member (a network blip, a bad uid, anything) aborted the
   * `for` loop entirely — every member after that point in iteration order silently
   * never got notified, with no error surfaced anywhere the user could see. Now one
   * member's failure is logged and skipped; everyone else still gets notified.
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

    // FIX — parallelized. Was a sequential `for...await` loop: each member's
    // notifyOnce() (a getDoc() + setDoc() pair) had to fully finish before the next
    // member's even started, so the Nth recipient waited on N-1 other round trips
    // first — exactly why this felt slow next to notify()'s (expense-added) already-
    // parallel Promise.all() below. Promise.allSettled() fires every member's call at
    // once and, same as before, never lets one member's failure affect anyone else's —
    // it just resolves/rejects independently per member instead of in series.
    const results = await Promise.allSettled(
      members
        .filter((m) => m.id !== enteredByMemberId) // never notify the person who entered the bill
        .map((m) => {
          const uid = m.uid ?? m.id;
          const paid = paidMap.get(m.id) ?? 0;
          const remaining = share - paid;
          const body =
            remaining < -0.5
              ? `Power bill added for ${monthLabel}. You'll get ₹${Math.abs(remaining).toFixed(2)} back.`
              : `Power bill added. You have to pay ₹${remaining.toFixed(2)}.`;

          return this.notifications.notifyOnce(
            `settlement_ready_${monthKey}_${m.id}`,
            uid,
            'settlement_ready',
            '⚡ Power Bill Added',
            body,
            '/expenses'
          );
        })
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error('notifyPowerBillAdded: failed for a member', r.reason);
      }
    });
  }
}