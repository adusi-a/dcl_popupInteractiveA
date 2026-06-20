/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework popup + crafting + fishing test
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   X~48-72, Z~68  — Gold coins (4×5g breadcrumb trail west from spawn)
 *   Z~40           — Resource gathering (Iron Ore, Coal, Wood, Stone)
 *   X=25-32,Z~50-56 — Worm Field soil patches (west side, near ore vein)
 *   Z~82           — Crafting stations (Smelter + Workbench)
 *   Z=100          — Chest popup demos (float / loot / choice)
 *   X=28,Z~120     — Fishmonger — buy rods/bait, sell fish (CraftingPopup)
 *   Z~147          — Trader — buy seeds / sell wheat (CraftingPopup)
 *   Z~138-152      — Farm plots × 4 (30s growth)
 *   X=28,Z=145     — Fishing Mission Board (NpcPopup / MissionGiverBehavior)
 *   X=28,Z=152     — Fishing Pond
 *
 * Item loops:
 *   Ore/Coal → Smelter → Iron Bar → Workbench → Rope/Sword/Shield
 *   Gold coins → Fishmonger → rod+bait → Pond → catch → Fishmonger sell
 *   Trader seeds → Farm Plot → Wheat → Trader sell
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { QuestManager } from './dn-framework/quests/questState'
import { MarketManager, DEFAULT_MARKET } from './dn-framework/economy/marketManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { setupChests } from './entities/chests'
import { setupResourceNodes } from './entities/resourceNodes'
import { setupCraftingStations, setupTrader, setupFishingShop } from './entities/craftingStations'
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

    // ECS system: X key closes popup + float expiry
    setupInteractionUiSystem(this.popupMgr)

    // Fishing mechanic (pass questMgr for phase advancement)
    initFishingMechanic(this.playerInventory, this.popupMgr, this.questMgr)

    // World entities
    setupStarterGoldCoins(this)        // X~48-72, Z~68: 4×5g coins west of spawn
    setupResourceNodes(this)           // Z~40: ore, coal, wood, stone
    setupWormField(this)               // X=25-32, Z=50-56: worms
    setupCraftingStations(this)        // Z~82: Smelter + Workbench
    setupChests(this)                  // Z=100: popup demos
    setupFishingShop(this)             // X=28, Z=120: Fishmonger (CraftingPopup)
    setupTrader(this)                  // Z~147: Trader (CraftingPopup)
    setupFarmPlots(this)               // Z~138-152: farm plots
    setupFishingMissionBoard(this)     // X=28, Z=145: mission board (NpcPopup)
    setupFishingPond(this)             // X=28, Z=152: pond

    // React-ECS UI
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready')
    console.log('[GameManager] Coins→west→ore/worms→crafting→chests→fishmonger→trader→farm→board→pond')
  }
}
