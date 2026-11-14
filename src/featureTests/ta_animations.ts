/**
 * ta_animations.ts — TA1-TA5: Transform Animation Patterns
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * Simple looping Transform animations — the backbone of "scene feels alive."
 * None of these need physics, audio, GLBs, or player interaction.
 * They run as pure engine.addSystem callbacks mutating Transform each frame.
 *
 * TA1 — LERP PING-PONG: Entity smoothly moves between A and B, bouncing.
 *        Easing function makes it feel natural (ease in/out). Hover effect.
 * TA2 — ROTATION LOOP:  Entity spins continuously. Speed configurable.
 *        Classic for: spinning coins, fan blades, radar dish, decorative items.
 * TA3 — SCALE PULSE:    Entity breathes in and out using Math.sin().
 *        Classic for: attention indicator, health pickup, power orb.
 * TA4 — WAYPOINT PATH:  Entity follows an ordered list of positions, looping.
 *        Distinct from NodeWalker (which is for NPCs). This is for objects
 *        (a floating platform, a patrol light, a moving hazard).
 * TA5 — ORBIT:          Entity circles a center point at configurable radius/speed.
 *        Classic for: moon around planet, guard patrol, decorative ring.
 *
 * FRAMEWORK NOTE: These 5 patterns cover ~90% of non-physics object animation in DCL.
 * Extract as animationSystem(entity, config: LerpConfig|RotateConfig|OrbitConfig) once confirmed.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── TA1 — Lerp Ping-Pong ─────────────────────────────────────────────────────

export function setupTALerpMove(): void {
  const { x, z } = { x: 96, z: 108 }
  createStation('ta1_lerpmove', 'TA1 — LERP PING-PONG\nEased hover motion', STATUS_COLOR.FULLY_CODED)

  const posA = Vector3.create(x, 1.0, z - 1.5)
  const posB = Vector3.create(x, 2.8, z - 1.5)
  const entity = engine.addEntity()
  Transform.create(entity, { position: posA, scale: Vector3.create(1.5, 0.4, 1.5) })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: Color4.create(0.3, 0.6, 1, 1), emissiveColor: { r: 0.1, g: 0.2, b: 0.5 }, emissiveIntensity: 0.4 })

  const lbl = engine.addEntity(); Transform.create(lbl, { position: posA }); Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '⬆⬇ LERP', fontSize: 1.1, textColor: Color4.create(0.5, 0.8, 1, 1) })

  let t = 0; let dir = 1; let speed = 0.5
  // Ease in-out: smoothstep 3t²-2t³
  const ease = (v: number) => v * v * (3 - 2 * v)

  engine.addSystem((dt: number) => {
    t += dt * speed * dir
    if (t >= 1) { t = 1; dir = -1 }
    if (t <= 0) { t = 0; dir = 1 }
    const et = ease(t)
    const p = Transform.getMutable(entity)
    p.position = Vector3.create(posA.x + (posB.x - posA.x) * et, posA.y + (posB.y - posA.y) * et, posA.z + (posB.z - posA.z) * et)
    Transform.getMutable(lbl).position = p.position
  }, 10)

  const slowBtn = createButton(x - 1.5, 0.8, z - 3.6, '🐢 Slow', Color4.create(0.3, 0.5, 0.3, 1))
  const fastBtn = createButton(x + 1.5, 0.8, z - 3.6, '⚡ Fast', Color4.create(0.5, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: slowBtn, opts: { button: 1, hoverText: '[E] Slow' } }, () => { speed = 0.25 })
  pointerEventsSystem.onPointerDown({ entity: fastBtn, opts: { button: 1, hoverText: '[E] Fast' } }, () => { speed = 1.5 })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.2, z) }); Billboard.create(info, {})
  TextShape.create(info, { text: 'ease(t) = t²(3-2t) → smooth start/stop\nUse: hover effect, floating pickup\npitch/speed buttons', fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08 })
  console.log('[TA1] LerpPingPong initialized')
}

// ─── TA2 — Rotation Loop ──────────────────────────────────────────────────────

export function setupTARotLoop(): void {
  const { x, z } = { x: 108, z: 108 }
  createStation('ta2_rotloop', 'TA2 — ROTATION LOOP\nContinuous spin', STATUS_COLOR.FULLY_CODED)

  // Three entities with different axes
  const configs = [
    { offset: Vector3.create(x - 2, 1.2, z), axis: 'Y', color: Color4.create(1, 0.3, 0.3, 1), rpm: 60 },
    { offset: Vector3.create(x,     1.2, z), axis: 'X', color: Color4.create(0.3, 1, 0.3, 1), rpm: 90 },
    { offset: Vector3.create(x + 2, 1.2, z), axis: 'Z', color: Color4.create(0.3, 0.3, 1, 1), rpm: 45 },
  ]

  for (const cfg of configs) {
    const ent = engine.addEntity()
    Transform.create(ent, { position: cfg.offset, scale: Vector3.create(0.8, 0.8, 0.3) })
    MeshRenderer.setBox(ent)
    Material.setPbrMaterial(ent, { albedoColor: cfg.color, emissiveColor: { r: cfg.color.r * 0.4, g: cfg.color.g * 0.4, b: cfg.color.b * 0.4 }, emissiveIntensity: 0.5 })

    const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(cfg.offset.x, cfg.offset.y + 1.2, cfg.offset.z) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: `${cfg.axis}\n${cfg.rpm} rpm`, fontSize: 0.9, textColor: cfg.color })

    let angle = 0; const speedDeg = cfg.rpm * 6; const ax = cfg.axis
    engine.addSystem((dt: number) => {
      angle = (angle + speedDeg * dt) % 360
      Transform.getMutable(ent).rotation = ax === 'Y' ? Quaternion.fromEulerDegrees(0, angle, 0) :
        ax === 'X' ? Quaternion.fromEulerDegrees(angle, 0, 0) : Quaternion.fromEulerDegrees(0, 0, angle)
    }, 10)
  }

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, { text: 'angle += rpm×6 × dt (degrees/s)\nX/Y/Z axis spin\nUse: spinning coin, fan, radar, sign', fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08 })
  console.log('[TA2] RotationLoop initialized — 3 axes demo')
}

// ─── TA3 — Scale Pulse ────────────────────────────────────────────────────────

export function setupTAPulse(): void {
  const { x, z } = { x: 120, z: 108 }
  createStation('ta3_pulse', 'TA3 — SCALE PULSE\nBreathing / attention effect', STATUS_COLOR.FULLY_CODED)

  const configs = [
    { offset: Vector3.create(x - 2, 1.2, z), base: 1.0, amp: 0.3, freq: 1.0, label: 'Slow\nBreath', color: Color4.create(0.3, 1, 0.5, 1) },
    { offset: Vector3.create(x,     1.2, z), base: 0.9, amp: 0.5, freq: 2.5, label: 'Fast\nPulse', color: Color4.create(1, 0.4, 0.4, 1) },
    { offset: Vector3.create(x + 2, 1.2, z), base: 0.7, amp: 0.6, freq: 4.0, label: 'Rapid\nFlash', color: Color4.create(1, 0.9, 0.2, 1) },
  ]

  for (const cfg of configs) {
    const ent = engine.addEntity()
    Transform.create(ent, { position: cfg.offset, scale: Vector3.create(cfg.base, cfg.base, cfg.base) })
    MeshRenderer.setCylinder(ent)
    Material.setPbrMaterial(ent, { albedoColor: cfg.color, emissiveColor: { r: cfg.color.r * 0.4, g: cfg.color.g * 0.4, b: cfg.color.b * 0.4 }, emissiveIntensity: 0.6 })

    const lbl = engine.addEntity(); Transform.create(lbl, { position: Vector3.create(cfg.offset.x, cfg.offset.y + 1.4, cfg.offset.z) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: cfg.label, fontSize: 0.9, textColor: cfg.color })

    let ph = 0; const b = cfg.base; const a = cfg.amp; const f = cfg.freq * Math.PI * 2
    engine.addSystem((dt: number) => {
      ph += dt * f
      const s = b + Math.sin(ph) * a
      Transform.getMutable(ent).scale = Vector3.create(s, s, s)
      Material.setPbrMaterial(ent, { albedoColor: cfg.color, emissiveColor: { r: cfg.color.r * 0.4, g: cfg.color.g * 0.4, b: cfg.color.b * 0.4 }, emissiveIntensity: 0.4 + (Math.sin(ph) * 0.5 + 0.5) * 1.2 })
    }, 10)
  }

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, { text: 's = base + sin(t×freq×2π)×amp\nEmissive also pulses for extra effect\nUse: health pickup, checkpoint glow', fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08 })
  console.log('[TA3] ScalePulse initialized — slow/medium/fast variants')
}

// ─── TA4 — Waypoint Path ──────────────────────────────────────────────────────

export function setupTAWaypoint(): void {
  const { x, z } = { x: 132, z: 108 }
  createStation('ta4_waypoint', 'TA4 — WAYPOINT PATH\nObject follows ordered points', STATUS_COLOR.FULLY_CODED)

  const waypoints = [
    Vector3.create(x - 3, 1.2, z - 2.5),
    Vector3.create(x + 3, 1.5, z - 2.5),
    Vector3.create(x + 3, 2.0, z + 2.5),
    Vector3.create(x - 3, 1.2, z + 2.5),
    Vector3.create(x,     2.5, z),          // center/top
  ]

  // Show waypoint markers
  for (let i = 0; i < waypoints.length; i++) {
    const mk = engine.addEntity()
    Transform.create(mk, { position: waypoints[i], scale: Vector3.create(0.2, 0.2, 0.2) })
    MeshRenderer.setCylinder(mk)
    Material.setPbrMaterial(mk, { albedoColor: Color4.create(0.3, 0.9, 1, 1), emissiveColor: { r: 0, g: 0.3, b: 0.4 }, emissiveIntensity: 0.8 })
    const lk = engine.addEntity(); Transform.create(lk, { position: Vector3.create(waypoints[i].x, waypoints[i].y + 0.4, waypoints[i].z) }); Billboard.create(lk, {})
    TextShape.create(lk, { text: `${i + 1}`, fontSize: 1.0, textColor: Color4.create(0.5, 1, 1, 1) })
  }

  // Moving entity
  const mover = engine.addEntity()
  Transform.create(mover, { position: waypoints[0], scale: Vector3.create(0.7, 0.7, 0.7) })
  MeshRenderer.setBox(mover)
  Material.setPbrMaterial(mover, { albedoColor: Color4.create(1, 0.5, 0.2, 1), emissiveColor: { r: 0.4, g: 0.2, b: 0 }, emissiveIntensity: 0.6 })

  let curWP = 0; let nextWP = 1; let t = 0; const SPEED = 1.5

  engine.addSystem((dt: number) => {
    const from = waypoints[curWP]; const to = waypoints[nextWP]
    const dx = to.x - from.x; const dy = to.y - from.y; const dz = to.z - from.z
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
    t += (SPEED / dist) * dt
    if (t >= 1) {
      t = 0; curWP = nextWP; nextWP = (nextWP + 1) % waypoints.length
    }
    const p = Transform.getMutable(mover)
    p.position = Vector3.create(from.x + dx * t, from.y + dy * t, from.z + dz * t)
  }, 10)

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.5, z) }); Billboard.create(info, {})
  TextShape.create(info, { text: 'Lerp from→to, advance waypoint at t=1\nLoop back to 0 — any N waypoints\nUse: moving hazard, patrol light', fontSize: 1.1, textColor: Color4.create(1, 0.85, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08 })
  console.log('[TA4] WaypointPath initialized — 5 waypoints, loops')
}

// ─── TA5 — Orbit ──────────────────────────────────────────────────────────────

export function setupTAOrbit(): void {
  const { x, z } = { x: 144, z: 108 }
  createStation('ta5_orbit', 'TA5 — ORBIT\nCircles a center point', STATUS_COLOR.FULLY_CODED)

  // Central "planet"
  const planet = engine.addEntity()
  Transform.create(planet, { position: Vector3.create(x, 1.5, z), scale: Vector3.create(1.0, 1.0, 1.0) })
  MeshRenderer.setCylinder(planet)
  Material.setPbrMaterial(planet, { albedoColor: Color4.create(0.2, 0.4, 0.9, 1), emissiveColor: { r: 0.05, g: 0.1, b: 0.4 }, emissiveIntensity: 0.4 })

  // Three orbiting moons at different radii and speeds
  const orbits = [
    { radius: 2.0, speed: 1.5,  height: 1.5, scale: 0.35, color: Color4.create(0.9, 0.9, 0.9, 1) },
    { radius: 3.2, speed: 0.8,  height: 1.8, scale: 0.5,  color: Color4.create(0.9, 0.5, 0.2, 1) },
    { radius: 1.3, speed: 2.5,  height: 1.2, scale: 0.2,  color: Color4.create(0.3, 1, 0.5, 1) },
  ]

  for (const orb of orbits) {
    const moon = engine.addEntity()
    Transform.create(moon, { position: Vector3.create(x + orb.radius, orb.height, z), scale: Vector3.create(orb.scale, orb.scale, orb.scale) })
    MeshRenderer.setCylinder(moon)
    Material.setPbrMaterial(moon, { albedoColor: orb.color, emissiveColor: { r: orb.color.r * 0.3, g: orb.color.g * 0.3, b: orb.color.b * 0.3 }, emissiveIntensity: 0.6 })

    let angle = Math.random() * Math.PI * 2; const r = orb.radius; const h = orb.height; const s = orb.speed
    engine.addSystem((dt: number) => {
      angle += s * dt
      Transform.getMutable(moon).position = Vector3.create(x + Math.cos(angle) * r, h, z + Math.sin(angle) * r)
    }, 10)
  }

  const orbitRing = engine.addEntity()
  Transform.create(orbitRing, { position: Vector3.create(x, 0.52, z), scale: Vector3.create(6.4, 0.06, 6.4) })
  MeshRenderer.setCylinder(orbitRing)
  Material.setPbrMaterial(orbitRing, { albedoColor: Color4.create(0.3, 0.3, 0.5, 0.3) })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, { text: 'x=cx+cos(angle)×r, z=cy+sin(angle)×r\nangle += speed×dt (radians)\nUse: guard patrol, decorative ring', fontSize: 1.1, textColor: Color4.create(0.9, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08 })
  console.log('[TA5] Orbit initialized — 3 moons at different radii/speeds')
}
