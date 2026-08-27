import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

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
import { InventoryItemInput, InventoryService } from '../../../core/services/inventory.service';
// import { InventoryItemInput, InventoryService } from '../../../core/services/inventory.service';

export interface InventoryItemDialogData {
  /** Which tab the user was on when they tapped "Add Item" — preselects the category. */
  category: InventoryCategory;
  /** Present when editing an existing item; absent when adding a new one. */
  item?: InventoryItem;
}

export type InventoryItemDialogResult = InventoryItemInput;

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
  templateUrl: './inventory-item-dialog.html',
  styleUrl: './inventory-item-dialog.scss',
})
export class InventoryItemDialog {
  private readonly ref = inject(MatDialogRef<InventoryItemDialog>);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<InventoryItemDialogData>(MAT_DIALOG_DATA);

  readonly categories = INVENTORY_CATEGORIES;
  readonly categoryLabels = INVENTORY_CATEGORY_LABEL;
  readonly statuses = INVENTORY_STATUSES;
  readonly statusLabels = INVENTORY_STATUS_LABEL;
  readonly units = INVENTORY_UNITS;

  readonly isEdit = !!this.data.item;

  readonly name = signal(this.data.item?.name ?? '');
  readonly category = signal<InventoryCategory>(this.data.item?.category ?? this.data.category);
  readonly status = signal<InventoryStatus>(this.data.item?.status ?? 'available');
  readonly quantityInput = signal(
    this.data.item?.quantity != null ? String(this.data.item.quantity) : ''
  );
  readonly unit = signal<InventoryUnit | ''>(this.data.item?.unit ?? '');
  readonly expiryDate = signal(this.data.item?.expiryDate ?? '');

  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});

  private validate(): boolean {
    const errs: Record<string, string> = {};

    const name = this.name().trim();
    if (!name) errs['name'] = 'Item name is required.';
    else if (name.length > 60) errs['name'] = 'Maximum 60 characters.';

    const qtyRaw = String(this.quantityInput() ?? '').trim();
    if (qtyRaw) {
      const qty = Number(qtyRaw);
      if (isNaN(qty) || qty < 0) {
        errs['quantity'] = 'Enter a valid quantity.';
      }
    }

    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  async save(): Promise<void> {
    if (!this.validate()) return;
    this.saving.set(true);

    try {
      const qtyRaw = String(this.quantityInput() ?? '').trim();

      const result: InventoryItemDialogResult = {
        name: this.name().trim(),
        category: this.category(),
        status: this.status(),
        quantity: qtyRaw ? Number(qtyRaw) : undefined,
        unit: this.unit() || undefined,
        expiryDate: this.expiryDate() || undefined,
      };

      this.ref.close(result);
    } catch (err) {
      console.error('Failed to save inventory item', err);
      const message = err instanceof Error ? err.message : 'Could not save the item. Please try again.';
      this.snackBar.open(message, 'OK', { duration: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.ref.close();
  }
}
