import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { InventoryService } from '../../core/services/inventory.service';
import { MemberService } from '../../core/services/member.service';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_ICON,
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_STATUS_ICON,
  INVENTORY_STATUS_LABEL,
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
} from '../../core/models/inventory.model';
import {
  InventoryItemDialog,
  InventoryItemDialogData,
  InventoryItemDialogResult,
} from './inventory-item-dialog/inventory-item-dialog';


interface TabDef {
  id: InventoryCategory;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly inventoryService = inject(InventoryService);
  readonly memberService = inject(MemberService);

  readonly categoryLabel = INVENTORY_CATEGORY_LABEL;
  readonly statusLabel = INVENTORY_STATUS_LABEL;
  readonly statusIcon = INVENTORY_STATUS_ICON;

  readonly tabs: TabDef[] = INVENTORY_CATEGORIES.map((c) => ({
    id: c,
    label: INVENTORY_CATEGORY_LABEL[c],
    icon: INVENTORY_CATEGORY_ICON[c],
  }));

  readonly activeTab = signal<InventoryCategory>('fridge');

  readonly visibleItems = computed<InventoryItem[]>(() =>
    this.inventoryService.items().filter((i) => i.category === this.activeTab())
  );

  selectTab(id: InventoryCategory): void {
    this.activeTab.set(id);
  }

  // ==========================================================
  // ADD ITEM
  // ==========================================================

  openAddItem(): void {
    const data: InventoryItemDialogData = { category: this.activeTab() };

    const ref = this.dialog.open(InventoryItemDialog, {
      data,
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
    });

    ref.afterClosed().subscribe(async (result: InventoryItemDialogResult | undefined) => {
      if (!result) return;

      await this.inventoryService.addItem(result);

      this.snackBar.open('Item added.', undefined, {
        duration: 1800,
        panelClass: 'rm-snack-success',
      });
    });
  }

  // ==========================================================
  // EDIT ITEM
  // ==========================================================

  openEditItem(item: InventoryItem): void {
    const data: InventoryItemDialogData = { category: item.category, item };

    const ref = this.dialog.open(InventoryItemDialog, {
      data,
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
    });

    ref.afterClosed().subscribe(async (result: InventoryItemDialogResult | undefined) => {
      if (!result) return;

      await this.inventoryService.updateItem(item.id, result);

      this.snackBar.open('Item updated.', undefined, {
        duration: 1800,
        panelClass: 'rm-snack-success',
      });
    });
  }

  // ==========================================================
  // QUICK STATUS UPDATE
  // ==========================================================

  async setStatus(item: InventoryItem, status: InventoryStatus): Promise<void> {
    if (item.status === status) return;
    await this.inventoryService.updateStatus(item, status);
  }

  // ==========================================================
  // DELETE ITEM
  // ==========================================================

  async deleteItem(item: InventoryItem): Promise<void> {
    const confirmed = confirm(`Remove "${item.name}" from ${this.categoryLabel[item.category]} inventory?`);
    if (!confirmed) return;

    await this.inventoryService.deleteItem(item);

    this.snackBar.open('Item removed.', undefined, { duration: 1800 });
  }

  quantityLabel(item: InventoryItem): string | null {
    if (item.quantity == null) return null;
    return item.unit ? `${item.quantity} ${item.unit}` : `${item.quantity}`;
  }
}
