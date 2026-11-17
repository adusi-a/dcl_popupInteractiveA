/**
 * cb_projectileEnemy.ts — CB3: Homing + CB4: Melee Swing + CB5: Respawning Enemy
 * STATUS: 🟩 FULLY CODED
 *
 * CB3 — HOMING PROJECTILE
 * Slow-moving shot that steers toward the player each frame. The turn rate
 * limits maneuverability — it can be outrun by moving sideways. This is the
 * "guided missile" pattern used for ghost AI, homing orbs, cursed objects.
 *
 * Key algorithm: each frame, lerp the projectile's current direction toward
 * the direction of the player, then move forward in that direction.
 *
 * CB4 — MELEE SWING HAZARD
 * Club/arm entity rotates around a fixed pivot in an arc (or continuously).
 * Uses Math.sin() for oscillating swing or continuous rotation.
 * Proximity damage along the arc radius from pivot.
 *
 * CB5 — RESPAWNING ENEMY
 * Enemy entity that the player can "kill" (proximity attack or [E]).
 * On kill: entity shrinks/fades, respawn timer starts.
 * After delay: entity reappears at origin in full health.
 * Demonstrates the core enemy lifecycle pattern.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── CB3 — Homing Projectile ──────────────────────────────────────────────────

export function setupCBHoming(): void {
  const { x, z } = { x: 40, z: 146 }
  createStation('cb3_homing', 'CB3 — HOMING PROJECTILE\nSteers toward player', STATUS_COLOR.FULLY_CODED)

  const LAUNCH_POS = Vector3.create(x, 1.5, z - 2.5)
  const PROJ_SPEED = 3.0  // m/s — slow enough to dodge sideways
  const TURN_RATE  = 90   // degrees/second
  const HIT_RADIUS = 0.7  // metres
  const MAX_RANGE  = 12.0 // metres before projectile expires

  // Launcher visual
  const launcher = engine.addEntity()
  Transform.create(launcher, { position: Vector3.create(x, 1.5, z - 2.5), scale: Vector3.create(0.5, 0.5, 0.5) })
  MeshRenderer.setCylinder(launcher)
  Material.setPbrMaterial(launcher, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  // Homing orb entity
  const orb = engine.addEntity()
  Transform.create(orb, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.3, 0.3, 0.3) })
  MeshRenderer.setCylinder(orb)
  Material.setPbrMaterial(orb, {
    albedoColor: Color4.create(0.8, 0.2, 1, 1),
    emissiveColor: { r: 0.5, g: 0, b: 0.8 }, emissiveIntensity: 2
  })

  const orbTrail = engine.addEntity()
  Transform.create(orbTrail, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.15, 0.15, 0.15) })
  MeshRenderer.setCylinder(orbTrail)
  Material.setPbrMaterial(orbTrail, { albedoColor: Color4.create(0.5, 0.1, 0.8, 0.5), transparencyMode: 1 })

  let orbActive = false; let orbPos = Vector3.create(0, -50, 0)
  let orbDirX = 0; let orbDirZ = 1
  let orbTravelled = 0; let hitImmunity = 0

  function launchOrb(): void {
    if (orbActive) return
    orbActive   = true
    orbPos      = Vector3.create(LAUNCH_POS.x, LAUNCH_POS.y, LAUNCH_POS.z)
    orbDirX     = 0; orbDirZ = 1
    orbTravelled = 0
    Transform.getMutable(orb).position = Vector3.create(orbPos.x, orbPos.y, orbPos.z)
    console.log('[CB3] Homing orb LAUNCHED')
  }

  engine.addSystem((dt: number) => {
    hitImmunity = Math.max(0, hitImmunity - dt)
    if (!orbActive) return

    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return

    // Steer toward player
    const dx = pT.position.x - orbPos.x; const dz = pT.position.z - orbPos.z
    const dist = Math.sqrt(dx*dx + dz*dz)
    if (dist > 0.1) {
      const targetX = dx / dist; const targetZ = dz / dist
      // Lerp current dir toward target dir by turnRate
      const turnDeg = TURN_RATE * dt; const turnRad = turnDeg * Math.PI / 180
      const currentAngle = Math.atan2(orbDirX, orbDirZ)
      const targetAngle  = Math.atan2(targetX, targetZ)
      let dAngle = targetAngle - currentAngle
      while (dAngle > Math.PI)  dAngle -= Math.PI * 2
      while (dAngle < -Math.PI) dAngle += Math.PI * 2
      const stepAngle = Math.sign(dAngle) * Math.min(Math.abs(dAngle), turnRad)
      const newAngle = currentAngle + stepAngle
      orbDirX = Math.sin(newAngle); orbDirZ = Math.cos(newAngle)
    }

    // Move
    orbPos.x += orbDirX * PROJ_SPEED * dt
    orbPos.z += orbDirZ * PROJ_SPEED * dt
    orbTravelled += PROJ_SPEED * dt

    const orbT = Transform.getMutableOrNull(orb)
    const trailT = Transform.getMutableOrNull(orbTrail)
    if (orbT) orbT.position = Vector3.create(orbPos.x, orbPos.y, orbPos.z)
    if (trailT) trailT.position = Vector3.create(orbPos.x - orbDirX * 0.4, orbPos.y, orbPos.z - orbDirZ * 0.4)

    // Check player hit
    const ph = Math.sqrt((pT.position.x - orbPos.x)**2 + (pT.position.z - orbPos.z)**2)
    if (ph < HIT_RADIUS && hitImmunity <= 0) {
      Physics.applyKnockbackToPlayer(Vector3.create(orbPos.x, orbPos.y, orbPos.z), 8)
      hitImmunity = 1.5; orbActive = false
      Transform.getMutable(orb).position = Vector3.create(0, -50, 0)
      Transform.getMutable(orbTrail).position = Vector3.create(0, -50, 0)
      console.log('[CB3] ORB HIT — knockback + respawn 2s')
      let respawnTimer = 2.0
    // @ts-ignore — removeSystem(void) TypeScript warning; SDK 7.33 returns void from addSystem
      const respawn = engine.addSystem((dt2: number) => { respawnTimer -= dt2; if (respawnTimer <= 0) { engine.removeSystem(respawn); launchOrb() } }, 15)
      return
    }

    if (orbTravelled > MAX_RANGE) {
      orbActive = false; Transform.getMutable(orb).position = Vector3.create(0, -50, 0)
      console.log('[CB3] Orb expired — relaunching in 2s')
      let t = 2.0
    // @ts-ignore — removeSystem(void) TypeScript warning; SDK 7.33 returns void from addSystem
      const r = engine.addSystem((dt2: number) => { t -= dt2; if (t <= 0) { engine.removeSystem(r); launchOrb() } }, 15)
    }
  }, 10)

  const launchBtn = createButton(x, 0.8, z - 3.6, '◎ Launch Orb', Color4.create(0.5, 0.1, 0.8, 1))
  pointerEventsSystem.onPointerDown({ entity: launchBtn, opts: { button: 1, hoverText: '[E] Launch' } }, launchOrb)

  // Auto-launch after 2s
  let autoTimer = 2.0
    // @ts-ignore — removeSystem(void) TypeScript warning; SDK 7.33 returns void from addSystem
  const autoLaunch = engine.addSystem((dt: number) => { autoTimer -= dt; if (autoTimer <= 0) { engine.removeSystem(autoLaunch); launchOrb() } }, 15)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'turnRate=90°/s — dodge sideways\ndir lerped each frame toward player\nspeed=3m/s, maxRange=12m',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB3] HomingProjectile initialized — turnRate=90°/s, speed=3m/s')
}

// ─── CB4 — Melee Swing Hazard ─────────────────────────────────────────────────

export function setupCBMeleeSwing(): void {
  const { x, z } = { x: 52, z: 146 }
  createStation('cb4_melee', 'CB4 — MELEE SWING\nArm arcs around pivot', STATUS_COLOR.FULLY_CODED)

  const PIVOT_X = x; const PIVOT_Y = 1.5; const PIVOT_Z = z
  const ARM_LENGTH = 2.5
  let swingMode: 'oscillate' | 'spin' = 'oscillate'
  let swingAngle = 0; let swingTime = 0

  // Pivot post
  const pivotPost = engine.addEntity()
  Transform.create(pivotPost, { position: Vector3.create(PIVOT_X, PIVOT_Y * 0.5, PIVOT_Z), scale: Vector3.create(0.3, PIVOT_Y, 0.3) })
  MeshRenderer.setCylinder(pivotPost)
  Material.setPbrMaterial(pivotPost, { albedoColor: Color4.create(0.5, 0.4, 0.3, 1) })

  // Arm entity (rotates around pivot)
  const arm = engine.addEntity()
  Transform.create(arm, {
    position: Vector3.create(PIVOT_X, PIVOT_Y, PIVOT_Z + ARM_LENGTH * 0.5),
    scale: Vector3.create(0.18, 0.18, ARM_LENGTH),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  MeshRenderer.setBox(arm)
  Material.setPbrMaterial(arm, { albedoColor: Color4.create(0.6, 0.4, 0.3, 1) })

  // Club head at end of arm
  const club = engine.addEntity()
  Transform.create(club, {
    position: Vector3.create(PIVOT_X + ARM_LENGTH, PIVOT_Y, PIVOT_Z),
    scale: Vector3.create(0.5, 0.5, 0.5)
  })
  MeshRenderer.setBox(club)
  Material.setPbrMaterial(club, { albedoColor: Color4.create(0.4, 0.3, 0.2, 1), emissiveColor: { r: 0.1, g: 0.05, b: 0 }, emissiveIntensity: 0.3 })

  const HIT_RADIUS = 0.9
  const immunity = { value: 0 }

  engine.addSystem((dt: number) => {
    immunity.value = Math.max(0, immunity.value - dt)
    swingTime += dt

    if (swingMode === 'oscillate') {
      swingAngle = Math.sin(swingTime * 2.0) * 80  // ±80° arc, 2 rad/s
    } else {
      swingAngle = (swingAngle + 180 * dt) % 360   // full spin at 180°/s
    }

    const angleRad = swingAngle * Math.PI / 180
    const clubX = PIVOT_X + Math.sin(angleRad) * ARM_LENGTH
    const clubZ = PIVOT_Z + Math.cos(angleRad) * ARM_LENGTH
    const midX  = PIVOT_X + Math.sin(angleRad) * ARM_LENGTH * 0.5
    const midZ  = PIVOT_Z + Math.cos(angleRad) * ARM_LENGTH * 0.5

    const rot = Quaternion.fromEulerDegrees(0, swingAngle, 0)
    Transform.getMutable(arm).position  = Vector3.create(midX, PIVOT_Y, midZ)
    Transform.getMutable(arm).rotation  = rot
    Transform.getMutable(club).position = Vector3.create(clubX, PIVOT_Y, clubZ)

    // Proximity damage at club end
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (pT && immunity.value <= 0) {
      const dx = pT.position.x - clubX; const dz = pT.position.z - clubZ
      if (Math.sqrt(dx*dx + dz*dz) < HIT_RADIUS) {
        const nx = dx / Math.max(0.1, Math.sqrt(dx*dx + dz*dz))
        const nz = dz / Math.max(0.1, Math.sqrt(dx*dx + dz*dz))
        Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 10)
        immunity.value = 1.0; console.log('[CB4] MELEE SWING HIT')
      }
    }
  }, 10)

  const oscBtn  = createButton(x - 2, 0.8, z - 3.6, '↔ Oscillate', Color4.create(0.3, 0.5, 0.3, 1))
  const spinBtn = createButton(x + 2, 0.8, z - 3.6, '↻ Full Spin', Color4.create(0.6, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: oscBtn,  opts: { button: 1, hoverText: '[E] Oscillate' } }, () => { swingMode = 'oscillate'; swingTime = 0 })
  pointerEventsSystem.onPointerDown({ entity: spinBtn, opts: { button: 1, hoverText: '[E] Spin' } }, () => { swingMode = 'spin' })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'sin(t×2)×80° oscillate or full 180°/s spin\nProximity check at club tip\nhitRadius=0.9m from club center',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB4] MeleeSwing initialized — oscillate + spin modes')
}

// ─── CB5 — Respawning Enemy ───────────────────────────────────────────────────

export function setupCBRespawning(): void {
  const { x, z } = { x: 64, z: 146 }
  createStation('cb5_respawn', 'CB5 — RESPAWNING ENEMY\nKill → fade → respawn', STATUS_COLOR.FULLY_CODED)

  const RESPAWN_TIME = 5.0
  const ENEMY_HP     = 3    // hits to kill

  const enemy = engine.addEntity()
  Transform.create(enemy, {
    position: Vector3.create(x, 1.0, z - 1.0),
    scale: Vector3.create(0.8, 1.6, 0.6)
  })
  MeshRenderer.setBox(enemy)
  MeshCollider.setBox(enemy, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(enemy, { albedoColor: Color4.create(0.6, 0.1, 0.9, 1), emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.3 })

  const hpLbl = engine.addEntity()
  Transform.create(hpLbl, { position: Vector3.create(x, 2.5, z - 1.0) }); Billboard.create(hpLbl, {})
  TextShape.create(hpLbl, { text: `HP: ${ENEMY_HP}/${ENEMY_HP}`, fontSize: 1.3, textColor: Color4.White() })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 1.0, z - 1.0) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '', fontSize: 1.3, textColor: Color4.White() })

  let currentHp = ENEMY_HP; let alive = true; let respawnTimer = 0
  let shrinkTimer = 0; let isShrinking = false

  engine.addSystem((dt: number) => {
    if (alive) return

    if (isShrinking) {
      shrinkTimer -= dt
      const frac = Math.max(0, shrinkTimer / 0.5)
      Transform.getMutable(enemy).scale = Vector3.create(0.8 * frac, 1.6 * frac, 0.6 * frac)
      TextShape.getMutable(hpLbl).textColor = Color4.create(1, 1, 1, frac)
      if (shrinkTimer <= 0) {
        isShrinking = false
        Transform.getMutable(enemy).scale = Vector3.create(0, 0, 0)
        TextShape.getMutable(hpLbl).text = ''
      }
      return
    }

    respawnTimer -= dt
    TextShape.getMutable(statusLbl).text = `Respawning... ${Math.ceil(respawnTimer)}s`
    if (respawnTimer <= 0) {
      // Respawn
      alive = true; currentHp = ENEMY_HP
      Transform.getMutable(enemy).scale = Vector3.create(0.8, 1.6, 0.6)
      TextShape.getMutable(hpLbl).text = `HP: ${ENEMY_HP}/${ENEMY_HP}`
      TextShape.getMutable(hpLbl).textColor = Color4.White()
      TextShape.getMutable(statusLbl).text = ''
      Material.setPbrMaterial(enemy, { albedoColor: Color4.create(0.6, 0.1, 0.9, 1), emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.3 })
      console.log('[CB5] Enemy RESPAWNED — full HP')
    }
  }, 10)

  pointerEventsSystem.onPointerDown({ entity: enemy, opts: { button: 1, hoverText: '[E] Attack!' } }, () => {
    if (!alive) return
    currentHp--
    TextShape.getMutable(hpLbl).text = `HP: ${currentHp}/${ENEMY_HP}`
    Material.setPbrMaterial(enemy, { albedoColor: Color4.create(1, 0.1, 0.1, 1), emissiveColor: { r: 0.8, g: 0, b: 0 }, emissiveIntensity: 1 })
    setTimeout(() => {
      if (alive) Material.setPbrMaterial(enemy, { albedoColor: Color4.create(0.6, 0.1, 0.9, 1), emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.3 })
    }, 200)
    console.log(`[CB5] Hit! HP: ${currentHp}/${ENEMY_HP}`)
    if (currentHp <= 0) {
      alive = false; isShrinking = true; shrinkTimer = 0.5
      respawnTimer = RESPAWN_TIME
      TextShape.getMutable(statusLbl).text = '☠ KILLED'
      console.log(`[CB5] Enemy KILLED — respawn in ${RESPAWN_TIME}s`)
    }
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Click 3× to kill → shrinks → respawns\n5s respawn timer\nSame lifecycle for all enemy types',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB5] RespawningEnemy initialized — 3HP, 5s respawn')
}
