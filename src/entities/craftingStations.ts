/**
 * craftingStations.ts — Crafting station, refiner, and trader entities
 *
 * All entities now use InteractiveComposite + createInteractiveEntity().
 *
 *   setupSmelter()   — RefinerBehavior (ore + coal → bar), Refine tab
 *   setupWorkbench() — CrafterBehavior (recipe list), Craft tab
 *   setupTrader()    — SellerBehavior (seeds) + BuyerBehavior (wheat), Buy/Sell tabs
 *   setupFishingShop() — SellerBehavior (rods/bait) + BuyerBehavior (fish), Buy/Sell tabs
 *
 * All behavior logic (canCraft, craft, refine, buy, sell) lives in the behavior
 * classes. The popup is handled by InteractivePopupModule. No manual recipe
 * validation or crafting callbacks here.
 */

import { Vector3, Color4 } from '@dcl/sdk/math'
import {
  CrafterBehavior,
  RefinerBehavior,
  SellerBehavior,
  BuyerBehavior,
} from '../dn-framework/npcs/npcBehaviors'
import { createInteractiveEntity } from '../dn-framework/npcs/npcComposite'
import { WORKBENCH_RECIPES } from '../data/recipeData'
import { GameManager } from '../gameMgr'

// ─── Smelter — RefinerBehavior ────────────────────────────────────────────────

export function setupSmelter(gameMgr: GameManager): void {
  const refiner = new RefinerBehavior('Smelter', [
    {
      id:             'iron_bar',
      name:           'Smelt Iron Bar',
      inputItemId:    'iron_ore',
      inputName:      'Iron Ore',
      inputQuantity:  2,
      fuelItemId:     'coal',
      fuelName:       'Coal',
      fuelQuantity:   1,
      outputItemId:   'iron_bar',
      outputName:     'Iron Bar',
      outputQuantity: 1,
    },
  ])

  createInteractiveEntity({
    pos:       Vector3.create(60, 1.5, 82),
    scale:     Vector3.create(2.8, 3.0, 2.8),
    color:     Color4.create(0.82, 0.28, 0.06, 1),
    label:     'SMELTER\n[E]',
    hoverText: 'Open Smelter',
    entity:    { displayName: 'Smelter', refiner },
    gameMgr,
  })
}

// ─── Workbench — CrafterBehavior ──────────────────────────────────────────────

export function setupWorkbench(gameMgr: GameManager): void {
  const crafter = new CrafterBehavior('Workbench', WORKBENCH_RECIPES)

  createInteractiveEntity({
    pos:       Vector3.create(100, 1.5, 82),
    scale:     Vector3.create(3.2, 2.2, 2.0),
    color:     Color4.create(0.50, 0.32, 0.14, 1),
    label:     'WORKBENCH\n[E]',
    hoverText: 'Open Workbench',
    entity:    { displayName: 'Workbench', crafter },
    gameMgr,
  })
}

// Backward-compat alias (gameMgr used to call setupCraftingStations)
export function setupCraftingStations(gameMgr: GameManager): void {
  setupSmelter(gameMgr)
  setupWorkbench(gameMgr)
}

// ─── Trader — SellerBehavior + BuyerBehavior ──────────────────────────────────

export function setupTrader(gameMgr: GameManager): void {
  const seller = new SellerBehavior([
    {
      id:          'wheat_seeds',
      name:        'Wheat Seeds',
      cost:        5,
      quantity:    1,
      description: 'Plant in a farm plot.',
    },
  ])

  const buyer = new BuyerBehavior(
    ['wheat'],
    (itemId) => itemId === 'wheat' ? 3 : 0
  )

  createInteractiveEntity({
    pos:       Vector3.create(100, 1.5, 147),
    scale:     Vector3.create(2.5, 3.2, 2.0),
    color:     Color4.create(0.42, 0.18, 0.72, 1),
    label:     'TRADER\n[E]',
    hoverText: 'Open Trader',
    entity:    { displayName: 'Trader', seller, buyer },
    gameMgr,
  })
}

// ─── Fishing Shop — SellerBehavior + BuyerBehavior ────────────────────────────

export function setupFishingShop(gameMgr: GameManager): void {
  const seller = new SellerBehavior([
    { id: 'rod_t1',     name: 'Basic Rod',     cost: 20,  quantity: 1, description: '15s cast time' },
    { id: 'rod_t2',     name: 'Good Rod',       cost: 60,  quantity: 1, description: '10s cast time' },
    { id: 'rod_t3',     name: "Master's Rod",   cost: 150, quantity: 1, description: '6s cast time'  },
    { id: 'bait_basic', name: 'Basic Bait',     cost: 12,  quantity: 3, description: 'Worms are free from the soil patches!' },
  ])

  const fishPrices: Record<string, number> = { perch: 3, bass: 8, trout: 6 }
  const buyer = new BuyerBehavior(
    ['perch', 'bass', 'trout'],
    (itemId) => fishPrices[itemId] ?? 0,
    'gold',
    // Quest phase 2 → 3 when a fish is sold
    (itemId) => {
      if (['perch', 'bass', 'trout'].includes(itemId) && gameMgr.questMgr) {
        if (gameMgr.questMgr.isActive('fishing_basic') && gameMgr.questMgr.getPhase('fishing_basic') === 1) {
          gameMgr.questMgr.advancePhase('fishing_basic')
          gameMgr.popupMgr.showFloat('Quest update: Return to the Mission Board!', Color4.create(1, 0.85, 0.2, 1), 3500)
        }
      }
    }
  )

  createInteractiveEntity({
    pos:       Vector3.create(28, 1.5, 120),
    scale:     Vector3.create(2.2, 3.0, 2.2),
    color:     Color4.create(0.16, 0.52, 0.70, 1),
    label:     'FISHMONGER\n[E]',
    hoverText: 'Open Fishmonger',
    entity:    { displayName: 'Fishmonger', seller, buyer },
    gameMgr,
  })
}
