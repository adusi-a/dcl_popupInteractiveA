/**
 * wormField.ts — Worm gathering soil patches
 *
 * Two dark-soil patches west of the ore vein.
 * Uses SimpleGiverBehavior with 3s cooldown per patch.
 * createInteractableBox handles the shared box+label+pointer pattern.
 *
 *   Patch 1: X=25, Z=50
 *   Patch 2: X=32, Z=56
 */

import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { SimpleGiverBehavior } from '../dn-framework/npcs/npcBehaviors'
import { createInteractableBox } from '../dn-framework/npcs/npcComposite'

const SOIL_COLOR  = Color4.create(0.22, 0.14, 0.06, 1)
const COOLDOWN_MS = 3000

export function setupWormField(gameMgr: GameManager): void {
  const patches = [
    { pos: Vector3.create(25, 0.075, 50), label: 'Soil Patch\n[E] Dig Worms' },
    { pos: Vector3.create(32, 0.075, 56), label: 'Soil Patch\n[E] Dig Worms' },
  ]

  for (const patch of patches) {
    const behavior = new SimpleGiverBehavior(
      [{ itemId: 'worm', name: 'Worm', quantity: 1 }],
      COOLDOWN_MS,
      'Resting...'
    )

    createInteractableBox({
      pos:      patch.pos,
      scale:    Vector3.create(4, 0.15, 4),
      color:    SOIL_COLOR,
      label:    patch.label,
      hoverText: 'Dig Worms [E]',
      maxDistance: 7,
      onClick:  () => behavior.give(gameMgr.playerInventory, gameMgr.popupMgr),
    })
  }
}
