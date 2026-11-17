/**
 * hz_bombThrower.ts — HZ6: Bomb Thrower NPC/Enemy
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * An NPC enemy that lobs bombs at the player on a parabolic arc.
 * No physics engine needed — pure kinematic math.
 *
 * PARABOLIC TRAJECTORY
 * ─────────────────────
 * Given start position S, target T, and desired flight time F:
 *   velX = (T.x - S.x) / F
 *   velZ = (T.z - S.z) / F
 *   velY = (T.y - S.y - 0.5 * GRAVITY * F²) / F
 *
 * Each frame: pos += vel * dt; vel.y += GRAVITY * dt
 * GRAVITY = -9.0 (slightly lower than real for game feel)
 *
 * TWO TARGETING MODES (toggled via button):
 *   Mode 1 — TRACKING: aims at player's current position when thrown.
 *             Accuracy settable via radius scatter (imperfect aim).
 *   Mode 2 — FIXED SPOT: always throws to the same world position.
 *             Classic turret/cannon pattern.
 *
 * FRAMEWORK NOTE — Arc Projectile
 * ────────────────────────────────
 * calculateLobVelocity(start, target, flightTime, gravity) is a pure math
 * function. Same calculation works for:
 *   Basketball shots, golf drives, grenade throws, siege catapults.
 *   Import from a shared projectile utils module once confirmed.
 *
 * CONFIGURABLES:
 *   throwInterval     — seconds between throws
 *   flightTime        — arc duration in seconds (longer = higher arc)
 *   scatter           — aiming error radius (0 = perfect, 1.5 = imprecise)
 *   bombRadius        — explosion hit radius
 *   targetMode        — 'player' | 'fixed'
 *   fixedTargetOffset — offset from NPC spawn for fixed mode
 *
 * DEMO (run and verify):
 *   [ ] Orange box NPC visible at north of station
 *   [ ] Every 3s: bomb launches on a visible arc from NPC toward player
 *   [ ] Walk around — bomb tracks your position (imperfect aim)
 *   [ ] Press "FIXED TARGET" button — bomb always lands at red X
 *   [ ] Press "TRACK PLAYER" button — bomb tracks you again
 *   [ ] Walk into bomb landing zone when it hits → knockback
 *   [ ] Console logs [HZ6] launch velocity + target
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer, MeshCollider
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

const GRAVITY = -9.0

// ─── Arc projectile math ─────────────────────────────────────────────────────

function calculateLobVelocity(
  start: {x:number;y:number;z:number}, target: {x:number;y:number;z:number}, flightTime: number
): {x:number; y:number; z:number} {
  return {
    x: (target.x - start.x) / flightTime,
    y: (target.y - start.y - 0.5 * GRAVITY * flightTime * flightTime) / flightTime,
    z: (target.z - start.z) / flightTime
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BombState {
  entity:  ReturnType<typeof engine.addEntity>
  active:  boolean
  pos:     {x:number; y:number; z:number}
  vel:     {x:number; y:number; z:number}
  elapsed: number
  maxTime: number  // kill bomb after this many seconds (safety net)
}

// ─── Station: HZ6 — Bomb Thrower ──────────────────────────────────────────────

export function setupHZBombThrower(): void {
  const { x, z } = { x: 96, z: 138 }
  createStation('hz6_bombthrow', 'HZ6 — BOMB THROWER\nParabolic arc, 2 target modes', STATUS_COLOR.FULLY_CODED)

  // NPC enemy (orange box — replace with GLB when available)
  const npc = engine.addEntity()
  Transform.create(npc, {
    position: Vector3.create(x, 1.0, z - 3.0),
    scale: Vector3.create(0.7, 1.4, 0.5)
  })
  MeshRenderer.setBox(npc)
  Material.setPbrMaterial(npc, {
    albedoColor: Color4.create(0.9, 0.4, 0.1, 1),
    emissiveColor: { r: 0.3, g: 0.1, b: 0 }, emissiveIntensity: 0.3
  })

  // "Eye" indicator showing throw direction
  const eye = engine.addEntity()
  Transform.create(eye, {
    position: Vector3.create(x, 1.5, z - 2.8),
    scale: Vector3.create(0.15, 0.15, 0.3)
  })
  MeshRenderer.setBox(eye)
  Material.setPbrMaterial(eye, {
    albedoColor: Color4.create(1, 0.9, 0, 1),
    emissiveColor: { r: 0.6, g: 0.5, b: 0 }, emissiveIntensity: 1
  })

  // NPC label
  const npcLbl = engine.addEntity()
  Transform.create(npcLbl, { position: Vector3.create(x, 2.5, z - 3.0) })
  Billboard.create(npcLbl, {})
  TextShape.create(npcLbl, {
    text: '💣 BOMB THROWER',
    fontSize: 1.4, textColor: Color4.create(1, 0.5, 0.1, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Bomb entity (pre-create one, hidden below floor when inactive)
  const bombEntity = engine.addEntity()
  Transform.create(bombEntity, {
    position: Vector3.create(x, -50, z),
    scale: Vector3.create(0.4, 0.4, 0.4)
  })
  MeshRenderer.setCylinder(bombEntity)  // round bomb shape
  Material.setPbrMaterial(bombEntity, {
    albedoColor: Color4.create(0.1, 0.1, 0.1, 1),
    emissiveColor: { r: 0.1, g: 0, b: 0 }, emissiveIntensity: 0.4
  })

  // Bomb fuse (small red sphere on top of bomb)
  const fuseEntity = engine.addEntity()
  Transform.create(fuseEntity, {
    position: Vector3.create(x, -50, z),
    scale: Vector3.create(0.08, 0.08, 0.08)
  })
  MeshRenderer.setCylinder(fuseEntity)
  Material.setPbrMaterial(fuseEntity, {
    albedoColor: Color4.create(1, 0.2, 0, 1),
    emissiveColor: { r: 0.8, g: 0.1, b: 0 }, emissiveIntensity: 2
  })

  // Fixed target marker (red X on the ground)
  const fixedTargetPos = Vector3.create(x, 0.52, z + 2.5)
  const targetMark = engine.addEntity()
  Transform.create(targetMark, {
    position: Vector3.create(fixedTargetPos.x, fixedTargetPos.y, fixedTargetPos.z),
    scale: Vector3.create(1.5, 0.08, 1.5)
  })
  MeshRenderer.setBox(targetMark)
  Material.setPbrMaterial(targetMark, {
    albedoColor: Color4.create(1, 0.1, 0.1, 0.4)  // subtle red, only obvious in fixed mode
  })

  const targetLbl = engine.addEntity()
  Transform.create(targetLbl, { position: Vector3.create(fixedTargetPos.x, 0.7, fixedTargetPos.z) })
  Billboard.create(targetLbl, {})
  TextShape.create(targetLbl, {
    text: '', fontSize: 1.2, textColor: Color4.create(1, 0.3, 0.3, 1)
  })

  // State
  const throwOrigin = Vector3.create(x, 2.0, z - 2.8)  // throw from NPC's "hand"
  const bombState: BombState = {
    entity: bombEntity, active: false,
    pos: {x, y:-50, z},
    vel: Vector3.Zero(),
    elapsed: 0, maxTime: 8
  }
  let targetMode: 'player' | 'fixed' = 'player'
  let throwTimer = 2.0  // first throw at t=2s
  const flightTime = 1.6
  const scatter = 1.0  // aiming imperfection radius

  // Bomb physics system
  engine.addSystem((dt: number) => {
    // Update throw timer
    throwTimer -= dt
    if (throwTimer <= 0 && !bombState.active) {
      throwTimer = 3.0

      // Determine target
      let target: Vector3
      const pT = Transform.getOrNull(engine.PlayerEntity)
      if (targetMode === 'player' && pT) {
        // Add aiming scatter
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * scatter
        target = Vector3.create(
          pT.position.x + Math.cos(angle) * radius,
          0,
          pT.position.z + Math.sin(angle) * radius
        )
      } else {
        target = Vector3.create(fixedTargetPos.x, fixedTargetPos.y, fixedTargetPos.z)
      }

      // Calculate launch velocity
      const vel = calculateLobVelocity(throwOrigin, target, flightTime)
      bombState.active  = true
      bombState.pos = {x: throwOrigin.x, y: throwOrigin.y, z: throwOrigin.z}
      bombState.vel     = vel
      bombState.elapsed = 0

      const tBomb = Transform.getMutableOrNull(bombEntity)
      const tFuse = Transform.getMutableOrNull(fuseEntity)
      if (tBomb) tBomb.position = Vector3.create(throwOrigin.x, throwOrigin.y, throwOrigin.z)
      if (tFuse) tFuse.position = Vector3.create(throwOrigin.x, throwOrigin.y + 0.25, throwOrigin.z)

      // Rotate NPC to face throw direction
      const faceDx = target.x - throwOrigin.x; const faceDz = target.z - throwOrigin.z
      const faceYaw = Math.atan2(faceDx, faceDz) * 180 / Math.PI
      Transform.getMutable(npc).rotation = Quaternion.fromEulerDegrees(0, faceYaw, 0)
      Transform.getMutable(eye).rotation = Quaternion.fromEulerDegrees(0, faceYaw, 0)

      console.log(`[HZ6] Bomb launched → target=(${target.x.toFixed(1)},${target.z.toFixed(1)}) | velY=${vel.y.toFixed(2)} | mode=${targetMode}`)
    }

    // Update active bomb
    if (bombState.active) {
      bombState.elapsed += dt
      bombState.vel.y += GRAVITY * dt
      bombState.pos.x += bombState.vel.x * dt
      bombState.pos.y += bombState.vel.y * dt
      bombState.pos.z += bombState.vel.z * dt

      const tBomb = Transform.getMutableOrNull(bombEntity)
      const tFuse = Transform.getMutableOrNull(fuseEntity)
      if (tBomb) {
        tBomb.position = Vector3.create(bombState.pos.x, bombState.pos.y, bombState.pos.z)
        // Spin the bomb for visual effect
        const spin = bombState.elapsed * 180
        tBomb.rotation = Quaternion.fromEulerDegrees(spin, 0, spin * 0.7)
      }
      if (tFuse) {
        tFuse.position = Vector3.create(bombState.pos.x, bombState.pos.y + 0.25, bombState.pos.z)
      }

      // Check player proximity (explosion radius)
      const pT = Transform.getOrNull(engine.PlayerEntity)
      if (pT) {
        const dx = pT.position.x - bombState.pos.x
        const dz = pT.position.z - bombState.pos.z
        const dist = Math.sqrt(dx*dx + dz*dz)
        if (dist < 1.0) {
          Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 12)
          console.log('[HZ6] BOMB HIT — knockback!')
          detonate()
          return
        }
      }

      // Hit the ground
      if (bombState.pos.y < 0.3 || bombState.elapsed > bombState.maxTime) {
        detonateAtPosition(bombState.pos)
      }
    }
  }, 10)

  function detonate(): void {
    bombState.active = false
    const tBomb = Transform.getMutableOrNull(bombEntity)
    const tFuse = Transform.getMutableOrNull(fuseEntity)
    if (tBomb) tBomb.position = Vector3.create(x, -50, z)
    if (tFuse) tFuse.position = Vector3.create(x, -50, z)
  }

  function detonateAtPosition(pos: Vector3): void {
    console.log(`[HZ6] Bomb detonated at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
    // Flash explosion (briefly make bomb entity large and yellow)
    const tBomb = Transform.getMutableOrNull(bombEntity)
    if (tBomb) {
      tBomb.position = Vector3.create(pos.x, 0.3, pos.z)
      tBomb.scale = Vector3.create(1.5, 1.5, 1.5)
    }
    Material.setPbrMaterial(bombEntity, {
      albedoColor: Color4.create(1, 0.8, 0, 1),
      emissiveColor: { r: 1, g: 0.5, b: 0 }, emissiveIntensity: 3
    })
    // Reset after brief flash
    let flashTimer = 0
    const flashSystem = engine.addSystem((dt: number) => {
      flashTimer += dt
      if (flashTimer > 0.25) {
        engine.removeSystem(flashSystem)
        const tb = Transform.getMutableOrNull(bombEntity)
        if (tb) {
          tb.position = Vector3.create(x, -50, z)
          tb.scale = Vector3.create(0.4, 0.4, 0.4)
        }
        Material.setPbrMaterial(bombEntity, {
          albedoColor: Color4.create(0.1, 0.1, 0.1, 1),
          emissiveColor: { r: 0.1, g: 0, b: 0 }, emissiveIntensity: 0.4
        })
      }
    }, 5)
    detonate()
  }

  // Target mode buttons
  const trackBtn = createButton(x - 2, 0.8, z - 3.6, '🎯 Track Player',
    Color4.create(0.2, 0.5, 0.9, 1))
  pointerEventsSystem.onPointerDown(
    { entity: trackBtn, opts: { button: 1, hoverText: '[E] Track player' } },
    () => {
      targetMode = 'player'
      Material.setPbrMaterial(targetMark, { albedoColor: Color4.create(1, 0.1, 0.1, 0.1) })
      TextShape.getMutable(targetLbl).text = ''
      console.log('[HZ6] Mode: TRACK PLAYER')
    }
  )

  const fixedBtn = createButton(x + 2, 0.8, z - 3.6, '📌 Fixed Target',
    Color4.create(0.6, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown(
    { entity: fixedBtn, opts: { button: 1, hoverText: '[E] Fixed target' } },
    () => {
      targetMode = 'fixed'
      Material.setPbrMaterial(targetMark, { albedoColor: Color4.create(1, 0.1, 0.1, 0.5) })
      TextShape.getMutable(targetLbl).text = '🎯 TARGET'
      console.log('[HZ6] Mode: FIXED TARGET')
    }
  )

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z - 3.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'calculateLobVelocity(start, target, flightTime)\nPure math — no physics engine\nScatter = aim imperfection (1.0m radius)',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ6] BombThrower initialized — 3s interval, flightTime=1.6s, scatter=1.0m')
}
