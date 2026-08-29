/**
 * Predefined Fridge + Kitchen item catalog.
 *
 * Mirrors the const-array convention in inventory.model.ts. Grouped by
 * subcategory purely for the autocomplete dropdown (mat-optgroup headers) —
 * the Item Name field stays free text, this is just suggestions.
 *
 * EXTENDED: added dedicated Indian / South-Indian / Telugu vegetables,
 * leafy greens, beans, root vegetables, and chilli/capsicum color variants
 * so each has its own suggestion AND its own real photo (see
 * inventory-images.ts). Every ORIGINAL entry is kept exactly as-is — new
 * items are appended as new groups or new entries within existing groups,
 * nothing was removed or renamed. Names are written "English (Telugu)"
 * where a common Telugu name exists, so the dropdown search also matches
 * the Telugu word (e.g. typing "vankaya" finds "Brinjal (Vankaya)").
 */

import { InventoryCategory } from './inventory.model';

export interface InventoryCatalogGroup {
  label: string;
  items: string[];
}

// ==============================================================
// FRIDGE
// ==============================================================

export const FRIDGE_ITEM_GROUPS: InventoryCatalogGroup[] = [
  {
    label: 'Vegetables',
    items: [
      // --- ORIGINAL (unchanged) ---
      'Tomato', 'Onion', 'Potato', 'Carrot', 'Capsicum', 'Green Chilli',
      'Curry Leaves', 'Coriander Leaves', 'Spinach', 'Cabbage',
      'Cauliflower', 'Broccoli', 'Brinjal / Eggplant', 'Okra / Lady Finger',
      'Cucumber', 'Beetroot', 'Beans', 'Green Peas', 'Sweet Corn',
      'Garlic', 'Ginger', 'Lemon', 'Mushroom', 'drumstic',

      // --- ADDED: more vegetables ---
      'Spring Onion', 'Radish (Mullangi)', 'Turnip',
    ],
  },
  {
    label: 'Leafy Greens',
    items: [
      'Curry Leaves (Karivepaku)', 'Coriander Leaves (Kothimeera)',
      'Mint Leaves (Pudina)', 'Spinach / Palak',
      'Amaranth Leaves (Thotakura)', 'Gongura', 'Drumstick Leaves (Munagaaku)',
      'Fenugreek Leaves (Methi / Menthi Kura)',
    ],
  },
  {
    label: 'Gourds & Regional Vegetables',
    items: [
      'Drumstick (Munagakaya)', 'Ivy Gourd (Dondakaya)', 'Bottle Gourd (Sorakaya)',
      'Ridge Gourd (Beerakaya)', 'Bitter Gourd (Kakarakaya)',
      'Snake Gourd (Potlakaya)', 'Ash Gourd', 'Pumpkin (Gummadikaya)',
    ],
  },
  {
    label: 'Beans & Peas',
    items: [
      'Green Beans / French Beans', 'Cluster Beans (Goru Chikkudukaya)',
      'Broad Beans (Chikkudukaya / Averakaya)', 'Peas',
    ],
  },
  {
    label: 'Root Vegetables',
    items: [
      'Sweet Potato (Chilagadda)', 'Yam (Kandagadda)', 'Taro Root (Chamagadda)',
    ],
  },
  {
    label: 'Chillies & Peppers',
    items: [
      'Green Chilli (Pachi Mirchi)', 'Red Chilli (Erra Mirchi)',
      'Red Chilli, Dried', 'Capsicum, Green', 'Capsicum, Red', 'Capsicum, Yellow',
    ],
  },
  {
    label: 'Fruits',
    items: [
      // --- ORIGINAL (unchanged) ---
      'Apple', 'Banana', 'Orange', 'Mango', 'Grapes', 'Watermelon',
      'Papaya', 'Pineapple', 'Pomegranate', 'Strawberry',

      // --- ADDED ---
      'Raw Banana / Plantain (Aritikaya)', 'Raw Papaya (Boppayi)',
    ],
  },
  {
    label: 'Dairy',
    items: [
      'Milk', 'Curd', 'Yogurt', 'Butter', 'Cheese', 'Paneer', 'Cream',
    ],
  },
  {
    label: 'Other Fridge Items',
    items: [
      'Eggs', 'Chicken', 'Fish', 'Coconut', 'Juice', 'Water', 'Ketchup',
      'Mayonnaise', 'Sauces',
    ],
  },
];

// ==============================================================
// KITCHEN / PANTRY
// ==============================================================

export const KITCHEN_ITEM_GROUPS: InventoryCatalogGroup[] = [
  {
    label: 'Rice & Grains',
    items: [
      'Rice', 'Basmati Rice', 'Brown Rice', 'Wheat', 'Atta', 'Maida',
      'Rava / Sooji', 'Besan', 'Poha', 'Oats',
    ],
  },
  {
    label: 'Dals & Pulses',
    items: [
      'Kandi Pappu / Toor Dal', 'Moong Dal', 'Masoor Dal', 'Chana Dal',
      'Urad Dal', 'Rajma', 'Chickpeas', 'Black Chana','whitedal (minapappu)',
      // ADDED: had no catalog entry despite being matched in inventory-images.ts
      'Green Gram (Pesalu)',
    ],
  },
  {
    label: 'Spices & Powders',
    items: [
      'Salt', 'Sugar', 'Turmeric Powder', 'Red Chilli Powder',
      'Coriander Powder', 'Jeera / Cumin', 'Jeera Powder', 'Mustard Seeds',
      'Black Pepper', 'Garam Masala', 'Curry Powder', 'Sambar Powder',
      'Rasam Powder', 'Hing / Asafoetida', 'Cinnamon', 'Cloves',
      'Cardamom', 'Bay Leaves', 'Fenugreek Seeds', 'Ajwain',
      // ADDED: seed spices already matched in inventory-images.ts but missing here
      'Coriander Seeds (Dhaniyaalu)', 'Fennel Seeds (Sopu)',
      'Poppy Seeds (Gasagasalu)', 'Sesame Seeds (Nuvvulu)', 'mustard (awaalu)', 'cumin (jilakara)',
    ],
  },
  {
    label: 'Cooking Essentials',
    items: [
      'Cooking Oil', 'Sunflower Oil', 'Groundnut Oil', 'Coconut Oil',
      'Olive Oil', 'Ghee', 'Vinegar',
    ],
  },
  {
    label: 'Other Pantry Items',
    items: [
      'Tamarind', 'Jaggery', 'Honey', 'Tea', 'Coffee', 'Noodles', 'Pasta',
      'Corn Flour', 'Baking Powder', 'Baking Soda',
    ],
  },
];

// ==============================================================
// LOOKUP BY CATEGORY
// ==============================================================

export const INVENTORY_CATALOG_GROUPS: Record<InventoryCategory, InventoryCatalogGroup[]> = {
  fridge: FRIDGE_ITEM_GROUPS,
  kitchen: KITCHEN_ITEM_GROUPS,
};