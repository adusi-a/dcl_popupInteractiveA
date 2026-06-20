/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework popup + crafting test
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   X~48-72, Z~68 — Gold coins (4×5g breadcrumb trail west from spawn)
 *   Z~40           — Resource gathering area (Iron Ore, Coal, Wood, Stone nodes)
 *   X=25-32,Z~50-56 — Worm Field soil patches (west side, near ore vein)
 *   Z~82           — Crafting stations (Smelter + Workbench)
 *   Z=100          — Original chest popup demos (float / loot window / choice)
 *   X=28,Z~120     — Fishmonger (buy rods/bait, sell fish) — west side
 *   Z~147          — Trader station (buy Wheat Seeds / sell Wheat)
 *   Z~138-152      — Farm plots (four plots, 30s growth cycle)
 *   X=28,Z=152     — Fishing Pond (8×8m, west side)
 *
 * Item loops:
 *   Gather ore/coal/wood/stone → Smelter (iron bar) → Workbench (rope, sword, shield)
 *   Buy Wheat Seeds at Trader → Plant at Farm Plot → Harvest Wheat → Sell at Trader
 *   Collect gold coins → Dig Worms (free) → Buy rod at Fishmonger → Fish at Pond → Sell fish
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { QuestManager } from './dn-framework/quests/questState'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { setupChests } from './entities/chests'
import { setupResourceNodes } from './entities/resourceNodes'
import { setupCraftingStations, setupTrader, setupFishingShop } from './entities/craftingStations'
import { setupFarmPlots } from './entities/farmPlots'
import { setupFishingPond } from './entities/fishingPond'
import { setupWormField } from './entities/wormField'
import { setupStarterGoldCoins } from './entities/goldCoin'
import { initFishingMechanic } from './fishing/fishingMechanic'
import { uiSetup } from './uiMgr'

export class GameManager {

  playerMgr: PlayerManager
  playerInventory: PlayerInventory
  popupMgr: PopupManager
  questMgr: QuestManager

  constructor() {
    this.playerMgr       = new PlayerManager(this)
    this.playerInventory = new PlayerInventory()
    this.popupMgr        = new PopupManager()
    this.questMgr        = new QuestManager()

    // ECS system: X key closes popup + float expiry updates
    setupInteractionUiSystem(this.popupMgr)

    // Fishing mechanic system (must init before pond entity)
    initFishingMechanic(this.playerInventory, this.popupMgr)

    // World entities
    setupStarterGoldCoins(this)    // X~48-72, Z~68: 4×5g coins along the west path
    setupResourceNodes(this)       // Z~40: gatherable ore, coal, wood, stone
    setupWormField(this)           // X=25-32, Z=50-56: soil patches → worms (west)
    setupCraftingStations(this)    // Z~82: Smelter + Workbench
    setupChests(this)              // Z=100: three popup demo chests
    setupFishingShop(this)         // X=28, Z=120: Fishmonger (rods/bait/sell fish)
    setupTrader(this)              // Z~147: buy/sell station (TRADE popup)
    setupFarmPlots(this)           // Z~138-152: four farm plots (30s growth)
    setupFishingPond(this)         // X=28, Z=152: fishing pond

    // React-ECS UI
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready')
    console.log('[GameManager] Gold coins west of spawn → Ore/Worm Field Z~40-56 → Crafting Z~82')
    console.log('[GameManager] Fishmonger X=28 Z=120, Trader Z~147, Farm Z~138-152, Pond X=28 Z=152')
  }
}
