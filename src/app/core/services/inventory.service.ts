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

import { firestoreDb } from './firebase';
import {
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
  InventoryUnit,
} from '../models/inventory.model';
import { AuthService } from './auth.service';
import { MemberService } from './member.service';

// New, dedicated collection — additive only. Does not touch expenses, water_records,
// cooking_records, members, or any other existing collection.
const COLLECTION = 'inventory_items';

export interface InventoryItemInput {
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity?: number;
  unit?: InventoryUnit;
  expiryDate?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  readonly items = signal<InventoryItem[]>([]);
  readonly loaded = signal(false);

  private readonly auth = inject(AuthService);
  private readonly memberService = inject(MemberService);

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION), orderBy('name', 'asc'));

    onSnapshot(
      q,
      (snap) => {
        const list: InventoryItem[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            id: d.id,
            name: data['name'],
            category: data['category'],
            status: data['status'],
            quantity: data['quantity'] ?? undefined,
            unit: data['unit'] ?? undefined,
            expiryDate: data['expiryDate'] ?? undefined,
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
            updatedByUid: data['updatedByUid'] ?? undefined,
            updatedByName: data['updatedByName'] ?? undefined,
          };
        });

        this.items.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error('inventory_items onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  forCategory(category: InventoryCategory): InventoryItem[] {
    return this.items().filter((i) => i.category === category);
  }

  /** Best-effort "who did this" stamp — same optional pattern used for
   *  Expense's createdByUid/updatedByUid; never blocks a write if unavailable. */
  private currentUserStamp(): { uid?: string; name?: string } {
    return {
      uid: this.auth.user()?.uid ?? undefined,
      name: this.memberService.currentMember()?.name ?? undefined,
    };
  }

  // ============================================================
  // ADD ITEM
  // ============================================================

  async addItem(input: InventoryItemInput): Promise<void> {
    const { uid, name } = this.currentUserStamp();

    const data: Record<string, unknown> = {
      name: input.name.trim(),
      category: input.category,
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.quantity != null) data['quantity'] = input.quantity;
    if (input.unit) data['unit'] = input.unit;
    if (input.expiryDate) data['expiryDate'] = input.expiryDate;
    if (uid) data['updatedByUid'] = uid;
    if (name) data['updatedByName'] = name;

    await addDoc(collection(firestoreDb, COLLECTION), data);
  }

  // ============================================================
  // UPDATE ITEM (full edit — name/category/quantity/unit/expiry/status)
  // ============================================================

  async updateItem(id: string, input: InventoryItemInput): Promise<void> {
    const { uid, name } = this.currentUserStamp();

    await updateDoc(doc(firestoreDb, COLLECTION, id), {
      name: input.name.trim(),
      category: input.category,
      status: input.status,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expiryDate: input.expiryDate ?? null,
      updatedByUid: uid ?? null,
      updatedByName: name ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  // ============================================================
  // QUICK STATUS UPDATE (mark Available / Low / Out without opening the full form)
  // ============================================================

  async updateStatus(item: InventoryItem, status: InventoryStatus): Promise<void> {
    const { uid, name } = this.currentUserStamp();

    await updateDoc(doc(firestoreDb, COLLECTION, item.id), {
      status,
      updatedByUid: uid ?? null,
      updatedByName: name ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  // ============================================================
  // DELETE ITEM
  // ============================================================

  async deleteItem(item: InventoryItem): Promise<void> {
    await deleteDoc(doc(firestoreDb, COLLECTION, item.id));
  }
}
