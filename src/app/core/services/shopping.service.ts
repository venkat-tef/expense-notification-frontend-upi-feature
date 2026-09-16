import { Injectable, inject, signal, computed } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { AuthService } from './auth.service';
import { MemberService } from './member.service';
import { ShoppingItem } from '../models/shopping.model';

const COLLECTION = 'shopping_items';

@Injectable({ providedIn: 'root' })
export class ShoppingService {
  readonly items = signal<ShoppingItem[]>([]);
  readonly loaded = signal(false);
  readonly todoItems = computed(() => this.items().filter(i => i.status === 'todo'));
  readonly purchasedItems = computed(() => this.items().filter(i => i.status === 'purchased'));

  private readonly auth = inject(AuthService);
  private readonly members = inject(MemberService);

  constructor() {
    const q = query(collection(firestoreDb, COLLECTION), orderBy('createdAt', 'desc'));
    onSnapshot(q, snap => {
      this.items.set(snap.docs.map(d => {
        const x = d.data() as any;
        return {
          id: d.id, name: x.name, groceryId: x.groceryId ?? x.name.toLowerCase().replace(/\s+/g,'-'),
          quantity: Number(x.quantity ?? 1), unit: x.unit ?? 'pcs', estimatedPrice: x.estimatedPrice ?? undefined,
          actualPrice: x.actualPrice ?? undefined, status: x.status ?? 'todo',
          addedByUid: x.addedByUid, addedByName: x.addedByName, purchasedByUid: x.purchasedByUid,
          purchasedByName: x.purchasedByName, purchasedAt: x.purchasedAt?.toMillis?.() ?? x.purchasedAt,
          addedToInventory: x.addedToInventory ?? false,
          createdAt: x.createdAt?.toMillis?.() ?? Date.now(), updatedAt: x.updatedAt?.toMillis?.() ?? Date.now()
        };
      }));
      this.loaded.set(true);
    }, err => { console.error('shopping_items listener', err); this.loaded.set(true); });
  }

  private stamp() { return { uid: this.auth.user()?.uid, name: this.members.currentMember()?.name }; }

  async add(input: { name: string; groceryId: string; quantity: number; unit: string; estimatedPrice?: number }): Promise<boolean> {
    const existing = this.items().find(i => i.status === 'todo' && i.groceryId === input.groceryId);
    if (existing) {
      await updateDoc(doc(firestoreDb, COLLECTION, existing.id), {
        quantity: existing.quantity + input.quantity,
        unit: existing.unit || input.unit,
        estimatedPrice: input.estimatedPrice ?? existing.estimatedPrice ?? null,
        updatedAt: serverTimestamp()
      });
      return false;
    }
    const s = this.stamp();
    await addDoc(collection(firestoreDb, COLLECTION), {
      ...input, status: 'todo', addedByUid: s.uid ?? null, addedByName: s.name ?? null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return true;
  }

  async addIfMissing(input: { name: string; groceryId: string; quantity: number; unit: string; estimatedPrice?: number }): Promise<boolean> {
    const existing = this.items().find(i => i.status === 'todo' && i.groceryId === input.groceryId);
    if (existing) return false;

    const s = this.stamp();
    await addDoc(collection(firestoreDb, COLLECTION), {
      ...input,
      status: 'todo',
      addedByUid: s.uid ?? null,
      addedByName: s.name ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return true;
  }

  async update(id: string, patch: Partial<ShoppingItem>): Promise<void> {
    await updateDoc(doc(firestoreDb, COLLECTION, id), { ...patch, updatedAt: serverTimestamp() });
  }

  async purchase(item: ShoppingItem, actualPrice?: number, purchaser?: { uid?: string; name?: string }): Promise<void> {
    const s = purchaser ?? this.stamp();
    await updateDoc(doc(firestoreDb, COLLECTION, item.id), {
      status: 'purchased', actualPrice: actualPrice ?? item.actualPrice ?? null,
      purchasedByUid: s.uid ?? null, purchasedByName: s.name ?? null,
      purchasedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }

  async undoPurchase(item: ShoppingItem): Promise<void> {
    await updateDoc(doc(firestoreDb, COLLECTION, item.id), {
      status: 'todo', purchasedByUid: null, purchasedByName: null, purchasedAt: null,
      addedToInventory: false, updatedAt: serverTimestamp()
    });
  }

  async remove(id: string): Promise<void> { await deleteDoc(doc(firestoreDb, COLLECTION, id)); }
}
