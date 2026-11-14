/**
 * ml_shared.ts — Shared types for MonsterLibrary prototype systems
 *
 * These types are designed to be promoted to the DN DCL framework once proven.
 * They are intentionally game-agnostic so they work for MonsterLibrary,
 * GhostTown, OreMonger, or any scene that needs node-walking, detection, or
 * timed interactions.
 *
 * FRAMEWORK DESIGN NOTE
 * ─────────────────────
 * The key architecture principle: DETECTION is decoupled from MOVEMENT.
 *
 *   DetectionComponent  — HOW does an enemy notice you?
 *                         (radius, cone, or both)
 *   MovementMode        — HOW does an enemy travel?
 *                         (node-walk, direct, fly+swoop)
 *   BehaviorState       — WHAT state is the enemy in?
 *                         (idle, patrol, alerted, chasing, attacking)
 *
 * This lets the same detection logic work for:
 *   MonsterLibrary wandering monster  → NodeWalk movement
 *   GhostTown tunnel ghost            → NodeWalk movement (different network)
 *   GhostTown graveyard ghost         → Direct/Swoop movement (not node-constrained)
 *
 * The calling code for each is identical:
 *   registerDetector(entity, { mode: 'cone', radius: 8, coneAngleDeg: 60 }, callbacks)
 *   registerNodeWalker(entity, myNodeNetwork, { speed: 2, state: 'patrol' })
 *
 * Only the MovementMode changes — not the detection logic.
 */

import { Entity } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// ─── Node Network (matches libraryLevelDesigner data format) ─────────────────

/**
 * A node in the navigation network.
 * Indices into NodeNetwork.nodes are STABLE — never shift or reuse them.
 * Wandering NPCs read connections[] to pick their next destination.
 */
export interface NodePoint {
  id: number              // stable index; equals position in nodes array
  pos: Vector3            // world-space position (Y = floor height)
  connections: number[]   // indices of directly reachable neighbor nodes
  label?: string          // optional: 'desk', 'shelfA1', 'junction_B', etc.
}

/** The full navigation graph for a space (library, tunnel, graveyard, etc.) */
export interface NodeNetwork {
  nodes: NodePoint[]
}

// ─── Node Walker ─────────────────────────────────────────────────────────────

export type WalkerState = 'idle' | 'patrol' | 'chasing' | 'returning'

export interface NodeWalkerConfig {
  speed: number           // m/s
  state: WalkerState
  patrolPath?: number[]   // node indices to visit in order (cycled)
  onReachedNode?: (nodeIdx: number) => void
}

// ─── Detection System ────────────────────────────────────────────────────────

export type DetectionMode = 'radius' | 'cone' | 'radius_and_cone'

/**
 * Configuration for how an entity detects the player.
 *
 * 'radius'         → triggered when player within radius
 * 'cone'           → triggered when player within radius AND in front cone
 * 'radius_and_cone'→ triggered by radius OR cone (most permissive)
 */
export interface DetectionConfig {
  mode: DetectionMode
  radius: number          // metres — trigger/lose distance
  lostRadius?: number     // metres — when to give up chase (defaults to radius * 1.5)
  coneAngleDeg?: number   // half-angle of detection cone (e.g. 60 = ±60° from forward)
}

export interface DetectorCallbacks {
  onDetect: (target: Entity) => void   // called once when player first spotted
  onLost: () => void                   // called once when player escapes
}

// ─── Hold Interaction ────────────────────────────────────────────────────────

export interface HoldInteractConfig {
  holdDuration: number      // seconds to hold E for
  hoverText?: string        // hint shown when hovering
  onComplete: () => void    // called when hold finishes
  onCancel?: () => void     // called if player releases early
}
