/**
 * recipeData.ts — Recipe definitions for dcl_popupInteractiveA
 *
 * Recipe loop:
 *   Gather -> Iron Ore, Coal, Wood, Stone (resource nodes in the world)
 *   Smelt  -> Iron Bar (Smelter: Iron Ore x2 + Coal x1)
 *   Craft  -> Rope, Iron Sword, Shield (Workbench)
 *   Farm   -> Plant Wheat Seeds -> Harvest Wheat (Farm Plots at Z~138-152)
 *   Trade  -> Buy Wheat Seeds for Gold / Sell Wheat for Gold (Trader at Z~147)
 *
 * Import Recipe type from dn-framework/ui/popupManager.
 * Add new recipe arrays here as new stations are added.
 */

import { Recipe } from '../dn-framework/ui/popupManager'

// ── Smelter ────────────────────────────────────────────────────────────────────
// Converts raw ore into refined bars using coal as fuel.

export const SMELTER_RECIPES: Recipe[] = [
  {
    id: 'iron_bar',
    name: 'Iron Bar',
    category: 'Materials',
    ingredients: [
      { itemId: 'iron_ore', name: 'Iron Ore', quantity: 2 },
      { itemId: 'coal',     name: 'Coal',     quantity: 1 },
    ],
    output: { itemId: 'iron_bar', name: 'Iron Bar', quantity: 1 },
  },
]

// ── Workbench ──────────────────────────────────────────────────────────────────
// Crafts tools, weapons, and utility items from refined materials.

export const WORKBENCH_RECIPES: Recipe[] = [
  {
    id: 'rope',
    name: 'Rope',
    category: 'Materials',
    ingredients: [
      { itemId: 'wood', name: 'Wood', quantity: 3 },
    ],
    output: { itemId: 'rope', name: 'Rope', quantity: 1 },
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: 'Weapons',
    ingredients: [
      { itemId: 'iron_bar', name: 'Iron Bar', quantity: 1 },
      { itemId: 'wood',     name: 'Wood',     quantity: 1 },
    ],
    output: { itemId: 'iron_sword', name: 'Iron Sword', quantity: 1 },
  },
  {
    id: 'shield',
    name: 'Shield',
    category: 'Weapons',
    ingredients: [
      { itemId: 'iron_bar', name: 'Iron Bar', quantity: 1 },
      { itemId: 'stone',    name: 'Stone',    quantity: 2 },
    ],
    output: { itemId: 'shield', name: 'Shield', quantity: 1 },
  },
]

// ── Trader ─────────────────────────────────────────────────────────────────────
// Buy seeds with Gold / Sell Wheat for Gold.
// Displayed in the crafting popup with label "TRADE".

export const TRADER_RECIPES: Recipe[] = [
  {
    id: 'buy_wheat_seeds',
    name: 'Wheat Seeds x3',
    category: 'Buy',
    ingredients: [{ itemId: 'gold', name: 'Gold', quantity: 15 }],
    output: { itemId: 'wheat_seeds', name: 'Wheat Seeds', quantity: 3 },
  },
  {
    id: 'sell_wheat',
    name: 'Sell Wheat x3',
    category: 'Sell',
    ingredients: [{ itemId: 'wheat', name: 'Wheat', quantity: 3 }],
    output: { itemId: 'gold', name: 'Gold', quantity: 10 },
  },
]

// ── Fishmonger ─────────────────────────────────────────────────────────────────
// Buy fishing gear with Gold / Sell fish for Gold.
// Uses the CraftingPopup with label "TRADE" (same pattern as Trader).
// Worms are gathered free from soil patches — not sold here.

export const FISHMONGER_RECIPES: Recipe[] = [
  // ── Buy: Rods ──────────────────────────────────────────────────────────────
  {
    id: 'buy_rod_t1',
    name: 'Basic Rod',
    category: 'Buy',
    ingredients: [{ itemId: 'gold', name: 'Gold', quantity: 20 }],
    output: { itemId: 'rod_t1', name: 'Basic Rod', quantity: 1 },
  },
  {
    id: 'buy_rod_t2',
    name: 'Good Rod',
    category: 'Buy',
    ingredients: [{ itemId: 'gold', name: 'Gold', quantity: 60 }],
    output: { itemId: 'rod_t2', name: 'Good Rod', quantity: 1 },
  },
  {
    id: 'buy_rod_t3',
    name: "Master's Rod",
    category: 'Buy',
    ingredients: [{ itemId: 'gold', name: 'Gold', quantity: 150 }],
    output: { itemId: 'rod_t3', name: "Master's Rod", quantity: 1 },
  },
  // ── Buy: Bait ──────────────────────────────────────────────────────────────
  {
    id: 'buy_bait',
    name: 'Basic Bait x3',
    category: 'Buy',
    ingredients: [{ itemId: 'gold', name: 'Gold', quantity: 12 }],
    output: { itemId: 'bait_basic', name: 'Basic Bait', quantity: 3 },
  },
  // ── Sell: Fish ─────────────────────────────────────────────────────────────
  {
    id: 'sell_perch',
    name: 'Sell Perch',
    category: 'Sell',
    ingredients: [{ itemId: 'perch', name: 'Perch', quantity: 1 }],
    output: { itemId: 'gold', name: 'Gold', quantity: 3 },
  },
  {
    id: 'sell_bass',
    name: 'Sell Bass',
    category: 'Sell',
    ingredients: [{ itemId: 'bass', name: 'Bass', quantity: 1 }],
    output: { itemId: 'gold', name: 'Gold', quantity: 8 },
  },
  {
    id: 'sell_trout',
    name: 'Sell Trout',
    category: 'Sell',
    ingredients: [{ itemId: 'trout', name: 'Trout', quantity: 1 }],
    output: { itemId: 'gold', name: 'Gold', quantity: 6 },
  },
]
