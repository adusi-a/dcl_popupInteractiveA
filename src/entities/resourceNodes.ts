/**
 * resourceNodes.ts — Gatherable resource pickup entities
 *
 * Four nodes at Z~40-52. Each uses SimpleGiverBehavior for consistent
 * item-give logic, and createInteractableBox for the shared box+label+pointer pattern.
 *
 *   Iron Ore vein  (dark orange, X=55, Z=45) → +2 Iron Ore, +1 Coal
 *   Woodpile       (warm brown,  X=72, Z=38) → +3 Wood
 *   Stone outcrop  (gray,        X=88, Z=52) → +3 Stone
 *   Coal deposit   (dark gray,   X=100,Z=40) → +2 Coal
 *
 * No cooldown — repeatable. Cooldown/depletion can be added via SimpleGiverBehavior.cooldownMs.
 */

import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { SimpleGiverBehavior } from '../dn-framework/npcs/npcBehaviors'
import { createInteractableBox } from '../dn-framework/npcs/npcComposite'

export function setupResourceNodes(gameMgr: GameManager): void {

  makeNode(gameMgr, {
    pos:      Vector3.create(55, 1.2, 45),
    scale:    Vector3.create(2.2, 1.4, 2.2),
    color:    Color4.create(0.70, 0.38, 0.12, 1),
    label:    'Iron Ore\nVein  [E]',
    hoverText: 'Mine',
    behavior: new SimpleGiverBehavior([
      { itemId: 'iron_ore', name: 'Iron Ore', quantity: 2 },
      { itemId: 'coal',     name: 'Coal',     quantity: 1 },
    ])
  })

  makeNode(gameMgr, {
    pos:      Vector3.create(72, 1.0, 38),
    scale:    Vector3.create(2.8, 1.2, 1.8),
    color:    Color4.create(0.52, 0.34, 0.14, 1),
    label:    'Woodpile\n[E]',
    hoverText: 'Chop',
    behavior: new SimpleGiverBehavior([
      { itemId: 'wood', name: 'Wood', quantity: 3 },
    ])
  })

  makeNode(gameMgr, {
    pos:      Vector3.create(88, 1.0, 52),
    scale:    Vector3.create(2.4, 1.0, 2.4),
    color:    Color4.create(0.58, 0.58, 0.62, 1),
    label:    'Stone\n[E]',
    hoverText: 'Mine',
    behavior: new SimpleGiverBehavior([
      { itemId: 'stone', name: 'Stone', quantity: 3 },
    ])
  })

  makeNode(gameMgr, {
    pos:      Vector3.create(100, 1.0, 40),
    scale:    Vector3.create(2.0, 1.2, 2.0),
    color:    Color4.create(0.22, 0.22, 0.26, 1),
    label:    'Coal\n[E]',
    hoverText: 'Mine',
    behavior: new SimpleGiverBehavior([
      { itemId: 'coal', name: 'Coal', quantity: 2 },
    ])
  })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

interface ResourceNodeConfig {
  pos: Vector3
  scale: Vector3
  color: Color4
  label: string
  hoverText: string
  behavior: SimpleGiverBehavior
}

function makeNode(gameMgr: GameManager, cfg: ResourceNodeConfig): void {
  createInteractableBox({
    pos:      cfg.pos,
    scale:    cfg.scale,
    color:    cfg.color,
    label:    cfg.label,
    hoverText: cfg.hoverText,
    onClick:  () => cfg.behavior.give(gameMgr.playerInventory, gameMgr.popupMgr),
  })
}
