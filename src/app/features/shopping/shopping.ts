import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ShoppingService } from '../../core/services/shopping.service';
import { InventoryService } from '../../core/services/inventory.service';
import { MemberService } from '../../core/services/member.service';
import { GROCERY_CATALOG, GROCERY_CATEGORIES, groceryById, groceryByName, GroceryCatalogItem, GroceryCategory } from '../../core/models/shopping-catalog';
import { ShoppingItem } from '../../core/models/shopping.model';
import { getInventoryFallbackImage } from '../../core/models/inventory-images';

@Component({
  selector: 'app-shopping', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './shopping.html', styleUrl: './shopping.scss'
})
export class Shopping implements OnDestroy {
  readonly shopping = inject(ShoppingService);
  readonly inventory = inject(InventoryService);
  readonly members = inject(MemberService);
  private readonly snack = inject(MatSnackBar);

  readonly catalog = GROCERY_CATALOG;
  readonly categories = GROCERY_CATEGORIES;
  readonly tab = signal<'todo'|'purchased'>('todo');
  readonly search = signal('');
  readonly category = signal<GroceryCategory | 'All'>('All');
  readonly showAdd = signal(false);
  readonly shoppingMode = signal(false);
  readonly shopperId = signal('');
  readonly newQty = signal(1);
  readonly newUnit = signal('pcs');
  readonly selectedGrocery = signal<GroceryCatalogItem | null>(null);
  readonly selectedIds = signal<string[]>([]);
  readonly estimatedPrice = signal<number | null>(null);
  readonly customName = signal('');
  readonly customMode = signal(false);
  readonly saving = signal(false);

  readonly selectedGroceries = computed(() =>
    this.catalog.filter(g => this.selectedIds().includes(g.id) && !this.isInCart(g))
  );

  readonly filteredCatalog = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.category();
    return this.catalog.filter(g => (!q || g.name.toLowerCase().includes(q)) && (cat === 'All' || g.category === cat));
  });

  readonly visibleItems = computed(() => this.tab() === 'todo' ? this.shopping.todoItems() : this.shopping.purchasedItems());
  readonly progress = computed(() => {
    const total = this.shopping.items().length;
    return total ? Math.round(this.shopping.purchasedItems().length / total * 100) : 0;
  });
  readonly pendingCount = computed(() => this.shopping.todoItems().length);
  readonly estimatedTotal = computed(() => this.shopping.todoItems().reduce((n, i) => n + (Number(i.estimatedPrice || 0) * i.quantity), 0));

  selectGrocery(g: GroceryCatalogItem): void {
    if (this.isInCart(g)) {
      this.snack.open(`${g.name} is already on your shopping list.`, undefined, {
        duration: 1500,
      });
      return;
    }

    this.customMode.set(false);
    const ids = this.selectedIds();
    const nextIds = ids.includes(g.id)
      ? ids.filter(id => id !== g.id)
      : [...ids, g.id];

    this.selectedIds.set(nextIds);
    this.selectedGrocery.set(nextIds.length ? g : null);
    this.newUnit.set(g.defaultUnit);
    this.newQty.set(1);
    this.estimatedPrice.set(null);
  }

  isInCart(g: GroceryCatalogItem): boolean {
    return this.shopping.todoItems().some(i => i.groceryId === g.id);
  }

  openCustom(): void {
    this.customMode.set(true);
    this.selectedGrocery.set(null);
    this.newQty.set(1);
    this.newUnit.set('pcs');
    this.estimatedPrice.set(null);
  }

  private resetAddState(): void {
    this.selectedGrocery.set(null);
    this.selectedIds.set([]);
    this.customMode.set(false);
    this.search.set('');
    this.category.set('All');
    this.customName.set('');
    this.newQty.set(1);
    this.newUnit.set('pcs');
    this.estimatedPrice.set(null);
  }

  closeAdd(force = false): void {
    if (this.saving() && !force) return;
    this.showAdd.set(false);
    document.body.classList.remove('shopping-sheet-open');
    document.documentElement.classList.remove('shopping-sheet-open');
    this.resetAddState();
  }

  openAdd(): void {
    this.resetAddState();
    this.showAdd.set(true);
    document.body.classList.add('shopping-sheet-open');
    document.documentElement.classList.add('shopping-sheet-open');
  }

  isSelected(g: GroceryCatalogItem): boolean {
    return this.selectedIds().includes(g.id);
  }

  async addSelected(): Promise<void> {
    if (this.saving()) return;

    if (this.customMode()) {
      const name = this.customName().trim();
      if (!name || this.newQty() <= 0) return;
      this.saving.set(true);
      try {
        const catalogItem = groceryByName(name);
        const added = await this.shopping.addIfMissing({
          name,
          groceryId: catalogItem.id,
          quantity: Math.max(1, Number(this.newQty())),
          unit: this.newUnit() || catalogItem.defaultUnit,
          estimatedPrice: this.estimatedPrice() ?? undefined,
        });

        this.snack.open(
          added ? `${name} added to your shopping list.` : `${name} is already on your shopping list.`,
          undefined,
          { duration: 1700, panelClass: added ? 'rm-snack-success' : undefined }
        );
        this.closeAdd(true);
      } catch (error) {
        console.error('Unable to add custom shopping item', error);
        this.snack.open('Could not add the item. Please try again.', 'OK', { duration: 2400 });
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const selected = this.selectedGroceries();
    if (!selected.length) {
      this.resetAddState();
      this.snack.open('All selected items are already on your shopping list.', undefined, { duration: 1800 });
      return;
    }

    this.saving.set(true);
    try {
      const existingIds = new Set(this.shopping.todoItems().map(i => i.groceryId));
      let added = 0;
      let skipped = 0;

      for (const g of selected) {
        if (existingIds.has(g.id)) {
          skipped++;
          continue;
        }
        await this.shopping.addIfMissing({
          name: g.name,
          groceryId: g.id,
          quantity: 1,
          unit: g.defaultUnit,
        });
        existingIds.add(g.id);
        added++;
      }

      if (added) {
        this.snack.open(
          `${added} item${added > 1 ? 's' : ''} added${skipped ? ` · ${skipped} already on your list` : ''}.`,
          undefined,
          { duration: 1900, panelClass: 'rm-snack-success' }
        );
      } else {
        this.snack.open('All selected items are already on your shopping list.', undefined, { duration: 1900 });
      }
      this.closeAdd(true);
    } catch (error) {
      console.error('Unable to add shopping items', error);
      this.snack.open('Some items could not be added. Please try again.', 'OK', { duration: 2400 });
    } finally {
      this.saving.set(false);
    }
  }

  async addLowStock(): Promise<void> {
    if (this.saving()) return;
    const low = this.inventory.items().filter(i => i.status === 'low' || i.status === 'out');
    const existingIds = new Set(this.shopping.todoItems().map(i => i.groceryId));
    const missing = low.filter(item => {
      const g = groceryByName(item.name);
      return !existingIds.has(g.id);
    });

    if (!missing.length) {
      this.snack.open(
        low.length ? 'All low-stock items are already on your shopping list.' : 'No low-stock items right now.',
        undefined,
        { duration: 1900 }
      );
      return;
    }

    this.saving.set(true);
    try {
      let added = 0;
      for (const item of missing) {
        const g = groceryByName(item.name);
        const addedNow = await this.shopping.addIfMissing({
          name: item.name,
          groceryId: g.id,
          quantity: 1,
          unit: item.unit ?? g.defaultUnit,
        });
        if (addedNow) added++;
        existingIds.add(g.id);
      }
      this.snack.open(
        `${added} missing low-stock item${added > 1 ? 's' : ''} added.`,
        undefined,
        { duration: 1800, panelClass: 'rm-snack-success' }
      );
    } catch (error) {
      console.error(error);
      this.snack.open('Some low-stock items could not be added.', 'OK', { duration: 2200 });
    } finally {
      this.saving.set(false);
    }
  }

  async changeQty(item: ShoppingItem, delta: number): Promise<void> {
    const next = Math.max(1, item.quantity + delta);
    await this.shopping.update(item.id, { quantity: next });
  }

  async purchase(item: ShoppingItem): Promise<void> {
    const selected = this.members.members().find(m => m.id === this.shopperId());
    try {
      await this.shopping.purchase(item, undefined, selected ? { uid: selected.uid, name: selected.name } : undefined);
      this.snack.open(`${item.name} marked as purchased.`, undefined, { duration: 1300, panelClass: 'rm-snack-success' });
    } catch (error) {
      console.error(error);
      this.snack.open('Could not mark the item as purchased.', 'OK', { duration: 2200 });
    }
  }

  async addToInventory(item: ShoppingItem): Promise<void> {
    const match = this.inventory.items().find(i => i.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    try {
      if (match) await this.inventory.restockItem(match, item.quantity, item.unit as any);
      else {
        const category = groceryById(item.groceryId)?.category === 'Dairy' ? 'fridge' : 'kitchen';
        await this.inventory.addItem({ name: item.name, category, status: 'available', quantity: item.quantity, unit: item.unit as any });
      }
      // Once the purchased item has been successfully restocked/created in Inventory,
      // remove it from Shopping so the Purchased list only contains purchases that
      // still need household follow-up.
      await this.shopping.remove(item.id);
      this.snack.open(`${item.name} added to Inventory and cleared from Purchased.`, undefined, {
        duration: 2000,
        panelClass: 'rm-snack-success'
      });
    } catch (e) {
      console.error(e);
      this.snack.open('Could not update Inventory.', undefined, { duration: 2200 });
    }
  }

  async undo(item: ShoppingItem): Promise<void> { await this.shopping.undoPurchase(item); }
  async remove(item: ShoppingItem): Promise<void> { await this.shopping.remove(item.id); }
  image(item: ShoppingItem): string { return groceryById(item.groceryId)?.image ?? groceryByName(item.name).image; }
  memberName(): string { return this.members.currentMember()?.name ?? 'You'; }
  async startShopping(): Promise<void> { this.shoppingMode.set(true); }
  customImage(): string { return getInventoryFallbackImage('kitchen'); }

  ngOnDestroy(): void {
    document.body.classList.remove('shopping-sheet-open');
    document.documentElement.classList.remove('shopping-sheet-open');
  }
}
