/**
 * @file npcBehaviors.ts
 * @module DN DCL Framework / npcs
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Modular NPC behavior classes.
 *
 * An NPC entity is composed of zero or more behaviors:
 *   MissionGiverBehavior — has quests to give, accept, and receive turn-ins
 *   SellerBehavior       — sells items/services to the player
 *   BuyerBehavior        — buys items from the player
 *   MessengerBehavior    — static message/dialogue text
 *
 * The NpcPopupModule reads which behaviors are present and renders only the
 * relevant tabs. A fishing mission board with only MissionGiverBehavior shows
 * one Missions tab. A full shopkeeper NPC with all four shows all four tabs.
 *
 * Wording/presentation differs per entity but the underlying logic is the same.
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA behavior-system sprint.
 */

import { QuestDefinition, QuestManager, QuestReward } from '../quests/questState'
import { PlayerInventory } from '../player/playerInventory'
import { MarketManager } from '../economy/marketManager'

// ─── MissionGiverBehavior ─────────────────────────────────────────────────────

export class MissionGiverBehavior {

  questDefinitions: QuestDefinition[]

  constructor(quests: QuestDefinition[]) {
    this.questDefinitions = quests
  }

  /** Quests this entity offers that the player hasn't started yet. */
  getAvailableQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => {
      const s = questMgr.getStatus(def.id)
      return s === 'available' || s === 'locked'  // show locked too (grayed out in UI = future)
    })
  }

  /** Quests this entity gave that are currently in progress. */
  getActiveQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => questMgr.isActive(def.id))
  }

  /** Quests ready to be turned in at this entity. */
  getCompletableQuests(questMgr: QuestManager): QuestDefinition[] {
    return this.questDefinitions.filter(def => questMgr.getStatus(def.id) === 'complete')
  }

  /** Accept a quest (make it active). No-op if already active or not registered. */
  acceptQuest(questId: string, questMgr: QuestManager): void {
    if (!this.questDefinitions.find(d => d.id === questId)) return
    if (questMgr.getStatus(questId) === 'turned_in') return
    questMgr.setStatus(questId, 'active')
  }

  /**
   * Turn in a completed quest: apply rewards, mark turned_in.
   * @returns the reward that was applied (for float notifications)
   */
  turnInQuest(
    questId: string,
    questMgr: QuestManager,
    inventory: PlayerInventory,
    market: MarketManager
  ): QuestReward | null {
    if (questMgr.getStatus(questId) !== 'complete') return null
    const def = this.questDefinitions.find(d => d.id === questId)
    if (!def?.reward) {
      questMgr.setStatus(questId, 'turned_in')
      return {}
    }

    const reward = def.reward

    if (reward.gold) inventory.addCurrency(reward.gold, 'gold')

    if (reward.stats) {
      for (const [key, val] of Object.entries(reward.stats)) {
        inventory.addStat(key, val)
      }
    }

    if (reward.items) {
      for (const item of reward.items) {
        inventory.addItem(item.itemId, item.name, item.quantity)
      }
    }

    questMgr.setStatus(questId, 'turned_in')
    return reward
  }
}

// ─── SellerBehavior ───────────────────────────────────────────────────────────

export interface SaleItem {
  itemId: string
  name: string
  cost: number
  currencyKey?: string   // default 'gold'
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
    const item = this.items.find(i => i.itemId === itemId)
    if (!item) return false
    const key = item.currencyKey ?? 'gold'
    if (!inventory.spendCurrency(item.cost, key)) return false
    inventory.addItem(item.itemId, item.name, 1)
    return true
  }
}

// ─── BuyerBehavior ────────────────────────────────────────────────────────────

export type PriceCalculator = (itemId: string, inventory: PlayerInventory) => number

export class BuyerBehavior {

  /** Item types or specific itemIds this entity will buy. */
  acceptedItemTypes: string[]

  /** How to calculate the price for a given item. */
  getPriceFor: PriceCalculator

  /** Currency paid out. Default 'gold'. */
  currencyKey: string

  constructor(
    acceptedItemTypes: string[],
    priceCalc: PriceCalculator,
    currencyKey: string = 'gold'
  ) {
    this.acceptedItemTypes = acceptedItemTypes
    this.getPriceFor       = priceCalc
    this.currencyKey       = currencyKey
  }

  /** Items from inventory that this entity will buy. */
  getBuyableItems(inventory: PlayerInventory): Array<{ item: import('../player/playerInventory').InventoryItem; price: number }> {
    return inventory.getAllItems()
      .filter(item => this.acceptedItemTypes.includes(item.itemId))
      .map(item => ({ item, price: this.getPriceFor(item.itemId, inventory) }))
      .filter(entry => entry.price > 0)
  }

  /** Sell one of a specific itemId. @returns true if sold */
  sell(itemId: string, inventory: PlayerInventory): boolean {
    const price = this.getPriceFor(itemId, inventory)
    if (price <= 0) return false
    if (!inventory.removeItem(itemId, 1)) return false
    inventory.addCurrency(price, this.currencyKey)
    return true
  }
}

// ─── MessengerBehavior ────────────────────────────────────────────────────────

export class MessengerBehavior {

  title: string
  message: string
  closeLabel?: string

  /**
   * Static text message. Pass a function for dynamic messages in the future.
   * @param title    Title shown in the popup header
   * @param message  Body text (supports \n for line breaks)
   * @param closeLabel  Button label, default 'Close'
   */
  constructor(title: string, message: string, closeLabel?: string) {
    this.title      = title
    this.message    = message
    this.closeLabel = closeLabel
  }
}
