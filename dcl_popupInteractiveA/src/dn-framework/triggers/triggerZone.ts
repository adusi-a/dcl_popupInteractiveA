/**
 * @file triggerZone.ts
 * @module DN DCL Framework / triggers
 * @version 0.0001
 * @status CONFIRMED
 *
 * TriggerZone factory functions for Decentraland SDK7.
 *
 * CONFIRMED (from ghosttown, rainbowArchive, triggerAreaMultiplayerTestA):
 *   - TriggerArea.setBox() pattern
 *   - triggerAreaEventsSystem.onTriggerEnter/Exit
 *   - engine.PlayerEntity guard is REQUIRED in multiplayer worlds
 *   - ColliderLayer.CL_PLAYER intentionally NOT used (fires for all players in multiplayer)
 *   - _debug flag shows semi-transparent colored box
 *
 * NEEDS_TEST:
 *   - ColliderLayer.CL_PLAYER behavior — retest with dcl_triggerAreaMultiplayerTestA
 *     to confirm if DCL has fixed cross-player triggering. Until confirmed, keep guard.
 *   - onTriggerExit — present in ghosttown but less-tested. Verify reliably fires.
 *
 * @changelog
 *   0.0001 - Initial extraction from ghosttown triggerZones.ts + rainbowArchive + triggerAreaMultiplayerTestA.
 *            Unified into generic factory + named variant helpers.
 */

import {
  engine, Entity, Transform, TriggerArea,
  triggerAreaEventsSystem, MeshRenderer, Material, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'

// ─── Generic Base Factory ──────────────────────────────────────────────────

/**
 * Create a box trigger zone entity.
 *
 * IMPORTANT: The engine.PlayerEntity guard inside onEnter/onExit is MANDATORY
 * in DCL worlds. Without it, any other player walking through fires the event too.
 * Do not use ColliderLayer.CL_PLAYER as the sole guard — it is unreliable in multiplayer.
 *
 * @param pos        World position of the trigger box center
 * @param scale      World-space size of the trigger box (x/y/z dimensions)
 * @param onEnter    Callback fired when THE LOCAL PLAYER enters (pre-guarded)
 * @param onExit     Optional callback fired when THE LOCAL PLAYER exits
 * @param debug      Show semi-transparent debug visualization
 * @param debugColor Debug box color (default: blue)
 * @returns The trigger entity
 */
export function createTriggerZone(
  pos: Vector3,
  scale: Vector3,
  onEnter: () => void,
  onExit?: () => void,
  debug: boolean = false,
  debugColor: Color4 = Color4.create(0, 0, 1, 0.4)
): Entity {

  const e = engine.addEntity()

  TriggerArea.setBox(e)
  // NOTE: ColliderLayer.CL_PLAYER intentionally omitted — NEEDS_TEST before enabling
  // TriggerArea.setBox(e, ColliderLayer.CL_PLAYER)

  Transform.create(e, { position: pos, scale: scale })

  if (debug) {
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, { albedoColor: debugColor })
  }

  triggerAreaEventsSystem.onTriggerEnter(e, (r) => {
    // CONFIRMED REQUIRED: guard for local player only
    if (r.trigger?.entity !== engine.PlayerEntity) return
    onEnter()
  })

  if (onExit) {
    // NEEDS_TEST: verify onTriggerExit fires reliably
    triggerAreaEventsSystem.onTriggerExit(e, (r) => {
      if (r.trigger?.entity !== engine.PlayerEntity) return
      onExit()
    })
  }

  return e
}

// ─── Named Variants ────────────────────────────────────────────────────────

/**
 * Checkpoint trigger zone.
 * Fires onEnter only when checkpoint ID is not already the current one.
 *
 * @param checkpointId   Unique string ID for this checkpoint
 * @param pos            World position
 * @param scale          Trigger box size
 * @param onActivate     Called with checkpointId when first entered
 * @param debug          Show debug visualization (green)
 */
export function createCheckpointZone(
  checkpointId: string,
  pos: Vector3,
  scale: Vector3,
  onActivate: (id: string) => void,
  debug: boolean = false
): Entity {
  return createTriggerZone(
    pos, scale,
    () => onActivate(checkpointId),
    undefined,
    debug,
    Color4.create(0, 1, 0, 0.4)
  )
}

/**
 * Fall / respawn trigger zone.
 * Placed below the scene floor to catch the player falling off.
 *
 * @param pos        World position (typically y = -10 or below floor)
 * @param scale      Very wide, flat box to catch all fall positions
 * @param onFall     Called when the player falls into zone
 * @param debug      Show debug visualization (red)
 */
export function createFallZone(
  pos: Vector3,
  scale: Vector3,
  onFall: () => void,
  debug: boolean = false
): Entity {
  return createTriggerZone(
    pos, scale,
    onFall,
    undefined,
    debug,
    Color4.create(1, 0, 0, 0.4)
  )
}

/**
 * Area-of-interest trigger zone — fires enter and exit.
 * Use for proximity-based state changes (enter a room, leave a zone).
 *
 * @param pos       World position
 * @param scale     Trigger box size
 * @param onEnter   Called when player enters
 * @param onExit    Called when player exits (NEEDS_TEST — verify reliability)
 * @param debug     Show debug visualization (yellow)
 */
export function createAreaZone(
  pos: Vector3,
  scale: Vector3,
  onEnter: () => void,
  onExit: () => void,
  debug: boolean = false
): Entity {
  return createTriggerZone(
    pos, scale,
    onEnter,
    onExit,
    debug,
    Color4.create(1, 1, 0, 0.4)
  )
}
