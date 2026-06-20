/**
 * fishingMechanic.ts — Fishing cast state machine for dcl_popupInteractiveA
 *
 * Module-level state (non-server MVP — runtime only).
 * Call initFishingMechanic() once in GameManager.
 * Call castLine() from fishing pond pointer event.
 *
 * Fish are stackable items (perch/bass/trout).
 * Gold is a currency (not inventory item) as of v0.0002.
 * Quest phase 1→2 fires when the player collects their first catch.
 */

import { engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { PlayerInventory } from '../dn-framework/player/playerInventory'
import { PopupManager, FishingCastLive } from '../dn-framework/ui/popupManager'
import { QuestManager } from '../dn-framework/quests/questState'
import { getPoleDef, getBaitDef, resolveCatch, CatchResult } from './fishingData'

let _inv:      PlayerInventory | null = null
let _popupMgr: PopupManager    | null = null
let _questMgr: QuestManager    | null = null
let _systemRegistered = false

type FishingPhase = 'idle' | 'casting'
let _phase:        FishingPhase    = 'idle'
let _poleId        = ''
let _castEndTime   = 0
let _activeCastLive: FishingCastLive | null = null

// ─── Init ──────────────────────────────────────────────────────────────────────

export function initFishingMechanic(
  inventory: PlayerInventory,
  popupMgr:  PopupManager,
  questMgr?: QuestManager
): void {
  _inv      = inventory
  _popupMgr = popupMgr
  _questMgr = questMgr ?? null
  _registerSystem()
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function isCasting(): boolean { return _phase === 'casting' }

export function castLine(poleId: string, baitId: string): boolean {
  if (!_inv || !_popupMgr) { console.error('[fishingMechanic] Not initialized'); return false }
  if (_phase === 'casting') return false

  const pole = getPoleDef(poleId)
  if (!pole) return false
  const bait = getBaitDef(baitId)
  if (!bait) return false

  if (!_inv.removeItem(baitId, 1)) {
    _popupMgr.showFloat('No bait left!', Color4.create(1, 0.4, 0.4, 1))
    return false
  }

  _phase       = 'casting'
  _poleId      = poleId
  _castEndTime = Date.now() + pole.castTimeSeconds * 1000

  const castLive: FishingCastLive = {
    poleLabel:      pole.displayName,
    baitLabel:      bait.displayName,
    castStartTime:  Date.now(),
    castDurationMs: pole.castTimeSeconds * 1000,
    phase:          'casting',
    onCollect:      () => {},
  }
  castLive.onCollect = () => _onCollect()
  _activeCastLive    = castLive

  _popupMgr.openFishingPopup(castLive)
  return true
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _registerSystem(): void {
  if (_systemRegistered) return
  _systemRegistered = true

  engine.addSystem((_dt: number) => {
    if (_phase !== 'casting' || !_activeCastLive) return
    if (Date.now() >= _castEndTime) {
      const result = resolveCatch(_poleId)
      _phase = 'idle'

      _activeCastLive.phase          = 'caught'
      _activeCastLive.catchLabel     = result.catchLabel
      _activeCastLive.catchGoldValue = result.sellPrice
      _activeCastLive.onCollect      = () => _doCollect(result)
    }
  })
}

function _onCollect(): void {
  // placeholder — replaced by _doCollect after catch resolves
}

function _doCollect(result: CatchResult): void {
  if (!_inv || !_popupMgr) return

  _inv.addItem(result.fishId, result.displayName, 1)

  _popupMgr.closeFishingPopup()
  _activeCastLive = null

  _popupMgr.showFloat(`Caught: ${result.catchLabel}`, Color4.create(0.5, 1, 0.5, 1), 2500)
  _popupMgr.showFloat(`Sell at Fishmonger for ~${result.sellPrice}g`, Color4.create(1, 0.85, 0.1, 1), 2500)

  // Quest: advance phase 1 → 2 on first catch
  if (_questMgr?.isActive('fishing_basic') && _questMgr.getPhase('fishing_basic') === 0) {
    _questMgr.advancePhase('fishing_basic')
    _popupMgr.showFloat('Quest update: Now sell the fish!', Color4.create(1, 0.85, 0.2, 1), 3500)
  }

  console.log(`[Fishing] Caught: ${result.catchLabel} (~${result.sellPrice}g)`)
}
