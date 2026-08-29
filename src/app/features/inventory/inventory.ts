import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

import { getInventoryItemImage, getInventoryFallbackImage } from '../../core/models/inventory-images';


interface TabDef {
  id: InventoryCategory;
  label: string;
  icon: string;
}


@Component({
  selector: 'app-inventory',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
  ],

  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory {

  // ==========================================================
  // DEPENDENCIES
  // ==========================================================

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly inventoryService = inject(InventoryService);
  readonly memberService = inject(MemberService);


  // ==========================================================
  // CONSTANTS
  // ==========================================================

  readonly categoryLabel = INVENTORY_CATEGORY_LABEL;
  readonly statusLabel = INVENTORY_STATUS_LABEL;
  readonly statusIcon = INVENTORY_STATUS_ICON;


  // ==========================================================
  // TABS
  // ==========================================================

  readonly tabs: TabDef[] = INVENTORY_CATEGORIES.map((category) => ({
    id: category,
    label: INVENTORY_CATEGORY_LABEL[category],
    icon: INVENTORY_CATEGORY_ICON[category],
  }));


  readonly activeTab = signal<InventoryCategory>('fridge');


  // ==========================================================
  // SEARCH
  // ==========================================================

  readonly searchText = signal('');


  // ==========================================================
  // VISIBLE ITEMS
  // ==========================================================

// ==========================================================
// VISIBLE ITEMS
// ==========================================================

readonly visibleItems = computed<InventoryItem[]>(() =>
  this.inventoryService
    .items()
    .filter((item) => item.category === this.activeTab())
);


  // ==========================================================
  // FILTERED ITEMS
  // ==========================================================

  readonly filteredItems = computed<InventoryItem[]>(() => {

    const search = this.searchText()
      .trim()
      .toLowerCase();

    const items = this.visibleItems();

    if (!search) {
      return items;
    }

    return items.filter((item) =>
      item.name.toLowerCase().includes(search)
    );
  });


  // ==========================================================
  // TAB SELECTION
  // ==========================================================

  selectTab(id: InventoryCategory): void {

    this.activeTab.set(id);

    // Clear search when switching category
    this.searchText.set('');
  }


  // ==========================================================
  // STATUS HELPERS
  // ==========================================================

  getStatusLabel(status: InventoryStatus): string {
    return this.statusLabel[status];
  }


  getStatusIcon(status: InventoryStatus): string {
    return this.statusIcon[status];
  }


  // ==========================================================
  // ITEM IMAGE
  //
  // Stable local SVG mapping (see inventory-images.ts) — replaces
  // the old emoji lookup. No network calls per card.
  // ==========================================================

  getItemImage(item: InventoryItem): string {
    return getInventoryItemImage(item.name, item.category);
  }


  // ==========================================================
  // IMAGE LOAD FAILURE
  //
  // If a mapped photo is missing/renamed, swap to the category
  // fallback instead of leaving a broken image icon on the card.
  // ==========================================================

  onImageError(event: Event, category: InventoryCategory): void {

    const img = event.target as HTMLImageElement;

    // Prevent an infinite loop if the fallback itself is missing.
    img.onerror = null;

    img.src = getInventoryFallbackImage(category);
  }

  // ==========================================================
  // ADD ITEM
  // ==========================================================

openAddItem(): void {

  const data: InventoryItemDialogData = {
    category: this.activeTab(),
  };


  const ref = this.dialog.open(
    InventoryItemDialog,
    {
      data,
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
    }
  );


  ref.afterClosed().subscribe(

    async (
      result: InventoryItemDialogResult | undefined
    ) => {

      if (!result) {
        return;
      }


      try {

        const added =
          await this.inventoryService.addItem(result);


        // ----------------------------------------------
        // SUCCESS
        // ----------------------------------------------

        if (added) {

          this.snackBar.open(
            'Item added.',
            undefined,
            {
              duration: 1800,
              panelClass: 'rm-snack-success',
            }
          );

          return;
        }


        // ----------------------------------------------
        // DUPLICATE
        // ----------------------------------------------

        this.snackBar.open(
          `"${result.name}" already exists in ${this.categoryLabel[result.category]}.`,
          undefined,
          {
            duration: 2500,
          }
        );

      } catch (err) {

        console.error(
          'Failed to add inventory item:',
          err
        );


        this.snackBar.open(
          'Could not add item. Please try again.',
          undefined,
          {
            duration: 2500,
          }
        );
      }
    }
  );
}


  // ==========================================================
  // EDIT ITEM
  // ==========================================================

  openEditItem(item: InventoryItem): void {

    const data: InventoryItemDialogData = {
      category: item.category,
      item,
    };

    const ref = this.dialog.open(
      InventoryItemDialog,
      {
        data,
        width: '480px',
        maxWidth: '95vw',
        autoFocus: false,
      }
    );

    ref.afterClosed().subscribe(
      async (result: InventoryItemDialogResult | undefined) => {

        if (!result) return;

        await this.inventoryService.updateItem(
          item.id,
          result
        );

        this.snackBar.open(
          'Item updated.',
          undefined,
          {
            duration: 1800,
            panelClass: 'rm-snack-success',
          }
        );
      }
    );
  }


  // ==========================================================
  // QUICK STATUS UPDATE
  // ==========================================================

  async setStatus(
    item: InventoryItem,
    status: InventoryStatus
  ): Promise<void> {

    if (item.status === status) {
      return;
    }

    await this.inventoryService.updateStatus(
      item,
      status
    );

    this.snackBar.open(
      `${item.name} marked as ${this.getStatusLabel(status)}.`,
      undefined,
      {
        duration: 1400,
      }
    );
  }


  // ==========================================================
  // DELETE ITEM
  // ==========================================================

  async deleteItem(
    item: InventoryItem
  ): Promise<void> {

    const confirmed = confirm(
      `Remove "${item.name}" from ${this.categoryLabel[item.category]} inventory?`
    );

    if (!confirmed) {
      return;
    }

    await this.inventoryService.deleteItem(item);

    this.snackBar.open(
      'Item removed.',
      undefined,
      {
        duration: 1800,
      }
    );
  }


  // ==========================================================
  // QUANTITY LABEL
  // ==========================================================

  quantityLabel(
    item: InventoryItem
  ): string | null {

    if (item.quantity == null) {
      return null;
    }

    return item.unit
      ? `${item.quantity} ${item.unit}`
      : `${item.quantity}`;
  }


  // ==========================================================
  // UPDATED BY LABEL
  // ==========================================================

  updatedByLabel(
    item: InventoryItem
  ): string | null {

    if (!item.updatedByName) {
      return null;
    }

    return `Updated by ${item.updatedByName}`;
  }

}