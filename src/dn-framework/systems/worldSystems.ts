/**
 * @file worldSystems.ts
 * @module DN DCL Framework / systems
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * World behavior ECS systems — registered ONCE via engine.addSystem().
 * Each system iterates a module-level registry of active behavior instances.
 *
 * SYSTEMS:
 *   FarmSystem        — ticks FarmPlotBehavior every ~1s; swaps GLBs on growth changes
 *   NPCMovementSystem — moves entities with MovementBehavior every frame
 *   EnemyAISystem     — drives enemy state machine (idle/chase/attack), handles death/respawn
 *
 * USAGE:
 *   1. Call initWorldSystems(gameMgr) once in GameManager constructor.
 *   2. Register entities via registerFarmPlot(), registerMovingEntity(), registerEnemyEntity()
 *      (called automatically by AreaManager at load time).
 *
 * @changelog
 *   0.0001 - Initial. FarmSystem + NPCMovementSystem. Single-system DOP pattern
 *            (no per-entity engine.addSystem calls — the correct SDK7 approach).
 */

import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { FarmPlotBehavior, MovementBehavior, HealthBehavior, EnemyAIBehavior } from '../npcs/npcBehaviors'

// ─── Farm System Registry ─────────────────────────────────────────────────────

interface FarmEntry {
  behavior: FarmPlotBehavior
  /** The GLB entity whose src gets swapped on growth. */
  visualEntity: any
}

const _farmEntries: FarmEntry[] = []
let _farmLastTickMs = 0

export function registerFarmPlot(behavior: FarmPlotBehavior, visualEntity: any): void {
  behavior.visualEntity = visualEntity
  _farmEntries.push({ behavior, visualEntity })
}

// ─── Movement System Registry ─────────────────────────────────────────────────

interface MovementEntry {
  entity:    any   // Entity
  behavior:  MovementBehavior
  /** Optional composite — movement pauses when its popup is open. */
  composite?: any
}

const _movingEntities: MovementEntry[] = []

export function registerMovingEntity(entity: any, behavior: MovementBehavior, composite?: any): void {
  _movingEntities.push({ entity, behavior, composite })
}

// ─── Enemy AI System Registry ─────────────────────────────────────────────────

interface EnemyEntry {
  entity:        any   // Entity
  entityId:      string
  health:        HealthBehavior
  ai:            EnemyAIBehavior
  /** Scale before death — restored on respawn. */
  originalScale: { x: number; y: number; z: number }
  /** Cached: was this entity dead last frame? Prevents redundant scale-zero ops. */
  wasDeadLastFrame: boolean
}

const _enemyEntities: EnemyEntry[] = []

export function registerEnemyEntity(
  entity: any,
  entityId: string,
  health: HealthBehavior,
  ai: EnemyAIBehavior,
  originalScale: { x: number; y: number; z: number }
): void {
  _enemyEntities.push({ entity, entityId, health, ai, originalScale, wasDeadLastFrame: false })
}

/** Returns all currently alive (non-dead) enemy entries. Used by gameMgr.playerAttack(). */
export function getLiveEnemies(): EnemyEntry[] {
  return _enemyEntities.filter(e => !e.health.dead)
}

// ─── Init (call once from GameManager) ────────────────────────────────────────

export function initWorldSystems(gameMgr: any): void {
  const popupMgr = gameMgr.popupMgr

  // ── Farm System (1s tick) ────────────────────────────────────────────────────
  engine.addSystem(() => {
    const now = Date.now()
    if (now - _farmLastTickMs < 1000) return
    _farmLastTickMs = now

    for (const entry of _farmEntries) {
      const changed = entry.behavior.tick(now)
      if (changed && entry.visualEntity !== null) {
        const glb = GltfContainer.getMutableOrNull(entry.visualEntity)
        if (glb) glb.src = entry.behavior.currentGlbSrc()
      }
    }
  })

  // ── NPC Movement System (every frame) ────────────────────────────────────────
  engine.addSystem((dt: number) => {
    for (const entry of _movingEntities) {
      const transform = Transform.getMutableOrNull(entry.entity)
      if (!transform) continue

      const moved = entry.behavior.update(
        transform.position,
        dt,
        popupMgr,
        entry.composite
      )

      // Y stays fixed — movement is horizontal only
      if (moved) transform.position.y = entry.behavior.spawnPos.y
    }
  })

  // ── Enemy AI System (every frame) ────────────────────────────────────────────
  engine.addSystem((dt: number) => {
    // Get player position once per frame
    const playerT = Transform.getOrNull(engine.PlayerEntity)
    const playerPos = playerT?.position ?? { x: 0, y: 0, z: 0 }

    for (const entry of _enemyEntities) {
      const t = Transform.getMutableOrNull(entry.entity)
      if (!t) continue

      // Handle respawn
      if (entry.health.dead) {
        if (!entry.wasDeadLastFrame) {
          // Just died this frame — scale to zero (hide entity)
          t.scale = Vector3.Zero()
          entry.wasDeadLastFrame = true
        }
        // Check for respawn
        if (
          entry.health.respawnMs > 0 &&
          entry.health.respawnAt > 0 &&
          Date.now() >= entry.health.respawnAt
        ) {
          entry.health.respawn()
          entry.wasDeadLastFrame = false
          t.scale    = Vector3.create(entry.originalScale.x, entry.originalScale.y, entry.originalScale.z)
          t.position = Vector3.create(entry.ai.spawnPos.x,   entry.ai.spawnPos.y,   entry.ai.spawnPos.z)
        }
        continue
      }

      entry.wasDeadLastFrame = false

      // Run AI update
      entry.ai.update(t.position, playerPos, entry.entityId, entry.health, gameMgr, dt)
    }
  })
}
