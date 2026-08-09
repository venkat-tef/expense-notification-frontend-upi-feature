import { Injectable, inject, signal } from '@angular/core';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { PaymentStatus, SettlementPayment } from '../models/expense.model';
import { NotificationService } from './notification.service';
import { MemberService } from './member.service';
import { AuthService } from './auth.service';

const COLLECTION = 'settlement_payments';

/**
 * Tracks the UPI payment lifecycle for members who owe money in a given month
 * (Pending -> Payment Pending Confirmation -> Settled). Members who are owed money
 * never get a doc here — that side of settlement is unchanged, computed-only, as before.
 *
 * A member with no doc for (monthKey, memberId) is implicitly 'pending' — same
 * "empty = default" pattern as MonthlySummaryService.emptyFor().
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

  /** The record for one member+month, or undefined if they're still at the implicit 'pending' default. */
  recordFor(monthKey: string, memberId: string): SettlementPayment | undefined {
    return this.payments().find((p) => p.monthKey === monthKey && p.memberId === memberId);
  }

  statusFor(monthKey: string, memberId: string): PaymentStatus {
    return this.recordFor(monthKey, memberId)?.status ?? 'pending';
  }

  /**
   * Builds a standard UPI deep link (`upi://pay?...`). Opening it hands off to whichever
   * UPI app the user has set as default (PhonePe, GPay, Paytm, BHIM, etc.) — no payment
   * gateway or SDK involved, this is purely a URI scheme all UPI apps register for.
   */
  buildUpiLink(upiId: string, payeeName: string, amount: number, note: string): string {
    const params = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: note,
    });
    return `upi://pay?${params.toString()}`;
  }

  /** Member taps "I've Paid" after returning from their UPI app. */
  async markPaid(monthKey: string, memberId: string, memberName: string, amount: number, monthLabel: string): Promise<void> {
    await setDoc(
      doc(firestoreDb, COLLECTION, this.docId(monthKey, memberId)),
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

    // Targeted, once-only notification straight to the approver — reuses notifyOnce()
    // exactly as duty reminders do, keyed so re-tapping "I've Paid" never double-notifies.
    const approver = this.memberService.paymentApprover();
    if (approver?.uid) {
      await this.notifications.notifyOnce(
        `settlement_paid_${monthKey}_${memberId}`,
        approver.uid,
        'settlement',
        '💸 Payment Pending Confirmation',
        `${memberName} marked ₹${amount.toFixed(2)} as paid for ${monthLabel}. Please confirm once received.`,
        '/expenses'
      );
    }
  }

  /** Payment approver taps "Confirm Received". */
  async confirmReceived(monthKey: string, memberId: string, memberName: string, amount: number, monthLabel: string): Promise<void> {
    const uid = this.auth.user()?.uid;
    await setDoc(
      doc(firestoreDb, COLLECTION, this.docId(monthKey, memberId)),
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

    // Settlement Completed — one push-eligible notification per relevant member,
    // INCLUDING the payer (e.g. Venki must never be excluded here), skipping only
    // whoever just tapped "Confirm Received" (the approver — same "don't notify
    // yourself about your own action" rule the rest of the app already follows for
    // expenses/duty reminders). This replaces the previous pair of calls that used
    // to run here: a private notifyOnce() straight to the payer (type 'settlement',
    // bell-only, never actually pushed) PLUS a separate notify() broadcast (type
    // 'settlement_completed', push-eligible). Both fired for the same event, which is
    // exactly the "inconsistent"/duplicate bell entries this was producing. Using
    // notifyOnce() in a loop — the same reliable, deduped pattern MonthlySummaryService
    // already uses for Settlement Ready — means a double-tap of this button can never
    // fan out duplicate notifications the way the old notify() broadcast could, and
    // every recipient gets exactly one, consistent, already push-eligible entry.
    const monthSlug = monthKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    for (const m of this.memberService.members()) {
      const recipientUid = m.uid ?? m.id;
      if (!recipientUid || recipientUid === uid) continue;
      await this.notifications.notifyOnce(
        `settlement_completed_${monthSlug}_${memberId}_${m.id}`,
        recipientUid,
        'settlement_completed',
        '🎉 Settlement Completed',
        `${memberName}'s settlement for ${monthLabel} has been completed.`,
        '/expenses'
      );
    }
  }
}