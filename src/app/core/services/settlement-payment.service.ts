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

/** Approver's "Send Reminder" button is disabled for this long after each send, per member+month. */
const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
// const REMINDER_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

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

  /**
   * Local optimistic records waiting for Firestore to acknowledge the write.
   *
   * Why this exists:
   * Firestore's onSnapshot() is realtime, but the UI should not have to wait for
   * the snapshot round-trip after a user taps a settlement button. We update the
   * signal immediately and keep the optimistic value here until Firestore's
   * listener catches up. The snapshot remains the final source of truth.
   */
  private readonly optimisticPayments = new Map<string, SettlementPayment>();

  /** Previous values used to restore the UI if an optimistic write fails. */
  private readonly optimisticPrevious = new Map<string, SettlementPayment | undefined>();

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
            lastReminderAt: data['lastReminderAt']?.toMillis?.() ?? undefined,
            lastReminderByUid: data['lastReminderByUid'] ?? undefined,
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
          };
        });

        // Firestore remains the source of truth, but preserve any local optimistic
        // updates until their writes have completed. This prevents a slow/stale
        // snapshot from briefly putting the UI back into the old state.
        const optimisticIds = new Set(this.optimisticPayments.keys());
        const merged = list.map((payment) =>
          optimisticIds.has(payment.id)
            ? this.optimisticPayments.get(payment.id)!
            : payment
        );

        // Optimistic records can represent a newly-created document that is not
        // present in this particular snapshot yet. Add those records as well.
        for (const [id, optimistic] of this.optimisticPayments) {
          if (!merged.some((payment) => payment.id === id)) {
            merged.push(optimistic);
          }
        }

        this.payments.set(merged);
        this.loaded.set(true);
      },
      (err) => {
        console.error('settlement_payments onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  /**
   * Apply a settlement change to the UI immediately, before Firestore responds.
   */
  private applyOptimisticPayment(payment: SettlementPayment): void {
    const id = payment.id;

    if (!this.optimisticPrevious.has(id)) {
      this.optimisticPrevious.set(
        id,
        this.payments().find((existing) => existing.id === id)
      );
    }

    this.optimisticPayments.set(id, payment);

    const current = this.payments();
    const index = current.findIndex((existing) => existing.id === id);

    if (index === -1) {
      this.payments.set([...current, payment]);
      return;
    }

    const next = [...current];
    next[index] = payment;
    this.payments.set(next);
  }

  /**
   * Mark an optimistic write as acknowledged by Firestore. The next snapshot
   * is then allowed to become the source of truth for this document.
   */
  private clearOptimisticPayment(id: string): void {
    this.optimisticPayments.delete(id);
    this.optimisticPrevious.delete(id);
  }

  /**
   * Roll an optimistic update back if the Firestore write fails.
   */
  private rollbackOptimisticPayment(id: string): void {
    const previous = this.optimisticPrevious.get(id);

    this.optimisticPayments.delete(id);
    this.optimisticPrevious.delete(id);

    const current = this.payments();

    if (previous) {
      const index = current.findIndex((payment) => payment.id === id);
      if (index === -1) {
        this.payments.set([...current, previous]);
      } else {
        const next = [...current];
        next[index] = previous;
        this.payments.set(next);
      }
      return;
    }

    this.payments.set(current.filter((payment) => payment.id !== id));
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
   * True while the approver's "Send Reminder" button should be disabled for this
   * member+month — i.e. a reminder was sent less than REMINDER_COOLDOWN_MS ago. A
   * member with no record yet (never reminded) is never on cooldown.
   */
  reminderOnCooldown(monthKey: string, memberId: string): boolean {
    const lastReminderAt = this.recordFor(monthKey, memberId)?.lastReminderAt;

    if (!lastReminderAt) {
      return false;
    }

    return Date.now() - lastReminderAt < REMINDER_COOLDOWN_MS;
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
    // Snapshot the current month so we can restore the UI if the delete fails.
    const previousMonthPayments = this.forMonth(monthKey);

    // Optimistically remove the records immediately. This keeps the settlement
    // cards in sync with the user's delete action without waiting for Firestore.
    this.payments.set(
      this.payments().filter((payment) => payment.monthKey !== monthKey)
    );

    try {
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
    } catch (err) {
      // Restore the previous state immediately if the reset could not be completed.
      const current = this.payments();
      const withoutMonth = current.filter(
        (payment) => payment.monthKey !== monthKey
      );
      this.payments.set([...withoutMonth, ...previousMonthPayments]);
      throw err;
    }

    // onSnapshot() will subsequently confirm the deletions from Firestore.
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
    // FIX — URLSearchParams encodes spaces as '+', not '%20'. PhonePe (and some other
    // UPI apps) do not reliably decode '+' back into a space when parsing the intent,
    // so `pn`/`tn` values containing spaces (payee names, "Nestly Settlement - Sept
    // 2026") arrived at PhonePe looking altered/garbled — which is exactly what was
    // triggering "your payment is declined for security reasons, please try using a
    // mobile number/UPI ID/QR code". Manual entry in the PhonePe app never hit this
    // because no such string is ever built there. encodeURIComponent always produces
    // %20, which every UPI app parses correctly.
    //
    // Also added `tr` — a unique transaction reference per payment attempt, required
    // by the NPCI UPI intent spec and increasingly enforced by PhonePe's fraud checks.
    // Without it, every link generated for the same approver + amount + note was
    // byte-for-byte identical across attempts, which can itself be flagged as a
    // suspicious static/replayed intent rather than a fresh legitimate payment.
    const tr = `NESTLY${Date.now()}`;

    const parts: Record<string, string> = {
      pa: upiId,
      pn: payeeName,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: note,
      tr,
    };

    const query = Object.entries(parts)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return `upi://pay?${query}`;
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
    const id = this.docId(monthKey, memberId);
    const existing = this.recordFor(monthKey, memberId);
    const now = Date.now();

    const optimisticPayment: SettlementPayment = {
      id,
      monthKey,
      memberId,
      memberName,
      amount,
      status: 'payment_pending_confirmation' as PaymentStatus,
      markedPaidAt: now,
      confirmedAt: existing?.confirmedAt,
      confirmedByUid: existing?.confirmedByUid,
      lastReminderAt: existing?.lastReminderAt,
      lastReminderByUid: existing?.lastReminderByUid,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // IMPORTANT: update the signal BEFORE awaiting Firestore.
    this.applyOptimisticPayment(optimisticPayment);

    try {
      await setDoc(
        doc(firestoreDb, COLLECTION, id),
        {
          monthKey,
          memberId,
          memberName,
          amount,
          status: 'payment_pending_confirmation' as PaymentStatus,
          markedPaidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAt: existing ? undefined : serverTimestamp(),
        },
        { merge: true }
      );

      this.clearOptimisticPayment(id);
    } catch (err) {
      this.rollbackOptimisticPayment(id);
      throw err;
    }

    // Targeted notification straight to the approver.
    // Every action creates its own notification event through notifyMember().
    const approver = this.memberService.paymentApprover();

    if (approver?.uid) {
      this.notifications
        .notifyMember(
          'settlement',
          '💸 Payment Pending Confirmation',
          `${memberName} marked ₹${amount.toFixed(
            2
          )} as paid for ${monthLabel}. Please confirm once received.`,
          '/expenses',
          approver.uid
        )
        .catch((err) => console.error('markPaid: approver notification failed', err));
    }
  }

  /**
   * Payment approver taps "Send Reminder" on another member's still-owing settlement
   * card. Pings that ONE member only (never a broadcast) and records when it was sent so
   * the button can disable itself for REMINDER_COOLDOWN_MS.
   *
   * Defense in depth: the UI already disables the button while reminderOnCooldown() is
   * true, but this re-checks the cooldown here too so a stale/duplicate click (or a
   * direct call) can never send a second reminder inside the cooldown window.
   */
  async sendReminder(
    monthKey: string,
    memberId: string,
    memberName: string,
    amount: number,
    monthLabel: string
  ): Promise<void> {
    if (this.reminderOnCooldown(monthKey, memberId)) {
      return;
    }

    const approverUid = this.auth.user()?.uid;
    const id = this.docId(monthKey, memberId);
    const existing = this.recordFor(monthKey, memberId);
    const now = Date.now();

    const optimisticPayment: SettlementPayment = {
      id,
      monthKey,
      memberId,
      memberName,
      amount: existing?.amount ?? amount,
      status: existing?.status ?? 'pending',
      markedPaidAt: existing?.markedPaidAt,
      confirmedAt: existing?.confirmedAt,
      confirmedByUid: existing?.confirmedByUid,
      lastReminderAt: now,
      lastReminderByUid: approverUid ?? undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // Disable the reminder immediately. Do not wait for the Firestore round-trip.
    this.applyOptimisticPayment(optimisticPayment);

    try {
      // A member who has never been reminded may have no document yet. merge=true
      // deliberately creates that document while leaving its implicit pending status.
      await setDoc(
        doc(firestoreDb, COLLECTION, id),
        {
          monthKey,
          memberId,
          memberName,
          lastReminderAt: serverTimestamp(),
          lastReminderByUid: approverUid ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.clearOptimisticPayment(id);
    } catch (err) {
      this.rollbackOptimisticPayment(id);
      throw err;
    }

    // Targeted notification straight to the member being reminded — never a broadcast.
    const targetMember = this.memberService.members().find((m) => m.id === memberId);
    const targetUid = targetMember?.uid ?? memberId;

    this.notifications
      .notifyMember(
        'settlement_reminder',
        '⏰ Payment Reminder',
        `Reminder: you still owe ₹${amount.toFixed(2)} for ${monthLabel}.`,
        '/expenses',
        targetUid
      )
      .catch((err) => console.error('sendReminder: member notification failed', err));
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
    const id = this.docId(monthKey, memberId);
    const existing = this.recordFor(monthKey, memberId);
    const now = Date.now();

    const optimisticPayment: SettlementPayment = {
      id,
      monthKey,
      memberId,
      memberName,
      amount,
      status: 'settled' as PaymentStatus,
      markedPaidAt: existing?.markedPaidAt,
      confirmedAt: now,
      confirmedByUid: uid,
      lastReminderAt: existing?.lastReminderAt,
      lastReminderByUid: existing?.lastReminderByUid,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // IMPORTANT: update the signal immediately so the Confirm Received button
    // changes to Settled without waiting for onSnapshot().
    this.applyOptimisticPayment(optimisticPayment);

    try {
      await setDoc(
        doc(firestoreDb, COLLECTION, id),
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

      this.clearOptimisticPayment(id);
    } catch (err) {
      this.rollbackOptimisticPayment(id);
      throw err;
    }

    // Settlement Completed notification.
    // One push-eligible notification per relevant member, skipping the actor.
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
    // ROOT-CAUSE FIX — this used to call notifyOnce() with a fixed ID
    // (`settlement_completed_${monthSlug}_${memberId}_${m.id}`) that depended only on
    // the month and the two members involved, never on the specific event. Any repeat
    // "settlement completed" cycle for the same month+pair (e.g. after resetMonth()
    // due to a bill correction, then paid + confirmed again) silently produced nothing,
    // because notifyOnce() found the old marker doc and skipped writing entirely — no
    // history entry, no push. Now uses notifyMember(), which always addDoc()s a
    // brand-new record, so every confirmation is its own permanent, separate event.
    for (const m of this.memberService.members()) {
      const recipientUid = m.uid ?? m.id;

      if (!recipientUid || recipientUid === actingUid) {
        continue;
      }

      try {
        await this.notifications.notifyMember(
          'settlement_completed',
          '🎉 Settlement Completed',
          `${memberName}'s settlement for ${monthLabel} has been completed.`,
          '/expenses',
          recipientUid
        );
      } catch (err) {
        console.error(`confirmReceived: notification failed for member ${m.id}`, err);
      }
    }
  }
}