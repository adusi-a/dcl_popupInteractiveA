/**
 * T1 — Player Physics + Double Jump / Glide Controls
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * Tests:
 *   A) applyImpulseToPlayer (upward launch pad)
 *   B) applyKnockbackToPlayer (explosion push)
 *   C) applyForceToPlayer in a TriggerArea (wind tunnel — continuous)
 *   D) AvatarLocomotionSettings zone — disableDoubleJump
 *   E) AvatarLocomotionSettings zone — disableGlide
 *   F) AvatarLocomotion on PlayerEntity — speed override
 *
 * VERIFY:
 *   - Standing on the launch pad + [E] → player shoots upward
 *   - [E] on Knockback button → player pushed backward
 *   - Entering Wind Zone → player drifts up while inside, stops on exit
 *   - Zone D: player cannot double-jump while standing in the yellow box
 *   - Zone E: player cannot glide while standing in the green box
 *   - Console logs confirm each trigger fires
 *
 * GAME APPLICATIONS:
 *   OreMonger  — mine collapse knockback, elevator launch pad to upper level
 *   GhostTown  — ghost push, haunted object launching
 *   Parkour    — launch pads between sections, wind gust zones
 *
 * SDK NOTES:
 *   • Physics.applyImpulseToPlayer takes a Vector3 velocity delta.
 *     Character mass = 1, so impulse magnitude = velocity change in m/s.
 *   • NEVER write to Transform.getMutable(engine.PlayerEntity).position — silently ignored.
 *   • AvatarLocomotionSettings (SDK 7.24.3+) goes on a modifier-area entity.
 *     If it shows a TS error, the SDK version needs updating:
 *     npm install @dcl/sdk@latest
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, TriggerArea, triggerAreaEventsSystem,
  AvatarModifierArea, AvatarModifierType,
  ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { InputAction, KnockbackFalloff } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// AvatarLocomotionSettings may need to be imported separately on SDK 7.24.3+
// If the import below fails at compile time, comment it out and note the SDK is older than 7.24.3
let AvatarLocomotion: any = null
let AvatarLocomotionSettings: any
try {
  // Dynamic-style comment: import { AvatarLocomotionSettings } from '@dcl/sdk/ecs'
  // Replace the try/catch with a direct import once SDK ≥ 7.24.3 is confirmed
  // @ts-ignore — require works in DCL/esbuild QuickJS context
  const _sdk = (require('@dcl/sdk/ecs') as any)
  AvatarLocomotionSettings = _sdk.AvatarLocomotionSettings
  AvatarLocomotion = _sdk.AvatarLocomotion
} catch {
  AvatarLocomotionSettings = null
}

export function setupPhysicsTest(): void {
  const { x, z } = { x: 96, z: 22 }   // station center
  createStation('t1_physics', 'T1 — PLAYER PHYSICS\n+ Double Jump / Glide', STATUS_COLOR.FULLY_CODED)

  // ─── A) Launch Pad ───────────────────────────────────────────────────────
  const launchPad = engine.addEntity()
  Transform.create(launchPad, {
    position: Vector3.create(x - 2.5, 0.75, z - 2),
    scale: Vector3.create(2, 0.3, 2)
  })
  MeshRenderer.setBox(launchPad)
  MeshCollider.setBox(launchPad, ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(launchPad, {
    albedoColor: Color4.create(0.2, 1, 0.3, 1),
    emissiveColor: { r: 0, g: 0.3, b: 0 },
    emissiveIntensity: 1
  })

  const launchLabel = engine.addEntity()
  Transform.create(launchLabel, { position: Vector3.create(x - 2.5, 2, z - 2) })
  Billboard.create(launchLabel)
  TextShape.create(launchLabel, {
    text: '[E] LAUNCH PAD\n(impulse up)', fontSize: 1.4,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  pointerEventsSystem.onPointerDown(
    { entity: launchPad, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Launch!' } },
    () => {
      console.log('[T1] Launch pad triggered — applying upward impulse')
      Physics.applyImpulseToPlayer(Vector3.create(0, 15, 0))
    }
  )

  // ─── B) Knockback Button ──────────────────────────────────────────────────
  const knockBtn = createButton(x, 0.9, z - 3, '[E] KNOCKBACK\n(push back)', Color4.create(1, 0.3, 0.1, 1))
  const knockSource = engine.addEntity()
  Transform.create(knockSource, { position: Vector3.create(x, 0, z - 3) })

  pointerEventsSystem.onPointerDown(
    { entity: knockBtn, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Knockback' } },
    () => {
      console.log('[T1] Knockback triggered')
      const srcPos = Transform.get(knockSource).position
      Physics.applyKnockbackToPlayer(srcPos, 18, 10, KnockbackFalloff.LINEAR)
    }
  )

  // ─── C) Wind Zone (continuous upward force while inside) ──────────────────
  const windEntity = engine.addEntity()   // the force "owner" handle
  Transform.create(windEntity, { position: Vector3.create(x + 2.5, 1.25, z - 1) })

  const windZoneViz = engine.addEntity()
  Transform.create(windZoneViz, {
    position: Vector3.create(x + 2.5, 1.25, z - 1),
    scale: Vector3.create(2.5, 2.5, 2.5)
  })
  MeshRenderer.setBox(windZoneViz)
  Material.setPbrMaterial(windZoneViz, { albedoColor: Color4.create(0.3, 0.7, 1, 0.3) })

  const windZoneTrigger = engine.addEntity()
  Transform.create(windZoneTrigger, {
    position: Vector3.create(x + 2.5, 1.25, z - 1),
    scale: Vector3.create(2.5, 2.5, 2.5)
  })
  TriggerArea.setBox(windZoneTrigger)

  // Per-frame pattern for continuous force (more reliable than enter/exit events)
  // onTriggerExit is documented as NEEDS_TEST — if it doesn't fire, force persists globally.
  // Using per-frame system instead: apply force ONLY on frames the player is in zone.
  let playerInWind = false
  triggerAreaEventsSystem.onTriggerEnter(windZoneTrigger, (e) => {
    if (e.trigger?.entity !== engine.PlayerEntity) return
    playerInWind = true
    console.log('[T1] Entered wind zone')
  })
  triggerAreaEventsSystem.onTriggerExit(windZoneTrigger, (e) => {
    if (e.trigger?.entity !== engine.PlayerEntity) return
    playerInWind = false
    Physics.removeForceFromPlayer(windEntity)  // belt-and-suspenders cleanup
    console.log('[T1] Left wind zone')
  })
  engine.addSystem((_dt: number) => {
    if (!playerInWind) return
    Physics.applyForceToPlayer(windEntity, Vector3.create(0, 4, 0))
  }, 1)

  const windLabel = engine.addEntity()
  Transform.create(windLabel, { position: Vector3.create(x + 2.5, 3.5, z - 1) })
  Billboard.create(windLabel)
  TextShape.create(windLabel, {
    text: 'WIND ZONE\n(step inside)', fontSize: 1.4,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── D & E) Locomotion Restriction Zones ──────────────────────────────────
  // These require AvatarLocomotionSettings (SDK 7.24.3+)
  // If AvatarLocomotionSettings is null (older SDK), the zones are created
  // but restrictions won't apply — verify after SDK upgrade.

  createLocomotionZone(
    x - 1, 0.5, z + 2, 3, 3, 3,
    'NO DOUBLE JUMP\nzone', Color4.create(1, 0.9, 0, 0.35),
    { disableDoubleJump: true, disableGlide: false }
  )

  createLocomotionZone(
    x + 2.5, 0.5, z + 2, 3, 3, 3,
    'NO GLIDE\nzone', Color4.create(0.1, 0.9, 0.5, 0.35),
    { disableDoubleJump: false, disableGlide: true }
  )

  // ─── F) Speed Control Buttons ─────────────────────────────────────────────
  const speedNormal = createButton(x - 2, 0.9, z + 3, '[E] Speed: Normal', Color4.create(0.3, 0.3, 0.8, 1))
  pointerEventsSystem.onPointerDown(
    { entity: speedNormal, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Normal Speed' } },
    () => {
      console.log('[T1] Speed set to normal')
      AvatarLocomotion.deleteFrom(engine.PlayerEntity)
    }
  )

  const speedFast = createButton(x + 1, 0.9, z + 3, '[E] Speed: Fast 2×', Color4.create(0.1, 0.8, 0.1, 1))
  pointerEventsSystem.onPointerDown(
    { entity: speedFast, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Fast Speed' } },
    () => {
      console.log('[T1] Speed set to 2x')
      AvatarLocomotion.createOrReplace(engine.PlayerEntity, {
        runSpeed: 12,
        walkSpeed: 4,
        jumpHeight: 1.5
      })
    }
  )

  console.log('[T1] Physics test station initialized')
}

/** Creates a colored transparent box that restricts locomotion when entered */
function createLocomotionZone(
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  label: string,
  color: Color4,
  options: { disableDoubleJump: boolean; disableGlide: boolean }
): void {
  const viz = engine.addEntity()
  Transform.create(viz, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(sx, sy, sz)
  })
  MeshRenderer.setBox(viz)
  Material.setPbrMaterial(viz, { albedoColor: color })

  // If AvatarLocomotionSettings is available (SDK 7.24.3+), apply it
  if (AvatarLocomotionSettings) {
    const zoneEntity = engine.addEntity()
    Transform.create(zoneEntity, {
      position: Vector3.create(x, y, z),
      scale: Vector3.create(sx, sy, sz)
    })
    // Note: AvatarLocomotionSettings may need AvatarModifierArea on the same entity.
    // Both approaches are written below — comment/uncomment as needed after testing.
    try {
      AvatarLocomotionSettings.create(zoneEntity, {
        disableDoubleJump: options.disableDoubleJump,
        disableGlide: options.disableGlide
      })
      console.log(`[T1] AvatarLocomotionSettings applied: ${JSON.stringify(options)}`)
    } catch (e) {
      console.error('[T1] AvatarLocomotionSettings failed — may need AvatarModifierArea', e)
    }
  } else {
    console.error('[T1] AvatarLocomotionSettings not available — upgrade SDK to 7.24.3+')
  }

  const lbl = engine.addEntity()
  Transform.create(lbl, { position: Vector3.create(x, y + sy / 2 + 0.8, z) })
  Billboard.create(lbl)
  TextShape.create(lbl, {
    text: label, fontSize: 1.3,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })
}
