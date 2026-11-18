/**
 * respawnSystem.ts — Standard "onRespawn" lifecycle hook for DN DCL framework modules
 *
 * FRAMEWORK DESIGN PATTERN
 * ─────────────────────────
 * Any module that has PERSISTENT STATE (force zones, damage flags, looping emotes,
 * active projectiles, immunity timers) should call registerRespawnCallback() once
 * at setup time, passing its cleanup function.
 *
 * On detected respawn, ALL registered callbacks fire in registration order.
 * Each module knows what to clean up for itself — no central "check every state"
 * loop is needed.
 *
 * WHY THIS PATTERN
 * ─────────────────
 * DCL's movePlayerTo() (the respawn mechanism) does NOT fire onTriggerExit for
 * active trigger zones.  This leaves per-frame force application, damage flags,
 * and looping emotes running at the new player position.  The symptoms are:
 *   • "ghost damage" — force zone still applying push every frame at respawn point
 *   • "ghost goblin" — homing projectile auto-relaunch keeps tracking after respawn
 *   • "stuck animation" — looping emote continues after death
 *
 * RESPAWN DETECTION
 * ─────────────────
 * Detected via Y position: a sudden upward jump of >5m in one frame = teleport to
 * spawn point.  This covers both manual respawn (movePlayerTo) and DCL's built-in
 * fall respawn.  False-positive risk (jump pad launching up fast): jump pads only
 * apply impulse — the Y change per frame stays <5m even at max velocity.  A
 * teleport moves >10m in one frame.
 *
 * IN A REAL GAME
 * ───────────────
 * This module stays lightweight.  Each gameplay module (HealthBehavior, DamageZone,
 * ForceZone, EmoteController, HomingProjectile) exports its own onRespawn hook and
 * registers it here.  The game-level respawn handler (FB8 DeathSequence or SW5
 * Checkpoint) calls fireRespawnCallbacks() explicitly for deterministic timing.
 *
 * USAGE
 * ──────
 *   import { registerRespawnCallback } from './respawnSystem'
 *
 *   // Inside your module setup:
 *   let playerInZone = false
 *   registerRespawnCallback(() => {
 *     if (playerInZone) {
 *       Physics.removeForceFromPlayer(zoneEntity)
 *       playerInZone = false
 *       console.log('[MyZone] Force cleared on respawn')
 *     }
 *   })
 */

import { engine, Transform } from '@dcl/sdk/ecs'

// ─── Registry ────────────────────────────────────────────────────────────────

type RespawnCallback = () => void
const _callbacks: RespawnCallback[] = []
let _systemRunning = false
let _lastY = -9999  // sentinel so first-frame delta is never treated as respawn

/**
 * Register a cleanup function that fires every time the player respawns.
 * Safe to call multiple times — each call adds one callback.
 * Automatically starts the respawn-detection system on first call.
 */
export function registerRespawnCallback(fn: RespawnCallback): void {
  _callbacks.push(fn)
  _ensureSystem()
}

/**
 * Fire all registered cleanup callbacks immediately.
 * Call this explicitly from a known respawn point (e.g. FB8 death sequence,
 * SW5 checkpoint) for deterministic timing alongside the auto-detect system.
 */
export function fireRespawnCallbacks(): void {
  for (const cb of _callbacks) {
    try { cb() } catch (e) { console.error('[Respawn] cleanup error:', e) }
  }
  console.log(`[Respawn] ${_callbacks.length} onRespawn callbacks fired`)
}

// ─── Auto-detection system ────────────────────────────────────────────────────

function _ensureSystem(): void {
  if (_systemRunning) return
  _systemRunning = true

  engine.addSystem((_dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return
    const dy = pT.position.y - _lastY
    // A sudden upward jump >5m in a single frame = teleport = respawn.
    // Jump-pad impulses never move >5m per frame at normal DCL physics speeds.
    if (_lastY !== -9999 && dy > 5) {
      console.log(`[Respawn] Detected (dy=${dy.toFixed(1)}m) — firing ${_callbacks.length} callbacks`)
      fireRespawnCallbacks()
    }
    _lastY = pT.position.y
  }, 100) // priority 100 — runs last, after all movement and damage systems
}
