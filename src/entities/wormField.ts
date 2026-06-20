/**
 * wormField.ts — Worm gathering soil patches for dcl_popupInteractiveA
 *
 * Two dark-soil patches placed west of the ore vein (X=55, Z=45):
 *   Patch 1: X=25, Z=50   Patch 2: X=32, Z=56
 *
 * Same pattern as resourceNodes.ts. Press [E] to dig:
 *   → +1 Worm in inventory
 *   → 3-second per-node cooldown (float shows remaining time if too soon)
 *
 * No cap — dig as many as needed. Models are colored boxes (soil brown).
 */

import {
  engine, Entity, Transform,
  MeshRenderer, Material, MeshCollider,
  Billboard, TextShape,
  pointerEventsSystem, InputAction,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'

const SOIL_COLOR    = Color4.create(0.22, 0.14, 0.06, 1)
const COOLDOWN_MS   = 3000

interface WormFieldConfig {
  pos: Vector3
  scale?: Vector3
  label?: string
}

const PATCHES: WormFieldConfig[] = [
  { pos: Vector3.create(25, 0.075, 50), label: 'Soil Patch\n[E] Dig Worms' },
  { pos: Vector3.create(32, 0.075, 56), label: 'Soil Patch\n[E] Dig Worms' },
]

export function setupWormField(gameMgr: GameManager): void {
  for (const patch of PATCHES) {
    createSoilPatch(gameMgr, patch)
  }
}

function createSoilPatch(gameMgr: GameManager, cfg: WormFieldConfig): Entity {
  const scale = cfg.scale ?? Vector3.create(4, 0.15, 4)
  const pos   = cfg.pos

  const e = engine.addEntity()
  Transform.create(e, { position: pos, scale })
  MeshRenderer.setBox(e)
  MeshCollider.setBox(e)
  Material.setPbrMaterial(e, { albedoColor: SOIL_COLOR, roughness: 0.95 })

  // Billboard label
  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(pos.x, pos.y + scale.y + 1.5, pos.z) })
  TextShape.create(label, {
    text: cfg.label ?? 'Soil Patch\n[E] Dig',
    fontSize: 2.2,
    textColor: Color4.create(0.75, 0.65, 0.45, 1),
    textWrapping: false,
  })
  Billboard.create(label)

  let lastDigMs = 0

  pointerEventsSystem.onPointerDown(
    { entity: e, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Dig Worms [E]', maxDistance: 7 } },
    () => {
      const now  = Date.now()
      const wait = COOLDOWN_MS - (now - lastDigMs)
      if (wait > 0) {
        gameMgr.popupMgr.showFloat(
          `Resting... (${Math.ceil(wait / 1000)}s)`,
          Color4.create(0.7, 0.6, 0.4, 1),
          1200
        )
        return
      }
      lastDigMs = now
      gameMgr.playerInventory.addItem('worm', 'Worm', 1)
      gameMgr.popupMgr.showFloat('+1 Worm', Color4.create(0.60, 0.85, 0.30, 1))
    }
  )

  return e
}
