/**
 * @file npcComposite.ts
 * @module DN DCL Framework / npcs
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * NpcComposite: the data structure that composes an NPC from behaviors.
 * Also provides createNpcEntity() — a helper that creates the DCL box entity,
 * billboard label, and pointer event in one call.
 *
 * Usage:
 *   const fishBoard: NpcComposite = {
 *     displayName: 'Fishing Mission Board',
 *     missionGiver: new MissionGiverBehavior([FISHING_BASIC_QUEST])
 *   }
 *   createNpcEntity({ pos, color, hoverText: 'Read Board [E]', npc: fishBoard, gameMgr })
 *   // On [E]: gameMgr.popupMgr.openNpcPopup(fishBoard)
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA behavior-system sprint.
 */

import {
  engine, Entity, Transform,
  MeshRenderer, Material, MeshCollider,
  Billboard, TextShape,
  pointerEventsSystem, InputAction,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'

import {
  MissionGiverBehavior,
  SellerBehavior,
  BuyerBehavior,
  MessengerBehavior,
} from './npcBehaviors'

// ─── NpcComposite ─────────────────────────────────────────────────────────────

/**
 * An NPC is a bag of optional behaviors.
 * The NpcPopupModule renders only the tabs that have a backing behavior.
 * Entity type (board, humanoid NPC, vending machine) doesn't matter —
 * the behaviors are what drive the UI.
 */
export interface NpcComposite {
  displayName: string
  missionGiver?: MissionGiverBehavior
  seller?:       SellerBehavior
  buyer?:        BuyerBehavior
  messenger?:    MessengerBehavior
}

// ─── Entity Factory ───────────────────────────────────────────────────────────

export interface NpcEntityConfig {
  pos: Vector3
  /** Box scale (default 2×2×0.25 — flat board). */
  scale?: Vector3
  color: Color4
  /** Billboard label text. */
  label?: string
  hoverText: string
  npc: NpcComposite
  gameMgr: any
}

/**
 * Create a box entity + billboard label + pointer event for an NPC composite.
 * Returns the main interactive entity.
 */
export function createNpcEntity(cfg: NpcEntityConfig): Entity {
  const { pos, color, hoverText, npc, gameMgr } = cfg
  const scale = cfg.scale ?? Vector3.create(2.0, 2.0, 0.25)

  // Main interactive box
  const e = engine.addEntity()
  Transform.create(e, { position: pos, scale, rotation: Quaternion.Identity() })
  MeshRenderer.setBox(e)
  MeshCollider.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor:       color,
    emissiveColor:     Color4.create(color.r * 0.2, color.g * 0.2, color.b * 0.2, 1),
    emissiveIntensity: 0.3,
    roughness:         0.8,
  })

  // Billboard label
  const labelText = cfg.label ?? npc.displayName
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(pos.x, pos.y + scale.y * 0.5 + 0.8, pos.z),
  })
  TextShape.create(label, {
    text: labelText,
    fontSize: 2.2,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(label)

  // Pointer event — opens the adaptive NPC popup
  pointerEventsSystem.onPointerDown(
    { entity: e, opts: { button: InputAction.IA_PRIMARY, hoverText, maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return
      gameMgr.popupMgr.openNpcPopup(npc)
    }
  )

  return e
}
