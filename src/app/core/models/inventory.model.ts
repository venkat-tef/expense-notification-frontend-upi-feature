/**
 * PHASE 1 — Fridge + Kitchen Inventory.
 * Mirrors the shape/conventions of expense.model.ts (const arrays + icon/label
 * maps, plain interface with createdAt/updatedAt as millis).
 */

export const INVENTORY_CATEGORIES = ['fridge', 'kitchen'] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  fridge: 'Fridge',
  kitchen: 'Kitchen',
};

export const INVENTORY_CATEGORY_ICON: Record<InventoryCategory, string> = {
  fridge: 'kitchen',
  kitchen: 'soup_kitchen',
};

export const INVENTORY_STATUSES = ['available', 'low', 'out'] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  available: 'Available',
  low: 'Low',
  out: 'Out',
};

export const INVENTORY_STATUS_ICON: Record<InventoryStatus, string> = {
  available: 'check_circle',
  low: 'error', // filled triangle-ish warning glyph used elsewhere in Material icon set
  out: 'cancel',
};

/**
 * Optional unit list — kept small and generic on purpose ("Do not overcomplicate
 * the data model"). Free-text quantity + this unit dropdown covers every example
 * in the spec (1 litre, 500 ml, 100g) without a rigid schema.
 */
export const INVENTORY_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'pack', 'other'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;

  /** Both optional — some users just want Available/Low/Out with no quantity tracking. */
  quantity?: number;
  unit?: InventoryUnit;

  /** Optional, YYYY-MM-DD — only meaningful for perishables. */
  expiryDate?: string;

  createdAt: number;
  updatedAt: number;

  /** Who last touched this item — same optional/best-effort pattern as
   *  Expense's createdByUid/updatedByUid; safe to be undefined on any item. */
  updatedByUid?: string;
  updatedByName?: string;
}
