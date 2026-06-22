/**
 * fishingPond.ts — Fishing pond entity for dcl_popupInteractiveA
 *
 * Placed on the west side of the scene: center X=28, Z=152, scale 8×0.2×8m.
 * Blue/teal colored flat box. Press [E] to cast.
 *
 * Checks inventory on click:
 *   No rod  → float "You need a fishing rod! Visit the Fishmonger (NW)."
 *   No bait → float "You need bait! Dig worms at the soil patch near the ore vein."
 *   OK      → castLine(bestPoleId, firstBaitId)
 *
 * Billboard label above pond shows current state.
 */

import {
  engine, Entity, Transform,
  MeshRenderer, Material, MeshCollider,
  Billboard, TextShape,
  pointerEventsSystem, InputAction,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { isCasting, castLine } from '../fishing/fishingMechanic'
import { VALID_POLE_IDS, VALID_BAIT_IDS, POLE_DEFS } from '../fishing/fishingData'

export function setupFishingPond(gameMgr: GameManager): Entity {
  const pos   = Vector3.create(28, 0.1, 152)
  const scale = Vector3.create(8, 0.2, 8)

  const pond = engine.addEntity()
  Transform.create(pond, { position: pos, scale, rotation: Quaternion.Identity() })
  MeshRenderer.setBox(pond)
  MeshCollider.setBox(pond)
  Material.setPbrMaterial(pond, {
    albedoColor:       Color4.create(0.10, 0.38, 0.68, 1),
    emissiveColor:     Color4.create(0.02, 0.08, 0.18, 1),
    emissiveIntensity: 0.4,
    metallic:          0.2,
    roughness:         0.15,
  })

  // Billboard label
  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(pos.x, pos.y + 2.2, pos.z) })
  TextShape.create(label, {
    text: 'FISHING POND\n[E] Cast',
    fontSize: 2.5,
    textColor: Color4.create(0.6, 0.9, 1, 1),
    textWrapping: false,
  })
  Billboard.create(label)

  pointerEventsSystem.onPointerDown(
    { entity: pond, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Cast [E]', maxDistance: 12 } },
    () => _onPondClick(gameMgr)
  )

  return pond
}

function _onPondClick(gameMgr: GameManager): void {
  const inv      = gameMgr.playerInventory
  const popupMgr = gameMgr.popupMgr

  if (isCasting()) {
    popupMgr.showFloat('Line is already in the water!', Color4.create(1, 0.6, 0.1, 1))
    return
  }

  // Find best owned rod (highest tier)
  const ownedPoles = VALID_POLE_IDS.filter(id => inv.getCount(id) > 0)
  if (ownedPoles.length === 0) {
    popupMgr.showFloat('You need a fishing rod!', Color4.create(1, 0.4, 0.4, 1), 2500)
    popupMgr.showFloat('Visit the Fishmonger to the northwest.', Color4.create(0.8, 0.8, 0.8, 1), 2500)
    return
  }

  // Find any bait
  const baitId = VALID_BAIT_IDS.find(id => inv.getCount(id) > 0)
  if (!baitId) {
    popupMgr.showFloat('You need bait!', Color4.create(1, 0.4, 0.4, 1), 2500)
    popupMgr.showFloat('Dig worms from the soil patch near the ore vein.', Color4.create(0.8, 0.8, 0.8, 1), 2500)
    return
  }

  // Use best rod
  const bestPoleId = ownedPoles.sort((a, b) => {
    const tA = POLE_DEFS.find(p => p.id === a)?.castTimeSeconds ?? 99
    const tB = POLE_DEFS.find(p => p.id === b)?.castTimeSeconds ?? 99
    return tA - tB  // lower cast time = better
  })[0]

  castLine(bestPoleId, baitId)
}
