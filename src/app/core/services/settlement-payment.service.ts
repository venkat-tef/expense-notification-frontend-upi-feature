import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  getDocs,
  where,
  query as firestoreQuery,
} from 'firebase/firestore';

import { firestoreDb } from './firebase';
import { PaymentStatus, SettlementPayment } from '../models/expense.model';
import { NotificationService } from './notification.service';
import { MemberService } from './member.service';
import { AuthService } from './auth.service';

const COLLECTION = 'settlement_payments';

/**
 * Tracks the UPI payment lifecycle for members who owe money in a given month
 * (Pending -> Payment Pending Confirmation -> Settled).
 *
 * Members who are owed money never get a doc here — that side of settlement
 * is unchanged, computed-only, as before.
 *
 * A member with no doc for (monthKey, memberId) is implicitly 'pending'.
 */
@Injectable({ providedIn: 'root' })
export class SettlementPaymentService {
  private readonly notifications = inject(NotificationService);
  private readonly memberService = inject(MemberService);
  private readonly auth = inject(AuthService);

  readonly payments = signal<SettlementPayment[]>([]);
  readonly loaded = signal(false);

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION));

    onSnapshot(
      q,
      (snap) => {
        const list: SettlementPayment[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            id: d.id,
            monthKey: data['monthKey'],
            memberId: data['memberId'],
            memberName: data['memberName'],
            amount: data['amount'] ?? 0,
            status: (data['status'] ?? 'pending') as PaymentStatus,
            markedPaidAt: data['markedPaidAt']?.toMillis?.() ?? undefined,
            confirmedAt: data['confirmedAt']?.toMillis?.() ?? undefined,
            confirmedByUid: data['confirmedByUid'] ?? undefined,
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
          };
        });

        this.payments.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error('settlement_payments onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  private docId(monthKey: string, memberId: string): string {
    return `${monthKey}_${memberId}`;
  }

  forMonth(monthKey: string): SettlementPayment[] {
    return this.payments().filter((p) => p.monthKey === monthKey);
  }

  /**
   * The record for one member + month,
   * or undefined if they're still at the implicit 'pending' default.
   */
  recordFor(
    monthKey: string,
    memberId: string
  ): SettlementPayment | undefined {
    return this.payments().find(
      (p) => p.monthKey === monthKey && p.memberId === memberId
    );
  }

  statusFor(monthKey: string, memberId: string): PaymentStatus {
    return this.recordFor(monthKey, memberId)?.status ?? 'pending';
  }

  /**
   * IMPORTANT:
   *
   * Completely resets settlement payment state for a month.
   *
   * This is used when the electricity bill is deleted.
   *
   * Example:
   *
   * August:
   *   Venki -> settled
   *   Narendra -> payment_pending_confirmation
   *
   * Delete electricity bill
   *
   * Result:
   *   August has NO settlement payment records.
   *
   * Add electricity bill again
   *
   * Result:
   *   Everyone starts fresh as 'pending'.
   */
  async resetMonth(monthKey: string): Promise<void> {
    const paymentsForMonth = this.forMonth(monthKey);

    // If the local snapshot already has no records for this month,
    // there is nothing to delete.
    //
    // We still query Firestore below so this also works safely if the
    // local snapshot has not caught up yet.
    const q = firestoreQuery(
      collection(firestoreDb, COLLECTION),
      where('monthKey', '==', monthKey)
    );

    const snap = await getDocs(q);

    await Promise.all(
      snap.docs.map((paymentDoc) =>
        deleteDoc(doc(firestoreDb, COLLECTION, paymentDoc.id))
      )
    );

    // No manual signal update is necessary.
    // onSnapshot() will receive the deletions and update payments().
    //
    // This is intentionally a complete reset of the month's settlement
    // payment records — not merely a status change.
  }

  /**
   * Builds a standard UPI deep link (`upi://pay?...`).
   *
   * Opening it hands off to whichever UPI app the user has set as default
   * (PhonePe, GPay, Paytm, BHIM, etc.).
   */
  buildUpiLink(
    upiId: string,
    payeeName: string,
    amount: number,
    note: string
  ): string {
    const params = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: note,
    });

    return `upi://pay?${params.toString()}`;
  }

  /**
   * Member taps "I've Paid" after returning from their UPI app.
   */
  async markPaid(
    monthKey: string,
    memberId: string,
    memberName: string,
    amount: number,
    monthLabel: string
  ): Promise<void> {
    await setDoc(
      doc(
        firestoreDb,
        COLLECTION,
        this.docId(monthKey, memberId)
      ),
      {
        monthKey,
        memberId,
        memberName,
        amount,
        status: 'payment_pending_confirmation' as PaymentStatus,
        markedPaidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Targeted, once-only notification straight to the approver.
    // Reuses notifyOnce() exactly as before.
    //
    // FIX — try/caught and NOT awaited before this method returns. A failure here
    // (or slowness) must never block the "I've Paid" action itself, and must never
    // propagate back to the caller.
    const approver = this.memberService.paymentApprover();

    if (approver?.uid) {
      this.notifications
        .notifyOnce(
          `settlement_paid_${monthKey}_${memberId}`,
          approver.uid,
          'settlement',
          '💸 Payment Pending Confirmation',
          `${memberName} marked ₹${amount.toFixed(
            2
          )} as paid for ${monthLabel}. Please confirm once received.`,
          '/expenses'
        )
        .catch((err) => console.error('markPaid: approver notification failed', err));
    }
  }

  /**
   * Payment approver taps "Confirm Received".
   */
  async confirmReceived(
    monthKey: string,
    memberId: string,
    memberName: string,
    amount: number,
    monthLabel: string
  ): Promise<void> {
    const uid = this.auth.user()?.uid;

    await setDoc(
      doc(
        firestoreDb,
        COLLECTION,
        this.docId(monthKey, memberId)
      ),
      {
        monthKey,
        memberId,
        memberName,
        amount,
        status: 'settled' as PaymentStatus,
        confirmedAt: serverTimestamp(),
        confirmedByUid: uid ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Settlement Completed notification.
    //
    // One push-eligible notification per relevant member,
    // including the payer, while skipping the person who just
    // performed the confirmation action.
    //
    // FIX — deliberately NOT awaited before this method returns (the write above,
    // the part the UI actually depends on, already completed). Each member's
    // notifyOnce() is individually try/caught so one member's failure can no longer
    // silently abort notifications to everyone after them in the loop.
    this.notifySettlementCompleted(monthKey, memberId, memberName, monthLabel, uid).catch(
      (err) => console.error('confirmReceived: settlement_completed fan-out failed', err)
    );
  }

  private async notifySettlementCompleted(
    monthKey: string,
    memberId: string,
    memberName: string,
    monthLabel: string,
    actingUid: string | undefined
  ): Promise<void> {
    const monthSlug = monthKey.replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const m of this.memberService.members()) {
      const recipientUid = m.uid ?? m.id;

      if (!recipientUid || recipientUid === actingUid) {
        continue;
      }

      try {
        await this.notifications.notifyOnce(
          `settlement_completed_${monthSlug}_${memberId}_${m.id}`,
          recipientUid,
          'settlement_completed',
          '🎉 Settlement Completed',
          `${memberName}'s settlement for ${monthLabel} has been completed.`,
          '/expenses'
        );
      } catch (err) {
        console.error(`confirmReceived: notification failed for member ${m.id}`, err);
      }
    }
  }
}