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

    // ROOT-CAUSE FIX — this used to delete the notifyOnce() "already notified" marker
    // doc (`settlement_ready_${monthKey}_${memberId}`) so a later re-add could notify
    // again. That marker WAS the "Power bill added" notification's only Firestore
    // record, so deleting it silently erased that notification from history — with
    // no "Power bill deleted" notification ever created to replace it. Net effect:
    // ADD -> DELETE -> ADD left only the newest ADD visible, exactly the bug reported.
    //
    // Now every lifecycle event (added / deleted / added again) is its own permanent,
    // addDoc()-backed record via notifyMember() — nothing here deletes history, and
    // this explicitly records the deletion as its own event.
    const enteredByMemberId = this.memberService.currentMember()?.id;
    const monthLabel = formatMonthLabel(monthKey);

    const results = await Promise.allSettled(
      this.memberService
        .members()
        .filter((m) => m.id !== enteredByMemberId) // never notify the person who cleared the bill
        .map((m) =>
          this.notifications.notifyMember(
            'settlement_ready',
            '⚡ Power Bill Removed',
            `Power bill for ${monthLabel} was removed.`,
            '/expenses',
            m.uid ?? m.id
          )
        )
    );
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.error('clearElectricityBill: failed to send a removal notification for a member', r.reason);
      }
    });
  }

  async toggleSettlementCompleted(monthKey: string, completed: boolean): Promise<void> {
    await this.upsert(monthKey, { settlementCompleted: completed });
  }

  /**
   * Fans out one individualized "Power bill added" notification per member (excluding
   * whoever just entered the bill), each with their own owed/owed-back amount for the
   * month so far. Type stays 'settlement_ready' — already wired end-to-end (bell + push,
   * via the existing Render announcementListener.js) and no model/backend change is
   * needed to reuse it here.
   *
   * ROOT-CAUSE FIX — this used to call notifyOnce() with a fixed ID
   * (`settlement_ready_${monthKey}_${memberId}`) that depended only on the month and
   * member, never on the specific event. notifyOnce() skips writing entirely if a doc
   * with that ID already exists, so a genuinely new "bill added again" event for the
   * same month silently produced NOTHING once the first notification for that month
   * existed — and, combined with clearElectricityBill() deleting that same marker doc,
   * meant only the single latest ADD was ever visible. Now uses notifyMember(), which
   * always addDoc()s a brand-new history record — every add is its own permanent event.
   *
   * Each member's notifyMember() is individually try/caught. A failure for any ONE
   * member (a network blip, a bad uid, anything) no longer aborts the loop — everyone
   * else still gets notified.
   */
  private async notifyPowerBillAdded(monthKey: string, electricityBill: number): Promise<void> {
    // const members = this.memberService.members();
      const members = this.memberService.members().filter((m) => m.role !== 'guest');
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

          return this.notifications.notifyMember(
            'settlement_ready',
            '⚡ Power Bill Added',
            body,
            '/expenses',
            uid
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