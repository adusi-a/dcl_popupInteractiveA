/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework interactive entity test
 *
 * All interactive entities now use InteractiveComposite + behavior system.
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   X~48-72, Z~68  — Gold coins (4×5g trail west from spawn)
 *   Z~40           — Resource nodes (ore/coal/wood/stone) — SimpleGiverBehavior
 *   X=25-32,Z~50-56 — Worm Field (soil patches) — SimpleGiverBehavior
 *   Z~82           — Smelter (RefinerBehavior) + Workbench (CrafterBehavior)
 *   Z=100          — Chest popup demos
 *   X=28,Z~120     — Fishmonger (SellerBehavior + BuyerBehavior)
 *   Z~147          — Trader (SellerBehavior + BuyerBehavior)
 *   Z~138-152      — Farm plots
 *   X=28,Z=145     — Fishing Mission Board (MissionGiverBehavior)
 *   X=28,Z=152     — Fishing Pond
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { QuestManager } from './dn-framework/quests/questState'
import { MarketManager, DEFAULT_MARKET } from './dn-framework/economy/marketManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { setupChests } from './entities/chests'
import { setupResourceNodes } from './entities/resourceNodes'
import { setupSmelter, setupWorkbench, setupTrader, setupFishingShop } from './entities/craftingStations'
import { setupFarmPlots } from './entities/farmPlots'
import { setupFishingPond } from './entities/fishingPond'
import { setupWormField } from './entities/wormField'
import { setupStarterGoldCoins } from './entities/goldCoin'
import { setupFishingMissionBoard } from './entities/fishingMissionBoard'
import { initFishingMechanic } from './fishing/fishingMechanic'
import { uiSetup } from './uiMgr'

export class GameManager {

  playerMgr:       PlayerManager
  playerInventory: PlayerInventory
  popupMgr:        PopupManager
  questMgr:        QuestManager
  market:          MarketManager

  constructor() {
    this.playerMgr       = new PlayerManager(this)
    this.playerInventory = new PlayerInventory()
    this.popupMgr        = new PopupManager()
    this.questMgr        = new QuestManager()
    this.market          = DEFAULT_MARKET

    setupInteractionUiSystem(this.popupMgr)
    initFishingMechanic(this.playerInventory, this.popupMgr, this.questMgr)

    setupStarterGoldCoins(this)
    setupResourceNodes(this)
    setupWormField(this)
    setupSmelter(this)
    setupWorkbench(this)
    setupChests(this)
    setupFishingShop(this)
    setupTrader(this)
    setupFarmPlots(this)
    setupFishingMissionBoard(this)
    setupFishingPond(this)

    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready — InteractiveComposite system active')
  }
}
