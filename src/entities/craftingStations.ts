/**
 * craftingStations.ts — Crafting station entities
 *
 * Two stations at Z=82, flanking the path from resources (Z~45) to chests (Z=100):
 *   Smelter   (hot orange-red, X=60) — converts ore + coal -> iron bars
 *   Workbench (wood brown,     X=100) — crafts tools + weapons from materials
 *
 * Plus a Trader at Z~147 (purple, X=100) — buy/sell with TRADE button label.
 *
 * Each station opens the CraftingPopupModule with its own recipe list.
 * The onCraftItem callback handles: ingredient check -> consume -> add output -> float -> close.
 */

import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  Billboard,
  TextShape,
  pointerEventsSystem,
  InputAction,
  Entity,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { Recipe } from '../dn-framework/ui/popupManager'
import { SMELTER_RECIPES, WORKBENCH_RECIPES, TRADER_RECIPES, FISHMONGER_RECIPES } from '../data/recipeData'

export function setupCraftingStations(gameMgr: GameManager): void {
  // Smelter
  makeStation(
    gameMgr,
    Vector3.create(60, 1.5, 82),
    Vector3.create(2.8, 3.0, 2.8),
    Color4.create(0.82, 0.28, 0.06, 1),
    'Smelter',
    SMELTER_RECIPES,
    'Open Smelter'
  )

  // Workbench
  makeStation(
    gameMgr,
    Vector3.create(100, 1.5, 82),
    Vector3.create(3.2, 2.2, 2.0),
    Color4.create(0.50, 0.32, 0.14, 1),
    'Workbench',
    WORKBENCH_RECIPES,
    'Open Workbench'
  )
}

export function setupTrader(gameMgr: GameManager): void {
  makeStation(
    gameMgr,
    Vector3.create(100, 1.5, 147),
    Vector3.create(2.5, 3.2, 2.0),
    Color4.create(0.42, 0.18, 0.72, 1),  // purple
    'Trader',
    TRADER_RECIPES,
    'Open Trader',
    'TRADE'  // custom button label
  )
}

/**
 * Fishing Shop (Fishmonger) — west side of scene, X=28, Z=120.
 * Teal-blue NPC box. Buy rods/bait | Sell fish.
 * Uses CraftingPopup with "TRADE" label (same pattern as Trader).
 * Worms are gathered free from the soil patches near the ore vein — not sold here.
 */
export function setupFishingShop(gameMgr: GameManager): void {
  makeStation(
    gameMgr,
    Vector3.create(28, 1.5, 120),
    Vector3.create(2.2, 3.0, 2.2),
    Color4.create(0.16, 0.52, 0.70, 1),  // teal-blue fishmonger
    'Fishmonger',
    FISHMONGER_RECIPES,
    'Open Fishmonger',
    'TRADE'
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeStation(
  gameMgr: GameManager,
  position: Vector3,
  scale: Vector3,
  color: Color4,
  stationName: string,
  recipes: Recipe[],
  hoverText: string,
  craftButtonLabel?: string
): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color, roughness: 0.7 })

  // Billboard label
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(position.x, position.y + scale.y + 0.8, position.z),
  })
  TextShape.create(label, {
    text: `${stationName.toUpperCase()}\n[E]`,
    fontSize: 3,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(label)

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText, maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return
      gameMgr.popupMgr.openCraftingWindow(stationName, recipes, (recipe) => {
        craftItem(gameMgr, recipe, stationName)
      }, craftButtonLabel)
    }
  )

  return entity
}

/** Execute a craft: check ingredients, consume, add output, float, close. */
function craftItem(gameMgr: GameManager, recipe: Recipe, stationName: string): void {
  const inv = gameMgr.playerInventory

  // Defensive check — button should already be disabled, but guard anyway
  const canCraft = recipe.ingredients.every(ing => inv.hasEnough(ing.itemId, ing.quantity))
  if (!canCraft) {
    gameMgr.popupMgr.showFloat('Missing ingredients!', Color4.create(1, 0.3, 0.3, 1))
    return
  }

  // Consume ingredients
  recipe.ingredients.forEach(ing => inv.removeItem(ing.itemId, ing.quantity))

  // Add output
  inv.addItem(recipe.output.itemId, recipe.output.name, recipe.output.quantity)

  // Float notification — longer lifetime so it's readable
  gameMgr.popupMgr.showFloat(
    `Crafted: ${recipe.output.name} x${recipe.output.quantity}`,
    Color4.create(0.40, 0.92, 0.48, 1),
    2000
  )

  console.log(`[${stationName}] Crafted ${recipe.output.quantity}x ${recipe.output.name}`)

  // Quest: fishing_basic phase 2 → 3 when a fish is sold at the Fishmonger
  const fishSellIds = ['sell_perch', 'sell_bass', 'sell_trout']
  if (fishSellIds.includes(recipe.id) && gameMgr.questMgr) {
    if (gameMgr.questMgr.isActive('fishing_basic') && gameMgr.questMgr.getPhase('fishing_basic') === 1) {
      gameMgr.questMgr.advancePhase('fishing_basic')
      gameMgr.popupMgr.showFloat('Quest update: Return to the Mission Board!', Color4.create(1, 0.85, 0.2, 1), 3500)
    }
  }

  // Auto-close popup
  gameMgr.popupMgr.closePopup()
}
