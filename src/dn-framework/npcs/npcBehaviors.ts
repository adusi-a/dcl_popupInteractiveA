/**
 * @file npcBehaviors.ts
 * @module DN DCL Framework / npcs
 * @version 0.0003
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
 */

import { QuestDefinition, QuestManager, QuestReward } from '../quests/questState'
import { PlayerInventory } from '../player/playerInventory'
import { MarketManager } from '../economy/marketManager'
import { Recipe, PopupManager } from '../ui/popupManager'

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
  type: 'setFlag' | 'startQuest' | 'turnInQuest' | 'openBuy'
  /** flagKey or questId (not needed for openBuy). */
  key?: string
  /** Value to set on the flag (for setFlag). Defaults to true. */
  value?: string | number | boolean
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
  }
}
