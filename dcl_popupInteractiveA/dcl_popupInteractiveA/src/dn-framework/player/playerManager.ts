/**
 * @file playerManager.ts
 * @module DN DCL Framework / player
 * @version 0.0001
 * @status PARTIALLY_CONFIRMED
 *
 * Base PlayerManager for Decentraland SDK7 scenes.
 *
 * CONFIRMED (from fragments, works in production):
 *   - Position + rotation tracking via engine.addSystem
 *   - playerInfoRec ready flag
 *   - GameManager constructor injection pattern
 *
 * NEEDS_TEST:
 *   - getPlayer() + onEnterScene() replacing old getUserData() from ~system/UserIdentity
 *   - getUserData() is SDK6-era; getPlayer() is SDK7 modern (synchronous, no executeTask wrapper)
 *   - Test: does onEnterScene fire reliably on first join in a DCL World?
 *   - Test: does getPlayer() return null briefly on load or instantly?
 *   - Fallback: if getPlayer() returns null, old executeTask(getUserData) is the safe fallback
 *
 * CONFIRMED SAFE FALLBACK (all fragments use this — keep until getPlayer tested):
 *   import { executeTask } from '@dcl/sdk/ecs'
 *   import { getUserData } from '~system/UserIdentity'
 *   executeTask(async () => { this.playerUserData = await getUserData({}) ... })
 *
 * @changelog
 *   0.0001 - Initial extraction from ghosttown + portparadox + dcl_interactAndCollectTestA fragments.
 *            Added getPlayer/onEnterScene path (NEEDS_TEST), fallback preserved.
 */

import { engine, Transform, executeTask } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

// SDK7 modern player API — NEEDS_TEST
// import { getPlayer, onEnterScene } from '@dcl/sdk/src/players'

// SDK6-era fallback — CONFIRMED working in all fragments
import { getUserData } from '~system/UserIdentity'
import { movePlayerTo, triggerEmote } from '~system/RestrictedActions'

/**
 * Base PlayerManager.
 * Handles async player data init, position/rotation tracking, and optional GameManager ref.
 *
 * Usage:
 *   const playerMgr = new PlayerManager(gameMgr) // with GameManager ref
 *   const playerMgr = new PlayerManager()         // standalone (no GameManager)
 *
 * Subclass for project-specific extensions:
 *   class MyPlayerManager extends PlayerManager { ... }
 */
export class PlayerManager {

  // Optional ref to GameManager — set via constructor if needed
  gameMgr: any | null

  // Player data (populated async after init)
  playerInfoRec: boolean = false
  playerUserData: any = null
  displayName: string = ''

  // Position + rotation (updated every frame)
  pos: Vector3
  rot: Quaternion

  constructor(_gameMgr?: any) {
    this.gameMgr = _gameMgr || null
    this.pos = Vector3.create(0, 0, 0)
    this.rot = Quaternion.fromEulerDegrees(0, 0, 0)

    this._initPlayerData()
  }

  /** @private Fetch player data and start tracking */
  private _initPlayerData(): void {

    // ----- NEEDS_TEST: SDK7 modern path -----
    // Uncomment and test this when ready. If getPlayer() is null on load,
    // onEnterScene will fire when the player actually enters.
    //
    // import { getPlayer, onEnterScene } from '@dcl/sdk/src/players'
    //
    // const existing = getPlayer()
    // if (existing) {
    //   this.displayName = existing.displayName || ''
    //   this.playerUserData = existing
    //   this._startTracking()
    // }
    // onEnterScene((player) => {
    //   this.displayName = player.displayName || ''
    //   this.playerUserData = player
    //   if (!this.playerInfoRec) this._startTracking()
    // })

    // ----- CONFIRMED FALLBACK: SDK6-era getUserData -----
    executeTask(async () => {
      this.playerUserData = await getUserData({})
      this.displayName = this.playerUserData?.data?.displayName || ''
      this._startTracking()
    })
  }

  /** @private Start per-frame position/rotation tracking */
  private _startTracking(): void {
    // Grab current position as initial value
    const t = Transform.getOrNull(engine.PlayerEntity)
    if (t) {
      this.pos = t.position
      this.rot = t.rotation
    }

    // Per-frame tracking system
    engine.addSystem(() => {
      const transform = Transform.getOrNull(engine.PlayerEntity)
      if (transform) {
        this.pos = transform.position
        this.rot = transform.rotation
      }
    })

    this.playerInfoRec = true
  }

  /**
   * Teleport the player to a position.
   * @param pos Target position
   * @param lookAt Optional look-at target
   */
  teleportTo(pos: Vector3, lookAt?: Vector3): void {
    movePlayerTo({
      newRelativePosition: pos,
      cameraTarget: lookAt || Vector3.add(pos, Vector3.create(0, 0, 1))
    })
  }

  /**
   * Trigger an emote on the local player.
   * @param emoteId Emote identifier string (e.g. 'wave', 'dance')
   */
  playEmote(emoteId: string): void {
    triggerEmote({ predefinedEmote: emoteId })
  }
}
