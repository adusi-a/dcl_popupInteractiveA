/**
 * @file npcBehaviors.ts
 * @module DN DCL Framework / npcs
 * @version 0.0004
 * @status NEEDS_TEST
 *
 * Modular behavior classes for InteractiveComposite entities.
 * Behaviors = ALL entity logic. Two categories:
 *   INTERACTION BEHAVIORS: player-triggered, open a popup tab.
 *   WORLD BEHAVIORS: autonomous/per-frame, no popup (movement, health, trigger — future sprints).
 *
 * INTERACTION BEHAVIORS (drive tabs in InteractivePopupModule):
 *   MissionGiverBehavior  — quests to give, accept, turn in
 *   SellerBehavior        — sells items/services to player
 *   BuyerBehavior         — buys items from player
 *   CrafterBehavior       — recipe-based crafting (workbench, crafting table)
 *   RefinerBehavior       — A + fuel C → B conversion (smelter, furnace)
 *   MessengerBehavior     — static text/dialogue display
 *   DialogueBehavior      — branching NPC conversation tree (NEW)
 *
 * ACTION BEHAVIORS (execute immediately, no popup):
 *   SimpleGiverBehavior   — click → receive items/currency, optional cooldown
 *                           (resource nodes, worm field, any item pickup)
 *
 * @changelog
 *   0.0001 - Initial. MissionGiverBehavior, SellerBehavior, BuyerBehavior, MessengerBehavior.
 *   0.0002 - Added CrafterBehavior (recipe-based), RefinerBehavior (A+fuel→B),
 *            SimpleGiverBehavior (action, no popup). SaleItem gets optional quantity.
 *            BuyerBehavior gets optional onSell callback.
 *   0.0003 - Added DialogueBehaviorDef types + DialogueBehavior class.
 *            Branching NPC conversations with flag/quest/item conditions and side effects.
 *            Used by InteractiveBehaviorSet.dialogue and rendered in Talk tab.
 *   0.0004 - Added LootBehavior, FarmPlotBehavior, MovementBehavior.
 *   0.0005 - Added HealthBehavior (HP, faction, tags, death/respawn, loot drops).
 *            Added EnemyAIBehavior (idle/chase/attack state machine, aggroRadius).
 *            Added 'equipItem' side effect to DialogueSideEffectDef + DialogueBehavior.
 *            Imported Color4 for damage floats.
 */

import { QuestDefinition, QuestManager, QuestReward } from '../quests/questState'
import { PlayerInventory } from '../player/playerInventory'
import { MarketManager } from '../economy/marketManager'
import { Recipe, PopupManager } from '../ui/popupManager'
import { Color4 } from '@dcl/sdk/math'

// ─── MissionGiverBehavior ─────────────────────────────────────────────────────

export class MissionGiverBehavior {

  questDefinitions: QuestDefinition[]

  constructor(quests: QuestDefinition[]) {
    this.questDefinitions = quests
  }

  getAvailableQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => {
      const s = questMgr.getStatus(def.id)
      return s === 'available' || s === 'locked'
    })
  }

  getActiveQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => questMgr.isActive(def.id))
  }

  getCompletableQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => questMgr.getStatus(def.id) === 'complete')
  }

  acceptQuest(questId: string, questMgr: QuestManager): void {
    if (!this.questDefinitions.find(d => d.id === questId)) return
    if (questMgr.getStatus(questId) === 'turned_in') return
    questMgr.setStatus(questId, 'active')
  }

  turnInQuest(
    questId: string,
    questMgr: QuestManager,
    inventory: PlayerInventory,
    market: MarketManager
  ): QuestReward | null {
    const q = questMgr.getQuest(questId)
    if (!q) return null

    const isLastPhase = q.currentPhase >= q.definition.phases.length - 1
    const canTurnIn   = q.status === 'complete' || (q.status === 'active' && isLastPhase)
    if (!canTurnIn) return null

    const def = this.questDefinitions.find(d => d.id === questId)
    if (!def?.reward) { questMgr.setStatus(questId, 'turned_in'); return {} }

    const reward = def.reward
    if (reward.gold)  inventory.addCurrency(reward.gold, 'gold')
    if (reward.stats) { for (const [k, v] of Object.entries(reward.stats)) inventory.addStat(k, v) }
    if (reward.items) { for (const i of reward.items) inventory.addItem(i.itemId, i.name, i.quantity) }

    questMgr.setStatus(questId, 'turned_in')
    return reward
  }
}

// ─── SellerBehavior ───────────────────────────────────────────────────────────

export interface SaleItem {
  id: string
  name: string
  cost: number
  /** How many units the player receives per purchase. Default 1. */
  quantity?: number
  currencyKey?: string
  description?: string
  category?: string
}

export class SellerBehavior {

  items: SaleItem[]

  constructor(items: SaleItem[]) {
    this.items = items
  }

  /** @returns true if purchase succeeded */
  buy(itemId: string, inventory: PlayerInventory): boolean {
    const item = this.items.find(i => i.id === itemId)
    if (!item) return false
    const key = item.currencyKey ?? 'gold'
    if (!inventory.spendCurrency(item.cost, key)) return false
    inventory.addItem(item.id, item.name, item.quantity ?? 1)
    return true
  }
}

// ─── BuyerBehavior ────────────────────────────────────────────────────────────

export type PriceCalculator = (itemId: string, inventory: PlayerInventory) => number

export class BuyerBehavior {

  acceptedItemTypes: string[]
  getPriceFor: PriceCalculator
  currencyKey: string
  /** Optional callback fired after a successful sell. Use for quest advancement etc. */
  onSell?: (itemId: string, price: number) => void

  constructor(
    acceptedItemTypes: string[],
    priceCalc: PriceCalculator,
    currencyKey: string = 'gold',
    onSell?: (itemId: string, price: number) => void
  ) {
    this.acceptedItemTypes = acceptedItemTypes
    this.getPriceFor       = priceCalc
    this.currencyKey       = currencyKey
    this.onSell            = onSell
  }

  getBuyableItems(inventory: PlayerInventory): Array<{ item: import('../player/playerInventory').InventoryItem; price: number }> {
    return inventory.getAllItems()
      .filter(item => this.acceptedItemTypes.includes(item.itemId))
      .map(item  => ({ item, price: this.getPriceFor(item.itemId, inventory) }))
      .filter(e  => e.price > 0)
  }

  sell(itemId: string, inventory: PlayerInventory): boolean {
    const price = this.getPriceFor(itemId, inventory)
    if (price <= 0) return false
    if (!inventory.removeItem(itemId, 1)) return false
    inventory.addCurrency(price, this.currencyKey)
    if (this.onSell) this.onSell(itemId, price)
    return true
  }
}

// ─── CrafterBehavior ──────────────────────────────────────────────────────────
// Recipe-based crafting: player picks a recipe, verifies ingredients, gets output.
// Examples: Workbench, crafting table, forge (recipe list approach).

export class CrafterBehavior {

  stationName: string
  recipes: Recipe[]

  /** Currently selected recipe ID — mutated by Craft tab UI each frame. */
  selectedRecipeId: string = ''
  /** Currently active category tab. */
  activeCategory: string = ''

  constructor(stationName: string, recipes: Recipe[]) {
    this.stationName = stationName
    this.recipes     = recipes
    // Auto-init selection
    if (recipes.length > 0) {
      this.selectedRecipeId = recipes[0].id
      this.activeCategory   = recipes[0].category ?? ''
    }
  }

  getCategories(): string[] {
    const cats: string[] = []
    for (const r of this.recipes) {
      if (r.category && !cats.includes(r.category)) cats.push(r.category)
    }
    return cats
  }

  getRecipesForCategory(category: string): Recipe[] {
    return this.recipes.filter(r => (r.category ?? '') === category)
  }

  getSelectedRecipe(): Recipe | undefined {
    return this.recipes.find(r => r.id === this.selectedRecipeId)
  }

  canCraft(recipe: Recipe, inventory: PlayerInventory): boolean {
    return recipe.ingredients.every(ing => inventory.hasEnough(ing.itemId, ing.quantity))
  }

  craft(recipeId: string, inventory: PlayerInventory): boolean {
    const recipe = this.recipes.find(r => r.id === recipeId)
    if (!recipe) return false
    if (!this.canCraft(recipe, inventory)) return false
    recipe.ingredients.forEach(ing => inventory.removeItem(ing.itemId, ing.quantity))
    inventory.addItem(recipe.output.itemId, recipe.output.name, recipe.output.quantity)
    return true
  }
}

// ─── RefinerBehavior ──────────────────────────────────────────────────────────
// Conversion-based: A + fuel C → B. Player picks a formula (Option B).
// Examples: Smelter (ore + coal → bar), kiln, distillery.
// Differs from Crafter: semantically a machine with a conversion list,
// not a recipe workbench. UI shows input/fuel/output explicitly.

export interface RefinementFormula {
  id: string
  /** Display name shown in the formula list. */
  name: string
  inputItemId: string
  inputName: string
  inputQuantity: number
  fuelItemId: string
  fuelName: string
  fuelQuantity: number
  outputItemId: string
  outputName: string
  outputQuantity: number
}

export class RefinerBehavior {

  stationName: string
  formulas: RefinementFormula[]

  /** Currently selected formula ID — mutated by Refine tab UI each frame. */
  selectedFormulaId: string = ''

  constructor(stationName: string, formulas: RefinementFormula[]) {
    this.stationName        = stationName
    this.formulas           = formulas
    if (formulas.length > 0) this.selectedFormulaId = formulas[0].id
  }

  getSelectedFormula(): RefinementFormula | undefined {
    return this.formulas.find(f => f.id === this.selectedFormulaId)
  }

  canRefine(formula: RefinementFormula, inventory: PlayerInventory): boolean {
    return (
      inventory.hasEnough(formula.inputItemId, formula.inputQuantity) &&
      inventory.hasEnough(formula.fuelItemId,  formula.fuelQuantity)
    )
  }

  refine(formulaId: string, inventory: PlayerInventory): boolean {
    const formula = this.formulas.find(f => f.id === formulaId)
    if (!formula) return false
    if (!this.canRefine(formula, inventory)) return false
    inventory.removeItem(formula.inputItemId, formula.inputQuantity)
    inventory.removeItem(formula.fuelItemId,  formula.fuelQuantity)
    inventory.addItem(formula.outputItemId, formula.outputName, formula.outputQuantity)
    return true
  }
}

// ─── MessengerBehavior ────────────────────────────────────────────────────────

export class MessengerBehavior {
  title: string
  message: string
  closeLabel?: string
  constructor(title: string, message: string, closeLabel?: string) {
    this.title      = title
    this.message    = message
    this.closeLabel = closeLabel
  }
}

// ─── SimpleGiverBehavior ──────────────────────────────────────────────────────
// ACTION BEHAVIOR — no popup. Click/interact → receive item(s) or currency.
// Optional per-instance cooldown (worm field, timed respawn nodes).
// Used by resource nodes, worm field, any click-to-get entity.

export interface GiverDrop {
  itemId: string
  name: string
  quantity: number
  /** If true, adds to currency instead of item map (for gold pickups etc). */
  isCurrency?: boolean
}

export class SimpleGiverBehavior {

  drops: GiverDrop[]
  /** Cooldown between successive gives (ms). 0 = no cooldown. */
  cooldownMs: number
  /** Label shown while on cooldown. Defaults to "Resting..." */
  cooldownLabel?: string

  private _lastGivenMs: number = 0

  constructor(drops: GiverDrop[], cooldownMs: number = 0, cooldownLabel?: string) {
    this.drops        = drops
    this.cooldownMs   = cooldownMs
    this.cooldownLabel = cooldownLabel
  }

  /** Milliseconds until this node can give again. 0 = ready now. */
  cooldownRemaining(): number {
    if (this.cooldownMs === 0) return 0
    return Math.max(0, this.cooldownMs - (Date.now() - this._lastGivenMs))
  }

  isReady(): boolean {
    return this.cooldownRemaining() === 0
  }

  /**
   * Attempt to give drops to the player.
   * @returns true if gave successfully, false if on cooldown
   */
  give(inventory: PlayerInventory, popupMgr: PopupManager): boolean {
    const remaining = this.cooldownRemaining()
    if (remaining > 0) {
      const secsLeft = Math.ceil(remaining / 1000)
      const label    = this.cooldownLabel ?? 'Resting...'
      popupMgr.showFloat(`${label} (${secsLeft}s)`, undefined, 1200)
      return false
    }

    this._lastGivenMs = Date.now()

    for (const drop of this.drops) {
      if (drop.isCurrency) {
        inventory.addCurrency(drop.quantity, drop.itemId)
      } else {
        inventory.addItem(drop.itemId, drop.name, drop.quantity)
      }
      popupMgr.showFloat(`+${drop.quantity} ${drop.name}`)
    }

    return true
  }
}

// ─── Dialogue types ───────────────────────────────────────────────────────────
// Exported here (not in areaTypes.ts) to avoid circular imports.
// areaTypes.ts imports DialogueBehaviorDef from this file.

/** Condition that gates a dialogue choice — evaluated against live game state. */
export interface DialogueConditionDef {
  type: 'hasFlag' | 'questStatus' | 'hasItem'
  /** flagKey, questId, or itemId depending on type. */
  key: string
  /** flagValue, questStatus string, or item count (number). */
  value?: string | number | boolean
}

/** Side effect executed when the player selects a choice. */
export interface DialogueSideEffectDef {
  type: 'setFlag' | 'startQuest' | 'turnInQuest' | 'openBuy' | 'equipItem'
  /** flagKey, questId, or itemId depending on type. */
  key?: string
  /** Value: flagValue (boolean/string), or equipment stats Record<string,number> for equipItem. */
  value?: string | number | boolean | Record<string, number>
  /** For equipItem: equipment slot ('weapon'|'offhand'|'accessory'). */
  slot?: string
  /** For equipItem: display name of the item. */
  name?: string
}

/** A single player-selectable response. */
export interface DialogueChoiceDef {
  text: string
  /** Node to navigate to. Undefined = terminal (closes popup after side effect). */
  nextNodeId?: string
  /** If present, this choice is hidden unless the condition passes. */
  condition?: DialogueConditionDef
  /** Optional side effect fired before advancing to nextNodeId. */
  sideEffect?: DialogueSideEffectDef
}

/** A single dialogue node (one NPC speech + array of player responses). */
export interface DialogueNodeDef {
  id: string
  /** Speaker name shown above the text. Defaults to entity displayName if omitted. */
  speaker?: string
  text: string
  choices: DialogueChoiceDef[]
}

/** Full dialogue tree definition — passed via InteractiveBehaviorSet.dialogue. */
export interface DialogueBehaviorDef {
  nodes: DialogueNodeDef[]
  startNodeId: string
}

// ─── DialogueBehavior ─────────────────────────────────────────────────────────
// INTERACTION BEHAVIOR — renders in the Talk tab of InteractivePopupModule.
// Supports branching conversations with conditional choices and side effects.

export class DialogueBehavior {

  private _nodes:       Map<string, DialogueNodeDef>
  private _startNodeId: string
  currentNodeId:        string
  /**
   * Set by the openBuy side effect. Consumed by DialogueTab after selectChoice()
   * to switch the popup to the Buy tab without a circular import.
   */
  pendingTabSwitch?: string

  constructor(def: DialogueBehaviorDef) {
    this._nodes       = new Map(def.nodes.map(n => [n.id, n]))
    this._startNodeId = def.startNodeId
    this.currentNodeId = def.startNodeId
  }

  getCurrentNode(): DialogueNodeDef | undefined {
    return this._nodes.get(this.currentNodeId)
  }

  /** Returns choices whose conditions pass (or have no condition). */
  getVisibleChoices(gameMgr: any): DialogueChoiceDef[] {
    const node = this.getCurrentNode()
    if (!node) return []
    return node.choices.filter(c => !c.condition || this._evalCondition(c.condition, gameMgr))
  }

  /**
   * Player selects a visible choice by index.
   * Executes side effect, advances to nextNodeId, or closes popup on terminal choice.
   */
  selectChoice(visibleIndex: number, gameMgr: any): void {
    const choices = this.getVisibleChoices(gameMgr)
    const choice  = choices[visibleIndex]
    if (!choice) return

    this.pendingTabSwitch = undefined
    if (choice.sideEffect) this._execSideEffect(choice.sideEffect, gameMgr)

    if (choice.nextNodeId) {
      this.currentNodeId = choice.nextNodeId
    } else {
      // Terminal choice — reset tree and close popup
      this.resetToStart()
      gameMgr.popupMgr.closeInteractivePopup()
    }
  }

  /** Reset tree to root (call when popup is closed by the X button). */
  resetToStart(): void {
    this.currentNodeId = this._startNodeId
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _evalCondition(cond: DialogueConditionDef, gameMgr: any): boolean {
    if (cond.type === 'hasFlag') {
      const val = gameMgr.flags.get(cond.key)
      if (cond.value !== undefined) return val === cond.value
      return val !== undefined && val !== false
    }
    if (cond.type === 'questStatus') {
      return gameMgr.questMgr.getStatus(cond.key) === cond.value
    }
    if (cond.type === 'hasItem') {
      const count = typeof cond.value === 'number' ? cond.value : 1
      return gameMgr.playerInventory.getCount(cond.key) >= count
    }
    return false
  }

  private _execSideEffect(effect: DialogueSideEffectDef, gameMgr: any): void {
    if (effect.type === 'setFlag' && effect.key !== undefined) {
      gameMgr.flags.set(effect.key, effect.value ?? true)
    }
    if (effect.type === 'startQuest' && effect.key) {
      gameMgr.questMgr.setStatus(effect.key, 'active')
    }
    if (effect.type === 'turnInQuest' && effect.key) {
      const quest = gameMgr.questMgr.getQuest(effect.key)
      if (quest && (quest.status === 'complete' || quest.status === 'active')) {
        const reward = quest.definition.reward
        if (reward?.gold)  gameMgr.playerInventory.addCurrency(reward.gold, 'gold')
        if (reward?.stats) {
          for (const [k, v] of Object.entries(reward.stats as Record<string, number>)) {
            gameMgr.playerInventory.addStat(k, v)
          }
        }
        if (reward?.items) {
          for (const item of reward.items as Array<{ itemId: string; name: string; quantity: number }>) {
            gameMgr.playerInventory.addItem(item.itemId, item.name, item.quantity)
          }
        }
        gameMgr.questMgr.setStatus(effect.key, 'turned_in')
        if (reward?.gold) {
          gameMgr.popupMgr.showFloat(`Quest complete! +${reward.gold}g`, undefined, 3000)
        }
      }
    }
    if (effect.type === 'openBuy') {
      this.pendingTabSwitch = 'Buy'
    }
    if (effect.type === 'equipItem' && effect.key && effect.slot) {
      const stats = (typeof effect.value === 'object' && effect.value !== null)
        ? effect.value as Record<string, number>
        : {}
      gameMgr.equipItem(effect.slot, effect.key, effect.name ?? effect.key, stats)
    }
  }
}

// ─── LootBehavior ─────────────────────────────────────────────────────────────
// INTERACTION BEHAVIOR — click once to receive chest contents.
// Three subtypes:
//   'auto'        — immediate float + item grant, no popup
//   'loot_window' — opens the loot window popup (Take All button)
//   'choice'      — opens choice popup (drops[0] OR drops[1])
// oneTime: if true (default), chest becomes non-interactive after being looted.

export interface LootBehaviorDef {
  chestType?: 'auto' | 'loot_window' | 'choice'  // default: 'loot_window'
  lootTitle?: string
  oneTime?: boolean                               // default: true
}

export class LootBehavior {

  chestType: 'auto' | 'loot_window' | 'choice'
  lootTitle: string
  oneTime: boolean
  taken: boolean = false

  /** Pre-resolved drops (set by AreaManager at spawn time). */
  drops: GiverDrop[] = []

  constructor(def: LootBehaviorDef) {
    this.chestType = def.chestType ?? 'loot_window'
    this.lootTitle = def.lootTitle ?? 'You found:'
    this.oneTime   = def.oneTime !== false
  }

  onInteract(gameMgr: any): void {
    if (this.taken) {
      gameMgr.popupMgr.showFloat('Already looted.', undefined, 1200)
      return
    }
    if (this.drops.length === 0) return

    if (this.chestType === 'auto') {
      for (const drop of this.drops) {
        if (drop.isCurrency) gameMgr.playerInventory.addCurrency(drop.quantity, drop.itemId)
        else                 gameMgr.playerInventory.addItem(drop.itemId, drop.name, drop.quantity)
        gameMgr.popupMgr.showFloat(`+${drop.quantity} ${drop.name}`)
      }
      if (this.oneTime) this.taken = true
    }

    if (this.chestType === 'loot_window') {
      gameMgr.popupMgr.openLootWindow(
        this.drops.map(d => ({ itemId: d.itemId, name: d.name, quantity: d.quantity })),
        this.lootTitle,
        (items: Array<{ itemId: string; name: string; quantity: number }>) => {
          items.forEach(item => gameMgr.playerInventory.addItem(item.itemId, item.name, item.quantity))
          items.forEach(item => gameMgr.popupMgr.showFloat(`+${item.quantity} ${item.name}`))
          if (this.oneTime) this.taken = true
        }
      )
    }

    if (this.chestType === 'choice' && this.drops.length >= 2) {
      gameMgr.popupMgr.openChoicePopup(
        { itemId: this.drops[0].itemId, name: this.drops[0].name },
        { itemId: this.drops[1].itemId, name: this.drops[1].name },
        (chosen: { itemId: string; name: string }) => {
          gameMgr.playerInventory.addItem(chosen.itemId, chosen.name, 1)
          gameMgr.popupMgr.showFloat(`+1 ${chosen.name}`)
          if (this.oneTime) this.taken = true
        }
      )
    }
  }
}

// ─── FarmPlotBehavior ─────────────────────────────────────────────────────────
// WORLD BEHAVIOR — manages the plant/grow/harvest lifecycle of a farm plot.
// Driven by FarmSystem (worldSystems.ts) which calls tick() every ~1 second.
// The popup reads `live` directly each frame for real-time progress display.

export interface FarmPlotBehaviorDef {
  plotId: string
  growthMs?: number              // default 30000 (30 seconds)
  outputItemId?: string          // default 'wheat'
  outputName?: string            // default 'Wheat'
  outputQuantity?: number        // default 3
  seedItemId?: string            // default 'wheat_seeds'
  seedName?: string              // default 'Wheat Seeds'
}

export class FarmPlotBehavior {

  plotId: string
  growthMs: number
  seedItemId: string
  seedName: string
  outputItemId: string
  outputName: string
  outputQuantity: number

  /** Live state — passed by reference to FarmPlotPopupModule. */
  live: import('../ui/popupManager').FarmPlotLive

  /** Set by AreaManager after creation — the GLB entity to swap. */
  visualEntity: any = null
  /** Track last rendered GLB step to avoid redundant swaps. */
  private _lastGlbStep: number = -1

  static readonly FARM_ASSETS = 'assets/farm'
  static readonly GLB_EMPTY   = 'assets/farm/fa_unplantedA.glb'

  static growthGlb(pct: number): string {
    const step = Math.min(100, Math.max(0, Math.round(pct / 10) * 10))
    return `${FarmPlotBehavior.FARM_ASSETS}/fa_plantedA_${step}.glb`
  }

  constructor(def: FarmPlotBehaviorDef, gameMgr: any) {
    this.plotId        = def.plotId
    this.growthMs      = def.growthMs      ?? 30000
    this.seedItemId    = def.seedItemId    ?? 'wheat_seeds'
    this.seedName      = def.seedName      ?? 'Wheat Seeds'
    this.outputItemId  = def.outputItemId  ?? 'wheat'
    this.outputName    = def.outputName    ?? 'Wheat'
    this.outputQuantity = def.outputQuantity ?? 3

    this.live = {
      plotId:         this.plotId,
      status:         'empty',
      seedName:       '',
      outputItemId:   this.outputItemId,
      outputName:     this.outputName,
      outputQuantity: this.outputQuantity,
      plantedAt:      null,
      growthMs:       this.growthMs,
      availableSeeds: [],
      onPlant:        (seedItemId: string, seedName: string) => this._plant(seedItemId, seedName, gameMgr),
      onHarvest:      () => this._harvest(gameMgr),
    }
  }

  /**
   * Called by FarmSystem every ~1s.
   * @returns true if the visual GLB should be updated (call setVisualGlb after).
   */
  tick(now: number): boolean {
    if (this.live.status !== 'growing' || this.live.plantedAt === null) return false
    const elapsed = now - this.live.plantedAt
    const pct     = Math.min(100, Math.round((elapsed / this.live.growthMs) * 100))
    const step    = Math.min(100, Math.floor(pct / 10) * 10)

    if (pct >= 100 && this.live.status === 'growing') {
      this.live.status = 'ready'
      return true
    }

    if (step !== this._lastGlbStep) {
      this._lastGlbStep = step
      return true
    }
    return false
  }

  /** Returns the GLB src path that should currently be shown. */
  currentGlbSrc(): string {
    if (this.live.status === 'empty') return FarmPlotBehavior.GLB_EMPTY
    if (this.live.status === 'ready') return FarmPlotBehavior.growthGlb(100)
    if (this.live.plantedAt === null)  return FarmPlotBehavior.growthGlb(0)
    const pct  = Math.min(100, Math.round(((Date.now() - this.live.plantedAt) / this.live.growthMs) * 100))
    const step = Math.min(100, Math.floor(pct / 10) * 10)
    return FarmPlotBehavior.growthGlb(step)
  }

  /** Call from click handler — refreshes seed availability and opens popup. */
  openPopup(gameMgr: any): void {
    if (gameMgr.popupMgr.isPopupOpen()) return
    this.live.availableSeeds = [
      { itemId: this.seedItemId, name: this.seedName, quantity: gameMgr.playerInventory.getCount(this.seedItemId) }
    ].filter(s => s.quantity > 0)
    gameMgr.popupMgr.openFarmPlotPopup(this.live)
  }

  private _plant(seedItemId: string, seedName: string, gameMgr: any): void {
    if (!gameMgr.playerInventory.removeItem(seedItemId, 1)) return
    this.live.status    = 'growing'
    this.live.seedName  = seedName
    this.live.plantedAt = Date.now()
    this._lastGlbStep   = 0
    gameMgr.popupMgr.showFloat(`${seedName} planted!`, undefined, 1800)
    gameMgr.popupMgr.closePopup()
  }

  private _harvest(gameMgr: any): void {
    gameMgr.playerInventory.addItem(this.live.outputItemId, this.live.outputName, this.live.outputQuantity)
    gameMgr.popupMgr.showFloat(`+${this.live.outputQuantity} ${this.live.outputName}`)
    this.live.status    = 'empty'
    this.live.seedName  = ''
    this.live.plantedAt = null
    this._lastGlbStep   = -1
    gameMgr.popupMgr.closePopup()
  }
}

// ─── MovementBehavior ─────────────────────────────────────────────────────────
// WORLD BEHAVIOR — autonomous per-frame entity movement.
// Two subtypes:
//   'wander'  — random direction changes within a radius of the spawn position
//   'patrol'  — moves through an ordered list of waypoints, then loops
//
// Driven by NPCMovementSystem (worldSystems.ts). One shared engine.addSystem()
// iterates ALL moving entities — the correct SDK7 DOP pattern.
//
// InteractiveComposite entities pause movement while their popup is open.

export interface MovementBehaviorDef {
  type: 'wander' | 'patrol'
  /** Movement speed in DCL units/second. Default 2.0. */
  speed?: number
  /** Wander: maximum wander radius from spawn position. Default 8. */
  wanderRadius?: number
  /** Wander: how often to pick a new direction (ms). Default 2000–4000 random. */
  dirChangeIntervalMs?: number
  /** Patrol: list of waypoints [[x,y,z], ...]. Loops when last is reached. */
  waypoints?: Array<[number, number, number]>
  /** Patrol: distance threshold to consider waypoint reached. Default 0.5. */
  waypointThreshold?: number
}

export class MovementBehavior {

  type: 'wander' | 'patrol'
  speed: number
  wanderRadius: number
  dirChangeIntervalMs: number
  waypoints: Array<[number, number, number]>
  waypointThreshold: number

  // Runtime state — wander
  private _angle: number         = Math.random() * Math.PI * 2
  private _nextDirChangeMs: number = 0
  spawnPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

  // Runtime state — patrol
  private _waypointIdx: number = 0

  constructor(def: MovementBehaviorDef) {
    this.type               = def.type
    this.speed              = def.speed              ?? 2.0
    this.wanderRadius       = def.wanderRadius       ?? 8
    this.dirChangeIntervalMs = def.dirChangeIntervalMs ?? 3000
    this.waypoints          = def.waypoints          ?? []
    this.waypointThreshold  = def.waypointThreshold  ?? 0.5
  }

  /**
   * Called by NPCMovementSystem each frame.
   * @param pos   Current mutable position (Transform.getMutable(entity).position)
   * @param dt    Delta time in seconds
   * @param popupMgr  For checking if popup is open (pause check)
   * @param composite Optional composite — if its popup is open, skip movement
   * @returns true if position was updated
   */
  update(
    pos: { x: number; y: number; z: number },
    dt: number,
    popupMgr: any,
    composite?: any
  ): boolean {
    // Pause when this entity's popup is open
    if (composite && popupMgr.isPopupOpen() && popupMgr.activeEntity === composite) return false

    if (this.type === 'wander') return this._updateWander(pos, dt)
    if (this.type === 'patrol') return this._updatePatrol(pos, dt)
    return false
  }

  private _updateWander(pos: { x: number; y: number; z: number }, dt: number): boolean {
    const now = Date.now()

    // Pick new direction on interval or when about to leave radius
    const dx = pos.x - this.spawnPos.x
    const dz = pos.z - this.spawnPos.z
    const distFromSpawn = Math.sqrt(dx * dx + dz * dz)

    if (now >= this._nextDirChangeMs || distFromSpawn >= this.wanderRadius * 0.9) {
      // Bias toward center when near edge
      if (distFromSpawn >= this.wanderRadius * 0.85) {
        const toCenter = Math.atan2(-dz, -dx)
        this._angle = toCenter + (Math.random() - 0.5) * 0.8
      } else {
        this._angle = Math.random() * Math.PI * 2
      }
      const jitter = (Math.random() * 0.5 + 0.75) * this.dirChangeIntervalMs
      this._nextDirChangeMs = now + jitter
    }

    const move = this.speed * dt
    pos.x += Math.cos(this._angle) * move
    pos.z += Math.sin(this._angle) * move
    return true
  }

  private _updatePatrol(pos: { x: number; y: number; z: number }, dt: number): boolean {
    if (this.waypoints.length === 0) return false
    const wp = this.waypoints[this._waypointIdx]
    const dx = wp[0] - pos.x
    const dz = wp[2] - pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < this.waypointThreshold) {
      // Advance to next waypoint (loop)
      this._waypointIdx = (this._waypointIdx + 1) % this.waypoints.length
      return false
    }

    const norm = this.speed * dt / dist
    pos.x += dx * norm
    pos.z += dz * norm
    return true
  }
}

// ─── HealthBehavior ───────────────────────────────────────────────────────────
// WORLD BEHAVIOR — entity HP, death handling, loot drops, respawn.
// NOT a popup behavior — no interaction prompt.
// Damage is dealt by gameMgr.playerAttack() calling health.takeDamage().
// Death/respawn state is managed by EnemyAISystem in worldSystems.ts.

export interface HealthBehaviorDef {
  maxHp: number
  /** Enemy faction for targeting. Default 'enemy'. */
  faction?: 'enemy' | 'neutral'
  /** Tags passed to QuestManager.reportKill() on death. e.g. ['goblin','enemy'] */
  tags?: string[]
  /** Items/currency dropped on death. */
  lootDrops?: GiverDrop[]
  /** Flat damage reduction. Default 0. */
  defense?: number
  /** Respawn delay in ms after death. 0 = no respawn (permanent). Default 0. */
  respawnMs?: number
}

export class HealthBehavior {

  maxHp:     number
  currentHp: number
  faction:   'enemy' | 'neutral'
  tags:      string[]
  lootDrops: GiverDrop[]
  defense:   number
  respawnMs: number

  dead: boolean    = false
  /** Date.now() + respawnMs set when entity dies. 0 = not scheduled. */
  respawnAt: number = 0

  constructor(def: HealthBehaviorDef) {
    this.maxHp     = def.maxHp
    this.currentHp = def.maxHp
    this.faction   = def.faction   ?? 'enemy'
    this.tags      = def.tags      ?? []
    this.lootDrops = def.lootDrops ?? []
    this.defense   = def.defense   ?? 0
    this.respawnMs = def.respawnMs ?? 0
  }

  /**
   * Deal damage to this entity.
   * @param rawDamage  Raw damage before defense reduction.
   * @param entityId   Unique ID string for kill tracking.
   * @param gameMgr    Game manager reference for loot, quests, floats.
   */
  takeDamage(rawDamage: number, entityId: string, gameMgr: any): void {
    if (this.dead) return
    const damage = Math.max(1, rawDamage - this.defense)
    this.currentHp = Math.max(0, this.currentHp - damage)
    if (this.currentHp <= 0) this._onDeath(entityId, gameMgr)
  }

  /** Called by EnemyAISystem after respawnMs elapses. */
  respawn(): void {
    this.dead      = false
    this.currentHp = this.maxHp
    this.respawnAt = 0
  }

  private _onDeath(entityId: string, gameMgr: any): void {
    this.dead = true
    // Give loot
    for (const drop of this.lootDrops) {
      if (drop.isCurrency) gameMgr.playerInventory.addCurrency(drop.quantity, drop.itemId)
      else                 gameMgr.playerInventory.addItem(drop.itemId, drop.name, drop.quantity)
      gameMgr.popupMgr.showFloat(`+${drop.quantity} ${drop.name}`, Color4.create(1, 0.9, 0.3, 1), 2000)
    }
    // Report kill to quest system (triggers goblin_bounty etc.)
    gameMgr.questMgr.reportKill(entityId, this.tags)
    // Schedule respawn
    if (this.respawnMs > 0) {
      this.respawnAt = Date.now() + this.respawnMs
    }
  }
}

// ─── EnemyAIBehavior ──────────────────────────────────────────────────────────
// WORLD BEHAVIOR — enemy NPC state machine: idle / chase / attack.
// Driven by EnemyAISystem (worldSystems.ts) — one shared engine.addSystem().
// Only tracks ENEMY→PLAYER aggro; player→enemy attacks use gameMgr.playerAttack().

export interface EnemyAIBehaviorDef {
  /** Distance at which enemy spots the player. Default 10. */
  aggroRadius?: number
  /** Distance at which enemy gives up chase. Default 18. */
  deaggroRadius?: number
  /** Distance at which enemy starts attacking. Default 2. */
  attackRadius?: number
  /** Flat damage dealt to player each attack tick. Default 5. */
  attackDamage?: number
  /** Ms between attack ticks when in range. Default 2000. */
  attackIntervalMs?: number
  /** Chase speed in DCL units/second. Default 3.0. */
  speed?: number
  /** If true, enemy wanders slowly when idle. Default false. */
  wanderOnIdle?: boolean
}

type EnemyState = 'idle' | 'chase' | 'attack'

export class EnemyAIBehavior {

  aggroRadius:      number
  deaggroRadius:    number
  attackRadius:     number
  attackDamage:     number
  attackIntervalMs: number
  speed:            number
  wanderOnIdle:     boolean

  state: EnemyState = 'idle'
  /** Set by AreaManager — the entity's spawn position for wander bounding + respawn. */
  spawnPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

  private _lastAttackMs:  number = 0
  private _wanderAngle:   number = Math.random() * Math.PI * 2
  private _nextWanderMs:  number = 0

  constructor(def: EnemyAIBehaviorDef) {
    this.aggroRadius      = def.aggroRadius      ?? 10
    this.deaggroRadius    = def.deaggroRadius    ?? 18
    this.attackRadius     = def.attackRadius     ?? 2
    this.attackDamage     = def.attackDamage     ?? 5
    this.attackIntervalMs = def.attackIntervalMs ?? 2000
    this.speed            = def.speed            ?? 3.0
    this.wanderOnIdle     = def.wanderOnIdle     ?? false
  }

  /**
   * Called by EnemyAISystem each frame.
   * @param pos       Mutable entity position (Transform.getMutable)
   * @param playerPos Player position (Transform.getOrNull(PlayerEntity))
   * @param entityId  Entity ID string — passed to health.takeDamage
   * @param health    HealthBehavior of this entity
   * @param gameMgr   For player damage + float notifications
   * @param dt        Delta time in seconds
   */
  update(
    pos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    entityId: string,
    health: HealthBehavior,
    gameMgr: any,
    dt: number
  ): void {
    if (health.dead) return

    const dx = playerPos.x - pos.x
    const dz = playerPos.z - pos.z
    const distToPlayer = Math.sqrt(dx * dx + dz * dz)
    const now = Date.now()

    // ── State transitions ────────────────────────────────────────────────────
    if (this.state === 'idle') {
      if (distToPlayer <= this.aggroRadius) this.state = 'chase'
    } else if (this.state === 'chase') {
      if (distToPlayer <= this.attackRadius)          this.state = 'attack'
      else if (distToPlayer > this.deaggroRadius)     this.state = 'idle'
    } else {  // 'attack'
      if (distToPlayer > this.attackRadius * 1.8)    this.state = 'chase'
      else if (distToPlayer > this.deaggroRadius)     this.state = 'idle'
    }

    // ── State actions ────────────────────────────────────────────────────────
    if (this.state === 'idle') {
      if (this.wanderOnIdle) this._doIdleWander(pos, dt, now)
    } else if (this.state === 'chase') {
      if (distToPlayer > 0.1) {
        const norm = this.speed * dt / distToPlayer
        pos.x += dx * norm
        pos.z += dz * norm
      }
    } else {  // 'attack'
      if (now - this._lastAttackMs >= this.attackIntervalMs) {
        this._lastAttackMs = now
        gameMgr.takeDamage(this.attackDamage)
      }
    }
  }

  private _doIdleWander(
    pos: { x: number; y: number; z: number },
    dt: number,
    now: number
  ): void {
    const dx = pos.x - this.spawnPos.x
    const dz = pos.z - this.spawnPos.z
    const distFromSpawn = Math.sqrt(dx * dx + dz * dz)

    if (now >= this._nextWanderMs || distFromSpawn >= 5) {
      if (distFromSpawn >= 4) {
        this._wanderAngle = Math.atan2(-dz, -dx) + (Math.random() - 0.5) * 0.6
      } else {
        this._wanderAngle = Math.random() * Math.PI * 2
      }
      this._nextWanderMs = now + 2000 + Math.random() * 2000
    }

    const wanderSpeed = this.speed * 0.4
    pos.x += Math.cos(this._wanderAngle) * wanderSpeed * dt
    pos.z += Math.sin(this._wanderAngle) * wanderSpeed * dt
  }
}
