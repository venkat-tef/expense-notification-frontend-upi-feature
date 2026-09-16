import { InventoryCategory } from './inventory.model';
import { FRIDGE_ITEM_GROUPS, KITCHEN_ITEM_GROUPS } from './inventory-catalog';
import { getInventoryFallbackImage, getInventoryItemImage } from './inventory-images';

export type GroceryCategory = 'Dairy' | 'Vegetables' | 'Fruits' | 'Staples' | 'Spices' | 'Other';

export interface GroceryCatalogItem {
  id: string;
  name: string;
  category: GroceryCategory;
  image: string;
  defaultUnit: string;
}

const idFor = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function unitFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('leaves') || n.includes('coriander') || n.includes('mint') || n.includes('methi')) return 'bunch';
  if (n.includes('egg')) return 'pcs';
  if (n.includes('oil') || n === 'milk' || n === 'water' || n.includes('juice')) return 'l';
  if (n.includes('bread') || n.includes('noodle') || n.includes('pasta') || n.includes('tea') || n.includes('coffee')) return 'pack';
  if (n.includes('spice') || n.includes('powder') || n.includes('masala') || n.includes('salt') || n.includes('sugar') || n.includes('tamarind')) return 'pack';
  if (n.includes('fruit') || ['lemon', 'apple', 'banana', 'orange', 'mango', 'grapes', 'watermelon', 'papaya', 'pineapple', 'pomegranate', 'strawberry', 'coconut'].some(x => n.includes(x))) return 'pcs';
  return 'kg';
}

function categoryFor(name: string, source: InventoryCategory): GroceryCategory {
  const n = name.toLowerCase();
  if (['milk', 'curd', 'yogurt', 'butter', 'cheese', 'paneer', 'cream', 'egg', 'chicken', 'fish', 'juice', 'water', 'ketchup', 'mayonnaise', 'sauce'].some(x => n.includes(x))) return 'Dairy';
  if (['apple', 'banana', 'orange', 'mango', 'grape', 'watermelon', 'papaya', 'pineapple', 'pomegranate', 'strawberry'].some(x => n.includes(x))) return 'Fruits';
  if (['rice', 'wheat', 'atta', 'maida', 'rava', 'sooji', 'besan', 'poha', 'oats', 'dal', 'pappu', 'rajma', 'chickpea', 'chana', 'noodle', 'pasta', 'flour', 'bread'].some(x => n.includes(x))) return 'Staples';
  if (['salt', 'sugar', 'turmeric', 'chilli powder', 'coriander powder', 'cumin', 'jeera', 'mustard', 'pepper', 'masala', 'sambar', 'rasam', 'hing', 'cinnamon', 'clove', 'cardamom', 'bay leaf', 'fenugreek', 'ajwain', 'seed'].some(x => n.includes(x))) return 'Spices';
  if (source === 'kitchen') return 'Staples';
  return 'Vegetables';
}

const inventoryEntries = [
  ...FRIDGE_ITEM_GROUPS.flatMap(g => g.items.map(name => ({ name, source: 'fridge' as InventoryCategory }))),
  ...KITCHEN_ITEM_GROUPS.flatMap(g => g.items.map(name => ({ name, source: 'kitchen' as InventoryCategory }))),
];

const EXTRA = [
  'Milk', 'Curd', 'Yogurt', 'Butter', 'Cheese', 'Paneer', 'Eggs', 'Bread', 'Cooking Oil', 'Sunflower Oil',
  'Groundnut Oil', 'Olive Oil', 'Toor Dal', 'Moong Dal', 'Masoor Dal', 'Chana Dal', 'Urad Dal', 'Rajma',
  'Chickpeas', 'Basmati Rice', 'Brown Rice', 'Oats', 'Poha', 'Rava / Sooji', 'Besan', 'Tomato', 'Onion',
  'Potato', 'Carrot', 'Capsicum', 'Green Chilli', 'Ginger', 'Garlic', 'Coriander Leaves', 'Curry Leaves',
  'Mint Leaves', 'Lemon', 'Cucumber', 'Mushroom', 'Beetroot', 'Drumstick', 'Bottle Gourd', 'Ridge Gourd',
  'Bitter Gourd', 'Snake Gourd', 'Pumpkin', 'Sweet Potato', 'Yam', 'Tamarind', 'Jaggery', 'Honey', 'Tea', 'Coffee'
].map(name => ({ name, source: 'kitchen' as InventoryCategory }));

const allEntries = [...inventoryEntries, ...EXTRA];
const seen = new Set<string>();

export const GROCERY_CATALOG: GroceryCatalogItem[] = allEntries
  .filter(({ name }) => {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .map(({ name, source }) => ({
    id: idFor(name),
    name,
    category: categoryFor(name, source),
    image: getInventoryItemImage(name, source),
    defaultUnit: unitFor(name),
  }));

export const GROCERY_CATEGORIES: Array<GroceryCategory | 'All'> = ['All', 'Vegetables', 'Fruits', 'Dairy', 'Staples', 'Spices', 'Other'];

export function groceryById(id: string): GroceryCatalogItem | undefined {
  return GROCERY_CATALOG.find(g => g.id === id);
}

export function groceryByName(name: string): GroceryCatalogItem {
  const normalized = name.trim().toLowerCase();
  return GROCERY_CATALOG.find(g => g.name.toLowerCase() === normalized)
    ?? GROCERY_CATALOG.find(g => normalized.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(normalized))
    ?? {
      id: idFor(name),
      name: name.trim(),
      category: 'Other',
      image: getInventoryFallbackImage('kitchen'),
      defaultUnit: 'pcs'
    };
}
