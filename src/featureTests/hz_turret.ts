/**
 * hz_turret.ts — HZ7: Projectile Turret + HZ8: Laser Turret
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * HZ7 — PROJECTILE TURRET: Rotates to face player (or sweeps fixed pattern),
 *         fires bursts of bullets. Two sub-modes: tracking vs. sweep.
 *
 * HZ8 — LASER TURRET: Emits a visible beam that persists for X seconds then
 *         turns off. The beam does damage while active (player in beam = knockback).
 *         No projectile — just a region of space that becomes hazardous.
 *
 * FRAMEWORK NOTE — Turret abstraction
 * ──────────────────────────────────────
 * Both turrets share:
 *   TurretBase: position + yaw rotation (tracks or sweeps)
 *   FireMode: 'projectile' | 'laser'
 *   TriggerMode: 'timed' | 'in_range' | 'always'
 *   Range: activation distance for 'in_range' mode
 *
 * This abstraction covers tower defense turrets, guard posts, security robots.
 * The same `rotateTurretTowardPlayer(entity, speed, dt)` utility works for
 * any enemy/turret that needs to face the player.
 *
 * HZ7 — CONFIGURABLES:
 *   rotationMode      — 'track_player' | 'sweep' (back-and-forth arc)
 *   fireMode          — 'in_range' | 'timed' | 'always'
 *   range             — activation distance for in_range
 *   burstSize         — projectiles per burst
 *   burstInterval     — seconds between bursts
 *   shotSpeed         — m/s
 *   sweepArc          — degrees total arc for sweep mode
 *   sweepSpeed        — degrees/second
 *
 * HZ8 — CONFIGURABLES:
 *   beamLength        — metres
 *   beamWidth         — metres (visual + damage width)
 *   onDuration        — seconds beam stays on
 *   offDuration       — seconds beam is off
 *   rotationMode      — 'fixed' | 'slow_sweep'
 *
 * DEMO (run and verify):
 *   HZ7 — Projectile Turret:
 *     [ ] Grey turret head on a base, rotates to face player
 *     [ ] Walk within 10m: fires 3-shot burst every 2s
 *     [ ] Press SWEEP button: turret sweeps ±60° arc instead
 *     [ ] Bullets travel straight, hit player = knockback
 *   HZ8 — Laser Turret:
 *     [ ] Red beam emits for 2s, off for 1.5s, cycling
 *     [ ] Press SWEEP button: beam sweeps slowly side to side
 *     [ ] Walk into active beam → knockback
 *     [ ] Console: beam ON/OFF + player HIT
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Shared: turret rotation utility ─────────────────────────────────────────

/**
 * Smoothly rotates a turret entity's Y angle toward a target position.
 * Returns the new current yaw (degrees). Speed = deg/sec.
 */
function rotateTurretToward(
  currentYaw: number, targetX: number, targetZ: number,
  fromX: number, fromZ: number, speed: number, dt: number
): number {
  const desired = Math.atan2(targetX - fromX, targetZ - fromZ) * 180 / Math.PI
  let delta = desired - currentYaw
  while (delta > 180)  delta -= 360
  while (delta < -180) delta += 360
  const step = Math.sign(delta) * Math.min(Math.abs(delta), speed * dt)
  return currentYaw + step
}

// ─── Bullet pool (shared with hz_darts.ts concept, local pool here) ──────────

interface BulletEntry {
  entity:  ReturnType<typeof engine.addEntity>
  active:  boolean
  pos:     Vector3
  dir:     Vector3
  speed:   number
  elapsed: number
  maxTime: number
}

const bullets: BulletEntry[] = []

function initBulletPool(count: number): void {
  for (let i = 0; i < count; i++) {
    const e = engine.addEntity()
    Transform.create(e, {
      position: Vector3.create(0, -50, 0),
      scale: Vector3.create(0.1, 0.1, 0.4)
    })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(1, 0.9, 0, 1),
      emissiveColor: { r: 0.8, g: 0.7, b: 0 }, emissiveIntensity: 1.5
    })
    bullets.push({ entity: e, active: false, pos: {x:0,y:-50,z:0}, dir: {x:0,y:0,z:0}, speed: 15, elapsed: 0, maxTime: 3 })
  }
}

function fireBullet(origin: Vector3, dir: Vector3, speed: number): void {
  const b = bullets.find(b => !b.active)
  if (!b) return
  b.active = true; b.pos = {x: origin.x, y: origin.y, z: origin.z}
  b.dir = {x: dir.x, y: dir.y, z: dir.z}; b.speed = speed; b.elapsed = 0
  const t = Transform.getMutableOrNull(b.entity)
  if (!t) return
  t.position = Vector3.create(origin.x, origin.y, origin.z)
  const yaw = Math.atan2(dir.x, dir.z) * 180 / Math.PI
  t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
}

// ─── Station: HZ7 — Projectile Turret ────────────────────────────────────────

export function setupHZTurret(): void {
  const { x, z } = { x: 108, z: 138 }
  createStation('hz7_turret', 'HZ7 — TURRET\nTrack + Sweep modes', STATUS_COLOR.FULLY_CODED)

  initBulletPool(12)

  // Turret base
  const base = engine.addEntity()
  Transform.create(base, {
    position: Vector3.create(x, 0.6, z - 2.5),
    scale: Vector3.create(0.8, 1.2, 0.8)
  })
  MeshRenderer.setCylinder(base)
  Material.setPbrMaterial(base, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  // Turret head (rotates)
  const head = engine.addEntity()
  Transform.create(head, {
    position: Vector3.create(x, 1.5, z - 2.5),
    scale: Vector3.create(0.6, 0.4, 0.6)
  })
  MeshRenderer.setBox(head)
  Material.setPbrMaterial(head, {
    albedoColor: Color4.create(0.5, 0.5, 0.5, 1),
    emissiveColor: { r: 0.1, g: 0.1, b: 0.1 }, emissiveIntensity: 0.3
  })

  // Turret barrel (child of head conceptually)
  const barrel = engine.addEntity()
  Transform.create(barrel, {
    position: Vector3.create(x, 1.5, z - 2.5),
    scale: Vector3.create(0.14, 0.14, 0.7)
  })
  MeshRenderer.setBox(barrel)
  Material.setPbrMaterial(barrel, { albedoColor: Color4.create(0.6, 0.6, 0.6, 1) })

  // Range indicator ring
  const RANGE = 10.0
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const dot = engine.addEntity()
    Transform.create(dot, {
      position: Vector3.create(x + Math.cos(a) * RANGE, 0.52, z - 2.5 + Math.sin(a) * RANGE),
      scale: Vector3.create(0.1, 0.06, 0.1)
    })
    MeshRenderer.setCylinder(dot)
    Material.setPbrMaterial(dot, { albedoColor: Color4.create(0.9, 0.3, 0.1, 0.5) })
  }

  // Bullet system
  engine.addSystem((dt: number) => {
    const pT2 = Transform.getOrNull(engine.PlayerEntity)
    const pp = pT2?.position ?? Vector3.create(0, -100, 0)
    for (const b of bullets) {
      if (!b.active) continue
      b.elapsed += dt
      b.pos.x += b.dir.x * b.speed * dt
      b.pos.z += b.dir.z * b.speed * dt
      const t = Transform.getMutableOrNull(b.entity)
      if (t) t.position = Vector3.create(b.pos.x, b.pos.y, b.pos.z)
      const dx = pp.x - b.pos.x; const dz = pp.z - b.pos.z
      if (Math.sqrt(dx*dx + dz*dz) < 0.6) {
        Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 8)
        console.log('[HZ7] BULLET HIT')
        b.active = false
        const tb = Transform.getMutableOrNull(b.entity)
        if (tb) tb.position = Vector3.create(0, -50, 0)
        continue
      }
      if (b.elapsed > b.maxTime) {
        b.active = false
        const tb = Transform.getMutableOrNull(b.entity)
        if (tb) tb.position = Vector3.create(0, -50, 0)
      }
    }
  }, 11)

  // Turret state
  let turretYaw = 0
  let turretMode: 'track' | 'sweep' = 'track'
  let sweepDir = 1
  let sweepAngle = 0
  const SWEEP_SPEED = 40  // deg/sec
  const SWEEP_ARC = 70    // ±70°
  let burstTimer = 2.0
  let burstCount = 0
  let burstShotTimer = 0
  const BURST_SIZE = 3
  const BURST_SHOT_INTERVAL = 0.18
  let inRange = false

  const turretOrigin = Vector3.create(x, 1.5, z - 2.5)

  engine.addSystem((dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return

    // Check range
    const dx = pT.position.x - x; const dz = pT.position.z - (z - 2.5)
    inRange = Math.sqrt(dx*dx + dz*dz) < RANGE

    if (turretMode === 'track' && inRange) {
      turretYaw = rotateTurretToward(turretYaw, pT.position.x, pT.position.z, x, z - 2.5, 90, dt)
    } else if (turretMode === 'sweep') {
      sweepAngle += sweepDir * SWEEP_SPEED * dt
      if (Math.abs(sweepAngle) >= SWEEP_ARC) sweepDir = -sweepDir
      turretYaw = sweepAngle
    }

    // Apply rotation to head + barrel
    const rot = Quaternion.fromEulerDegrees(0, turretYaw, 0)
    const headT = Transform.getMutableOrNull(head)
    const barrelT = Transform.getMutableOrNull(barrel)
    if (headT) headT.rotation = rot

    // Barrel follows head: position barrel forward from head
    if (barrelT) {
      const fwdX = Math.sin(turretYaw * Math.PI / 180) * 0.55
      const fwdZ = Math.cos(turretYaw * Math.PI / 180) * 0.55
      barrelT.position = Vector3.create(x + fwdX, 1.5, z - 2.5 + fwdZ)
      barrelT.rotation = rot
    }

    // Fire when in range
    if (!inRange && turretMode === 'track') return

    burstTimer -= dt
    if (burstTimer <= 0 && burstCount === 0) {
      burstCount = BURST_SIZE
      burstShotTimer = 0
    }
    if (burstCount > 0) {
      burstShotTimer -= dt
      if (burstShotTimer <= 0) {
        // Fire bullet in turret facing direction
        const fwdX = Math.sin(turretYaw * Math.PI / 180)
        const fwdZ = Math.cos(turretYaw * Math.PI / 180)
        fireBullet(turretOrigin, Vector3.create(fwdX, 0, fwdZ), 15)
        burstCount--
        burstShotTimer = BURST_SHOT_INTERVAL
        if (burstCount === 0) burstTimer = 2.0
        console.log(`[HZ7] SHOT yaw=${turretYaw.toFixed(0)}°`)
      }
    }
  }, 12)

  // Mode buttons
  const trackBtn = createButton(x - 2, 0.8, z - 3.6, '🎯 Track Player', Color4.create(0.2, 0.5, 0.9, 1))
  pointerEventsSystem.onPointerDown({ entity: trackBtn, opts: { button: 1, hoverText: '[E] Track mode' } }, () => {
    turretMode = 'track'; console.log('[HZ7] Mode: TRACK PLAYER')
  })
  const sweepBtn = createButton(x + 2, 0.8, z - 3.6, '↔ Sweep Arc', Color4.create(0.5, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: sweepBtn, opts: { button: 1, hoverText: '[E] Sweep mode' } }, () => {
    turretMode = 'sweep'; sweepAngle = 0; console.log('[HZ7] Mode: SWEEP ±70°')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z - 2.5) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Track: faces player in range (10m)\nSweep: ±70° at 40 deg/s\nBurst: 3 shots × 0.18s, every 2s',
    fontSize: 1.1, textColor: Color4.create(1, 0.95, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ7] ProjectileTurret initialized — track/sweep, 10m range, 3-shot bursts')
}

// ─── Station: HZ8 — Laser Turret ─────────────────────────────────────────────

export function setupHZLaserTurret(): void {
  const { x, z } = { x: 120, z: 138 }
  createStation('hz8_laser', 'HZ8 — LASER TURRET\nOn/off cycle + slow sweep', STATUS_COLOR.FULLY_CODED)

  const BEAM_LENGTH = 7.0
  const BEAM_WIDTH  = 0.3
  const ON_DURATION  = 2.0
  const OFF_DURATION = 1.5

  // Turret base + head
  const base = engine.addEntity()
  Transform.create(base, {
    position: Vector3.create(x, 0.6, z - 2.5),
    scale: Vector3.create(0.8, 1.2, 0.8)
  })
  MeshRenderer.setCylinder(base)
  Material.setPbrMaterial(base, { albedoColor: Color4.create(0.2, 0.2, 0.3, 1) })

  const head = engine.addEntity()
  Transform.create(head, {
    position: Vector3.create(x, 1.5, z - 2.5),
    scale: Vector3.create(0.55, 0.4, 0.55)
  })
  MeshRenderer.setBox(head)
  Material.setPbrMaterial(head, {
    albedoColor: Color4.create(0.3, 0.1, 0.1, 1),
    emissiveColor: { r: 0.3, g: 0, b: 0 }, emissiveIntensity: 0.5
  })

  // Laser beam entity
  const beamEntity = engine.addEntity()
  Transform.create(beamEntity, {
    position: Vector3.create(x, 1.5, z - 2.5 + BEAM_LENGTH * 0.5),  // extends from turret
    scale: Vector3.create(BEAM_WIDTH, BEAM_WIDTH * 0.4, BEAM_LENGTH),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  MeshRenderer.setBox(beamEntity)
  Material.setPbrMaterial(beamEntity, {
    albedoColor: Color4.create(1, 0, 0, 0),  // invisible initially
    transparencyMode: 1
  })

  // State
  let beamOn = false
  let beamTimer = OFF_DURATION  // start OFF
  let beamYaw = 0
  let turretLaserMode: 'fixed' | 'sweep' = 'fixed'
  let laserSweepDir = 1
  let laserSweepAngle = 0
  let playerHitImmunity = 0

  engine.addSystem((dt: number) => {
    beamTimer -= dt
    if (playerHitImmunity > 0) playerHitImmunity -= dt

    if (turretLaserMode === 'sweep') {
      laserSweepAngle += laserSweepDir * 20 * dt  // 20 deg/sec sweep
      if (Math.abs(laserSweepAngle) >= 50) laserSweepDir = -laserSweepDir
      beamYaw = laserSweepAngle
    }

    // Rotate head + beam
    const rot = Quaternion.fromEulerDegrees(0, beamYaw, 0)
    const headT = Transform.getMutableOrNull(head)
    if (headT) headT.rotation = rot

    // Position beam: extends from turret head forward
    const fwdX = Math.sin(beamYaw * Math.PI / 180)
    const fwdZ = Math.cos(beamYaw * Math.PI / 180)
    const beamCenterX = x + fwdX * BEAM_LENGTH * 0.5
    const beamCenterZ = z - 2.5 + fwdZ * BEAM_LENGTH * 0.5

    const beamT = Transform.getMutableOrNull(beamEntity)
    if (beamT) {
      beamT.position = Vector3.create(beamCenterX, 1.5, beamCenterZ)
      beamT.rotation = rot
    }

    // Cycle beam on/off
    if (beamTimer <= 0) {
      beamOn = !beamOn
      beamTimer = beamOn ? ON_DURATION : OFF_DURATION
      console.log(`[HZ8] Laser ${beamOn ? 'ON' : 'OFF'}`)
      Material.setPbrMaterial(beamEntity, {
        albedoColor: beamOn ? Color4.create(1, 0.1, 0.1, 0.85) : Color4.create(1, 0, 0, 0),
        transparencyMode: 1,
        ...(beamOn ? { emissiveColor: { r: 0.8, g: 0, b: 0 }, emissiveIntensity: 2 } : {})
      })
      Material.setPbrMaterial(head, {
        albedoColor: beamOn ? Color4.create(0.9, 0.1, 0.1, 1) : Color4.create(0.3, 0.1, 0.1, 1),
        emissiveColor: beamOn ? { r: 0.8, g: 0, b: 0 } : { r: 0.3, g: 0, b: 0 },
        emissiveIntensity: beamOn ? 2 : 0.5
      })
    }

    // Damage check when beam on
    if (!beamOn) return
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT || playerHitImmunity > 0) return

    // Project player position onto beam axis
    const relX = pT.position.x - x
    const relZ = pT.position.z - (z - 2.5)
    const along = relX * fwdX + relZ * fwdZ    // distance along beam
    const crossX = relX - fwdX * along
    const crossZ = relZ - fwdZ * along
    const across = Math.sqrt(crossX*crossX + crossZ*crossZ)  // distance from beam axis

    if (along >= 0 && along <= BEAM_LENGTH && across < BEAM_WIDTH * 0.6) {
      Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 6)
      playerHitImmunity = 0.8
      console.log('[HZ8] LASER HIT — knockback')
    }
  }, 12)

  // Mode buttons
  const fixedBtn = createButton(x - 2, 0.8, z - 3.6, '📌 Fixed Beam', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: fixedBtn, opts: { button: 1, hoverText: '[E] Fixed mode' } }, () => {
    turretLaserMode = 'fixed'; beamYaw = 0; laserSweepAngle = 0
    console.log('[HZ8] Mode: FIXED')
  })
  const sweepBtn = createButton(x + 2, 0.8, z - 3.6, '↔ Sweep Laser', Color4.create(0.6, 0.1, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: sweepBtn, opts: { button: 1, hoverText: '[E] Sweep mode' } }, () => {
    turretLaserMode = 'sweep'; console.log('[HZ8] Mode: SWEEP ±50°')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z - 2.5) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Beam: 2s ON / 1.5s OFF cycle\nDamage: projection onto beam axis\nSweep: 20 deg/s, ±50° arc',
    fontSize: 1.1, textColor: Color4.create(1, 0.7, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ8] LaserTurret initialized — 2s/1.5s cycle, 7m beam, sweep mode available')
}
