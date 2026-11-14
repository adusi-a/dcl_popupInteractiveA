/**
 * ml_wanderingEnemy.ts — T13: Wandering Enemy with Detection + Chase
 * STATUS: 🟩 FULLY CODED — no assets needed (box placeholder)
 *
 * WHAT THIS PROVES
 * ────────────────
 * An NPC that patrols a node network and switches to chase when it spots
 * the player. The critical architectural point is that DETECTION and MOVEMENT
 * are SEPARATE SYSTEMS — the same DetectionSystem works for enemies with
 * completely different movement types.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  DETECTION (this file: DetectionSystem)                         │
 * │    — HOW does the enemy notice you?                             │
 * │    — radius only, cone only, or both                            │
 * │    — fires onDetect() / onLost() callbacks                      │
 * │                                                                 │
 * │  MOVEMENT (ml_nodeWalker.ts: NodeWalkerSystem)                  │
 * │    — HOW does the enemy travel?                                 │
 * │    — walks node-to-node along a network                         │
 * │                                                                 │
 * │  Behavior wiring (this station's setup code)                    │
 * │    — onDetect → switch walker state to 'chasing'                │
 * │    — onLost   → switch walker state to 'patrol'                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * FRAMEWORK NOTE — cross-game reuse
 * ──────────────────────────────────
 * MonsterLibrary wandering monster:
 *   registerDetector(entity, { mode: 'cone', radius: 7, coneAngleDeg: 60 }, callbacks)
 *   registerNodeWalker(entity, libraryNetwork, 0, { state: 'patrol' })
 *
 * GhostTown V2 tunnel ghost (node-constrained in tunnels):
 *   registerDetector(entity, { mode: 'radius', radius: 10 }, callbacks)
 *   registerNodeWalker(entity, tunnelNetwork, 0, { state: 'patrol' })
 *   → Same two calls; different network. Everything else identical.
 *
 * GhostTown V2 graveyard ghost (can fly anywhere — NOT node-constrained):
 *   registerDetector(entity, { mode: 'cone', radius: 12, coneAngleDeg: 45 }, callbacks)
 *   // Uses a DIRECT CHASE mover (not NodeWalker) — the detection call is identical.
 *   // onDetect → enable DirectChase system (lerp toward player position)
 *   // DirectChase doesn't exist yet — this is where it would be wired in.
 *
 * The DetectionSystem doesn't care which movement system responds to its
 * callbacks. Add a DirectChase system later; the detection code never changes.
 *
 * DEMO (run and verify):
 *   [ ] Green enemy box patrols the 5-node route continuously
 *   [ ] Walk into the YELLOW cone (front arc): enemy turns orange, chases you
 *   [ ] Enemy routes toward closest node to your position
 *   [ ] Back beyond 8m: enemy gives up, turns green, resumes patrol
 *   [ ] Radius ring (magenta) = max detection range
 *   [ ] Console logs [ML3] state changes
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, STATUS_COLOR } from './testUtils'
import { NodeNetwork } from './ml_shared'
import { registerNodeWalker, setWalkerState, setWalkerTarget, createNodeNetwork, visualizeNodeNetwork, getWalkerEntry } from './ml_nodeWalker'

// ─── Types ───────────────────────────────────────────────────────────────────

type DetectionMode = 'radius' | 'cone' | 'radius_and_cone'

interface DetectorEntry {
  entity: ReturnType<typeof engine.addEntity>
  mode: DetectionMode
  radius: number
  lostRadius: number
  coneAngleDeg: number
  detected: boolean
  onDetect: () => void
  onLost: () => void
}

const detectors: DetectorEntry[] = []
let detectionSystemRegistered = false

// ─── Detection system ─────────────────────────────────────────────────────────

function ensureDetectionSystem(): void {
  if (detectionSystemRegistered) return
  detectionSystemRegistered = true

  engine.addSystem((_dt: number) => {
    const playerTransform = Transform.getOrNull(engine.PlayerEntity)
    if (!playerTransform) return
    const pp = playerTransform.position

    for (const d of detectors) {
      const eTransform = Transform.getOrNull(d.entity)
      if (!eTransform) continue

      const ep = eTransform.position
      const dx = pp.x - ep.x
      const dz = pp.z - ep.z
      const dist2D = Math.sqrt(dx * dx + dz * dz)

      let spotted = false

      if (d.mode === 'radius') {
        spotted = dist2D < d.radius
      } else if (d.mode === 'cone') {
        // Cone check: player must be within radius AND in front arc
        if (dist2D < d.radius) {
          // Derive forward vector from entity rotation
          const q = eTransform.rotation
          const fwdX = 2 * (q.x * q.z + q.y * q.w)
          const fwdZ = 1 - 2 * (q.x * q.x + q.y * q.y)
          // Normalize direction to player
          const nx = dist2D > 0.01 ? dx / dist2D : 0
          const nz = dist2D > 0.01 ? dz / dist2D : 0
          const dot = fwdX * nx + fwdZ * nz
          const halfCos = Math.cos(d.coneAngleDeg * Math.PI / 180)
          spotted = dot > halfCos
        }
      } else { // radius_and_cone
        if (dist2D < d.radius * 0.5) {
          spotted = true // close enough — radius shortcut
        } else if (dist2D < d.radius) {
          // Check cone
          const q = eTransform.rotation
          const fwdX = 2 * (q.x * q.z + q.y * q.w)
          const fwdZ = 1 - 2 * (q.x * q.x + q.y * q.y)
          const nx = dist2D > 0.01 ? dx / dist2D : 0
          const nz = dist2D > 0.01 ? dz / dist2D : 0
          const dot = fwdX * nx + fwdZ * nz
          const halfCos = Math.cos(d.coneAngleDeg * Math.PI / 180)
          spotted = dot > halfCos
        }
      }

      if (spotted && !d.detected) {
        d.detected = true
        d.onDetect()
      } else if (!spotted && d.detected && dist2D > d.lostRadius) {
        d.detected = false
        d.onLost()
      }
    }
  }, 20) // priority 20 — after walker movement
}

function registerDetector(
  entity: ReturnType<typeof engine.addEntity>,
  config: { mode: DetectionMode; radius: number; coneAngleDeg?: number; lostRadius?: number },
  callbacks: { onDetect: () => void; onLost: () => void }
): void {
  ensureDetectionSystem()
  detectors.push({
    entity,
    mode: config.mode,
    radius: config.radius,
    lostRadius: config.lostRadius ?? config.radius * 1.5,
    coneAngleDeg: config.coneAngleDeg ?? 60,
    detected: false,
    onDetect: callbacks.onDetect,
    onLost: callbacks.onLost
  })
}

/** Given a player position, find the closest node in the network. */
function closestNodeToPlayer(network: NodeNetwork, playerPos: Vector3): number {
  let closest = 0
  let closestDist = Infinity
  for (let i = 0; i < network.nodes.length; i++) {
    const n = network.nodes[i]
    const dx = n.pos.x - playerPos.x
    const dz = n.pos.z - playerPos.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < closestDist) { closestDist = d; closest = i }
  }
  return closest
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLWanderingEnemy(): void {
  const { x, z } = { x: 120, z: 78 }
  createStation('ml3_wanderenemy', 'ML3 — WANDERING ENEMY\nDetect + Chase decoupled', STATUS_COLOR.FULLY_CODED)

  // 5-node patrol route inside station
  const network = createNodeNetwork([
    { id: 0, pos: Vector3.create(x - 2.5, 0.75, z - 2.5), connections: [1, 4] },
    { id: 1, pos: Vector3.create(x + 2.5, 0.75, z - 2.5), connections: [0, 2] },
    { id: 2, pos: Vector3.create(x + 2.5, 0.75, z     ), connections: [1, 3] },
    { id: 3, pos: Vector3.create(x + 2.5, 0.75, z + 2.5), connections: [2, 4] },
    { id: 4, pos: Vector3.create(x - 2.5, 0.75, z + 2.5), connections: [3, 0] },
  ])
  visualizeNodeNetwork(network)

  // Enemy entity (green box)
  const enemy = engine.addEntity()
  Transform.create(enemy, {
    position: Vector3.create(x - 2.5, 0.75, z - 2.5),
    scale: Vector3.create(0.5, 0.9, 0.3)
  })
  MeshRenderer.setBox(enemy)
  Material.setPbrMaterial(enemy, {
    albedoColor: Color4.create(0.1, 0.8, 0.2, 1),
    emissiveColor: { r: 0, g: 0.3, b: 0 }, emissiveIntensity: 0.3
  })

  // "Eye" indicator (small box that shows where enemy is "looking")
  const eye = engine.addEntity()
  Transform.create(eye, {
    position: Vector3.create(x - 2.5, 1.2, z - 2.5),
    scale: Vector3.create(0.1, 0.1, 0.4)  // elongated forward
  })
  MeshRenderer.setBox(eye)
  Material.setPbrMaterial(eye, {
    albedoColor: Color4.create(1, 0.9, 0, 1),
    emissiveColor: { r: 0.5, g: 0.4, b: 0 }, emissiveIntensity: 1
  })

  // Detection radius ring (visual guide — ring of small spheres)
  const DETECT_RADIUS = 7.0
  const CONE_ANGLE = 60
  const RING_SEGMENTS = 20
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    const rx = x + Math.cos(angle) * DETECT_RADIUS
    const rz = z + Math.sin(angle) * DETECT_RADIUS
    const dot = engine.addEntity()
    Transform.create(dot, {
      position: Vector3.create(rx, 0.52, rz),
      scale: Vector3.create(0.12, 0.08, 0.12)
    })
    MeshRenderer.setCylinder(dot)
    Material.setPbrMaterial(dot, {
      albedoColor: Color4.create(0.9, 0, 0.9, 0.5)
    })
  }

  // Register NodeWalker (patrol)
  registerNodeWalker(enemy, network, 0, {
    speed: 2.0,
    state: 'patrol',
    patrolPath: [0, 1, 2, 3, 4],
    onReachedNode: (idx) => {
      // Keep eye tracker updated — Transform is handled by NodeWalker
      const eT = Transform.getOrNull(enemy)
      if (eT) {
        const eyeT = Transform.getMutableOrNull(eye)
        if (eyeT) {
          eyeT.position.x = eT.position.x
          eyeT.position.y = eT.position.y + 0.45
          eyeT.position.z = eT.position.z
          eyeT.rotation   = eT.rotation
        }
      }
    }
  })

  // Detection state tracking
  let isChasing = false

  registerDetector(
    enemy,
    { mode: 'cone', radius: DETECT_RADIUS, coneAngleDeg: CONE_ANGLE, lostRadius: 8.5 },
    {
      onDetect: () => {
        if (isChasing) return
        isChasing = true
        // Turn orange — enemy is alert/chasing
        Material.setPbrMaterial(enemy, {
          albedoColor: Color4.create(1, 0.4, 0, 1),
          emissiveColor: { r: 0.5, g: 0.1, b: 0 }, emissiveIntensity: 0.6
        })
        console.log('[ML3] Enemy DETECTED player — switching to chase')

        // Set up a chase update system (runs until lost)
        // We update the chase target each frame by picking the closest node to the player
        engine.addSystem(function chaseUpdate(_dt: number) {
          if (!isChasing) {
            engine.removeSystem(chaseUpdate)
            return
          }
          const pT = Transform.getOrNull(engine.PlayerEntity)
          if (!pT) return
          const targetNode = closestNodeToPlayer(network, pT.position)
          setWalkerTarget(enemy, targetNode)
          // Increase speed while chasing
          const w = getWalkerEntry(enemy)
          if (w) w.speed = 3.5
        }, 25)
      },

      onLost: () => {
        if (!isChasing) return
        isChasing = false
        // Reset to green — back to patrol
        Material.setPbrMaterial(enemy, {
          albedoColor: Color4.create(0.1, 0.8, 0.2, 1),
          emissiveColor: { r: 0, g: 0.3, b: 0 }, emissiveIntensity: 0.3
        })
        setWalkerState(enemy, 'patrol')
        // Reset speed
        const w = getWalkerEntry(enemy)
        if (w) w.speed = 2.0
        console.log('[ML3] Enemy LOST player — back to patrol')
      }
    }
  )

  // Detection cone visualization (yellow arc lines)
  const CONE_ARC_STEPS = 8
  const CONE_DISPLAY_RANGE = 5.0
  for (let i = -CONE_ARC_STEPS; i <= CONE_ARC_STEPS; i++) {
    const a = (i / CONE_ARC_STEPS) * CONE_ANGLE * Math.PI / 180
    // Start at center front of station (pointing -Z = south = toward the aisle area)
    const coneLbl = engine.addEntity()
    Transform.create(coneLbl, {
      position: Vector3.create(
        x + Math.sin(a) * CONE_DISPLAY_RANGE * 0.7,
        0.52,
        z - 2.5 + Math.cos(a) * CONE_DISPLAY_RANGE * 0.7
      ),
      scale: Vector3.create(0.08, 0.06, 0.08)
    })
    MeshRenderer.setCylinder(coneLbl)
    Material.setPbrMaterial(coneLbl, {
      albedoColor: Color4.create(1, 0.9, 0, 0.6)
    })
  }

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.2, z - 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '🟡 Cone = detection arc (front)\n🟣 Ring = max detect radius (7m)\nSame detector works for GhostTown ghosts\nMovement system is fully separate',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML3] WanderingEnemy initialized — detection radius=7m, cone=60°, speed=2→3.5 on chase')
}


