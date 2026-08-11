import { Injectable, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

import { firestoreDb, firebaseStorage } from './firebase';
import { Expense, ExpenseCategory } from '../models/expense.model';
import { NotificationService } from './notification.service';
import { MemberService } from './member.service';
import { AuthService } from './auth.service';

const COLLECTION = 'expenses';
const EVENTS_COLLECTION = 'expenseEvents';

export interface ExpenseInput {
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidByMemberId: string;
  expenseDate: string;
  notes?: string;
  billImageUrl?: string;
  billImagePath?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  readonly expenses = signal<Expense[]>([]);
  readonly loaded = signal(false);

  private readonly notifications = inject(NotificationService);
  private readonly memberService = inject(MemberService);
  private readonly auth = inject(AuthService);

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(
      collection(firestoreDb, COLLECTION),
      orderBy('expenseDate', 'desc')
    );

    onSnapshot(
      q,
      (snap) => {
        const list: Expense[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            id: d.id,
            title: data['title'],
            category: data['category'],
            amount: data['amount'],
            paidByMemberId: data['paidByMemberId'],
            expenseDate: data['expenseDate'],
            monthKey: data['monthKey'],
            notes: data['notes'] ?? undefined,
            billImageUrl: data['billImageUrl'] ?? undefined,
            billImagePath: data['billImagePath'] ?? undefined,
            createdAt:
              data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt:
              data['updatedAt']?.toMillis?.() ?? Date.now(),
          };
        });

        this.expenses.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error('expenses onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  forMonth(monthKey: string): Expense[] {
    return this.expenses().filter((e) => e.monthKey === monthKey);
  }

  // ============================================================
  // ADD EXPENSE
  // ============================================================

  async addExpense(input: ExpenseInput): Promise<void> {
    const monthKey = input.expenseDate.slice(0, 7);

    const data: Record<string, unknown> = {
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      paidByMemberId: input.paidByMemberId,
      expenseDate: input.expenseDate,
      monthKey,

      // Current logged-in user who performed the action
      createdByUid:
        this.auth.user()?.uid ?? input.paidByMemberId,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.notes) {
      data['notes'] = input.notes;
    }

    if (input.billImageUrl) {
      data['billImageUrl'] = input.billImageUrl;
    }

    if (input.billImagePath) {
      data['billImagePath'] = input.billImagePath;
    }

    // IMPORTANT:
    // Capture the newly generated Firestore expense ID.
    const expenseRef = await addDoc(
      collection(firestoreDb, COLLECTION),
      data
    );

    const payerName =
      this.memberService.members().find(
        (m) => m.id === input.paidByMemberId
      )?.name ?? 'Someone';

    // IMPORTANT:
    // Every expense gets its own unique notification ID.
    const notificationId =
      `expense_added_${expenseRef.id}`;

    await this.notifications.notify(
      'expense',
      '💰 New Expense',
      `${payerName} added ₹${input.amount} for ${input.category}.`,
      '/expenses',
      notificationId
    );
  }

  // ============================================================
  // UPDATE EXPENSE
  // ============================================================

  async updateExpense(
    id: string,
    input: ExpenseInput
  ): Promise<void> {
    const monthKey = input.expenseDate.slice(0, 7);

    await updateDoc(
      doc(firestoreDb, COLLECTION, id),
      {
        title: input.title.trim(),
        category: input.category,
        amount: input.amount,
        paidByMemberId: input.paidByMemberId,
        expenseDate: input.expenseDate,
        monthKey,

        notes: input.notes ?? null,
        billImageUrl: input.billImageUrl ?? null,
        billImagePath: input.billImagePath ?? null,

        updatedByUid:
          this.auth.user()?.uid ?? input.paidByMemberId,

        updatedAt: serverTimestamp(),
      }
    );
  }

  // ============================================================
  // DELETE EXPENSE
  // ============================================================

  async deleteExpense(expense: Expense): Promise<void> {
    // Write a transient event BEFORE deleting the expense.
    // This allows the backend deletion listener to know
    // exactly what was deleted. (Push-only — this doc is
    // deleted by the backend right after it's processed,
    // so it is NOT the bell/history record. See below.)

    const deletionNotificationId =
      `expense_deleted_${expense.id}_${Date.now()}`;

    await addDoc(
      collection(firestoreDb, EVENTS_COLLECTION),
      {
        type: 'deleted',

        expenseId: expense.id,

        title: expense.title,
        amount: expense.amount,
        category: expense.category,

        deletedByUid:
          this.auth.user()?.uid ??
          expense.paidByMemberId,

        // IMPORTANT:
        // Unique notification ID for this delete event.
        notificationId: deletionNotificationId,

        deletedAt: serverTimestamp(),
      }
    );

    // ROOT-CAUSE FIX — this method used to ONLY write the transient
    // expenseEvents doc above, which the backend deletes right after
    // sending its push. That meant a DELETE never left any trace in the
    // `notifications` collection (the bell/history), unlike an ADD, which
    // gets its own permanent addDoc() record via notify() below. So history
    // only ever showed ADDs — a delete looked like it vanished, and an
    // ADD -> DELETE -> ADD cycle only ever showed both ADDs with no DELETE
    // between them.
    //
    // This addDoc()s a brand-new, permanent bell/history record for the
    // deletion, exactly parallel to addExpense()'s notify() call. Reuses
    // type 'expense' (not 'expense_deleted') on purpose: it's not part of
    // the NotificationType union or the icon map, and — just as important —
    // it's NOT in the backend's PUSH_ELIGIBLE_TYPES list, so this stays
    // bell-only and does not fire a second, duplicate OS push alongside the
    // one the expenseEvents doc above already triggers via deletionListener.js.
    const deleterUid =
      this.auth.user()?.uid ??
      expense.paidByMemberId;

    const deleterName =
      this.memberService.members().find(
        (m) => (m.uid ?? m.id) === deleterUid
      )?.name ?? 'Someone';

    await this.notifications.notify(
      'expense',
      '🗑️ Expense Removed',
      `${deleterName} removed "${expense.title}" (₹${expense.amount}).`,
      '/expenses',
      deletionNotificationId
    );

    await deleteDoc(
      doc(
        firestoreDb,
        COLLECTION,
        expense.id
      )
    );

    if (expense.billImagePath) {
      await this.deleteStorageFile(
        expense.billImagePath
      );
    }
  }

  // ============================================================
  // DELETE STORAGE FILE
  // ============================================================

  async deleteStorageFile(path: string): Promise<void> {
    try {
      await deleteObject(
        ref(firebaseStorage, path)
      );
    } catch (err) {
      console.warn(
        'Could not delete storage file',
        path,
        err
      );
    }
  }

  // ============================================================
  // UPLOAD BILL IMAGE
  // ============================================================

  async uploadBillImage(
    file: File,
    monthKey: string
  ): Promise<{ path: string; url: string }> {
    const path =
      `bill-images/${monthKey}/${Date.now()}-${file.name}`;

    const storageRef = ref(
      firebaseStorage,
      path
    );

    await uploadBytes(
      storageRef,
      file
    );

    const url = await getDownloadURL(
      storageRef
    );

    return {
      path,
      url,
    };
  }
}