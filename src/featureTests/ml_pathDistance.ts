/**
 * ml_pathDistance.ts — T15: Node Graph Pathfinding + Distance Calculation
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * BFS pathfinding on the NodeNetwork graph. Returns:
 *   - Ordered array of node indices (the route)
 *   - Total path length in metres (sum of segment lengths)
 *   - Estimated travel time at a given speed
 *
 * WHY THIS MATTERS FOR MONSTERLIB
 * ─────────────────────────────────
 * Order difficulty scales with how far a book is from the desk. Without a
 * real path distance, you get Euclidean "as-the-crow-flies" distance — which
 * ignores aisles. A book directly behind a solid shelf might be 2m Euclidean
 * but 12m along the aisle network. The node graph gives the REAL walking
 * distance for balancing patience timers and difficulty.
 *
 * Order difficulty = f(pathLength, playerSpeed, numObstacles)
 * "This book will take about 8s to fetch" — accurate via path distance.
 *
 * FRAMEWORK NOTE
 * ──────────────
 * findPath / pathDistance are pure functions with no SDK dependencies.
 * They can live in a DN utility module (dn-framework/pathfinding.ts)
 * and be used identically in DCL, the World Explorer, or web games.
 *
 * DEMO (run and verify):
 *   [ ] 6-node "library aisles" layout visible (nodes + connections)
 *   [ ] Press NEXT button to cycle through 4 example start→end pairs
 *   [ ] Active path nodes highlight in YELLOW; others stay cyan
 *   [ ] Display shows: path indices, metres, estimated travel time
 *   [ ] Invalid pairs (disconnected) show "No path" gracefully
 *   [ ] Console logs [ML5] each path result
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'
import { NodeNetwork } from './ml_shared'
import { createNodeNetwork, visualizeNodeNetwork } from './ml_nodeWalker'

// ─── BFS Pathfinding (pure functions — no SDK dependency) ────────────────────

export function findPath(network: NodeNetwork, startIdx: number, endIdx: number): number[] | null {
  if (startIdx === endIdx) return [startIdx]
  if (startIdx < 0 || startIdx >= network.nodes.length) return null
  if (endIdx   < 0 || endIdx   >= network.nodes.length) return null

  // BFS
  const visited = new Set<number>()
  const queue: Array<{ idx: number; path: number[] }> = [
    { idx: startIdx, path: [startIdx] }
  ]

  while (queue.length > 0) {
    const { idx, path } = queue.shift()!
    if (visited.has(idx)) continue
    visited.add(idx)

    for (const neighborIdx of network.nodes[idx].connections) {
      if (neighborIdx === endIdx) return [...path, neighborIdx]
      if (!visited.has(neighborIdx)) {
        queue.push({ idx: neighborIdx, path: [...path, neighborIdx] })
      }
    }
  }

  return null // disconnected
}

export function pathWorldDistance(network: NodeNetwork, path: number[]): number {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = network.nodes[path[i]].pos
    const b = network.nodes[path[i + 1]].pos
    const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z
    total += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return total
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLPathDistance(): void {
  const { x, z } = { x: 144, z: 78 }
  createStation('ml5_pathdistance', 'ML5 — PATH DISTANCE\nBFS aisle pathfinding', STATUS_COLOR.FULLY_CODED)

  // Build a "library" node layout: 6 nodes forming aisles + a desk node
  //
  //   [0=desk]--[1=junction]--[2=aisle_A]
  //                  |
  //             [3=cross]----[4=aisle_B]
  //                  |
  //             [5=deep_stack]
  //
  const network = createNodeNetwork([
    { id: 0, pos: Vector3.create(x - 2.5, 0.75, z - 2.5), connections: [1],       label: 'desk'      },
    { id: 1, pos: Vector3.create(x - 0.5, 0.75, z - 2.5), connections: [0, 2, 3], label: 'junction'  },
    { id: 2, pos: Vector3.create(x + 2.5, 0.75, z - 2.5), connections: [1],       label: 'aisle_A'   },
    { id: 3, pos: Vector3.create(x - 0.5, 0.75, z      ), connections: [1, 4, 5], label: 'cross'     },
    { id: 4, pos: Vector3.create(x + 2.5, 0.75, z      ), connections: [3],       label: 'aisle_B'   },
    { id: 5, pos: Vector3.create(x - 0.5, 0.75, z + 2.5), connections: [3],       label: 'deep_stack'},
  ])
  visualizeNodeNetwork(network)

  // Desk marker (yellow star-ish quad)
  const deskMark = engine.addEntity()
  Transform.create(deskMark, {
    position: Vector3.create(x - 2.5, 0.78, z - 2.5),
    scale: Vector3.create(0.6, 0.06, 0.6)
  })
  MeshRenderer.setCylinder(deskMark)
  Material.setPbrMaterial(deskMark, {
    albedoColor: Color4.create(1, 0.9, 0, 1),
    emissiveColor: { r: 0.5, g: 0.4, b: 0 }, emissiveIntensity: 1
  })

  // ─── Path highlight overlay entities (one per node, hidden by default) ───
  const nodeHighlights: ReturnType<typeof engine.addEntity>[] = []
  for (const node of network.nodes) {
    const h = engine.addEntity()
    Transform.create(h, {
      position: Vector3.create(node.pos.x, node.pos.y + 0.08, node.pos.z),
      scale: Vector3.create(0.55, 0.12, 0.55)
    })
    MeshRenderer.setCylinder(h)
    Material.setPbrMaterial(h, {
      albedoColor: Color4.create(1, 0.8, 0, 0) // invisible initially
    })
    nodeHighlights.push(h)
  }

  // ─── Info display ─────────────────────────────────────────────────────────
  const displaySign = engine.addEntity()
  Transform.create(displaySign, { position: Vector3.create(x, 2.6, z - 3.6) })
  Billboard.create(displaySign, {})
  TextShape.create(displaySign, {
    text: 'Press NEXT to find paths\nbetween desk and book nodes',
    fontSize: 1.3, textColor: Color4.White(),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Cycle through example pairs ─────────────────────────────────────────
  const examples: Array<[number, number, string]> = [
    [0, 2, 'desk → aisle_A'],
    [0, 4, 'desk → aisle_B'],
    [0, 5, 'desk → deep_stack'],
    [2, 4, 'aisle_A → aisle_B'],
  ]
  let exampleIdx = 0

  function showPath(startIdx: number, endIdx: number, label: string): void {
    const path = findPath(network, startIdx, endIdx)

    // Reset all highlights
    for (let i = 0; i < network.nodes.length; i++) {
      Material.setPbrMaterial(nodeHighlights[i], {
        albedoColor: Color4.create(1, 0.8, 0, 0) // invisible
      })
    }

    if (!path) {
      TextShape.getMutable(displaySign).text = `${label}\n\nNo path found\n(disconnected nodes)`
      console.log(`[ML5] ${label} → no path`)
      return
    }

    // Highlight path nodes
    for (const nodeIdx of path) {
      Material.setPbrMaterial(nodeHighlights[nodeIdx], {
        albedoColor: Color4.create(1, 0.8, 0, 0.9),
        emissiveColor: { r: 0.5, g: 0.4, b: 0 }, emissiveIntensity: 0.8
      })
    }

    const dist = pathWorldDistance(network, path)
    const travelTime = dist / 2.5 // at 2.5 m/s player walk speed

    const pathStr = path.map(i => network.nodes[i].label || `${i}`).join(' → ')
    TextShape.getMutable(displaySign).text = [
      label,
      '',
      `Path: ${pathStr}`,
      `Distance: ${dist.toFixed(1)} m`,
      `~${travelTime.toFixed(1)} s at walk speed`,
      `Hops: ${path.length - 1}`,
    ].join('\n')

    console.log(`[ML5] ${label} | path=[${path.join(',')}] | ${dist.toFixed(2)}m | ${travelTime.toFixed(1)}s`)
  }

  // Show first example immediately
  showPath(...examples[0])

  // Next button
  const nextBtn = createButton(x + 2.0, 1.0, z - 3.4, '▶ NEXT path',
    Color4.create(0.2, 0.5, 0.9, 1))
  pointerEventsSystem.onPointerDown(
    { entity: nextBtn, opts: { button: 1, hoverText: '[E] Next path example' } },
    () => {
      exampleIdx = (exampleIdx + 1) % examples.length
      showPath(...examples[exampleIdx])
    }
  )

  // Clear button
  const clearBtn = createButton(x - 2.0, 1.0, z - 3.4, '✕ Clear',
    Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown(
    { entity: clearBtn, opts: { button: 1, hoverText: '[E] Clear highlights' } },
    () => {
      for (let i = 0; i < network.nodes.length; i++) {
        Material.setPbrMaterial(nodeHighlights[i], {
          albedoColor: Color4.create(1, 0.8, 0, 0)
        })
      }
      TextShape.getMutable(displaySign).text = 'Highlights cleared\nPress NEXT to find paths'
    }
  )

  // Framework note sign
  const noteSign = engine.addEntity()
  Transform.create(noteSign, { position: Vector3.create(x, 3.8, z - 3.6) })
  Billboard.create(noteSign, {})
  TextShape.create(noteSign, {
    text: 'findPath() = pure function, no SDK deps\nWorks in DCL, World Explorer, web 2D\nBalances MonsterLib order difficulty',
    fontSize: 1.1, textColor: Color4.create(0.8, 1, 0.9, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML5] PathDistance station initialized — 6-node library layout')
}
