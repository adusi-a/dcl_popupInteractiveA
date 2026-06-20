/**
 * fishingMechanic.ts — Fishing cast state machine for dcl_popupInteractiveA
 *
 * Module-level state (non-server MVP — runtime only).
 * Call initFishingMechanic() once in GameManager.
 * Call castLine() from fishing pond pointer event.
 *
 * Gold is an inventory item in this scene (not currency).
 * Fish are stackable items — added as 'perch'/'bass'/'trout'.
 */

import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { PlayerInventory } from '../dn-framework/player/playerInventory'
import { PopupManager, FishingCastLive } from '../dn-framework/ui/popupManager'
import { getPoleDef, getBaitDef, resolveCatch, CatchResult } from './fishingData'

let _inv: PlayerInventory | null = null
let _popupMgr: PopupManager | null = null
let _systemRegistered = false

type FishingPhase = 'idle' | 'casting'
let _phase: FishingPhase = 'idle'
let _poleId = ''
let _castEndTime = 0
let _activeCastLive: FishingCastLive | null = null

// ─── Init ──────────────────────────────────────────────────────────────────────

export function initFishingMechanic(inventory: PlayerInventory, popupMgr: PopupManager): void {
  _inv = inventory
  _popupMgr = popupMgr
  _registerSystem()
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function isCasting(): boolean {
  return _phase === 'casting'
}

/**
 * Begin a cast. Called by fishing pond pointer event.
 * @returns true if cast started, false if already casting or missing gear.
 */
export function castLine(poleId: string, baitId: string): boolean {
  if (!_inv || !_popupMgr) { console.error('[fishingMechanic] Not initialized'); return false }
  if (_phase === 'casting') return false

  const pole = getPoleDef(poleId)
  if (!pole) return false
  const bait = getBaitDef(baitId)
  if (!bait) return false

  // Consume 1 bait
  if (!_inv.removeItem(baitId, 1)) {
    _popupMgr.showFloat('No bait left!', Color4.create(1, 0.4, 0.4, 1))
    return false
  }

  _phase = 'casting'
  _poleId = poleId
  _castEndTime = Date.now() + pole.castTimeSeconds * 1000

  const castLive: FishingCastLive = {
    poleLabel:     pole.displayName,
    baitLabel:     bait.displayName,
    castStartTime: Date.now(),
    castDurationMs: pole.castTimeSeconds * 1000,
    phase:         'casting',
    onCollect:     () => {},  // replaced below before popup opens
  }
  castLive.onCollect = () => _onCollect()
  _activeCastLive = castLive

  _popupMgr.openFishingPopup(castLive)
  return true
}

// ─── Private ───────────────────────────────────────────────────────────────────

function _registerSystem(): void {
  if (_systemRegistered) return
  _systemRegistered = true

  engine.addSystem((_dt: number) => {
    if (_phase !== 'casting' || !_activeCastLive) return
    if (Date.now() >= _castEndTime) {
      // Transition: casting → caught
      const result = resolveCatch(_poleId)
      _phase = 'idle'  // mechanic done; popup stays open for collect

      _activeCastLive.phase         = 'caught'
      _activeCastLive.catchLabel    = result.catchLabel
      _activeCastLive.catchGoldValue = result.sellPrice
      _activeCastLive.onCollect     = () => _doCollect(result)
    }
  })
}

function _onCollect(): void {
  // Placeholder — replaced by _doCollect after catch resolves
}

function _doCollect(result: CatchResult): void {
  if (!_inv || !_popupMgr) return

  // Add stackable fish to inventory
  _inv.addItem(result.fishId, result.displayName, 1)

  _popupMgr.closeFishingPopup()
  _activeCastLive = null

  _popupMgr.showFloat(`Caught: ${result.catchLabel}`, Color4.create(0.5, 1, 0.5, 1), 2500)
  _popupMgr.showFloat(`Sell at Fishmonger for ${result.sellPrice}g`, Color4.create(1, 0.85, 0.1, 1), 2500)

  console.log(`[Fishing] Caught: ${result.catchLabel} (sell: ${result.sellPrice}g)`)
}
