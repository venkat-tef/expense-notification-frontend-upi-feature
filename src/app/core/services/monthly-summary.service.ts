import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { MonthlySummary } from '../models/expense.model';
import { MemberService } from './member.service';
import { ExpenseService } from './expense.service';
import { NotificationService } from './notification.service';

const COLLECTION = 'monthly_summary';

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);

  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

@Injectable({ providedIn: 'root' })
export class MonthlySummaryService {
  readonly summaries = signal<MonthlySummary[]>([]);
  readonly loaded = signal(false);

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

  private async upsert(
    monthKey: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const exists = !!this.forMonth(monthKey);

    const data: Record<string, unknown> = {
      ...patch,
      updatedAt: serverTimestamp(),
    };

    if (!exists) {
      data['createdAt'] = serverTimestamp();
    }

    await setDoc(
      doc(firestoreDb, COLLECTION, monthKey),
      data,
      { merge: true }
    );
  }

  async setRoomRent(monthKey: string, amount: number): Promise<void> {
    await this.upsert(monthKey, {
      roomRent: amount,
    });
  }

  /**
   * Electricity bills arrive the following month but still belong to monthKey.
   *
   * The notification must only be generated after:
   * 1. The bill has successfully been saved.
   * 2. MemberService has finished loading the members.
   *
   * This prevents the notification from being silently skipped when the
   * members snapshot has not arrived yet.
   */
  async setElectricityBill(
    monthKey: string,
    amount: number
  ): Promise<void> {
    await this.upsert(monthKey, {
      electricityBill: amount,
      electricityBillSet: true,
    });

    try {
      await this.notifyPowerBillAdded(monthKey, amount);
    } catch (err) {
      console.error(
        'notifyPowerBillAdded failed:',
        err
      );
    }
  }

  async clearElectricityBill(monthKey: string): Promise<void> {
    await this.upsert(monthKey, {
      electricityBill: 0,
      electricityBillSet: false,
    });

    /*
     * Do NOT delete any previous notification document here.
     *
     * Every add/remove event should remain an independent notification.
     */

    try {
      // Make sure members are available before creating removal notifications.
      await this.memberService.whenLoaded();

      const enteredByMemberId =
        this.memberService.currentMember()?.id;

      const monthLabel = formatMonthLabel(monthKey);

      const members = this.memberService
        .members()
        .filter((m) => m.role !== 'guest')
        .filter((m) => m.id !== enteredByMemberId);

      if (!members.length) {
        console.warn(
          'clearElectricityBill: no eligible members found'
        );
        return;
      }

      const results = await Promise.allSettled(
        members.map((m) =>
          this.notifications.notifyMember(
            'settlement_ready',
            '⚡ Power Bill Removed',
            `Power bill for ${monthLabel} was removed.`,
            '/expenses',
            m.uid ?? m.id
          )
        )
      );

      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(
            'clearElectricityBill: failed to send removal notification:',
            result.reason
          );
        }
      });
    } catch (err) {
      console.error(
        'clearElectricityBill notification failed:',
        err
      );
    }
  }

  async toggleSettlementCompleted(
    monthKey: string,
    completed: boolean
  ): Promise<void> {
    await this.upsert(monthKey, {
      settlementCompleted: completed,
    });
  }

  /**
   * Creates one notification for every eligible member.
   *
   * Important:
   * - Wait for MemberService to load.
   * - Do not use notifyOnce().
   * - notifyMember() creates a new Firestore notification document
   *   for every Power Bill event.
   * - One failed member must not prevent other members from receiving
   *   their notification.
   */
  private async notifyPowerBillAdded(
    monthKey: string,
    electricityBill: number
  ): Promise<void> {
    /*
     * IMPORTANT FIX:
     *
     * MemberService can still be loading when the electricity bill is
     * saved. Previously members() could temporarily return [] and the
     * function would simply return without creating any notification.
     *
     * Wait until the member snapshot has completed.
     */
    await this.memberService.whenLoaded();

    const members = this.memberService
      .members()
      .filter((m) => m.role !== 'guest');

    if (!members.length) {
      console.warn(
        'notifyPowerBillAdded: no eligible members found'
      );
      return;
    }

    const roomRent =
      this.forMonth(monthKey)?.roomRent ?? 0;

    const monthExpenses =
      this.expenseService.forMonth(monthKey);

    const otherExpensesTotal =
      monthExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );

    const grandTotal =
      roomRent +
      electricityBill +
      otherExpensesTotal;

    const share =
      grandTotal / members.length;

    /*
     * Calculate how much each member has already paid.
     */
    const paidMap = new Map<string, number>();

    for (const expense of monthExpenses) {
      const currentPaid =
        paidMap.get(expense.paidByMemberId) ?? 0;

      paidMap.set(
        expense.paidByMemberId,
        currentPaid + expense.amount
      );
    }

    /*
     * Do not notify the member who entered the electricity bill.
     */
    const enteredByMemberId =
      this.memberService.currentMember()?.id;

    const monthLabel =
      formatMonthLabel(monthKey);

    const recipients = members.filter(
      (member) =>
        member.id !== enteredByMemberId
    );

    if (!recipients.length) {
      console.log(
        'notifyPowerBillAdded: no recipients after excluding current member'
      );
      return;
    }

    /*
     * Create all notification documents independently.
     *
     * Promise.allSettled() means:
     * - Member A failure does not stop Member B.
     * - Member B failure does not stop Member C.
     */
    const results = await Promise.allSettled(
      recipients.map(async (member) => {
        const uid =
          member.uid ?? member.id;

        const paid =
          paidMap.get(member.id) ?? 0;

        const remaining =
          share - paid;

        const body =
          remaining < -0.5
            ? `Power bill added for ${monthLabel}. You'll get ₹${Math.abs(
                remaining
              ).toFixed(2)} back.`
            : `Power bill added. You have to pay ₹${remaining.toFixed(
                2
              )}.`;

        await this.notifications.notifyMember(
          'settlement_ready',
          '⚡ Power Bill Added',
          body,
          '/expenses',
          uid
        );
      })
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `notifyPowerBillAdded: failed for recipient ${recipients[index]?.id}:`,
          result.reason
        );
      }
    });
  }
}