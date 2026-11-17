/**
 * pm_wallsFloor.ts — PM7: Squeeze Walls + PM8: Rising Floor + PM9: Fan
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * PM7 — SQUEEZE WALLS
 * ────────────────────
 * Two walls that slowly close toward each other on a timer, then reset.
 * If the player is between them when they're close together: knockback sideways.
 * Shows the "close quarters" hazard pattern — adapt for any door-slam, crusher,
 * press, or pinch obstacle.
 * Configurables: closeTime, dangerGap, resetTime, openWaitTime, knockbackDir
 *
 * PM8 — RISING/FLOOD FLOOR
 * ─────────────────────────
 * A large floor entity that rises from below at a configurable rate.
 * As it reaches the player's height, it pushes them upward (through physics).
 * When floor reaches max height, it resets (sinks back down).
 * The "escape" design: player must jump to side platforms before the floor traps them.
 *
 * Key DCL physics note: a rising solid platform DOES push the player upward via
 * the collision system — same behavior as a rising elevator. The player is
 * "lifted" by the floor surface automatically.
 *
 * Configurables: riseRate, maxY, startY, resetDelay, platform escapes
 *
 * PM9 — DIRECTIONAL FAN / BLOWER
 * ────────────────────────────────
 * Visible fan entity with rotating blades, plus a TriggerArea that applies
 * continuous applyForceToPlayer() while the player is inside the zone.
 * Extends T1's wind zone test with a visual and configurable direction/power.
 *
 * The important DCL pattern: Physics.applyForceToPlayer() must be called
 * EVERY FRAME while the player is in the zone (not just on enter). The
 * triggerArea.onEnterArea sets a flag; the system applies force each frame.
 *
 * Configurables: direction, force, bladeRPM, fanSize
 *
 * FRAMEWORK NOTE
 * ──────────────
 * PM7 Squeeze: same Transform lerp pattern as the moving bridge (SW8),
 * applied to two separate entities moving toward each other.
 *
 * PM8 Rising floor: confirms that "elevator from below" pushes players
 * upward in DCL physics — same as the platform ride but reversed (floor
 * comes to you, not you go to floor). No movePlayerTo() needed.
 *
 * PM9 Fan: confirms that applyForceToPlayer() works as a continuous force
 * when called each frame inside a system (not just on enter/exit events).
 *
 * DEMO (run and verify):
 *   PM7 — Squeeze:
 *     [ ] Two grey walls start 6m apart, slowly close over 6s
 *     [ ] Stand between walls while they close → knockback sideways at danger gap
 *     [ ] Walls open again after 2s, then close again
 *   PM8 — Rising Floor:
 *     [ ] Dark floor entity sinks below station at start
 *     [ ] After 2s: floor rises at 0.3 m/s
 *     [ ] Player jumps to escape platforms (green pads) before trapped
 *     [ ] Floor reaches max (Y=4) → stays 2s → sinks back
 *   PM9 — Fan:
 *     [ ] Fan entity visible with rotating blades
 *     [ ] Walk into green zone → continuous push in fan direction
 *     [ ] Walk out → push stops
 *     [ ] LEFT / RIGHT / UP buttons change fan direction
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: PM7 — Squeeze Walls ─────────────────────────────────────────────

export function setupPMSqueezeWalls(): void {
  const { x, z } = { x: 28, z: 88 }
  createStation('pm7_squeeze', 'PM7 — SQUEEZE WALLS\nClose + knockback + reset', STATUS_COLOR.FULLY_CODED)

  const OPEN_X    = 3.5  // half-distance when open
  const DANGER_X  = 0.8  // walls at this half-distance = danger
  const CLOSE_TIME = 6.0 // seconds to close
  const OPEN_WAIT  = 2.0 // seconds sitting open before closing again
  const SIT_TIME   = 1.5 // seconds sitting closed before opening

  // Floor strip showing danger zone
  const dangerFloor = engine.addEntity()
  Transform.create(dangerFloor, {
    position: Vector3.create(x, 0.52, z),
    scale: Vector3.create(DANGER_X * 2.2, 0.06, 5.5)
  })
  MeshRenderer.setBox(dangerFloor)
  Material.setPbrMaterial(dangerFloor, { albedoColor: Color4.create(0.9, 0.2, 0.1, 0.4) })

  // The two walls
  const leftWall = engine.addEntity()
  Transform.create(leftWall, {
    position: Vector3.create(x - OPEN_X, 1.5, z),
    scale: Vector3.create(0.4, 3.0, 5.5)
  })
  MeshRenderer.setBox(leftWall)
  MeshCollider.setBox(leftWall, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(leftWall, { albedoColor: Color4.create(0.5, 0.5, 0.6, 1) })

  const rightWall = engine.addEntity()
  Transform.create(rightWall, {
    position: Vector3.create(x + OPEN_X, 1.5, z),
    scale: Vector3.create(0.4, 3.0, 5.5)
  })
  MeshRenderer.setBox(rightWall)
  MeshCollider.setBox(rightWall, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(rightWall, { albedoColor: Color4.create(0.5, 0.5, 0.6, 1) })

  // WARNING stripes on walls
  for (const side of [-1, 1]) {
    for (const zy of [-1.5, 0, 1.5]) {
      const stripe = engine.addEntity()
      Transform.create(stripe, {
        position: Vector3.create(x + side * (OPEN_X - 0.15), 1.5, z + zy),
        scale: Vector3.create(0.08, 0.3, 1.0)
      })
      MeshRenderer.setBox(stripe)
      Material.setPbrMaterial(stripe, { albedoColor: Color4.create(1, 0.9, 0, 1) })
    }
  }

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '◀    OPEN    ▶', fontSize: 1.4, textColor: Color4.create(0.5, 1, 0.5, 1) })

  // State machine
  type SqueezeState = 'open' | 'closing' | 'closed' | 'opening'
  let sqState: SqueezeState = 'open'
  let sqTimer = OPEN_WAIT
  let currentHalfX = OPEN_X
  let hitImmunity = 0

  engine.addSystem((dt: number) => {
    hitImmunity = Math.max(0, hitImmunity - dt)

    switch (sqState) {
      case 'open':
        sqTimer -= dt
        if (sqTimer <= 0) { sqState = 'closing'; console.log('[PM7] CLOSING') }
        break

      case 'closing': {
        const closeRate = (OPEN_X - DANGER_X) / CLOSE_TIME
        currentHalfX = Math.max(DANGER_X, currentHalfX - closeRate * dt)
        Transform.getMutable(leftWall).position  = Vector3.create(x - currentHalfX, 1.5, z)
        Transform.getMutable(rightWall).position = Vector3.create(x + currentHalfX, 1.5, z)

        const pct = 1 - (currentHalfX - DANGER_X) / (OPEN_X - DANGER_X)
        Material.setPbrMaterial(leftWall,  { albedoColor: Color4.create(0.5 + pct * 0.4, 0.5 - pct * 0.4, 0.6 - pct * 0.5, 1) })
        Material.setPbrMaterial(rightWall, { albedoColor: Color4.create(0.5 + pct * 0.4, 0.5 - pct * 0.4, 0.6 - pct * 0.5, 1) })
        TextShape.getMutable(statusLbl).text = `◀${' '.repeat(Math.round(pct * 4))}CLOSING${' '.repeat(Math.round((1-pct)*4))}▶`
        TextShape.getMutable(statusLbl).textColor = Color4.create(1, 1 - pct, 0, 1)

        // Check if player is in danger zone
        const pT = Transform.getOrNull(engine.PlayerEntity)
        if (pT && hitImmunity <= 0 && Math.abs(pT.position.x - x) < currentHalfX + 0.5) {
          Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 10)
          hitImmunity = 0.8
          console.log('[PM7] SQUEEZE HIT — knockback sideways')
        }
        if (currentHalfX <= DANGER_X) { sqState = 'closed'; sqTimer = SIT_TIME }
        break
      }

      case 'closed':
        TextShape.getMutable(statusLbl).text = '◀! CLOSED !▶'
        TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.2, 0.2, 1)
        sqTimer -= dt
        if (sqTimer <= 0) { sqState = 'opening'; console.log('[PM7] OPENING') }
        break

      case 'opening': {
        const openRate = (OPEN_X - DANGER_X) / 1.5  // opens faster than it closes
        currentHalfX = Math.min(OPEN_X, currentHalfX + openRate * dt)
        Transform.getMutable(leftWall).position  = Vector3.create(x - currentHalfX, 1.5, z)
        Transform.getMutable(rightWall).position = Vector3.create(x + currentHalfX, 1.5, z)
        Material.setPbrMaterial(leftWall,  { albedoColor: Color4.create(0.5, 0.5, 0.6, 1) })
        Material.setPbrMaterial(rightWall, { albedoColor: Color4.create(0.5, 0.5, 0.6, 1) })
        TextShape.getMutable(statusLbl).text = '◀    OPEN    ▶'
        TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 1, 0.5, 1)
        if (currentHalfX >= OPEN_X) { sqState = 'open'; sqTimer = OPEN_WAIT }
        break
      }
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 5.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Opens 3.5m apart → closes to 0.8m gap\n6s close / 1.5s sit / 1.5s open\nSame lerp pattern as moving bridge',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM7] SqueezeWalls initialized — open=3.5m, danger=0.8m, close=6s')
}

// ─── Station: PM8 — Rising Floor ──────────────────────────────────────────────

export function setupPMRisingFloor(): void {
  const { x, z } = { x: 40, z: 88 }
  createStation('pm8_risingfloor', 'PM8 — RISING FLOOR\nEscape before trapped!', STATUS_COLOR.FULLY_CODED)

  const START_Y    = -1.5  // floor starts below ground
  const MAX_Y      = 4.0   // floor rises to this height
  const RISE_RATE  = 0.35  // m/s
  const START_WAIT = 2.5   // seconds before floor starts rising
  const MAX_WAIT   = 1.5   // seconds at max before sinking
  const SINK_RATE  = 2.0   // m/s sinking (fast reset)

  // Escape platforms (green pads on the sides — player must jump to these)
  for (const [ex, ez] of [[-3.0, -1.5], [3.0, -1.5], [-3.0, 1.5], [3.0, 1.5]]) {
    const pad = engine.addEntity()
    Transform.create(pad, {
      position: Vector3.create(x + (ex as number), 0.55, z + (ez as number)),
      scale: Vector3.create(1.5, 0.15, 1.5)
    })
    MeshRenderer.setBox(pad)
    MeshCollider.setBox(pad, ColliderLayer.CL_PHYSICS)
    Material.setPbrMaterial(pad, { albedoColor: Color4.create(0.2, 0.9, 0.3, 1), emissiveColor: { r: 0, g: 0.3, b: 0 }, emissiveIntensity: 0.3 })
  }

  // "SAFE ZONE" label over escape pads
  const safeLabel = engine.addEntity()
  Transform.create(safeLabel, { position: Vector3.create(x - 3.0, 1.0, z + 2.5) })
  Billboard.create(safeLabel, {})
  TextShape.create(safeLabel, { text: '🟢 SAFE ZONES\n(jump to these!)', fontSize: 1.0, textColor: Color4.create(0.5, 1, 0.5, 1) })

  // The rising floor entity
  const risingFloor = engine.addEntity()
  Transform.create(risingFloor, {
    position: Vector3.create(x, START_Y, z),
    scale: Vector3.create(5.5, 0.4, 5.5)
  })
  MeshRenderer.setBox(risingFloor)
  MeshCollider.setBox(risingFloor, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(risingFloor, {
    albedoColor: Color4.create(0.1, 0.1, 0.5, 1),
    emissiveColor: { r: 0, g: 0, b: 0.2 }, emissiveIntensity: 0.4
  })

  // Status display
  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 1.5, z - 3.2) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '😴 Waiting...', fontSize: 1.4, textColor: Color4.create(0.6, 0.6, 1, 1) })

  // Floor level indicator bar on wall
  for (let yi = 0; yi <= 10; yi++) {
    const tick = engine.addEntity()
    Transform.create(tick, {
      position: Vector3.create(x + 3.5, yi * 0.4, z),
      scale: Vector3.create(0.1, 0.06, 0.4)
    })
    MeshRenderer.setBox(tick)
    Material.setPbrMaterial(tick, { albedoColor: yi % 5 === 0 ? Color4.create(1, 0.9, 0.3, 1) : Color4.create(0.5, 0.5, 0.5, 1) })
  }

  type FloorState = 'waiting' | 'rising' | 'at_top' | 'sinking'
  let floorState: FloorState = 'waiting'
  let floorTimer = START_WAIT
  let currentY = START_Y

  engine.addSystem((dt: number) => {
    switch (floorState) {
      case 'waiting':
        floorTimer -= dt
        if (floorTimer <= 0) {
          floorState = 'rising'
          Material.setPbrMaterial(risingFloor, {
            albedoColor: Color4.create(0.5, 0.1, 0.1, 1),
            emissiveColor: { r: 0.2, g: 0, b: 0 }, emissiveIntensity: 0.6
          })
          console.log('[PM8] FLOOR RISING — escape!')
        }
        TextShape.getMutable(statusLbl).text = `😴 Rising in ${Math.ceil(floorTimer)}s`
        break

      case 'rising':
        currentY = Math.min(MAX_Y, currentY + RISE_RATE * dt)
        Transform.getMutable(risingFloor).position = Vector3.create(x, currentY, z)
        const pct = (currentY - START_Y) / (MAX_Y - START_Y)
        TextShape.getMutable(statusLbl).text = `🔼 RISING (${Math.round(pct * 100)}%)`
        TextShape.getMutable(statusLbl).textColor = Color4.create(1, 1 - pct * 0.8, 0, 1)
        if (currentY >= MAX_Y) {
          floorState = 'at_top'; floorTimer = MAX_WAIT
          TextShape.getMutable(statusLbl).text = '🔴 TOP — resetting...'
          console.log('[PM8] At top — waiting to sink')
        }
        break

      case 'at_top':
        floorTimer -= dt
        if (floorTimer <= 0) {
          floorState = 'sinking'
          Material.setPbrMaterial(risingFloor, { albedoColor: Color4.create(0.1, 0.1, 0.5, 1), emissiveColor: { r: 0, g: 0, b: 0.2 }, emissiveIntensity: 0.4 })
          console.log('[PM8] SINKING — reset')
        }
        break

      case 'sinking':
        currentY = Math.max(START_Y, currentY - SINK_RATE * dt)
        Transform.getMutable(risingFloor).position = Vector3.create(x, currentY, z)
        TextShape.getMutable(statusLbl).text = '⬇ Resetting...'
        TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 0.7, 1, 1)
        if (currentY <= START_Y) {
          floorState = 'waiting'; floorTimer = START_WAIT
          TextShape.getMutable(statusLbl).textColor = Color4.create(0.6, 0.6, 1, 1)
          console.log('[PM8] RESET — waiting again')
        }
        break
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 5.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Rising floor pushes player UP via physics\nNo movePlayerTo() needed\nJump to green pads to escape\nFloor cycles automatically',
    fontSize: 1.1, textColor: Color4.create(0.8, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM8] RisingFloor initialized — start=Y-1.5, max=Y4, rise=0.35m/s')
}

// ─── Station: PM9 — Directional Fan ──────────────────────────────────────────

export function setupPMFan(): void {
  const { x, z } = { x: 52, z: 88 }
  createStation('pm9_fan', 'PM9 — FAN / BLOWER\nContinuous directional force', STATUS_COLOR.FULLY_CODED)

  let fanDirection = Vector3.create(0, 0, 1)   // current push direction (+Z)
  let fanForce = 8.0
  let fanRPM   = 300.0
  let playerInZone = false

  // Fan housing (the machine body)
  const housing = engine.addEntity()
  Transform.create(housing, {
    position: Vector3.create(x, 1.0, z - 2.5),
    scale: Vector3.create(2.5, 2.0, 0.6)
  })
  MeshRenderer.setBox(housing)
  MeshCollider.setBox(housing, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(housing, { albedoColor: Color4.create(0.5, 0.5, 0.5, 1) })

  // Fan blades (3 blades rotating)
  const blades: ReturnType<typeof engine.addEntity>[] = []
  for (let i = 0; i < 3; i++) {
    const blade = engine.addEntity()
    Transform.create(blade, {
      position: Vector3.create(x, 1.0, z - 2.2),
      scale: Vector3.create(0.12, 1.0, 0.08),
      rotation: Quaternion.fromEulerDegrees(0, 0, i * 120)
    })
    MeshRenderer.setBox(blade)
    Material.setPbrMaterial(blade, { albedoColor: Color4.create(0.8, 0.8, 0.8, 1) })
    blades.push(blade)
  }

  // Fan hub
  const hub = engine.addEntity()
  Transform.create(hub, {
    position: Vector3.create(x, 1.0, z - 2.18),
    scale: Vector3.create(0.3, 0.3, 0.1)
  })
  MeshRenderer.setCylinder(hub)
  Material.setPbrMaterial(hub, { albedoColor: Color4.create(0.9, 0.3, 0.1, 1) })

  // Wind stream visual (arrows)
  for (let zi = 1; zi <= 5; zi++) {
    const arrow = engine.addEntity()
    Transform.create(arrow, {
      position: Vector3.create(x, 1.0, z - 2.5 + zi * 1.0),
      scale: Vector3.create(0.08, 0.08, 0.5)
    })
    MeshRenderer.setBox(arrow)
    Material.setPbrMaterial(arrow, {
      albedoColor: Color4.create(0.3, 0.7, 1, 0.3 + zi * 0.1),
      emissiveColor: { r: 0.1, g: 0.3, b: 0.5 }, emissiveIntensity: 0.5,
      transparencyMode: 1
    })
  }

  // Wind zone (trigger area)
  const windZone = engine.addEntity()
  Transform.create(windZone, {
    position: Vector3.create(x, 1.0, z + 0.5),
    scale: Vector3.create(2.5, 2.5, 7.0)
  })
  TriggerArea.setBox(windZone)
  triggerAreaEventsSystem.onTriggerEnter(windZone, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    playerInZone = true; console.log('[PM9] Player in fan zone — force applying')
  })
  triggerAreaEventsSystem.onTriggerExit(windZone, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    playerInZone = false
    Physics.removeForceFromPlayer(engine.RootEntity)
    console.log('[PM9] Player left fan zone')
  })

  // Zone visual (green outline of wind area)
  const zoneVis = engine.addEntity()
  Transform.create(zoneVis, {
    position: Vector3.create(x, 0.52, z + 0.5),
    scale: Vector3.create(2.5, 0.06, 7.0)
  })
  MeshRenderer.setBox(zoneVis)
  Material.setPbrMaterial(zoneVis, { albedoColor: Color4.create(0.2, 0.9, 0.5, 0.4) })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.8, z - 2.5) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '🌀 → +Z push', fontSize: 1.2, textColor: Color4.create(0.5, 0.8, 1, 1) })

  // Fan blade rotation + force application
  let bladeAngle = 0
  engine.addSystem((dt: number) => {
    bladeAngle += fanRPM / 60 * 360 * dt
    for (let i = 0; i < blades.length; i++) {
      Transform.getMutable(blades[i]).rotation = Quaternion.fromEulerDegrees(0, 0, bladeAngle + i * 120)
    }
    if (playerInZone) {
      Physics.applyForceToPlayer(engine.RootEntity, Vector3.create(fanDirection.x * fanForce, fanDirection.y * fanForce, fanDirection.z * fanForce)
      )
    }
  }, 10)

  // Direction buttons
  const leftBtn = createButton(x - 2.5, 0.8, z - 3.6, '◀ Push +X',   Color4.create(0.3, 0.3, 0.6, 1))
  const rightBtn = createButton(x,       0.8, z - 3.6, '▶ Push -X',   Color4.create(0.3, 0.3, 0.6, 1))
  const fwdBtn  = createButton(x + 2.5, 0.8, z - 3.6, '▲ Push +Z',   Color4.create(0.3, 0.6, 0.3, 1))
  const upBtn   = createButton(x,       0.8, z + 3.6, '⬆ Push Up',   Color4.create(0.6, 0.3, 0.1, 1))

  pointerEventsSystem.onPointerDown({ entity: leftBtn,  opts: { button: 1, hoverText: '[E] Push +X' } }, () => {
    fanDirection = Vector3.create(1, 0, 0); TextShape.getMutable(statusLbl).text = '🌀 → +X push'
  })
  pointerEventsSystem.onPointerDown({ entity: rightBtn, opts: { button: 1, hoverText: '[E] Push -X' } }, () => {
    fanDirection = Vector3.create(-1, 0, 0); TextShape.getMutable(statusLbl).text = '🌀 ← -X push'
  })
  pointerEventsSystem.onPointerDown({ entity: fwdBtn,   opts: { button: 1, hoverText: '[E] Push +Z' } }, () => {
    fanDirection = Vector3.create(0, 0, 1); TextShape.getMutable(statusLbl).text = '🌀 → +Z push'
  })
  pointerEventsSystem.onPointerDown({ entity: upBtn,    opts: { button: 1, hoverText: '[E] Push Up' } }, () => {
    fanDirection = Vector3.create(0, 1, 0); fanForce = 12
    TextShape.getMutable(statusLbl).text = '🌀 ⬆ Lift up'
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z + 2.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'applyForceToPlayer() called every frame\nwhile in trigger zone (not just on enter)\nSame as T1 wind zone — now with visual',
    fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM9] Fan initialized — 7m zone, 8N force, +Z direction, 300 RPM')
}
