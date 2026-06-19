/**
 * resourceNodes.ts — Gatherable resource pickup entities
 *
 * Four node types at the Z=40 gathering area (scene center X≈80):
 *   Iron Ore vein  (dark orange, X=55, Z=45) → +2 Iron Ore, +1 Coal
 *   Woodpile       (warm brown,  X=72, Z=38) → +3 Wood
 *   Stone outcrop  (gray,        X=88, Z=52) → +3 Stone
 *   Coal deposit   (dark gray,   X=100,Z=40) → +2 Coal
 *
 * No cooldown — repeatable clicks. Depletion/respawn can be added later.
 * MeshCollider required for pointer events to fire.
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

export function setupResourceNodes(gameMgr: GameManager): void {
  // Iron Ore vein — gives ore + coal together
  makeNode(
    gameMgr,
    Vector3.create(55, 1.2, 45),
    Vector3.create(2.2, 1.4, 2.2),
    Color4.create(0.70, 0.38, 0.12, 1),
    'Iron Ore\nVein  [E]',
    'Mine',
    () => {
      gameMgr.playerInventory.addItem('iron_ore', 'Iron Ore', 2)
      gameMgr.playerInventory.addItem('coal',     'Coal',     1)
      gameMgr.popupMgr.showFloat('+2 Iron Ore', Color4.create(0.8,  0.48, 0.22, 1))
      gameMgr.popupMgr.showFloat('+1 Coal',     Color4.create(0.45, 0.45, 0.50, 1))
    }
  )

  // Woodpile — gives wood
  makeNode(
    gameMgr,
    Vector3.create(72, 1.0, 38),
    Vector3.create(2.8, 1.2, 1.8),
    Color4.create(0.52, 0.34, 0.14, 1),
    'Woodpile\n[E]',
    'Chop',
    () => {
      gameMgr.playerInventory.addItem('wood', 'Wood', 3)
      gameMgr.popupMgr.showFloat('+3 Wood', Color4.create(0.58, 0.75, 0.30, 1))
    }
  )

  // Stone outcrop — gives stone
  makeNode(
    gameMgr,
    Vector3.create(88, 1.0, 52),
    Vector3.create(2.4, 1.0, 2.4),
    Color4.create(0.58, 0.58, 0.62, 1),
    'Stone\n[E]',
    'Mine',
    () => {
      gameMgr.playerInventory.addItem('stone', 'Stone', 3)
      gameMgr.popupMgr.showFloat('+3 Stone', Color4.create(0.68, 0.68, 0.72, 1))
    }
  )

  // Coal deposit — gives coal
  makeNode(
    gameMgr,
    Vector3.create(100, 1.0, 40),
    Vector3.create(2.0, 1.2, 2.0),
    Color4.create(0.22, 0.22, 0.26, 1),
    'Coal\n[E]',
    'Mine',
    () => {
      gameMgr.playerInventory.addItem('coal', 'Coal', 2)
      gameMgr.popupMgr.showFloat('+2 Coal', Color4.create(0.50, 0.50, 0.55, 1))
    }
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeNode(
  gameMgr: GameManager,
  position: Vector3,
  scale: Vector3,
  color: Color4,
  labelText: string,
  hoverText: string,
  onInteract: () => void
): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color, roughness: 0.9 })

  // Billboard label
  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(position.x, position.y + scale.y + 1.4, position.z) })
  TextShape.create(label, { text: labelText, fontSize: 2.5, textColor: Color4.White(), textWrapping: false })
  Billboard.create(label)

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText, maxDistance: 6 } },
    onInteract
  )

  return entity
}
