/**
 * chests.ts — Three test chest entities for dcl_popupInteractiveA
 *
 * Layout (spawn at 80,1,70 looking toward +Z):
 *   Chest A (gold,  X=50, Z=100) — Float notifications: +Gold +Wood +Rope
 *   Chest B (blue,  X=80, Z=100) — Loot window: Iron Sword + Potions + Gold
 *   Chest C (green, X=110,Z=100) — Choice popup: Enchanted Sword OR Shield
 *
 * Colored box placeholders — replace with GltfContainer chest models in a later build.
 * MeshCollider.setBox() is REQUIRED for pointerEventsSystem to fire.
 *
 * Chest spacing: 30m apart (easily visible from spawn, distinct targets).
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

// Scene center X, chest Z row, chest height
const CX = 80
const CZ = 100
const CHEST_Y = 1.5
const CHEST_SCALE = Vector3.create(2.5, 2.5, 2.5)

// ─── Main Setup ───────────────────────────────────────────────────────────────

export function setupChests(gameMgr: GameManager): void {
  setupChestA(gameMgr)
  setupChestB(gameMgr)
  setupChestC(gameMgr)
}

// ─── Chest A — Float Notifications ───────────────────────────────────────────

function setupChestA(gameMgr: GameManager): void {
  const pos = Vector3.create(CX - 30, CHEST_Y, CZ)
  const entity = makeBox(pos, CHEST_SCALE, Color4.create(1, 0.78, 0.08, 1))  // gold
  makeLabel(Vector3.create(pos.x, pos.y + 3, pos.z), 'CHEST A\nFloat Loot')

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Chest', maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return

      // Three simultaneous floats — automatically stacked 32px apart
      gameMgr.popupMgr.showFloat('+50 Gold',  Color4.create(1,    0.85, 0.08, 1))
      gameMgr.popupMgr.showFloat('+3 Wood',   Color4.create(0.55, 0.88, 0.35, 1))
      gameMgr.popupMgr.showFloat('+1 Rope',   Color4.create(0.88, 0.76, 0.55, 1))

      // Add to inventory silently (no popup needed — floats handle the feedback)
      gameMgr.playerInventory.addItem('gold', 'Gold', 50)
      gameMgr.playerInventory.addItem('wood', 'Wood', 3)
      gameMgr.playerInventory.addItem('rope', 'Rope', 1)

      console.log('[Chest A] Float loot triggered')
    }
  )
}

// ─── Chest B — Loot Window ───────────────────────────────────────────────────

function setupChestB(gameMgr: GameManager): void {
  const pos = Vector3.create(CX, CHEST_Y, CZ)
  const entity = makeBox(pos, CHEST_SCALE, Color4.create(0.18, 0.42, 1, 1))  // blue
  makeLabel(Vector3.create(pos.x, pos.y + 3, pos.z), 'CHEST B\nLoot Window')

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Chest', maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return

      gameMgr.popupMgr.openLootWindow(
        [
          { itemId: 'iron_sword',     name: 'Iron Sword',     quantity: 1   },
          { itemId: 'heal_potion',    name: 'Healing Potion', quantity: 2   },
          { itemId: 'gold',           name: 'Gold',           quantity: 100 },
        ],
        'Found in the old chest:',
        (items) => {
          // Take All callback — add items and show floats
          items.forEach(item =>
            gameMgr.playerInventory.addItem(item.itemId, item.name, item.quantity)
          )
          gameMgr.popupMgr.showFloat('+1 Iron Sword',      Color4.create(0.7,  0.82, 0.95, 1))
          gameMgr.popupMgr.showFloat('+2 Healing Potion',  Color4.create(0.35, 0.92, 0.35, 1))
          gameMgr.popupMgr.showFloat('+100 Gold',          Color4.create(1,    0.85, 0.08, 1))
          console.log('[Chest B] Loot taken:', items.map(i => `${i.quantity}x ${i.name}`).join(', '))
        }
      )
    }
  )
}

// ─── Chest C — Choice Popup ───────────────────────────────────────────────────

function setupChestC(gameMgr: GameManager): void {
  const pos = Vector3.create(CX + 30, CHEST_Y, CZ)
  const entity = makeBox(pos, CHEST_SCALE, Color4.create(0.18, 0.72, 0.3, 1))  // green
  makeLabel(Vector3.create(pos.x, pos.y + 3, pos.z), 'CHEST C\nChoose One')

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Chest', maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return

      gameMgr.popupMgr.openChoicePopup(
        {
          itemId: 'enchanted_sword',
          name: 'Enchanted Sword',
          description: '+25 Attack  •  Glows in darkness',
        },
        {
          itemId: 'shield_of_fortitude',
          name: 'Shield of Fortitude',
          description: '+50 Defense  •  Never bends',
        },
        (chosen) => {
          gameMgr.playerInventory.addItem(chosen.itemId, chosen.name, 1)
          gameMgr.popupMgr.showFloat(`+1 ${chosen.name}`, Color4.create(0.4, 0.8, 1, 1))
          console.log('[Chest C] Player chose:', chosen.name)
        }
      )
    }
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBox(position: Vector3, scale: Vector3, color: Color4): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color })
  return entity
}

function makeLabel(position: Vector3, text: string): void {
  const label = engine.addEntity()
  Transform.create(label, { position })
  TextShape.create(label, {
    text,
    fontSize: 3,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(label)
}
