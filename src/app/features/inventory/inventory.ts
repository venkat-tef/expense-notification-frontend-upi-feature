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
  // ITEM EMOJI
  // ==========================================================

getItemEmoji(itemName: string): string {
  const name = (itemName || '').toLowerCase().trim();

  // ==========================================================
  // VEGETABLES
  // ==========================================================

  if (name.includes('tomato')) return '🍅';
  if (name.includes('onion')) return '🧅';
  if (name.includes('potato')) return '🥔';
  if (name.includes('carrot')) return '🥕';
  if (name.includes('brinjal') || name.includes('eggplant')) return '🍆';
  if (name.includes('chilli') || name.includes('chili') || name.includes('mirchi')) return '🌶️';
  if (name.includes('green chilli')) return '🌶️';
  if (name.includes('garlic')) return '🧄';
  if (name.includes('ginger')) return '🫚';
  if (name.includes('corn')) return '🌽';
  if (name.includes('spinach') || name.includes('palak')) return '🥬';
  if (name.includes('cabbage')) return '🥬';
  if (name.includes('cauliflower')) return '🥦';
  if (name.includes('broccoli')) return '🥦';
  if (name.includes('capsicum') || name.includes('bell pepper')) return '🫑';
  if (name.includes('cucumber')) return '🥒';
  if (name.includes('peas')) return '🫛';
  if (name.includes('mushroom')) return '🍄';

  // ==========================================================
  // LEAVES / HERBS
  // ==========================================================

  if (name.includes('curry leaves')) return '🌿';
  if (name.includes('coriander')) return '🌿';
  if (name.includes('mint')) return '🌿';
  if (name.includes('pudina')) return '🌿';

  // ==========================================================
  // DAIRY / FRIDGE
  // ==========================================================

  if (name.includes('milk')) return '🥛';
  if (name.includes('cheese')) return '🧀';
  if (name.includes('butter')) return '🧈';
  if (name.includes('ghee')) return '🫙';

  if (
    name.includes('curd') ||
    name.includes('yogurt') ||
    name.includes('yoghurt')
  ) {
    return '🥣';
  }

  // ==========================================================
  // EGGS / MEAT
  // ==========================================================

  if (name.includes('egg')) return '🥚';
  if (name.includes('chicken')) return '🍗';
  if (name.includes('fish')) return '🐟';
  if (name.includes('prawn') || name.includes('shrimp')) return '🦐';
  if (name.includes('mutton') || name.includes('meat')) return '🥩';

  // ==========================================================
  // FRUITS
  // ==========================================================

  if (name.includes('apple')) return '🍎';
  if (name.includes('banana')) return '🍌';
  if (name.includes('orange')) return '🍊';
  if (name.includes('mango')) return '🥭';
  if (name.includes('grape')) return '🍇';
  if (name.includes('watermelon')) return '🍉';
  if (name.includes('lemon') || name.includes('lime')) return '🍋';
  if (name.includes('strawberry')) return '🍓';

  // ==========================================================
  // KITCHEN GROCERIES
  // ==========================================================

  if (name.includes('rice')) return '🍚';
  if (name.includes('atta') || name.includes('flour')) return '🌾';
  if (name.includes('wheat')) return '🌾';
  if (name.includes('dal')) return '🫘';
  if (name.includes('lentil')) return '🫘';
  if (name.includes('chana')) return '🫘';
  if (name.includes('beans')) return '🫘';
  if (name.includes('bread')) return '🍞';
  if (name.includes('pasta')) return '🍝';
  if (name.includes('noodles')) return '🍜';

  // ==========================================================
  // OIL / SAUCES
  // ==========================================================

  if (name.includes('oil')) return '🫗';
  if (name.includes('vinegar')) return '🧴';
  if (name.includes('sauce')) return '🥫';
  if (name.includes('ketchup')) return '🍅';

  // ==========================================================
  // SPICES / POWDERS
  // ==========================================================

  if (
    name.includes('turmeric') ||
    name.includes('pasupu') ||
    name.includes('haldi')
  ) {
    return '🟡';
  }

  if (
    name.includes('chilli powder') ||
    name.includes('red chilli powder') ||
    name.includes('mirapakaya powder')
  ) {
    return '🌶️';
  }

  if (
    name.includes('garam masala') ||
    name.includes('masala')
  ) {
    return '🫙';
  }

  if (
    name.includes('coriander powder') ||
    name.includes('dhaniya powder')
  ) {
    return '🌿';
  }

  if (
    name.includes('cumin') ||
    name.includes('jeera')
  ) {
    return '🫘';
  }

  if (
    name.includes('mustard') ||
    name.includes('avalu')
  ) {
    return '🟤';
  }

  if (
    name.includes('pepper') ||
    name.includes('black pepper')
  ) {
    return '⚫';
  }

  // ==========================================================
  // BASIC KITCHEN ITEMS
  // ==========================================================

  if (name.includes('salt')) return '🧂';
  if (name.includes('sugar')) return '🍬';
  if (name.includes('coffee')) return '☕';
  if (name.includes('tea')) return '🍵';
  if (name.includes('water')) return '💧';
  if (name.includes('juice')) return '🧃';

  // ==========================================================
  // DEFAULT
  // ==========================================================

  return '📦';
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