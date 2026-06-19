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
}

/** Helper: get display name for an itemId (fallback to itemId if not found). */
export function getItemName(itemId: string): string {
  return ITEM_DATA[itemId]?.name ?? itemId
}
