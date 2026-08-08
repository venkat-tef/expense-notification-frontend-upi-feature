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
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestoreDb, firebaseStorage } from './firebase';
import { Expense, ExpenseCategory } from '../models/expense.model';
import { NotificationService } from './notification.service';
import { MemberService } from './member.service';
import { AuthService } from './auth.service'; // add — needed to know who's performing the action

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
  private readonly auth = inject(AuthService); // add

  constructor() {
    this.listen();
  }

  private listen(): void {
    // ...unchanged, exactly as it is...
    const q = query(collection(firestoreDb, COLLECTION), orderBy('expenseDate', 'desc'));
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
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
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

  async addExpense(input: ExpenseInput): Promise<void> {
    const monthKey = input.expenseDate.slice(0, 7);
    const data: Record<string, unknown> = {
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      paidByMemberId: input.paidByMemberId,
      expenseDate: input.expenseDate,
      monthKey,
      createdByUid: this.auth.user()?.uid ?? input.paidByMemberId, // add — lets the backend correctly exclude the actor, not just the payer
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.notes) data['notes'] = input.notes;
    if (input.billImageUrl) data['billImageUrl'] = input.billImageUrl;
    if (input.billImagePath) data['billImagePath'] = input.billImagePath;
    await addDoc(collection(firestoreDb, COLLECTION), data);

    const payerName = this.memberService.members().find((m) => m.id === input.paidByMemberId)?.name ?? 'Someone';
    await this.notifications.notify(
      'expense',
      '💰 New Expense',
      `${payerName} added ₹${input.amount} for ${input.category}.`,
      '/expenses'
    );
  }

  async updateExpense(id: string, input: ExpenseInput): Promise<void> {
    const monthKey = input.expenseDate.slice(0, 7);
    await updateDoc(doc(firestoreDb, COLLECTION, id), {
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      paidByMemberId: input.paidByMemberId,
      expenseDate: input.expenseDate,
      monthKey,
      notes: input.notes ?? null,
      billImageUrl: input.billImageUrl ?? null,
      billImagePath: input.billImagePath ?? null,
      updatedByUid: this.auth.user()?.uid ?? input.paidByMemberId, // add — required by expenseListener.js's update handler
      updatedAt: serverTimestamp(),
    });
  }

  async deleteExpense(expense: Expense): Promise<void> {
    // Write a transient event doc BEFORE deleting — a deleted Firestore doc carries no data
    // by the time any listener (including your backend) sees it, so this is the only way
    // deletionListener.js can know what was deleted or by whom.
    await addDoc(collection(firestoreDb, EVENTS_COLLECTION), {
      type: 'deleted',
      expenseId: expense.id,
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      deletedByUid: this.auth.user()?.uid ?? expense.paidByMemberId,
      deletedAt: serverTimestamp(),
    });

    await deleteDoc(doc(firestoreDb, COLLECTION, expense.id));
    if (expense.billImagePath) {
      await this.deleteStorageFile(expense.billImagePath);
    }
  }

  async deleteStorageFile(path: string): Promise<void> {
    try {
      await deleteObject(ref(firebaseStorage, path));
    } catch (err) {
      console.warn('Could not delete storage file', path, err);
    }
  }

  async uploadBillImage(file: File, monthKey: string): Promise<{ path: string; url: string }> {
    const path = `bill-images/${monthKey}/${Date.now()}-${file.name}`;
    const storageRef = ref(firebaseStorage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { path, url };
  }
}