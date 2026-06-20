/**
 * itemData.ts — Item registry for dcl_popupInteractiveA
 *
 * Defines display properties for every item in the scene.
 * Used by crafting UI and inventory panel for consistent names/colors.
 *
 * Add new items here as the game loop expands.
 */

export interface ItemDef {
  itemId: string
  name: string
  description: string
  color: { r: number, g: number, b: number }  // for UI tinting (future icon placeholder)
}

export const ITEM_DATA: Record<string, ItemDef> = {
  // ── Raw Resources ──────────────────────────────────────────────────────────
  iron_ore: {
    itemId: 'iron_ore',
    name: 'Iron Ore',
    description: 'Raw ore from the earth. Smelt it into bars.',
    color: { r: 0.7, g: 0.42, b: 0.28 },
  },
  coal: {
    itemId: 'coal',
    name: 'Coal',
    description: 'Burns hot. Required for smelting.',
    color: { r: 0.22, g: 0.22, b: 0.25 },
  },
  wood: {
    itemId: 'wood',
    name: 'Wood',
    description: 'Rough timber. Useful for many crafts.',
    color: { r: 0.55, g: 0.36, b: 0.16 },
  },
  stone: {
    itemId: 'stone',
    name: 'Stone',
    description: 'Dense and sturdy. Good for armor.',
    color: { r: 0.6, g: 0.6, b: 0.65 },
  },
  gold: {
    itemId: 'gold',
    name: 'Gold',
    description: 'Currency of the realm.',
    color: { r: 1, g: 0.85, b: 0.1 },
  },
  rope: {
    itemId: 'rope',
    name: 'Rope',
    description: 'Twisted wood fibers. Surprisingly versatile.',
    color: { r: 0.72, g: 0.58, b: 0.38 },
  },

  // ── Refined Materials ──────────────────────────────────────────────────────
  iron_bar: {
    itemId: 'iron_bar',
    name: 'Iron Bar',
    description: 'Smelted iron, ready for forging.',
    color: { r: 0.55, g: 0.58, b: 0.65 },
  },

  // ── Crafted Items ──────────────────────────────────────────────────────────
  iron_sword: {
    itemId: 'iron_sword',
    name: 'Iron Sword',
    description: '+25 Attack. Forged at the Workbench.',
    color: { r: 0.7, g: 0.75, b: 0.85 },
  },
  shield: {
    itemId: 'shield',
    name: 'Shield',
    description: '+50 Defense. Forged at the Workbench.',
    color: { r: 0.5, g: 0.55, b: 0.7 },
  },

  // ── Chest / Loot items ─────────────────────────────────────────────────────
  heal_potion: {
    itemId: 'heal_potion',
    name: 'Healing Potion',
    description: 'Restores 50 HP.',
    color: { r: 0.3, g: 0.85, b: 0.35 },
  },
  enchanted_sword: {
    itemId: 'enchanted_sword',
    name: 'Enchanted Sword',
    description: '+25 Attack. Glows in darkness.',
    color: { r: 0.4, g: 0.7, b: 1 },
  },
  shield_of_fortitude: {
    itemId: 'shield_of_fortitude',
    name: 'Shield of Fortitude',
    description: '+50 Defense. Never bends.',
    color: { r: 0.4, g: 0.6, b: 0.9 },
  },

  // ── Farming ───────────────────────────────────────────────────────────────
  wheat_seeds: {
    itemId: 'wheat_seeds',
    name: 'Wheat Seeds',
    description: 'Plant in a farm plot. Grows into Wheat in ~30 seconds.',
    color: { r: 0.75, g: 0.82, b: 0.30 },
  },
  wheat: {
    itemId: 'wheat',
    name: 'Wheat',
    description: 'Harvested crop. Sell to the Trader for Gold.',
    color: { r: 0.92, g: 0.82, b: 0.22 },
  },

  // ── Fishing — Bait & Tackle ───────────────────────────────────────────────
  worm: {
    itemId: 'worm',
    name: 'Worm',
    description: 'Dug from the soil patch west of the ore vein. Works as bait.',
    color: { r: 0.55, g: 0.35, b: 0.20 },
  },
  bait_basic: {
    itemId: 'bait_basic',
    name: 'Basic Bait',
    description: 'Bought from the Fishmonger. Slightly better odds than worms.',
    color: { r: 0.75, g: 0.60, b: 0.30 },
  },
  rod_t1: {
    itemId: 'rod_t1',
    name: 'Basic Rod',
    description: 'A simple fishing rod. 15s cast time.',
    color: { r: 0.45, g: 0.28, b: 0.10 },
  },
  rod_t2: {
    itemId: 'rod_t2',
    name: 'Good Rod',
    description: 'Faster and better catches. 10s cast time.',
    color: { r: 0.35, g: 0.55, b: 0.75 },
  },
  rod_t3: {
    itemId: 'rod_t3',
    name: "Master's Rod",
    description: 'The best rod available. 6s cast, heavy catches.',
    color: { r: 0.80, g: 0.60, b: 0.10 },
  },

  // ── Fishing — Fish ────────────────────────────────────────────────────────
  perch: {
    itemId: 'perch',
    name: 'Perch',
    description: 'A small but common catch. Sells for 3g.',
    color: { r: 0.55, g: 0.78, b: 0.42 },
  },
  bass: {
    itemId: 'bass',
    name: 'Bass',
    description: 'A sturdy mid-size fish. Sells for 8g.',
    color: { r: 0.28, g: 0.58, b: 0.82 },
  },
  trout: {
    itemId: 'trout',
    name: 'Trout',
    description: 'A fine catch. Sells for 6g.',
    color: { r: 0.85, g: 0.42, b: 0.22 },
  },
}

/** Helper: get display name for an itemId (fallback to itemId if not found). */
export function getItemName(itemId: string): string {
  return ITEM_DATA[itemId]?.name ?? itemId
}
