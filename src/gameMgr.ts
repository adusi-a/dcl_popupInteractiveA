/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework interactive entity + data-driven area test
 *
 * MANAGER STACK:
 *   DataManager     — global registries (items, recipes, presets), save/load
 *   AreaManager     — data-driven entity creation + tracking from AreaDefinition
 *   PlayerManager   — player identity, position, checkpoint
 *   PlayerInventory — items, currency, stats
 *   PopupManager    — popup state machine
 *   QuestManager    — quest state
 *   MarketManager   — currency rates (static for now)
 *
 * TRANSITION NOTE:
 *   AreaManager handles: gold coins, resource nodes, worm field, smelter,
 *   workbench, fishmonger, trader. These setup functions are now BYPASSED.
 *
 *   Legacy setup functions still run for: farm plots, fishing mechanic,
 *   fishing mission board, fishing pond, chests — until their behavior
 *   classes (FarmPlotBehavior, FishingSpotBehavior, LootBehavior) are ready.
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   X~48-72, Z~68  — Gold coins (4×5g) — AreaManager
 *   Z~40-52        — Resource nodes (ore/coal/wood/stone) — AreaManager
 *   X=25-32,Z~50-56 — Worm Field patches — AreaManager
 *   Z~82           — Smelter + Workbench — AreaManager
 *   Z=100          — Chests A/B/C — legacy
 *   X=28,Z~120     — Fishmonger — AreaManager
 *   Z~147          — Trader — AreaManager
 *   Z~138-152      — Farm plots — legacy
 *   X=28,Z=145     — Fishing Mission Board — legacy
 *   X=28,Z=152     — Fishing Pond — legacy
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { QuestManager } from './dn-framework/quests/questState'
import { MarketManager, DEFAULT_MARKET } from './dn-framework/economy/marketManager'
import { DataManager } from './dn-framework/data/dataManager'
import { AreaManager } from './dn-framework/data/areaManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'

// Global data registries
import { WORKBENCH_RECIPES } from './data/recipeData'
import { AREA_POPUP_TEST } from './data/areas/area_popupTest'

// Legacy setup functions (entities not yet in AreaManager)
import { setupChests } from './entities/chests'
import { setupFarmPlots } from './entities/farmPlots'
import { setupFishingPond } from './entities/fishingPond'
import { setupFishingMissionBoard } from './entities/fishingMissionBoard'
import { initFishingMechanic } from './fishing/fishingMechanic'

import { uiSetup } from './uiMgr'

export class GameManager {

  // ── Manager stack ──────────────────────────────────────────────────────────
  dataMgr:         DataManager
  areaMgr:         AreaManager
  playerMgr:       PlayerManager
  playerInventory: PlayerInventory
  popupMgr:        PopupManager
  questMgr:        QuestManager
  market:          MarketManager

  // ── Story entity refs (set by AreaManager via storyRole) ──────────────────
  fishmonger?: any   // InteractiveComposite for the fishmonger (storyRole: 'fishmonger')

  constructor() {

    // ── Data layer — register global content ─────────────────────────────────
    this.dataMgr = new DataManager()
    this.dataMgr.registerRecipes(WORKBENCH_RECIPES)
    // Drop presets and shop presets: inline in area def for now (dataMethod: 'inline')
    // Register presets here when data grows and sharing is needed.

    // ── Core managers ─────────────────────────────────────────────────────────
    this.playerMgr       = new PlayerManager(this)
    this.playerInventory = new PlayerInventory()
    this.popupMgr        = new PopupManager()
    this.questMgr        = new QuestManager()
    this.market          = DEFAULT_MARKET

    // ── Systems ───────────────────────────────────────────────────────────────
    setupInteractionUiSystem(this.popupMgr)
    initFishingMechanic(this.playerInventory, this.popupMgr, this.questMgr)

    // ── Area load — data-driven entity creation ────────────────────────────────
    this.areaMgr = new AreaManager(this, this.dataMgr)
    this.areaMgr.loadArea(AREA_POPUP_TEST)

    // ── Legacy setup (not yet in AreaManager) ─────────────────────────────────
    setupChests(this)
    setupFarmPlots(this)
    setupFishingMissionBoard(this)
    setupFishingPond(this)

    // ── UI ────────────────────────────────────────────────────────────────────
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready — DataManager + AreaManager active')
  }
}
