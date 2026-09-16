export type ShoppingStatus = 'todo' | 'purchased';

export interface ShoppingItem {
  id: string;
  name: string;
  groceryId: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  actualPrice?: number;
  status: ShoppingStatus;
  addedByUid?: string;
  addedByName?: string;
  purchasedByUid?: string;
  purchasedByName?: string;
  purchasedAt?: number;
  addedToInventory?: boolean;
  createdAt: number;
  updatedAt: number;
}
