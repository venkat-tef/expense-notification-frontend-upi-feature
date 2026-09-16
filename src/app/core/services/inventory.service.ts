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


// ============================================================
// COLLECTION
// ============================================================

const COLLECTION = 'inventory_items';


// ============================================================
// INPUT
// ============================================================

export interface InventoryItemInput {
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity?: number;
  unit?: InventoryUnit;
  expiryDate?: string;
}


// ============================================================
// SERVICE
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class InventoryService {

  // ==========================================================
  // STATE
  // ==========================================================

  readonly items = signal<InventoryItem[]>([]);
  readonly loaded = signal(false);


  // ==========================================================
  // DUPLICATE REQUEST PROTECTION
  //
  // Prevents:
  // - double click
  // - dialog firing twice
  // - voice command firing twice
  // - multiple rapid requests
  // ==========================================================

  private readonly addingItems = new Set<string>();


  // ==========================================================
  // DEPENDENCIES
  // ==========================================================

  private readonly auth = inject(AuthService);
  private readonly memberService = inject(MemberService);


  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor() {
    this.listen();
  }


  // ==========================================================
  // REALTIME FIRESTORE LISTENER
  // ==========================================================

  private listen(): void {

    const q = query(
      collection(firestoreDb, COLLECTION),
      orderBy('name', 'asc')
    );


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

            quantity:
              data['quantity'] ?? undefined,

            unit:
              data['unit'] ?? undefined,

            expiryDate:
              data['expiryDate'] ?? undefined,

            createdAt:
              data['createdAt']?.toMillis?.() ?? Date.now(),

            updatedAt:
              data['updatedAt']?.toMillis?.() ?? Date.now(),

            updatedByUid:
              data['updatedByUid'] ?? undefined,

            updatedByName:
              data['updatedByName'] ?? undefined,
          };
        });


        // Update Angular signal
        this.items.set(list);

        this.loaded.set(true);
      },


      (err) => {

        console.error(
          'inventory_items onSnapshot error',
          err
        );

        this.loaded.set(true);
      }
    );
  }


  // ==========================================================
  // GET ITEMS BY CATEGORY
  // ==========================================================

  forCategory(
    category: InventoryCategory
  ): InventoryItem[] {

    return this.items().filter(
      (item) => item.category === category
    );
  }


  // ==========================================================
  // CURRENT USER STAMP
  // ==========================================================

  private currentUserStamp(): {
    uid?: string;
    name?: string;
  } {

    return {

      uid:
        this.auth.user()?.uid ?? undefined,

      name:
        this.memberService.currentMember()?.name ?? undefined,
    };
  }


  // ==========================================================
  // CREATE NORMALIZED KEY
  //
  // Used for duplicate detection.
  //
  // Example:
  //
  // Milk + fridge
  // -> fridge:milk
  // ==========================================================

  private getItemKey(
    name: string,
    category: InventoryCategory
  ): string {

    const normalizedName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    return `${category}:${normalizedName}`;
  }


  // ==========================================================
  // ADD ITEM
  //
  // Returns:
  //
  // true  = item was added
  // false = duplicate / request prevented
  // ==========================================================

  async addItem(
    input: InventoryItemInput
  ): Promise<boolean> {

    const itemName = input.name.trim();


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!itemName) {

      throw new Error(
        'Item name is required.'
      );
    }


    // --------------------------------------------------------
    // CREATE UNIQUE REQUEST KEY
    // --------------------------------------------------------

    const itemKey = this.getItemKey(
      itemName,
      input.category
    );


    // --------------------------------------------------------
    // PREVENT RAPID DOUBLE REQUESTS
    // --------------------------------------------------------

    if (this.addingItems.has(itemKey)) {

      console.warn(
        'Duplicate add request prevented:',
        itemKey
      );

      return false;
    }


    // Lock this item while adding
    this.addingItems.add(itemKey);


    try {

      // ------------------------------------------------------
      // CHECK EXISTING INVENTORY
      //
      // Same name + same category = duplicate
      //
      // Milk in Fridge != Milk in Kitchen
      // ------------------------------------------------------

      const existingItem = this.items().find(
        (item) => {

          return (
            this.getItemKey(
              item.name,
              item.category
            ) === itemKey
          );
        }
      );


      if (existingItem) {

        console.warn(
          'Item already exists:',
          itemKey
        );

        return false;
      }


      // ------------------------------------------------------
      // USER INFORMATION
      // ------------------------------------------------------

      const {
        uid,
        name,
      } = this.currentUserStamp();


      // ------------------------------------------------------
      // FIRESTORE DATA
      // ------------------------------------------------------

      const data: Record<string, unknown> = {

        name: itemName,

        category: input.category,

        status: input.status,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      };


      // ------------------------------------------------------
      // OPTIONAL FIELDS
      // ------------------------------------------------------

      if (input.quantity != null) {

        data['quantity'] =
          input.quantity;
      }


      if (input.unit) {

        data['unit'] =
          input.unit;
      }


      if (input.expiryDate) {

        data['expiryDate'] =
          input.expiryDate;
      }


      if (uid) {

        data['updatedByUid'] =
          uid;
      }


      if (name) {

        data['updatedByName'] =
          name;
      }


      // ------------------------------------------------------
      // ADD TO FIRESTORE
      // ------------------------------------------------------

      await addDoc(
        collection(
          firestoreDb,
          COLLECTION
        ),
        data
      );


      console.log(
        'Inventory item added:',
        itemName
      );


      return true;

    } finally {

      // ------------------------------------------------------
      // ALWAYS RELEASE LOCK
      // ------------------------------------------------------

      this.addingItems.delete(itemKey);
    }
  }


  // ==========================================================
  // UPDATE ITEM
  //
  // Full edit:
  // name/category/quantity/unit/expiry/status
  // ==========================================================

  async updateItem(
    id: string,
    input: InventoryItemInput
  ): Promise<void> {

    const {
      uid,
      name,
    } = this.currentUserStamp();


    await updateDoc(
      doc(
        firestoreDb,
        COLLECTION,
        id
      ),

      {

        name:
          input.name.trim(),

        category:
          input.category,

        status:
          input.status,

        quantity:
          input.quantity ?? null,

        unit:
          input.unit ?? null,

        expiryDate:
          input.expiryDate ?? null,

        updatedByUid:
          uid ?? null,

        updatedByName:
          name ?? null,

        updatedAt:
          serverTimestamp(),
      }
    );
  }


  // ==========================================================
  // QUICK STATUS UPDATE
  // ==========================================================

  async updateStatus(
    item: InventoryItem,
    status: InventoryStatus
  ): Promise<void> {

    const {
      uid,
      name,
    } = this.currentUserStamp();


    await updateDoc(

      doc(
        firestoreDb,
        COLLECTION,
        item.id
      ),

      {

        status,

        updatedByUid:
          uid ?? null,

        updatedByName:
          name ?? null,

        updatedAt:
          serverTimestamp(),
      }
    );
  }


  // ==========================================================
  // RESTOCK FROM SHOPPING
  // ==========================================================

  async restockItem(item: InventoryItem, quantity: number, unit?: InventoryUnit): Promise<void> {
    const { uid, name } = this.currentUserStamp();
    const sameUnit = !item.unit || !unit || item.unit === unit;
    const nextQuantity = sameUnit && item.quantity != null ? item.quantity + quantity : quantity;
    await updateDoc(doc(firestoreDb, COLLECTION, item.id), {
      quantity: nextQuantity,
      unit: unit ?? item.unit ?? null,
      status: 'available',
      updatedByUid: uid ?? null,
      updatedByName: name ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  // ==========================================================
  // DELETE ITEM
  // ==========================================================

  async deleteItem(
    item: InventoryItem
  ): Promise<void> {

    await deleteDoc(

      doc(
        firestoreDb,
        COLLECTION,
        item.id
      )
    );
  }
}