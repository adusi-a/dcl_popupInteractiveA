/**
 * @file popupManager.ts
 * @module DN DCL Framework / ui
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Popup state manager for DCL SDK7 scenes.
 * Manages three popup types used by chest/toolbox interactions:
 *   - Float notifications (fire-and-forget drift-up messages)
 *   - Loot window (formal "you received" modal with item list)
 *   - Choice popup (binary item choice — pick one, abandon the other)
 *
 * PopupManager is a PURE DATA class — no ECS system calls.
 * Wire up the ECS system separately via setupInteractionUiSystem().
 *
 * Usage:
 *   const popupMgr = new PopupManager()
 *
 *   // Fire-and-forget float
 *   popupMgr.showFloat('+50 Gold', Color4.create(1, 0.85, 0.1, 1))
 *
 *   // Loot window
 *   popupMgr.openLootWindow(
 *     [{ itemId: 'sword', name: 'Iron Sword', quantity: 1 }],
 *     'Found in the chest:',
 *     (items) => items.forEach(i => inv.addItem(i.itemId, i.name, i.quantity))
 *   )
 *
 *   // Choice popup
 *   popupMgr.openChoicePopup(
 *     { itemId: 'sword', name: 'Enchanted Sword', description: '+25 ATK' },
 *     { itemId: 'shield', name: 'Shield of Fortitude', description: '+50 DEF' },
 *     (chosen) => inv.addItem(chosen.itemId, chosen.name, 1)
 *   )
 *
 * @changelog
 *   0.0001 - Initial. Built for dnWorld_chestTestA popup sprint.
 */

import { Color4 } from '@dcl/sdk/math'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupType = 'none' | 'loot' | 'choice' | 'pause'

export interface LootItem {
  itemId: string
  name: string
  quantity: number
  icon?: string
}

export interface ChoiceItem {
  itemId: string
  name: string
  description?: string
  icon?: string
}

export interface FloatItem {
  id: number
  text: string
  color: Color4
  startTime: number      // Date.now() when created
  lifeMs: number         // total lifetime in ms
  stackOffset: number    // initial bottom-px offset for simultaneous items
}

// ─── PopupManager ─────────────────────────────────────────────────────────────

export class PopupManager {

  // ── Active popup state ──────────────────────────────────────────────────────
  popupType: PopupType = 'none'

  // ── Loot window ─────────────────────────────────────────────────────────────
  lootTitle: string = 'You received:'
  pendingLootItems: LootItem[] = []
  private onTakeAll: ((items: LootItem[]) => void) | null = null

  // ── Choice popup ─────────────────────────────────────────────────────────────
  choiceItemA: ChoiceItem | null = null
  choiceItemB: ChoiceItem | null = null
  private onChoiceMade: ((chosen: ChoiceItem) => void) | null = null

  // ── Float notifications ──────────────────────────────────────────────────────
  floatItems: FloatItem[] = []
  private nextFloatId: number = 0

  // ─── Float Notifications ───────────────────────────────────────────────────

  /**
   * Show a fire-and-forget floating text notification.
   * Items appear at a consistent screen position, drift upward, and fade out.
   * Multiple simultaneous calls are automatically stacked vertically.
   *
   * @param text  Display text (e.g. '+50 Gold', '+3 Wood')
   * @param color Text color (default: gold)
   * @param lifeMsOverride  Optional lifetime override (default 1500ms)
   */
  showFloat(text: string, color?: Color4, lifeMsOverride?: number): void {
    const now = Date.now()
    // Count items added in the last 80ms — used to stack simultaneous items
    const recentCount = this.floatItems.filter(f => now - f.startTime < 80).length
    this.floatItems.push({
      id: this.nextFloatId++,
      text,
      color: color ?? Color4.create(1, 0.85, 0.1, 1),  // default: gold
      startTime: now,
      lifeMs: lifeMsOverride ?? 1500,
      stackOffset: recentCount * 32  // 32px gap between stacked items
    })
  }

  /**
   * Remove expired float items. Call this every frame from setupInteractionUiSystem().
   */
  updateFloats(): void {
    if (this.floatItems.length === 0) return
    const now = Date.now()
    this.floatItems = this.floatItems.filter(f => now - f.startTime < f.lifeMs)
  }

  // ─── Loot Window ──────────────────────────────────────────────────────────

  /**
   * Open the loot window modal.
   * @param items      Items to display
   * @param title      Window header text (default 'You received:')
   * @param onTakeAll  Callback invoked when player clicks "Take All". Add to inventory here.
   */
  openLootWindow(items: LootItem[], title: string, onTakeAll: (items: LootItem[]) => void): void {
    this.pendingLootItems = items
    this.lootTitle = title
    this.onTakeAll = onTakeAll
    this.popupType = 'loot'
  }

  /** Called by the "Take All" button in the loot window. */
  takeLoot(): void {
    if (this.onTakeAll) {
      this.onTakeAll(this.pendingLootItems)
    }
    this._clearLoot()
  }

  // ─── Choice Popup ─────────────────────────────────────────────────────────

  /**
   * Open the binary choice popup.
   * @param itemA         First choice
   * @param itemB         Second choice
   * @param onChoiceMade  Callback invoked with the chosen item. Add to inventory here.
   */
  openChoicePopup(
    itemA: ChoiceItem,
    itemB: ChoiceItem,
    onChoiceMade: (chosen: ChoiceItem) => void
  ): void {
    this.choiceItemA = itemA
    this.choiceItemB = itemB
    this.onChoiceMade = onChoiceMade
    this.popupType = 'choice'
  }

  /** Called by the "Choose" button for a specific item. */
  makeChoice(chosen: ChoiceItem): void {
    if (this.onChoiceMade) {
      this.onChoiceMade(chosen)
    }
    this._clearChoice()
  }

  // ─── General ──────────────────────────────────────────────────────────────

  /**
   * Close the active popup (loot or choice). ESC key calls this.
   * Does NOT fire takeLoot/makeChoice callbacks — items are NOT received on ESC.
   */
  closePopup(): void {
    this._clearLoot()
    this._clearChoice()
  }

  /** True if a blocking popup (loot or choice) is currently open. */
  isPopupOpen(): boolean {
    return this.popupType !== 'none' && this.popupType !== 'pause'
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _clearLoot(): void {
    this.pendingLootItems = []
    this.onTakeAll = null
    if (this.popupType === 'loot') this.popupType = 'none'
  }

  private _clearChoice(): void {
    this.choiceItemA = null
    this.choiceItemB = null
    this.onChoiceMade = null
    if (this.popupType === 'choice') this.popupType = 'none'
  }
}
