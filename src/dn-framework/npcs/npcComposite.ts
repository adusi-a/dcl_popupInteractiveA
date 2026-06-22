/**
 * @file npcComposite.ts
 * @module DN DCL Framework / npcs
 * @version 0.0002
 * @status NEEDS_TEST
 *
 * InteractiveComposite: any interactive entity composed of behaviors.
 * Not limited to humanoid NPCs — works for stations, boards, machines, signs.
 *
 * Two factory helpers:
 *   createInteractiveEntity() — entity that opens the InteractivePopupModule
 *   createInteractableBox()   — entity with a custom click callback (no popup)
 *
 * @changelog
 *   0.0001 - Initial (NpcComposite, createNpcEntity).
 *   0.0002 - Renamed NpcComposite→InteractiveComposite, createNpcEntity→createInteractiveEntity.
 *            Added crafter/refiner fields. Added createInteractableBox() shared helper.
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
  CrafterBehavior,
  RefinerBehavior,
  MessengerBehavior,
  DialogueBehavior,
} from './npcBehaviors'

// ─── InteractiveComposite ─────────────────────────────────────────────────────

/**
 * An interactive entity is a bag of optional behaviors.
 * The InteractivePopupModule renders only the tabs that have a backing behavior.
 * Any entity type (board, NPC, station, vending machine) can use this pattern.
 */
export interface InteractiveComposite {
  displayName: string
  // Interaction behaviors (each drives a tab in InteractivePopupModule)
  messenger?:    MessengerBehavior
  missionGiver?: MissionGiverBehavior
  crafter?:      CrafterBehavior
  refiner?:      RefinerBehavior
  seller?:       SellerBehavior
  buyer?:        BuyerBehavior
  dialogue?:     DialogueBehavior
}

// Backward-compat alias (temporary — remove after all call sites updated)
export type NpcComposite = InteractiveComposite

// ─── createInteractiveEntity ──────────────────────────────────────────────────

export interface InteractiveEntityConfig {
  pos: Vector3
  scale?: Vector3
  color: Color4
  label?: string
  hoverText: string
  entity: InteractiveComposite
  gameMgr: any
}

// Also accept old 'npc' key for backward compat during transition
export interface LegacyInteractiveEntityConfig extends Omit<InteractiveEntityConfig, 'entity'> {
  npc?: InteractiveComposite
  entity?: InteractiveComposite
}

/**
 * Create a box entity + billboard label + pointer event for an InteractiveComposite.
 * On [E] click: opens the InteractivePopupModule for this entity.
 */
export function createInteractiveEntity(cfg: LegacyInteractiveEntityConfig): Entity {
  const composite = cfg.entity ?? cfg.npc!
  const { pos, color, hoverText, gameMgr } = cfg
  const scale = cfg.scale ?? Vector3.create(2.0, 2.0, 0.25)

  const e = _buildBox(pos, scale, color)

  const labelText = cfg.label ?? composite.displayName
  _buildLabel(pos, scale, labelText)

  pointerEventsSystem.onPointerDown(
    { entity: e, opts: { button: InputAction.IA_PRIMARY, hoverText, maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return
      gameMgr.popupMgr.openInteractivePopup(composite)
    }
  )

  return e
}

// Backward-compat alias
export const createNpcEntity = createInteractiveEntity

// ─── createInteractableBox ────────────────────────────────────────────────────

export interface InteractableBoxConfig {
  pos: Vector3
  scale?: Vector3
  color: Color4
  label?: string
  hoverText: string
  maxDistance?: number
  onClick: () => void
}

/**
 * Shared helper: create a box entity + billboard label + pointer event.
 * Use for any entity that reacts to click without opening a full popup.
 * Eliminates the repeated box+label+pointer pattern across entity files.
 */
export function createInteractableBox(cfg: InteractableBoxConfig): Entity {
  const scale = cfg.scale ?? Vector3.create(2.0, 1.5, 2.0)
  const e = _buildBox(cfg.pos, scale, cfg.color)

  if (cfg.label) _buildLabel(cfg.pos, scale, cfg.label)

  pointerEventsSystem.onPointerDown(
    {
      entity: e,
      opts: {
        button: InputAction.IA_PRIMARY,
        hoverText: cfg.hoverText,
        maxDistance: cfg.maxDistance ?? 8,
      }
    },
    cfg.onClick
  )

  return e
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _buildBox(pos: Vector3, scale: Vector3, color: Color4): Entity {
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
  return e
}

function _buildLabel(pos: Vector3, scale: Vector3, text: string): Entity {
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(pos.x, pos.y + scale.y * 0.5 + 0.8, pos.z),
  })
  TextShape.create(label, {
    text,
    fontSize: 2.2,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(label)
  return label
}
