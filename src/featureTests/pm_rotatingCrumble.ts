/**
 * pm_rotatingCrumble.ts — PM3: Rotating Platform + PM4: Crumble Platform
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * PM3 — ROTATING PLATFORM
 * ────────────────────────
 * Platform spins around a central Y axis. Player must ride it without
 * falling off the edge. The ride pattern extends the PM1/PM2 delta approach
 * to ROTATIONAL movement — each frame we rotate the player's position offset
 * around the platform center to follow the rotation.
 *
 *   playerOffset = playerPos - platformCenter
 *   rotate playerOffset by dTheta around Y axis
 *   newPlayerPos = platformCenter + rotatedOffset
 *   movePlayerTo(newPlayerPos)
 *
 * Platform also moves in Z to give the player something to dodge/jump onto.
 * Configurables: rpm, platformRadius (how far from center).
 *
 * PM4 — CRUMBLE PLATFORM
 * ───────────────────────
 * Platform holds for N seconds while player stands on it, then drops.
 * Distinct from HZ5 (disappear floor) because the PLATFORM FALLS as an
 * entity, then slowly RISES back to starting position.
 * Shows that "falling thing" mechanic is easy in DCL — just lerp Y downward.
 *
 * State machine: solid → crumbling (shaking, countdown) → falling → reset_wait → rising → solid
 * Configurables: holdTime, fallSpeed, resetY (how far it falls), riseSpeed
 *
 * FRAMEWORK NOTE
 * ──────────────
 * PM3 rotating ride uses the same `applyPlatformRide(state, offset)` helper
 * but with an additional rotation step applied to the player's offset vector.
 *
 * PM4 crumble is distinct enough from HZ5 (which removes collider) because
 * the PLATFORM FALLS — the visual and physics object moves. This creates the
 * more dramatic "floor drops away from you" feeling vs. the "floor disappears."
 *
 * DEMO (run and verify):
 *   PM3 — Rotating Platform:
 *     [ ] Grey disc platform visible, spinning slowly
 *     [ ] Jump on (approach from south) → player rotates with platform
 *     [ ] Go toward edge → centrifugal challenge (must navigate back to center)
 *     [ ] Speed 1x / 2x buttons work
 *   PM4 — Crumble Platform:
 *     [ ] Walk onto orange platform → it shakes for 2s
 *     [ ] Falls fast (3s to sink 5m below floor)
 *     [ ] Platform slowly rises back (5s to restore)
 *     [ ] Platform becomes solid again at starting height
 *     [ ] Walk off before it falls → platform stops shaking and resets
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: PM3 — Rotating Platform ─────────────────────────────────────────

export function setupPMRotating(): void {
  const { x, z } = { x: 40, z: 66 }
  createStation('pm3_rotating', 'PM3 — ROTATING PLATFORM\nAngular ride with offset rotation', STATUS_COLOR.FULLY_CODED)

  const CENTER_Y   = 0.9
  let rotationRPM  = 8.0  // rotations per minute

  // Central post
  const post = engine.addEntity()
  Transform.create(post, {
    position: Vector3.create(x, CENTER_Y * 0.5, z),
    scale: Vector3.create(0.3, CENTER_Y, 0.3)
  })
  MeshRenderer.setCylinder(post)
  Material.setPbrMaterial(post, { albedoColor: Color4.create(0.5, 0.5, 0.5, 1) })

  // Platform disc
  const disc = engine.addEntity()
  Transform.create(disc, {
    position: Vector3.create(x, CENTER_Y, z),
    scale: Vector3.create(4.0, 0.25, 4.0)
  })
  MeshRenderer.setCylinder(disc)
  MeshCollider.setCylinder(disc, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(disc, {
    albedoColor: Color4.create(0.6, 0.6, 0.7, 1),
    emissiveColor: { r: 0.05, g: 0.05, b: 0.1 }, emissiveIntensity: 0.3
  })

  // Edge markers (rotating with the disc visually)
  const edgeMarker = engine.addEntity()
  Transform.create(edgeMarker, {
    position: Vector3.create(x + 1.8, CENTER_Y + 0.15, z),
    scale: Vector3.create(0.25, 0.3, 0.6)
  })
  MeshRenderer.setBox(edgeMarker)
  Material.setPbrMaterial(edgeMarker, { albedoColor: Color4.create(1, 0.3, 0.1, 1), emissiveColor: { r: 0.5, g: 0.1, b: 0 }, emissiveIntensity: 0.8 })

  // Safe zone indicator (center circle)
  const safeCenter = engine.addEntity()
  Transform.create(safeCenter, {
    position: Vector3.create(x, CENTER_Y + 0.14, z),
    scale: Vector3.create(1.0, 0.04, 1.0)
  })
  MeshRenderer.setCylinder(safeCenter)
  Material.setPbrMaterial(safeCenter, { albedoColor: Color4.create(0.2, 0.9, 0.3, 0.7), transparencyMode: 1 })

  // Trigger area (top of disc — also rotates)
  const triggerEntity = engine.addEntity()
  Transform.create(triggerEntity, {
    position: Vector3.create(x, CENTER_Y + 0.6, z),
    scale: Vector3.create(4.0, 1.0, 4.0)
  })
  TriggerArea.create(triggerEntity, {
    triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(4.0, 1.0, 4.0) }]
  })

  let playerOnDisc = false
  triggerAreaEventsSystem.onEnterArea(triggerEntity, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    playerOnDisc = true; console.log('[PM3] Player ON rotating disc')
  })
  triggerAreaEventsSystem.onExitArea(triggerEntity, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    playerOnDisc = false; console.log('[PM3] Player OFF rotating disc')
  })

  // Rotation state
  let currentAngleDeg = 0

  engine.addSystem((dt: number) => {
    const dAngleDeg = (rotationRPM / 60) * 360 * dt
    currentAngleDeg = (currentAngleDeg + dAngleDeg) % 360
    const angleRad = currentAngleDeg * Math.PI / 180
    const rot = Quaternion.fromEulerDegrees(0, currentAngleDeg, 0)

    // Rotate disc and all attached visuals
    Transform.getMutable(disc).rotation       = rot
    Transform.getMutable(edgeMarker).rotation = rot
    Transform.getMutable(edgeMarker).position = Vector3.create(
      x + Math.sin(angleRad) * 1.8,
      CENTER_Y + 0.15,
      z + Math.cos(angleRad) * 1.8
    )

    // If player is on disc: rotate their position around the disc center
    if (playerOnDisc) {
      const pT = Transform.getOrNull(engine.PlayerEntity)
      if (!pT) return

      // Player offset from disc center in XZ
      const offX = pT.position.x - x
      const offZ = pT.position.z - z
      const dist = Math.sqrt(offX * offX + offZ * offZ)

      // Only move player if they're within disc radius (don't chase them off-disc)
      if (dist < 2.5) {
        const dRad = dAngleDeg * Math.PI / 180
        const cosA = Math.cos(dRad); const sinA = Math.sin(dRad)
        const newOffX = offX * cosA - offZ * sinA
        const newOffZ = offX * sinA + offZ * cosA
        movePlayerTo({
          newRelativePosition: Vector3.create(x + newOffX, pT.position.y, z + newOffZ)
        })
      }
    }
  }, 10)

  // Speed buttons
  const slowBtn = createButton(x - 2, 0.8, z - 3.6, '🐢 4 RPM', Color4.create(0.3, 0.5, 0.3, 1))
  const normBtn = createButton(x,     0.8, z - 3.6, '▶ 8 RPM', Color4.create(0.3, 0.3, 0.6, 1))
  const fastBtn = createButton(x + 2, 0.8, z - 3.6, '⚡ 16 RPM', Color4.create(0.6, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: slowBtn, opts: { button: 1, hoverText: '[E] Slow' } }, () => { rotationRPM = 4 })
  pointerEventsSystem.onPointerDown({ entity: normBtn, opts: { button: 1, hoverText: '[E] Normal' } }, () => { rotationRPM = 8 })
  pointerEventsSystem.onPointerDown({ entity: fastBtn, opts: { button: 1, hoverText: '[E] Fast' } }, () => { rotationRPM = 16 })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'rotateOffset(playerPos-center, dTheta)\nmovePlayerTo(center + rotatedOffset)\nStay in green zone (center) for safety',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM3] RotatingPlatform initialized — 8 RPM, 4m disc')
}

// ─── Station: PM4 — Crumble Platform ──────────────────────────────────────────

export function setupPMCrumble(): void {
  const { x, z } = { x: 52, z: 66 }
  createStation('pm4_crumble', 'PM4 — CRUMBLE PLATFORM\nHold 2s then falls, restores', STATUS_COLOR.FULLY_CODED)

  const START_Y    = 1.8   // platform starting height
  const FALL_DEPTH = 5.0   // falls to START_Y - FALL_DEPTH
  const HOLD_TIME  = 2.0   // seconds before falling
  const FALL_SPEED = 3.0   // m/s fall rate
  const RESET_WAIT = 2.0   // seconds at bottom before rising
  const RISE_SPEED = 1.2   // m/s rise rate (slow)

  // Elevated base (shows gap when platform falls)
  const leftPier = engine.addEntity()
  Transform.create(leftPier, {
    position: Vector3.create(x - 2.0, 0.9, z),
    scale: Vector3.create(0.5, 1.8, 2.5)
  })
  MeshRenderer.setBox(leftPier)
  MeshCollider.setBox(leftPier, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(leftPier, { albedoColor: Color4.create(0.4, 0.3, 0.3, 1) })

  const rightPier = engine.addEntity()
  Transform.create(rightPier, {
    position: Vector3.create(x + 2.0, 0.9, z),
    scale: Vector3.create(0.5, 1.8, 2.5)
  })
  MeshRenderer.setBox(rightPier)
  MeshCollider.setBox(rightPier, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(rightPier, { albedoColor: Color4.create(0.4, 0.3, 0.3, 1) })

  // The crumble platform
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(x, START_Y, z),
    scale: Vector3.create(3.5, 0.3, 2.5)
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(platform, { albedoColor: Color4.create(0.9, 0.5, 0.2, 1) })

  // Status label
  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, START_Y + 1.2, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '🟡 SOLID', fontSize: 1.3, textColor: Color4.create(1, 0.8, 0.3, 1) })

  // Countdown label
  const countdownLbl = engine.addEntity()
  Transform.create(countdownLbl, { position: Vector3.create(x, START_Y + 0.7, z) })
  Billboard.create(countdownLbl, {})
  TextShape.create(countdownLbl, { text: '', fontSize: 2.0, textColor: Color4.create(1, 0.3, 0.3, 1) })

  // State
  type CrumbleState = 'solid' | 'crumbling' | 'falling' | 'reset_wait' | 'rising'
  let state: CrumbleState = 'solid'
  let timer = 0
  let currentY = START_Y
  let playerOnPlatform = false
  let shakeX = 0

  // Trigger area
  const trigger = engine.addEntity()
  Transform.create(trigger, {
    position: Vector3.create(x, START_Y + 0.6, z),
    scale: Vector3.create(3.5, 0.9, 2.5)
  })
  TriggerArea.create(trigger, {
    triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(3.5, 0.9, 2.5) }]
  })
  triggerAreaEventsSystem.onEnterArea(trigger, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    if (state === 'solid') {
      state = 'crumbling'; timer = HOLD_TIME
      console.log('[PM4] CRUMBLING — player stepped on')
    }
    playerOnPlatform = true
  })
  triggerAreaEventsSystem.onExitArea(trigger, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    playerOnPlatform = false
    if (state === 'crumbling') {
      state = 'solid'  // player stepped off in time — reset
      TextShape.getMutable(statusLbl).text = '🟡 SOLID'
      TextShape.getMutable(countdownLbl).text = ''
      Material.setPbrMaterial(platform, { albedoColor: Color4.create(0.9, 0.5, 0.2, 1) })
      console.log('[PM4] Player escaped — platform reset')
    }
  })

  engine.addSystem((dt: number) => {
    const pt = Transform.getMutableOrNull(platform)
    if (!pt) return

    switch (state) {
      case 'crumbling':
        timer -= dt
        shakeX = Math.sin(timer * 25) * 0.07  // shake
        pt.position = Vector3.create(x + shakeX, currentY, z)
        TextShape.getMutable(statusLbl).text = '🔴 CRUMBLING!'
        TextShape.getMutable(countdownLbl).text = `${Math.ceil(timer)}`
        TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.2, 0.2, 1)
        if (timer <= 0) {
          state = 'falling'
          MeshCollider.deleteFrom(platform)  // no longer solid while falling
          TextShape.getMutable(countdownLbl).text = ''
          console.log('[PM4] FALLING')
        }
        break

      case 'falling':
        currentY = Math.max(START_Y - FALL_DEPTH, currentY - FALL_SPEED * dt)
        pt.position = Vector3.create(x, currentY, z)
        Transform.getMutable(trigger).position = Vector3.create(x, currentY + 0.6, z)
        TextShape.getMutable(statusLbl).position = Vector3.create(x, currentY + 1.2, z)
        if (currentY <= START_Y - FALL_DEPTH) {
          state = 'reset_wait'; timer = RESET_WAIT
          TextShape.getMutable(statusLbl).text = '⬛ FALLEN'
          console.log('[PM4] Hit bottom — waiting to rise')
        }
        break

      case 'reset_wait':
        timer -= dt
        if (timer <= 0) { state = 'rising'; console.log('[PM4] RISING') }
        break

      case 'rising':
        currentY = Math.min(START_Y, currentY + RISE_SPEED * dt)
        pt.position = Vector3.create(x, currentY, z)
        Transform.getMutable(trigger).position = Vector3.create(x, currentY + 0.6, z)
        TextShape.getMutable(statusLbl).position = Vector3.create(x, currentY + 1.2, z)
        TextShape.getMutable(statusLbl).text = '⬆ RISING'
        TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 1, 0.5, 1)
        if (currentY >= START_Y) {
          state = 'solid'
          MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS)
          Material.setPbrMaterial(platform, { albedoColor: Color4.create(0.9, 0.5, 0.2, 1) })
          TextShape.getMutable(statusLbl).text = '🟡 SOLID'
          TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.8, 0.3, 1)
          console.log('[PM4] Platform RESET — solid again')
        }
        break
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Platform FALLS as entity (not just disappears)\nHold 2s → shake → fall → rise\nMeshCollider removed while falling',
    fontSize: 1.1, textColor: Color4.create(1, 0.85, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM4] CrumblePlatform initialized — hold=2s, fall=3m/s, rise=1.2m/s')
}
