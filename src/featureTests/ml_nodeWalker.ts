/**
 * ml_nodeWalker.ts — T11: Node Network Walker
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Node-to-node movement along a navigation graph. One shared engine system
 * drives every registered walker — proper DCL ECS pattern (one system, many
 * entities; not one system per entity).
 *
 * FRAMEWORK CANDIDATES
 * ────────────────────
 * NodeNetwork + registerNodeWalker → reusable in any scene that needs
 * predictable, aisle-respecting NPC movement:
 *   MonsterLibrary  — wandering enemies, customer queue
 *   GhostTown V2    — tunnel ghosts (same system, different network)
 *   OreMonger       — crew members walking between mine and office
 *
 * The node network format matches libraryLevelDesigner's data model so
 * level-editor data loads directly into this system.
 *
 * DEMO (run and verify):
 *   [ ] Blue box walks continuously around the 4-node loop
 *   [ ] Press 'Set Target' button → box routes to a specific node
 *   [ ] Press 'Patrol' button → box resumes looping the full path
 *   [ ] Console logs [ML1] each time a node is reached
 *   [ ] Node markers (cyan cylinders) visible on the ground
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'
import { NodeNetwork, NodeWalkerConfig, WalkerState } from './ml_shared'

// ─── Module-level walker registry ────────────────────────────────────────────

interface WalkerEntry {
  entity: ReturnType<typeof engine.addEntity>
  network: NodeNetwork
  currentNodeIdx: number
  targetNodeIdx: number
  speed: number
  state: WalkerState
  patrolPath: number[]
  patrolPathIdx: number
  onReachedNode?: (nodeIdx: number) => void
}

const walkers = new Map<ReturnType<typeof engine.addEntity>, WalkerEntry>()
let systemRegistered = false

function getV3Distance(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Registers the ONE shared walker system (safe to call multiple times). */
function ensureWalkerSystem(): void {
  if (systemRegistered) return
  systemRegistered = true

  engine.addSystem((dt: number) => {
    for (const [entity, entry] of walkers) {
      if (entry.state === 'idle') continue
      if (entry.currentNodeIdx === entry.targetNodeIdx) continue

      const targetNode = entry.network.nodes[entry.targetNodeIdx]
      if (!targetNode) continue

      const t = Transform.getMutableOrNull(entity)
      if (!t) continue

      const dx = targetNode.pos.x - t.position.x
      const dy = targetNode.pos.y - t.position.y
      const dz = targetNode.pos.z - t.position.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 0.08) {
        // Arrived at node
        t.position.x = targetNode.pos.x
        t.position.y = targetNode.pos.y
        t.position.z = targetNode.pos.z
        entry.currentNodeIdx = entry.targetNodeIdx

        if (entry.onReachedNode) entry.onReachedNode(entry.currentNodeIdx)

        // Advance patrol path
        if (entry.state === 'patrol' && entry.patrolPath.length > 1) {
          entry.patrolPathIdx = (entry.patrolPathIdx + 1) % entry.patrolPath.length
          entry.targetNodeIdx = entry.patrolPath[entry.patrolPathIdx]
        }
      } else {
        // Move toward target
        const step = Math.min(entry.speed * dt / dist, 1)
        t.position.x += dx * step
        t.position.y += dy * step
        t.position.z += dz * step

        // Face direction of travel (Y-up, XZ plane)
        if (Math.abs(dx) + Math.abs(dz) > 0.01) {
          const yaw = Math.atan2(dx, dz) * (180 / Math.PI)
          t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
        }
      }
    }
  }, 10) // priority 10 — runs before detection (which is 20)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register an entity to walk on a node network.
 * The entity's Transform.position should start at the starting node.
 */
export function registerNodeWalker(
  entity: ReturnType<typeof engine.addEntity>,
  network: NodeNetwork,
  startNodeIdx: number,
  config: NodeWalkerConfig
): void {
  ensureWalkerSystem()
  const patrolPath = config.patrolPath ?? network.nodes.map((_, i) => i)
  walkers.set(entity, {
    entity, network,
    currentNodeIdx: startNodeIdx,
    targetNodeIdx: startNodeIdx,
    speed: config.speed,
    state: config.state,
    patrolPath,
    patrolPathIdx: patrolPath.indexOf(startNodeIdx),
    onReachedNode: config.onReachedNode
  })
}

/** Change a walker's state. */
export function setWalkerState(
  entity: ReturnType<typeof engine.addEntity>,
  state: WalkerState
): void {
  const w = walkers.get(entity)
  if (!w) return
  w.state = state
  if (state === 'patrol' && w.patrolPath.length > 0) {
    // Resume patrol from current node's position in the patrol path
    const idx = w.patrolPath.indexOf(w.currentNodeIdx)
    w.patrolPathIdx = idx >= 0 ? idx : 0
    w.targetNodeIdx = w.patrolPath[(w.patrolPathIdx + 1) % w.patrolPath.length]
  }
}

/** Route walker to a specific node (overrides patrol). */
export function setWalkerTarget(
  entity: ReturnType<typeof engine.addEntity>,
  targetNodeIdx: number
): void {
  const w = walkers.get(entity)
  if (!w) return
  w.state = 'chasing'
  w.targetNodeIdx = targetNodeIdx
}

/** Remove a walker from the system. */
export function unregisterNodeWalker(entity: ReturnType<typeof engine.addEntity>): void {
  walkers.delete(entity)
}

/** Expose the walker registry for other systems (detection, chase). */
export function getWalkerEntry(entity: ReturnType<typeof engine.addEntity>): WalkerEntry | undefined {
  return walkers.get(entity)
}

/** Export the network builder for other ML files. */
export function createNodeNetwork(nodes: NodeNetwork['nodes']): NodeNetwork {
  return { nodes }
}

// ─── Visual helpers ──────────────────────────────────────────────────────────

/**
 * Spawns cyan cylinder markers at each node position and
 * dashed-line connectors (small boxes) between connected nodes.
 */
export function visualizeNodeNetwork(network: NodeNetwork): void {
  for (const node of network.nodes) {
    // Node dot
    const dot = engine.addEntity()
    Transform.create(dot, {
      position: Vector3.create(node.pos.x, node.pos.y + 0.05, node.pos.z),
      scale: Vector3.create(0.3, 0.1, 0.3)
    })
    MeshRenderer.setCylinder(dot)
    Material.setPbrMaterial(dot, {
      albedoColor: Color4.create(0, 0.8, 1, 0.9),
      emissiveColor: { r: 0, g: 0.3, b: 0.5 }, emissiveIntensity: 0.8
    })

    // Label
    const lbl = engine.addEntity()
    Transform.create(lbl, {
      position: Vector3.create(node.pos.x, node.pos.y + 0.6, node.pos.z)
    })
    Billboard.create(lbl, {})
    TextShape.create(lbl, {
      text: node.label ? `${node.id}:${node.label}` : `${node.id}`,
      fontSize: 1.2, textColor: Color4.White(),
      outlineColor: Color4.Black(), outlineWidth: 0.1
    })

    // Connection lines (small boxes between nodes)
    for (const neighborIdx of node.connections) {
      if (neighborIdx <= node.id) continue // draw each connection once
      const neighbor = network.nodes[neighborIdx]
      if (!neighbor) continue
      const mx = (node.pos.x + neighbor.pos.x) / 2
      const my = (node.pos.y + neighbor.pos.y) / 2 + 0.03
      const mz = (node.pos.z + neighbor.pos.z) / 2
      const dist = getV3Distance(node.pos, neighbor.pos)
      const dx = neighbor.pos.x - node.pos.x
      const dz = neighbor.pos.z - node.pos.z
      const angle = Math.atan2(dx, dz) * (180 / Math.PI)

      const line = engine.addEntity()
      Transform.create(line, {
        position: Vector3.create(mx, my, mz),
        scale: Vector3.create(0.08, 0.06, dist),
        rotation: Quaternion.fromEulerDegrees(0, angle, 0)
      })
      MeshRenderer.setBox(line)
      Material.setPbrMaterial(line, {
        albedoColor: Color4.create(0, 0.6, 0.8, 0.5)
      })
    }
  }
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLNodeWalker(): void {
  const { x, z } = { x: 96, z: 78 }
  createStation('ml1_nodewalker', 'ML1 — NODE WALKER\n4-node patrol loop', STATUS_COLOR.FULLY_CODED)

  // Build demo network: 4 nodes forming a loop inside the station
  const network = createNodeNetwork([
    { id: 0, pos: Vector3.create(x - 2.5, 0.75, z - 2.5), connections: [1, 3], label: 'A' },
    { id: 1, pos: Vector3.create(x + 2.5, 0.75, z - 2.5), connections: [0, 2], label: 'B' },
    { id: 2, pos: Vector3.create(x + 2.5, 0.75, z + 2.5), connections: [1, 3], label: 'C' },
    { id: 3, pos: Vector3.create(x - 2.5, 0.75, z + 2.5), connections: [2, 0], label: 'D' },
  ])
  visualizeNodeNetwork(network)

  // Walker entity (blue box — represents a wandering NPC without a GLB)
  const walkerEntity = engine.addEntity()
  Transform.create(walkerEntity, {
    position: Vector3.create(x - 2.5, 0.75, z - 2.5),
    scale: Vector3.create(0.5, 0.9, 0.3)
  })
  MeshRenderer.setBox(walkerEntity)
  Material.setPbrMaterial(walkerEntity, {
    albedoColor: Color4.create(0.3, 0.3, 1, 1),
    emissiveColor: { r: 0.1, g: 0.1, b: 0.5 }, emissiveIntensity: 0.3
  })

  // Register as patrol walker cycling all 4 nodes
  registerNodeWalker(walkerEntity, network, 0, {
    speed: 2,
    state: 'patrol',
    patrolPath: [0, 1, 2, 3],
    onReachedNode: (idx) => {
      console.log(`[ML1] Walker reached node ${idx} (${network.nodes[idx]?.label})`)
    }
  })

  // Patrol button
  const patrolBtn = createButton(x - 2, 1.2, z - 3.8, '▶ Patrol Loop',
    Color4.create(0.2, 0.6, 0.2, 1))
  pointerEventsSystem.onPointerDown({ entity: patrolBtn, opts: { button: 1, hoverText: '[E] Patrol' } },
    () => {
      setWalkerState(walkerEntity, 'patrol')
      console.log('[ML1] Walker → patrol mode')
    })

  // Target jump button (jump to node C)
  const targetBtn = createButton(x + 2, 1.2, z - 3.8, '◉ Jump → C',
    Color4.create(0.6, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: targetBtn, opts: { button: 1, hoverText: '[E] Jump to C' } },
    () => {
      setWalkerTarget(walkerEntity, 2) // node C
      console.log('[ML1] Walker → target node 2 (C)')
    })

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 2.8, z - 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'NodeWalker — one system, many entities\nSame network works for customers + enemies\nGhostTown tunnel ghosts: same system',
    fontSize: 1.2, textColor: Color4.create(0.8, 1, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML1] NodeWalker station initialized — 4-node patrol loop running')
}
