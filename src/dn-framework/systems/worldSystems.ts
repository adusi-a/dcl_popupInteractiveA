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
 *
 * USAGE:
 *   1. Call initWorldSystems(popupMgr) once in GameManager constructor.
 *   2. Register entities via registerFarmPlot() and registerMovingEntity()
 *      (called automatically by AreaManager at load time).
 *
 * @changelog
 *   0.0001 - Initial. FarmSystem + NPCMovementSystem. Single-system DOP pattern
 *            (no per-entity engine.addSystem calls — the correct SDK7 approach).
 */

import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { FarmPlotBehavior, MovementBehavior } from '../npcs/npcBehaviors'

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

// ─── Init (call once from GameManager) ────────────────────────────────────────

export function initWorldSystems(popupMgr: any): void {

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
}
