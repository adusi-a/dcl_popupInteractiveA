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
