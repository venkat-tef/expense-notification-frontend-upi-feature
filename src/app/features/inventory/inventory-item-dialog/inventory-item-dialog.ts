import {
  Component,
  inject,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import {
  MatInputModule,
} from '@angular/material/input';

import {
  MatSelectModule,
} from '@angular/material/select';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_STATUS_LABEL,
  INVENTORY_STATUSES,
  INVENTORY_UNITS,
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
  InventoryUnit,
} from '../../../core/models/inventory.model';

import {
  InventoryItemInput,
} from '../../../core/services/inventory.service';


export interface InventoryItemDialogData {

  category: InventoryCategory;

  item?: InventoryItem;
}


export type InventoryItemDialogResult =
  InventoryItemInput;


@Component({
  selector: 'app-inventory-item-dialog',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],

  templateUrl:
    './inventory-item-dialog.html',

  styleUrl:
    './inventory-item-dialog.scss',
})
export class InventoryItemDialog {

  // ============================================================
  // DEPENDENCIES
  // ============================================================

  private readonly ref =
    inject(
      MatDialogRef<InventoryItemDialog>
    );

  readonly data =
    inject<InventoryItemDialogData>(
      MAT_DIALOG_DATA
    );


  // ============================================================
  // CONSTANTS
  // ============================================================

  readonly categories =
    INVENTORY_CATEGORIES;

  readonly categoryLabels =
    INVENTORY_CATEGORY_LABEL;

  readonly statuses =
    INVENTORY_STATUSES;

  readonly statusLabels =
    INVENTORY_STATUS_LABEL;

  readonly units =
    INVENTORY_UNITS;


  // ============================================================
  // EDIT MODE
  // ============================================================

  readonly isEdit =
    !!this.data.item;


  // ============================================================
  // FORM SIGNALS
  // ============================================================

  readonly name =
    signal(
      this.data.item?.name ?? ''
    );


  readonly category =
    signal<InventoryCategory>(
      this.data.item?.category ??
      this.data.category
    );


  readonly status =
    signal<InventoryStatus>(
      this.data.item?.status ??
      'available'
    );


  readonly quantityInput =
    signal(
      this.data.item?.quantity != null
        ? String(
            this.data.item.quantity
          )
        : ''
    );


  readonly unit =
    signal<InventoryUnit | ''>(
      this.data.item?.unit ?? ''
    );


  readonly expiryDate =
    signal(
      this.data.item?.expiryDate ?? ''
    );


  // ============================================================
  // SAVING STATE
  // ============================================================

  readonly saving =
    signal(false);


  readonly errors =
    signal<Record<string, string>>({});


  // ============================================================
  // VALIDATION
  // ============================================================

  private validate(): boolean {

    const errors:
      Record<string, string> = {};


    const itemName =
      this.name()
        .trim();


    if (!itemName) {

      errors['name'] =
        'Item name is required.';

    } else if (
      itemName.length > 60
    ) {

      errors['name'] =
        'Maximum 60 characters.';
    }


    const quantityRaw =
      String(
        this.quantityInput() ?? ''
      ).trim();


    if (quantityRaw) {

      const quantity =
        Number(quantityRaw);


      if (
        Number.isNaN(quantity) ||
        quantity < 0
      ) {

        errors['quantity'] =
          'Enter a valid quantity.';
      }
    }


    this.errors.set(errors);


    return (
      Object.keys(errors).length === 0
    );
  }


  // ============================================================
  // SAVE
  // ============================================================

  async save(): Promise<void> {

    // ----------------------------------------------------------
    // IMPORTANT:
    // Prevent double-click / duplicate save
    // ----------------------------------------------------------

    if (this.saving()) {
      return;
    }


    if (!this.validate()) {
      return;
    }


    this.saving.set(true);


    try {

      const quantityRaw =
        String(
          this.quantityInput() ?? ''
        ).trim();


      const result:
        InventoryItemDialogResult = {

        name:
          this.name().trim(),

        category:
          this.category(),

        status:
          this.status(),

        quantity:
          quantityRaw
            ? Number(quantityRaw)
            : undefined,

        unit:
          this.unit() || undefined,

        expiryDate:
          this.expiryDate() || undefined,
      };


      // --------------------------------------------------------
      // ONLY RETURN RESULT
      //
      // Parent component handles Firestore add/update.
      // --------------------------------------------------------

      this.ref.close(result);

    } catch (error) {

      console.error(
        'Failed to save inventory item',
        error
      );

      this.saving.set(false);
    }
  }


  // ============================================================
  // CANCEL
  // ============================================================

  cancel(): void {

    if (this.saving()) {
      return;
    }

    this.ref.close();
  }
}