/**
 * hz_thwomp.ts — HZ9: Thwomp (Mario-style Ceiling Crusher)
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * A large rectangular block that waits at ceiling height, detects when
 * the player stands below it, shakes (warning), then slams down at high
 * speed (dealing knockback if the player is under it), and slowly rises back up.
 *
 * STATE MACHINE:
 *   WAITING (at ceiling, idle)
 *      ↓ player enters trigger zone below
 *   SHAKING (warning: small random jitter in X/Z, 1 second)
 *      ↓
 *   FALLING (fast Y-axis drop at fallSpeed m/s)
 *      ↓ reaches floor or player hit
 *   SITTING (rests at floor height for 1.5s)
 *      ↓
 *   RISING (slow Y-axis lift at riseSpeed m/s back to wait height)
 *      ↓ reaches wait height
 *   WAITING
 *
 * CONFIGURABLES:
 *   waitHeight    — Y position when waiting (ceiling level)
 *   floorHeight   — Y position when fully down
 *   fallSpeed     — m/s downward velocity (fast — feel of sudden danger)
 *   riseSpeed     — m/s upward velocity (slow — feel of mechanical reset)
 *   shakeTime     — seconds of warning shake before falling
 *   sitTime       — seconds to sit at floor before rising
 *   hitRadius     — XZ radius within which player takes damage when falling
 *
 * FRAMEWORK NOTE
 * ──────────────
 * This is the HazardState machine again (wait → shake/warn → active → sit/cooldown → rise → wait).
 * Same pattern used for spikes, darts. The unique part is the Y-axis animation
 * with two different speeds — identical to any elevator/platform but with a
 * danger state.
 *
 * MonsterLibrary use: a heavy bookshelf in the stacks that falls when the
 * player lingers under it (adds danger to searching deep sections).
 *
 * DEMO (run and verify):
 *   [ ] Large grey block visible near ceiling above station center
 *   [ ] Walk under the block → it shakes side-to-side for 1 second
 *   [ ] Block slams DOWN fast (< 0.5s) — get out from under it!
 *   [ ] If player is under block when it hits → knockback upward
 *   [ ] Block sits at floor for 1.5s, then slowly rises back (3-4s to ceiling)
 *   [ ] Walk away during rise → it still completes the cycle
 *   [ ] Console logs [HZ9] each state transition
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── Station: HZ9 — Thwomp ───────────────────────────────────────────────────

export function setupHZThwomp(): void {
  const { x, z } = { x: 132, z: 138 }
  createStation('hz9_thwomp', 'HZ9 — THWOMP\nMario ceiling crusher', STATUS_COLOR.FULLY_CODED)

  // Configuration
  const WAIT_Y    = 7.0   // ceiling level (metres)
  const FLOOR_Y   = 0.9   // just above station floor surface
  const FALL_SPEED = 18.0 // m/s — fast slam
  const RISE_SPEED = 1.8  // m/s — slow rise
  const SHAKE_TIME = 1.1  // seconds of warning shake
  const SIT_TIME   = 1.8  // seconds sitting at floor
  const HIT_RADIUS = 2.4  // XZ radius for knockback
  const BLOCK_HALF = 2.0  // half-size of block (block is 4×4m wide, 1.5m tall)
  const BLOCK_HEIGHT = 1.5

  // ─── Thwomp block ───────────────────────────────────────────────────────────
  const thwompEntity = engine.addEntity()
  Transform.create(thwompEntity, {
    position: Vector3.create(x, WAIT_Y + BLOCK_HEIGHT * 0.5, z),
    scale: Vector3.create(BLOCK_HALF * 2, BLOCK_HEIGHT, BLOCK_HALF * 2)
  })
  MeshRenderer.setBox(thwompEntity)
  MeshCollider.setBox(thwompEntity, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(thwompEntity, {
    albedoColor: Color4.create(0.4, 0.4, 0.5, 1),
    emissiveColor: { r: 0.05, g: 0.05, b: 0.1 }, emissiveIntensity: 0.3
  })

  // "Face" markings (two eyes as small boxes)
  for (const ex of [-0.7, 0.7]) {
    const eye = engine.addEntity()
    Transform.create(eye, {
      position: Vector3.create(x + ex, WAIT_Y + BLOCK_HEIGHT * 0.5 + 0.3, z + BLOCK_HALF - 0.08),
      scale: Vector3.create(0.4, 0.4, 0.1)
    })
    MeshRenderer.setBox(eye)
    Material.setPbrMaterial(eye, {
      albedoColor: Color4.create(0.9, 0.1, 0.1, 1),
      emissiveColor: { r: 0.6, g: 0, b: 0 }, emissiveIntensity: 1
    })
  }

  // Warning danger zone below the thwomp (shows player where it's safe vs. not)
  const dangerZone = engine.addEntity()
  Transform.create(dangerZone, {
    position: Vector3.create(x, 0.52, z),
    scale: Vector3.create(BLOCK_HALF * 2 * 0.9, 0.06, BLOCK_HALF * 2 * 0.9)
  })
  MeshRenderer.setBox(dangerZone)
  Material.setPbrMaterial(dangerZone, {
    albedoColor: Color4.create(0.6, 0.1, 0.1, 0.4)  // subtle red shadow
  })

  const dangerLbl = engine.addEntity()
  Transform.create(dangerLbl, { position: Vector3.create(x, 0.68, z + 2.2) })
  Billboard.create(dangerLbl, {})
  TextShape.create(dangerLbl, {
    text: '☠ DANGER ZONE\nStand here to trigger',
    fontSize: 1.1, textColor: Color4.create(1, 0.4, 0.4, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Status display
  const statusSign = engine.addEntity()
  Transform.create(statusSign, { position: Vector3.create(x + BLOCK_HALF + 1.2, WAIT_Y * 0.5, z) })
  Billboard.create(statusSign, {})
  TextShape.create(statusSign, {
    text: '😴 WAITING', fontSize: 1.3,
    textColor: Color4.create(0.7, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Trigger zone below the thwomp ──────────────────────────────────────────
  const triggerEntity = engine.addEntity()
  Transform.create(triggerEntity, {
    position: Vector3.create(x, 2.5, z),
    scale: Vector3.create(BLOCK_HALF * 2, 5, BLOCK_HALF * 2)
  })
  TriggerArea.setBox(triggerEntity)

  // ─── State ───────────────────────────────────────────────────────────────────
  type ThwompState = 'waiting' | 'shaking' | 'falling' | 'sitting' | 'rising'
  let state: ThwompState = 'waiting'
  let stateTimer = 0
  let currentY = WAIT_Y + BLOCK_HEIGHT * 0.5
  let shakeOffsetX = 0
  let shakeOffsetZ = 0
  let playerHit = false
  let hitImmunity = 0

  triggerAreaEventsSystem.onTriggerEnter(triggerEntity, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    if (state === 'waiting') {
      state = 'shaking'
      stateTimer = SHAKE_TIME
      TextShape.getMutable(statusSign).text = '😠 SHAKING!'
      TextShape.getMutable(statusSign).textColor = Color4.create(1, 0.6, 0.1, 1)
      Material.setPbrMaterial(thwompEntity, {
        albedoColor: Color4.create(0.7, 0.3, 0.2, 1),
        emissiveColor: { r: 0.3, g: 0.05, b: 0 }, emissiveIntensity: 0.8
      })
      console.log('[HZ9] Player entered — SHAKING')
    }
  })

  engine.addSystem((dt: number) => {
    if (hitImmunity > 0) hitImmunity -= dt

    const pT = Transform.getOrNull(engine.PlayerEntity)
    const pp = pT?.position ?? Vector3.create(0, -100, 0)
    const thwompT = Transform.getMutableOrNull(thwompEntity)
    if (!thwompT) return

    switch (state) {
      case 'waiting':
        shakeOffsetX = 0; shakeOffsetZ = 0
        thwompT.position = Vector3.create(x, WAIT_Y + BLOCK_HEIGHT * 0.5, z)
        break

      case 'shaking': {
        stateTimer -= dt
        // Random jitter
        shakeOffsetX = (Math.random() - 0.5) * 0.25
        shakeOffsetZ = (Math.random() - 0.5) * 0.08
        thwompT.position = Vector3.create(x + shakeOffsetX, WAIT_Y + BLOCK_HEIGHT * 0.5, z + shakeOffsetZ)

        if (stateTimer <= 0) {
          state = 'falling'
          playerHit = false
          TextShape.getMutable(statusSign).text = '💥 FALLING!'
          TextShape.getMutable(statusSign).textColor = Color4.create(1, 0.2, 0.2, 1)
          Material.setPbrMaterial(thwompEntity, {
            albedoColor: Color4.create(0.9, 0.1, 0.05, 1),
            emissiveColor: { r: 0.7, g: 0, b: 0 }, emissiveIntensity: 1.5
          })
          console.log('[HZ9] FALLING')
        }
        break
      }

      case 'falling': {
        currentY = thwompT.position.y - BLOCK_HEIGHT * 0.5  // top of block
        const newY = thwompT.position.y - FALL_SPEED * dt

        // Check player XZ proximity during fall
        const dx = pp.x - x; const dz = pp.z - z
        const xyDist = Math.sqrt(dx*dx + dz*dz)

        if (!playerHit && hitImmunity <= 0 && xyDist < HIT_RADIUS) {
          // Player is under the thwomp — did the bottom pass the player's head?
          const blockBottom = newY - BLOCK_HEIGHT * 0.5
          if (blockBottom <= pp.y + 1.0) {
            // HIT
            Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 15)
            playerHit = true
            hitImmunity = 2.0
            console.log('[HZ9] THWOMP HIT — knockback!')
          }
        }

        thwompT.position = Vector3.create(x, Math.max(FLOOR_Y + BLOCK_HEIGHT * 0.5, newY), z)

        if (thwompT.position.y <= FLOOR_Y + BLOCK_HEIGHT * 0.5 + 0.05) {
          // Hit floor
          thwompT.position = Vector3.create(x, FLOOR_Y + BLOCK_HEIGHT * 0.5, z)
          state = 'sitting'; stateTimer = SIT_TIME
          TextShape.getMutable(statusSign).text = '😑 SITTING...'
          TextShape.getMutable(statusSign).textColor = Color4.create(0.5, 0.5, 0.5, 1)
          Material.setPbrMaterial(thwompEntity, {
            albedoColor: Color4.create(0.3, 0.3, 0.4, 1),
            emissiveColor: { r: 0.03, g: 0.03, b: 0.08 }, emissiveIntensity: 0.3
          })
          console.log('[HZ9] SITTING — waiting to rise')
        }
        break
      }

      case 'sitting':
        stateTimer -= dt
        if (stateTimer <= 0) {
          state = 'rising'
          TextShape.getMutable(statusSign).text = '⬆ RISING...'
          TextShape.getMutable(statusSign).textColor = Color4.create(0.6, 0.6, 1, 1)
          Material.setPbrMaterial(thwompEntity, {
            albedoColor: Color4.create(0.4, 0.4, 0.55, 1),
            emissiveColor: { r: 0.05, g: 0.05, b: 0.15 }, emissiveIntensity: 0.4
          })
          console.log('[HZ9] RISING')
        }
        break

      case 'rising': {
        const newY2 = thwompT.position.y + RISE_SPEED * dt
        thwompT.position = Vector3.create(x, Math.min(WAIT_Y + BLOCK_HEIGHT * 0.5, newY2), z)
        if (thwompT.position.y >= WAIT_Y + BLOCK_HEIGHT * 0.5 - 0.05) {
          thwompT.position = Vector3.create(x, WAIT_Y + BLOCK_HEIGHT * 0.5, z)
          state = 'waiting'
          TextShape.getMutable(statusSign).text = '😴 WAITING'
          TextShape.getMutable(statusSign).textColor = Color4.create(0.7, 0.9, 0.7, 1)
          Material.setPbrMaterial(thwompEntity, {
            albedoColor: Color4.create(0.4, 0.4, 0.5, 1),
            emissiveColor: { r: 0.05, g: 0.05, b: 0.1 }, emissiveIntensity: 0.3
          })
          console.log('[HZ9] RESET — waiting')
        }
        break
      }
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x - BLOCK_HALF - 1.5, WAIT_Y * 0.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Fall: 18 m/s\nRise: 1.8 m/s\nShake: 1.1s warning\nSit: 1.8s before rise\nSame FSM: spikes, darts, doors',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.9, 1, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ9] Thwomp initialized — waitY=7m, fallSpeed=18, riseSpeed=1.8')
}
