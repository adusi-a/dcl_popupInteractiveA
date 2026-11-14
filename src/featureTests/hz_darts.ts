/**
 * hz_darts.ts — HZ3: Dart Wall + HZ4: Single Dart Box
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Darts (fast projectiles) that shoot out from a wall/box, travel until they
 * hit the player or reach max range, then vanish. Object pool approach: a fixed
 * set of dart entities are pre-created and recycled rather than spawned fresh.
 *
 * CONFIGURABLES:
 *   dartCount        — darts per burst (HZ3 wall = 3, HZ4 single = 1)
 *   dartSpeed        — m/s
 *   dartLength/Width — size of dart box
 *   burstInterval    — seconds between bursts
 *   burstSpread      — HZ3: staggered timing (not all at once)
 *   hitRadius        — knockback when dart reaches player
 *   direction        — dart travel direction (here: +Z for HZ3, ±X for HZ4)
 *   mode             — 'timed' | 'player_triggered'
 *
 * FRAMEWORK NOTE — Projectile System
 * ────────────────────────────────────
 * The DartProjectile (origin → travel → hit/expire) is the same system as:
 *   ML2 Shelf Ghost:  book throw (already prototyped)
 *   HZ6 Bomb Thrower: parabolic arc (same but with gravity)
 *   HZ7 Turret shots: same system, spawning from turret muzzle
 *
 * Extract to hz_projectile.ts with:
 *   createProjectile(origin, direction, speed, maxRange, gravity?)
 *   registerProjectileHitCallback(onHit)
 * One system handles all projectile types.
 *
 * POOL DESIGN
 * ───────────
 * Pre-create dart entities. When a dart is "fired":
 *   1. Set position to launcher muzzle
 *   2. Set state: active + travel direction + elapsed time
 *   3. System moves it each frame
 *   4. When player hit or max range reached: reset position to below floor
 *
 * DEMO (run and verify):
 *   HZ3 — Dart Wall (3 darts, staggered):
 *     [ ] 3 dart launchers visible on wall (grey boxes with barrel notch)
 *     [ ] Every 3s: darts fire in sequence (0.4s apart)
 *     [ ] Dart travels ~8m along aisle and disappears
 *     [ ] Walk into dart path → knockback
 *   HZ4 — Single Dart Box (alternating left/right):
 *     [ ] Single dart fires every 2s, alternating +X and -X direction
 *     [ ] Stand in path → knockback
 *   Both: console logs [HZ3] / [HZ4] dart launch + hit
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DartPoolEntry {
  entity:   ReturnType<typeof engine.addEntity>
  active:   boolean
  pos:      Vector3
  dir:      Vector3   // unit direction
  speed:    number
  elapsed:  number
  maxRange: number
}

interface LauncherEntry {
  launcherPos: Vector3
  fireDir:     Vector3
  dartSpeed:   number
  dartMaxRange: number
  dartLength:  number
  dartWidth:   number
  hitRadius:   number
  logTag:      string
}

const dartPool: DartPoolEntry[] = []
let dartSystemRegistered = false

// ─── Dart pool + system ───────────────────────────────────────────────────────

function initDartPool(count: number): void {
  for (let i = 0; i < count; i++) {
    const e = engine.addEntity()
    Transform.create(e, {
      position: Vector3.create(0, -50, 0),
      scale: Vector3.create(0.08, 0.08, 0.5)
    })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(0.9, 0.7, 0.1, 1),
      emissiveColor: { r: 0.4, g: 0.3, b: 0 }, emissiveIntensity: 0.6
    })
    dartPool.push({ entity: e, active: false, pos: Vector3.create(0, -50, 0), dir: Vector3.create(0, 0, 1), speed: 10, elapsed: 0, maxRange: 10 })
  }
}

function fireDart(launcher: LauncherEntry, dir: Vector3): void {
  // Find a free dart in the pool
  const dart = dartPool.find(d => !d.active)
  if (!dart) return

  dart.active  = true
  dart.pos     = Vector3.create(launcher.launcherPos.x, launcher.launcherPos.y, launcher.launcherPos.z)
  dart.dir     = Vector3.create(dir.x, dir.y, dir.z)
  dart.speed   = launcher.dartSpeed
  dart.elapsed = 0
  dart.maxRange = launcher.dartMaxRange

  const t = Transform.getMutableOrNull(dart.entity)
  if (t) {
    t.position = Vector3.create(dart.pos.x, dart.pos.y, dart.pos.z)
    t.scale    = Vector3.create(launcher.dartWidth, launcher.dartWidth, launcher.dartLength)
    // Rotate dart to face travel direction
    const yaw = Math.atan2(dir.x, dir.z) * (180 / Math.PI)
    t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
  }

  console.log(`[${launcher.logTag}] Dart fired from (${launcher.launcherPos.x.toFixed(1)},${launcher.launcherPos.z.toFixed(1)}) dir=(${dir.x.toFixed(1)},${dir.z.toFixed(1)})`)
}

function ensureDartSystem(launcher: LauncherEntry): void {
  if (dartSystemRegistered) return
  dartSystemRegistered = true

  engine.addSystem((dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    const pp = pT?.position ?? Vector3.create(0, -100, 0)

    for (const dart of dartPool) {
      if (!dart.active) continue

      dart.elapsed += dt
      const travel = dart.elapsed * dart.speed
      dart.pos.x = dart.pos.x + dart.dir.x * dart.speed * dt
      dart.pos.z = dart.pos.z + dart.dir.z * dart.speed * dt

      const t = Transform.getMutableOrNull(dart.entity)
      if (t) {
        t.position.x = dart.pos.x
        t.position.y = dart.pos.y
        t.position.z = dart.pos.z
      }

      // Check player hit (XZ distance)
      const dx = pp.x - dart.pos.x; const dz = pp.z - dart.pos.z
      const dist = Math.sqrt(dx*dx + dz*dz)

      if (dist < 0.7) {
        // HIT
        Physics.applyKnockbackToPlayer({
          direction: Vector3.create(dart.dir.x, 0.3, dart.dir.z),
          falloff: 1, magnitude: 7
        })
        console.log('[HZ] DART HIT — knockback applied')
        resetDart(dart)
        continue
      }

      // Max range
      if (travel >= dart.maxRange) {
        resetDart(dart)
      }
    }
  }, 10)
}

function resetDart(dart: DartPoolEntry): void {
  dart.active = false
  const t = Transform.getMutableOrNull(dart.entity)
  if (t) t.position = Vector3.create(0, -50, 0)
}

// ─── Station: HZ3 — Dart Wall ─────────────────────────────────────────────────

export function setupHZDartWall(): void {
  const { x, z } = { x: 120, z: 118 }
  createStation('hz3_dartwall', 'HZ3 — DART WALL\n3-dart burst, timed', STATUS_COLOR.FULLY_CODED)

  // Pre-create dart pool (shared with HZ4 — 8 total)
  if (dartPool.length === 0) initDartPool(8)
  ensureDartSystem({ launcherPos: Vector3.Zero(), fireDir: Vector3.Zero(), dartSpeed: 10, dartMaxRange: 8, dartLength: 0.5, dartWidth: 0.08, hitRadius: 0.7, logTag: 'HZ3' })

  // Wall backing
  const wallBacking = engine.addEntity()
  Transform.create(wallBacking, {
    position: Vector3.create(x, 1.5, z - 2.8),
    scale: Vector3.create(4.0, 2.5, 0.35)
  })
  MeshRenderer.setBox(wallBacking)
  Material.setPbrMaterial(wallBacking, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  // 3 dart launcher barrels on the wall
  const launchers: LauncherEntry[] = []
  const launcherXOffsets = [-1.2, 0, 1.2]

  for (let i = 0; i < 3; i++) {
    const lx = x + launcherXOffsets[i]
    const ly = 1.5

    // Barrel visual (small box)
    const barrel = engine.addEntity()
    Transform.create(barrel, {
      position: Vector3.create(lx, ly, z - 2.6),
      scale: Vector3.create(0.18, 0.18, 0.4)
    })
    MeshRenderer.setBox(barrel)
    Material.setPbrMaterial(barrel, {
      albedoColor: Color4.create(0.5, 0.5, 0.5, 1),
      emissiveColor: { r: 0.1, g: 0.1, b: 0 }, emissiveIntensity: 0.3
    })

    launchers.push({
      launcherPos: Vector3.create(lx, ly, z - 2.4),
      fireDir:     Vector3.create(0, 0, 1),   // fire along +Z
      dartSpeed: 10, dartMaxRange: 8, dartLength: 0.5, dartWidth: 0.08,
      hitRadius: 0.7, logTag: 'HZ3'
    })
  }

  // Aisle strip (visual)
  const aisleVis = engine.addEntity()
  Transform.create(aisleVis, {
    position: Vector3.create(x, 0.52, z + 1.0),
    scale: Vector3.create(4.0, 0.04, 8)
  })
  MeshRenderer.setBox(aisleVis)
  Material.setPbrMaterial(aisleVis, { albedoColor: Color4.create(0.5, 0.4, 0.3, 0.5) })

  // Burst timer system (timed cycle: burst every 3s, darts staggered 0.4s apart)
  let burstTimer = 2.0  // first burst at t=2s
  let dartFiredInBurst = 0
  let subTimer = 0.0

  engine.addSystem((dt: number) => {
    burstTimer -= dt
    if (dartFiredInBurst < launchers.length) {
      subTimer -= dt
      if (subTimer <= 0) {
        fireDart(launchers[dartFiredInBurst], launchers[dartFiredInBurst].fireDir)
        dartFiredInBurst++
        subTimer = 0.35  // next dart 0.35s later
      }
    }
    if (burstTimer <= 0) {
      burstTimer = 3.0
      dartFiredInBurst = 0
      subTimer = 0
    }
  }, 15)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z - 2.8) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '3 darts, staggered 0.35s, every 3s\nPool of 8 dart entities (reused)\nSame ProjectileSystem as bombs+turrets',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ3] DartWall initialized — 3-dart burst, 3s interval')
}

// ─── Station: HZ4 — Single Dart Box ───────────────────────────────────────────

export function setupHZDartBox(): void {
  const { x, z } = { x: 132, z: 118 }
  createStation('hz4_dartbox', 'HZ4 — SINGLE DART\nAlternating directions', STATUS_COLOR.FULLY_CODED)

  if (dartPool.length === 0) initDartPool(8)

  // Box launcher
  const box = engine.addEntity()
  Transform.create(box, {
    position: Vector3.create(x, 1.0, z),
    scale: Vector3.create(0.7, 0.7, 0.7)
  })
  MeshRenderer.setBox(box)
  Material.setPbrMaterial(box, {
    albedoColor: Color4.create(0.5, 0.3, 0.1, 1),
    emissiveColor: { r: 0.2, g: 0.1, b: 0 }, emissiveIntensity: 0.3
  })

  const launcherL: LauncherEntry = { launcherPos: Vector3.create(x - 0.4, 1.0, z), fireDir: Vector3.create(-1, 0, 0), dartSpeed: 12, dartMaxRange: 6, dartLength: 0.45, dartWidth: 0.1, hitRadius: 0.6, logTag: 'HZ4' }
  const launcherR: LauncherEntry = { launcherPos: Vector3.create(x + 0.4, 1.0, z), fireDir: Vector3.create(1, 0, 0),  dartSpeed: 12, dartMaxRange: 6, dartLength: 0.45, dartWidth: 0.1, hitRadius: 0.6, logTag: 'HZ4' }

  // Direction arrows
  for (const [ox, label] of [[-3.5, '← LEFT dart'], [3.5, 'RIGHT dart →']]) {
    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(x + (ox as number), 1.0, z - 2.5) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, { text: label as string, fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.3, 1) })
  }

  // Fire alternating darts every 2s
  let fireTimer = 1.5
  let fireSide = 0 // 0 = left, 1 = right

  engine.addSystem((dt: number) => {
    fireTimer -= dt
    if (fireTimer <= 0) {
      fireTimer = 2.0
      const launcher = fireSide === 0 ? launcherL : launcherR
      fireDart(launcher, launcher.fireDir)
      fireSide = 1 - fireSide
    }
  }, 16)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.2, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Single dart, alternating L/R\nFires every 2s, speed=12 m/s\nStand to sides, dodge center',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ4] SingleDartBox initialized — alternating L/R, 2s interval')
}
