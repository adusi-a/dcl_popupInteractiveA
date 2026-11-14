/**
 * pz_powerZones.ts — PZ1-PZ5: Player Physics Power Zones
 * STATUS: 🟩 FULLY CODED
 *
 * PZ1 — TRAMPOLINE: Repeated upward bounces while player is on pad.
 * PZ2 — ANTI-GRAVITY BUBBLE: Continuous upward force = floating sensation.
 * PZ3 — REPULSOR FIELD: Radial outward push — direction depends on player position from center.
 * PZ4 — ATTRACTOR: Radial INWARD pull — opposite of repulsor; black-hole effect.
 * PZ5 — DIRECTIONAL SPEED PAD: One-way horizontal boost in a fixed direction.
 *
 * All build on Physics.applyForceToPlayer / applyImpulseToPlayer / applyKnockbackToPlayer.
 * PZ3 and PZ4 are genuinely new: T1 had fixed-direction forces; these compute
 * direction dynamically from player position relative to zone center.
 *
 * Framework: extractable as a "zone type" enum driving one shared force system.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem,
  AvatarLocomotion
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── PZ1 — Trampoline ─────────────────────────────────────────────────────────

export function setupPZTrampoline(): void {
  const { x, z } = { x: 16, z: 100 }
  createStation('pz1_jumppad', 'PZ1 — TRAMPOLINE\nRepeated bounce', STATUS_COLOR.FULLY_CODED)

  const pad = engine.addEntity()
  Transform.create(pad, { position: Vector3.create(x, 0.52, z), scale: Vector3.create(4, 0.12, 4) })
  MeshRenderer.setBox(pad); MeshCollider.setBox(pad, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(pad, { albedoColor: Color4.create(0.3, 1, 0.3, 1), emissiveColor: { r: 0, g: 0.4, b: 0 }, emissiveIntensity: 0.4 })

  const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(x, 0.9, z) }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '⬆ TRAMPOLINE\nStep on + jump', fontSize: 1.1, textColor: Color4.create(0.3, 1, 0.5, 1) })

  // Track if player is on pad (Y proximity to pad top)
  let onPad = false; let bounceTimer = 0
  const trigger = engine.addEntity()
  Transform.create(trigger, { position: Vector3.create(x, 0.9, z), scale: Vector3.create(4, 1.0, 4) })
  TriggerArea.create(trigger, { triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(4, 1.0, 4) }] })
  triggerAreaEventsSystem.onEnterArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) { onPad = true; bounceTimer = 0 } })
  triggerAreaEventsSystem.onExitArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) onPad = false })

  engine.addSystem((dt: number) => {
    if (!onPad) return
    bounceTimer += dt
    if (bounceTimer > 0.4) {  // bounce every 0.4s while on pad
      bounceTimer = 0
      Physics.applyImpulseToPlayer({ impulse: Vector3.create(0, 12, 0) })
      console.log('[PZ1] BOUNCE!')
    }
  }, 10)
}

// ─── PZ2 — Anti-Gravity Bubble ────────────────────────────────────────────────

export function setupPZAntiGrav(): void {
  const { x, z } = { x: 28, z: 100 }
  createStation('pz2_antigrav', 'PZ2 — ANTI-GRAVITY\nFloat upward in zone', STATUS_COLOR.FULLY_CODED)

  const bubble = engine.addEntity()
  Transform.create(bubble, { position: Vector3.create(x, 2.0, z), scale: Vector3.create(4.5, 4.5, 4.5) })
  MeshRenderer.setCylinder(bubble)
  Material.setPbrMaterial(bubble, { albedoColor: Color4.create(0.4, 0.8, 1, 0.15), emissiveColor: { r: 0.1, g: 0.3, b: 0.5 }, emissiveIntensity: 0.4, transparencyMode: 1 })

  const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(x, 4.5, z) }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '🫧 ANTI-GRAVITY\nWalk into sphere', fontSize: 1.1, textColor: Color4.create(0.5, 0.9, 1, 1) })

  let inZone = false
  const trigger = engine.addEntity()
  Transform.create(trigger, { position: Vector3.create(x, 2.0, z), scale: Vector3.create(4.5, 4.5, 4.5) })
  TriggerArea.create(trigger, { triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(4.5, 4.5, 4.5) }] })
  triggerAreaEventsSystem.onEnterArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) { inZone = true; console.log('[PZ2] Anti-grav ON') } })
  triggerAreaEventsSystem.onExitArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) { inZone = false; console.log('[PZ2] Anti-grav OFF') } })

  engine.addSystem((_dt: number) => {
    if (!inZone) return
    Physics.applyForceToPlayer({ force: Vector3.create(0, 15, 0) })  // counteracts gravity (~9.8) and then some
  }, 10)
}

// ─── PZ3 — Repulsor Field ─────────────────────────────────────────────────────

export function setupPZRepulsor(): void {
  const { x, z } = { x: 40, z: 100 }
  createStation('pz3_repulsor', 'PZ3 — REPULSOR\nRadial outward push', STATUS_COLOR.FULLY_CODED)

  const core = engine.addEntity()
  Transform.create(core, { position: Vector3.create(x, 1.0, z), scale: Vector3.create(0.8, 0.8, 0.8) })
  MeshRenderer.setCylinder(core)
  Material.setPbrMaterial(core, { albedoColor: Color4.create(1, 0.3, 0.3, 1), emissiveColor: { r: 0.6, g: 0, b: 0 }, emissiveIntensity: 1.5 })

  const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '💥 REPULSOR\nPushes you OUT', fontSize: 1.1, textColor: Color4.create(1, 0.5, 0.5, 1) })

  const RANGE = 4.5; const FORCE = 20

  engine.addSystem((_dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity); if (!pT) return
    const dx = pT.position.x - x; const dz = pT.position.z - z
    const dist = Math.sqrt(dx*dx + dz*dz)
    if (dist > RANGE) return
    const strength = (1 - dist / RANGE) * FORCE  // stronger closer to center
    const nx = dist > 0.1 ? dx / dist : 1; const nz = dist > 0.1 ? dz / dist : 0
    Physics.applyForceToPlayer({ force: Vector3.create(nx * strength, 0.5, nz * strength) })
  }, 10)

  // Ring visual
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2; const dot = engine.addEntity()
    Transform.create(dot, { position: Vector3.create(x + Math.cos(a) * RANGE, 0.52, z + Math.sin(a) * RANGE), scale: Vector3.create(0.1, 0.06, 0.1) })
    MeshRenderer.setCylinder(dot); Material.setPbrMaterial(dot, { albedoColor: Color4.create(1, 0.3, 0.3, 0.5) })
  }
}

// ─── PZ4 — Attractor (black hole) ────────────────────────────────────────────

export function setupPZAttractor(): void {
  const { x, z } = { x: 52, z: 100 }
  createStation('pz4_attractor', 'PZ4 — ATTRACTOR\nRadial inward pull', STATUS_COLOR.FULLY_CODED)

  const core = engine.addEntity()
  Transform.create(core, { position: Vector3.create(x, 1.0, z), scale: Vector3.create(0.8, 0.8, 0.8) })
  MeshRenderer.setCylinder(core)
  Material.setPbrMaterial(core, { albedoColor: Color4.create(0.1, 0.1, 0.5, 1), emissiveColor: { r: 0, g: 0, b: 0.8 }, emissiveIntensity: 2 })

  const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '🌀 ATTRACTOR\nPulls you IN', fontSize: 1.1, textColor: Color4.create(0.5, 0.5, 1, 1) })

  const RANGE = 5.5; const FORCE = 15

  engine.addSystem((_dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity); if (!pT) return
    const dx = pT.position.x - x; const dz = pT.position.z - z
    const dist = Math.sqrt(dx*dx + dz*dz)
    if (dist > RANGE || dist < 0.5) return  // don't pull when already at center
    const strength = (1 - dist / RANGE) * FORCE
    // INWARD = negative direction (toward center)
    const nx = dist > 0.1 ? -dx / dist : 0; const nz = dist > 0.1 ? -dz / dist : 0
    Physics.applyForceToPlayer({ force: Vector3.create(nx * strength, 0, nz * strength) })
  }, 10)

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2; const dot = engine.addEntity()
    Transform.create(dot, { position: Vector3.create(x + Math.cos(a) * RANGE, 0.52, z + Math.sin(a) * RANGE), scale: Vector3.create(0.1, 0.06, 0.1) })
    MeshRenderer.setCylinder(dot); Material.setPbrMaterial(dot, { albedoColor: Color4.create(0.3, 0.3, 1, 0.5) })
  }
}

// ─── PZ5 — Directional Speed Pad ─────────────────────────────────────────────

export function setupPZSpeedPad(): void {
  const { x, z } = { x: 64, z: 100 }
  createStation('pz5_speedpad', 'PZ5 — SPEED PAD\nDirectional ground boost', STATUS_COLOR.FULLY_CODED)

  let padDir = Vector3.create(0, 0, 1)  // +Z default

  const pad = engine.addEntity()
  Transform.create(pad, { position: Vector3.create(x, 0.52, z), scale: Vector3.create(2.5, 0.08, 5.0) })
  MeshRenderer.setBox(pad); MeshCollider.setBox(pad, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(pad, { albedoColor: Color4.create(1, 0.9, 0.1, 1), emissiveColor: { r: 0.4, g: 0.3, b: 0 }, emissiveIntensity: 0.4 })

  // Direction arrow markers
  for (let i = 1; i <= 3; i++) {
    const arrow = engine.addEntity()
    Transform.create(arrow, { position: Vector3.create(x, 0.56, z - 2.0 + i * 1.2), scale: Vector3.create(0.1, 0.06, 0.6) })
    MeshRenderer.setBox(arrow); Material.setPbrMaterial(arrow, { albedoColor: Color4.create(1, 0.5, 0, 1), emissiveColor: { r: 0.4, g: 0.2, b: 0 }, emissiveIntensity: 0.6 })
  }

  const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(x, 1.5, z) }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '→ SPEED PAD\n+Z direction', fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.3, 1) })

  let onPad = false
  const trigger = engine.addEntity()
  Transform.create(trigger, { position: Vector3.create(x, 0.9, z), scale: Vector3.create(2.5, 1.0, 5.0) })
  TriggerArea.create(trigger, { triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(2.5, 1.0, 5.0) }] })
  triggerAreaEventsSystem.onEnterArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) onPad = true })
  triggerAreaEventsSystem.onExitArea(trigger, (r) => { if (r.otherEntity === engine.PlayerEntity) onPad = false })

  const BOOST = 25
  engine.addSystem((_dt: number) => {
    if (!onPad) return
    Physics.applyForceToPlayer({ force: Vector3.create(padDir.x * BOOST, 0, padDir.z * BOOST) })
  }, 10)

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 3.5, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'PZ3: radial OUT (direction = playerPos-center)\nPZ4: radial IN (negate direction)\nSame formula — just negate normal vector',
    fontSize: 1.0, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PZ5] SpeedPad initialized')
}
