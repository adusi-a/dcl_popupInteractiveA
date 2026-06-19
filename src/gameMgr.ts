/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework popup system test
 *
 * Trinity pattern:
 *   GameManager → new PlayerManager(this)
 *               → new PlayerInventory()
 *               → new PopupManager()
 *               → setupInteractionUiSystem(popupMgr)
 *               → setupChests(this)
 *               → uiSetup(this)
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { setupChests } from './entities/chests'
import { uiSetup } from './uiMgr'

export class GameManager {

  playerMgr: PlayerManager
  playerInventory: PlayerInventory
  popupMgr: PopupManager

  constructor() {
    // Player data + position tracking
    this.playerMgr = new PlayerManager(this)

    // Client-side item store
    this.playerInventory = new PlayerInventory()

    // Popup state (float / loot window / choice)
    this.popupMgr = new PopupManager()

    // ECS system: X key closes popup + float expiry updates
    setupInteractionUiSystem(this.popupMgr)

    // Three chest entities — each triggers a different popup type
    setupChests(this)

    // React-ECS UI: debug HUD + popup overlays + inventory panel
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready')
    console.log('[GameManager] Spawn: 80,1,70  |  Chests at Z=100')
  }
}
