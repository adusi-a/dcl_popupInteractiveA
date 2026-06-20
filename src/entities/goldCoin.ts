/**
 * goldCoin.ts — Auto-collect gold coin pickups for dcl_popupInteractiveA
 *
 * Small golden box (0.4m × 0.2m × 0.4m). Auto-collects when the player
 * walks close (trigger zone). Disappears on pickup.
 *
 * Gold is an INVENTORY ITEM in this scene ('gold', 'Gold', qty).
 *
 * Coins are scattered near spawn so new players have starting gold for a rod:
 *   Spawn: X=80, Z=70  |  Fishmonger: X=28, Z=120  |  Rod cost: 20g
 *   Four coins × 5g = 20g — just enough for a Basic Rod.
 *
 * Usage:
 *   setupStarterGoldCoins(gameMgr)   — places the default 4-coin spread near spawn
 *   createGoldCoin({ pos, value, gameMgr })  — single coin anywhere in the scene
 */

import {
  engine, Entity, Transform,
  MeshRenderer, Material, MeshCollider,
  Billboard, TextShape,
  TriggerArea, triggerAreaEventsSystem,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'

export interface GoldCoinConfig {
  pos: Vector3
  /** Gold amount (inventory item). Default: 5 */
  value?: number
  gameMgr: GameManager
}

const COIN_COLOR  = Color4.create(1.00, 0.80, 0.08, 1)
const COIN_EMIT   = Color4.create(0.80, 0.60, 0.00, 1)
const COIN_SCALE  = Vector3.create(0.4, 0.2, 0.4)
const TRIG_SCALE  = Vector3.create(1.6, 1.6, 1.6)

export function createGoldCoin(config: GoldCoinConfig): Entity {
  const { pos, gameMgr } = config
  const value = config.value ?? 5

  // Visual box
  const visual = engine.addEntity()
  Transform.create(visual, {
    position: Vector3.create(pos.x, pos.y + 0.1, pos.z),
    scale: COIN_SCALE,
    rotation: Quaternion.Identity(),
  })
  MeshRenderer.setBox(visual)
  Material.setPbrMaterial(visual, {
    albedoColor:       COIN_COLOR,
    metallic:          0.9,
    roughness:         0.1,
    emissiveColor:     COIN_EMIT,
    emissiveIntensity: 0.7,
  })

  // Floating label
  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(pos.x, pos.y + 1.1, pos.z) })
  TextShape.create(label, {
    text: `+${value}g`,
    fontSize: 1.8,
    textColor: Color4.create(1, 0.88, 0.2, 1),
    textWrapping: false,
  })
  Billboard.create(label)

  // Trigger zone — auto-collects on player proximity
  const trigger = engine.addEntity()
  TriggerArea.setBox(trigger)
  Transform.create(trigger, {
    position: Vector3.create(pos.x, pos.y + 0.1, pos.z),
    scale: TRIG_SCALE,
    rotation: Quaternion.Identity(),
  })

  let collected = false

  triggerAreaEventsSystem.onTriggerEnter(trigger, (r) => {
    if (collected) return
    if (r.trigger?.entity !== engine.PlayerEntity) return

    collected = true

    // Hide visual + label
    Transform.getMutable(visual).scale = Vector3.Zero()
    Transform.getMutable(label).scale  = Vector3.Zero()

    // Gold = inventory item in this scene
    gameMgr.playerInventory.addItem('gold', 'Gold', value)
    gameMgr.popupMgr.showFloat(`+${value} Gold`, Color4.create(1, 0.85, 0.1, 1))
  })

  return visual
}

/**
 * Place four 5g coins along a west-bound path from spawn.
 * Spawn: X=80, Z=70 → Fishmonger: X=28, Z=120.
 * Total: 20g = cost of Basic Rod.
 */
export function setupStarterGoldCoins(gameMgr: GameManager): void {
  const positions = [
    Vector3.create(72, 0, 68),   // just west of spawn
    Vector3.create(64, 0, 68),   // continue west
    Vector3.create(56, 0, 70),   // continuing toward ore area
    Vector3.create(48, 0, 70),   // near ore vein / worm field path
  ]
  for (const pos of positions) {
    createGoldCoin({ pos, value: 5, gameMgr })
  }
}
