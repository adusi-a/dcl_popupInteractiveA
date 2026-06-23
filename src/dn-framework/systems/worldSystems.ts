/**
 * @file worldSystems.ts
 * @module DN DCL Framework / systems
 * @version 0.0002
 * @status NEEDS_TEST
 *
 * World behavior ECS systems — registered ONCE via engine.addSystem().
 * Each system iterates a module-level registry of active behavior instances.
 *
 * SYSTEMS:
 *   FarmSystem              — ticks FarmPlotBehavior every ~1s; swaps GLBs on growth changes
 *   NPCMovementSystem       — moves entities with MovementBehavior every frame
 *   EnemyAISystem           — drives enemy state machine (idle/chase/attack), handles death/respawn
 *   DamageZone+ShieldSystem — ticks damage zones + recharges player shield (Sprint 5)
 *
 * USAGE:
 *   1. Call initWorldSystems(gameMgr) once in GameManager constructor.
 *   2. Register entities via registerFarmPlot(), registerMovingEntity(), registerEnemyEntity()
 *      (called automatically by AreaManager at load time).
 *   3. Register damage zones via registerDamageZone() (called by AreaManager for ZoneDef.damage).
 *
 * @changelog
 *   0.0001 - Initial. FarmSystem + NPCMovementSystem. Single-system DOP pattern.
 *   0.0002 - Sprint 5. Added DamageZone system + shield recharge system.
 */

import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
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

// ─── Damage Zone System Registry ──────────────────────────────────────────────

/**
 * Runtime state for a damage zone registered with the DamageZone system.
 * AreaManager gets back this object and sets isPlayerInside via trigger callbacks.
 */
export interface DamageZoneEntry {
  damagePerTick:  number
  tickIntervalMs: number
  label?:         string
  isPlayerInside: boolean
  lastTickMs:     number
}

const _damageZones: DamageZoneEntry[] = []

/**
 * Register a damage zone with the DamageZone system.
 * Returns the entry object — caller sets entry.isPlayerInside via onEnter/onExit callbacks.
 *
 * @param config  { damagePerTick, tickIntervalMs, label? }
 * @returns       Mutable DamageZoneEntry — set isPlayerInside from TriggerZone callbacks
 */
export function registerDamageZone(config: {
  damagePerTick:  number
  tickIntervalMs: number
  label?:         string
}): DamageZoneEntry {
  const entry: DamageZoneEntry = {
    damagePerTick:  config.damagePerTick,
    tickIntervalMs: config.tickIntervalMs,
    label:          config.label,
    isPlayerInside: false,
    lastTickMs:     0,
  }
  _damageZones.push(entry)
  return entry
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

  // ── Damage Zone Tick + Shield Recharge System (every frame) ──────────────────
  engine.addSystem((dt: number) => {
    const now = Date.now()

    // Damage zone ticks — deal periodic damage while player is inside a hazard zone
    for (const zone of _damageZones) {
      if (!zone.isPlayerInside) continue
      if (gameMgr.playerDead) continue
      if (now - zone.lastTickMs < zone.tickIntervalMs) continue
      zone.lastTickMs = now
      gameMgr.takeDamage(zone.damagePerTick)
      if (zone.label) {
        popupMgr.showFloat(zone.label, Color4.create(1, 0.35, 0.05, 1), 1200)
      }
    }

    // Shield recharge — starts after rechargeDelayMs of not taking damage
    const shield = gameMgr.playerShield
    if (
      shield && shield.max > 0 &&
      shield.current < shield.max &&
      !gameMgr.playerDead &&
      (now - shield.lastDamagedAt) > shield.rechargeDelayMs
    ) {
      shield.current = Math.min(shield.max, shield.current + shield.rechargeRatePerSec * dt)
    }
  })
}
