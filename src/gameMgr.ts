/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework popup + crafting test
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   Z~40  — Resource gathering area (Iron Ore, Coal, Wood, Stone nodes)
 *   Z~82  — Crafting stations (Smelter + Workbench)
 *   Z=100 — Original chest popup demos (float / loot window / choice)
 *   Z~147 — Trader station (buy Wheat Seeds / sell Wheat)
 *   Z~138-152 — Farm plots (four plots, 30s growth cycle)
 *
 * Item loop:
 *   Gather ore/coal/wood/stone -> Smelter (iron bar) -> Workbench (rope, sword, shield)
 *   Buy Wheat Seeds at Trader -> Plant at Farm Plot -> Harvest Wheat -> Sell at Trader
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { setupChests } from './entities/chests'
import { setupResourceNodes } from './entities/resourceNodes'
import { setupCraftingStations, setupTrader } from './entities/craftingStations'
import { setupFarmPlots } from './entities/farmPlots'
import { uiSetup } from './uiMgr'

export class GameManager {

  playerMgr: PlayerManager
  playerInventory: PlayerInventory
  popupMgr: PopupManager

  constructor() {
    this.playerMgr = new PlayerManager(this)
    this.playerInventory = new PlayerInventory()
    this.popupMgr = new PopupManager()

    // ECS system: X key closes popup + float expiry updates
    setupInteractionUiSystem(this.popupMgr)

    // World entities
    setupResourceNodes(this)      // Z~40: gatherable ore, coal, wood, stone
    setupCraftingStations(this)   // Z~82: Smelter + Workbench
    setupChests(this)             // Z=100: three popup demo chests
    setupTrader(this)             // Z~147: buy/sell station (TRADE popup)
    setupFarmPlots(this)          // Z~138-152: four farm plots (30s growth)

    // React-ECS UI
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready')
    console.log('[GameManager] Gather resources at Z~40, craft at Z~82, chest demos at Z=100')
    console.log('[GameManager] Trader at Z~147, Farm plots at Z~138-152')
  }
}
