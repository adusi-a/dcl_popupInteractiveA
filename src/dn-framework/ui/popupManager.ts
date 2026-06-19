/**
 * @file popupManager.ts
 * @module DN DCL Framework / ui
 * @version 0.0002
 * @status NEEDS_TEST
 *
 * Popup state manager for DCL SDK7 scenes.
 * Manages all popup types used by chest/toolbox interactions:
 *   - Float notifications (fire-and-forget drift-up messages)
 *   - Loot window (formal "you received" modal with item list)
 *   - Choice popup (binary item choice — pick one, abandon the other)
 *   - Crafting window (recipe list + ingredient check + craft button)
 *
 * PopupManager is a PURE DATA class — no ECS system calls.
 * Wire up the ECS system separately via setupInteractionUiSystem().
 *
 * @changelog
 *   0.0001 - Initial. Float, LootWindow, ChoicePopup.
 *   0.0002 - Added Recipe/RecipeIngredient types + CraftingWindow state.
 */

import { Color4 } from '@dcl/sdk/math'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupType = 'none' | 'loot' | 'choice' | 'crafting' | 'pause'

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
  startTime: number
  lifeMs: number
  stackOffset: number
}

export interface RecipeIngredient {
  itemId: string
  name: string
  quantity: number
}

export interface Recipe {
  id: string
  name: string
  category: string
  ingredients: RecipeIngredient[]
  output: { itemId: string, name: string, quantity: number }
  craftTimeMs?: number  // future: hold-to-craft duration
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

  // ── Crafting window ───────────────────────────────────────────────────────────
  craftingStationName: string = ''
  craftingRecipes: Recipe[] = []
  craftingActiveCategory: string = ''
  craftingSelectedRecipe: Recipe | null = null
  private onCraftItem: ((recipe: Recipe) => void) | null = null

  // ── Float notifications ──────────────────────────────────────────────────────
  floatItems: FloatItem[] = []
  private nextFloatId: number = 0

  // ─── Float Notifications ───────────────────────────────────────────────────

  showFloat(text: string, color?: Color4, lifeMsOverride?: number): void {
    const now = Date.now()
    const recentCount = this.floatItems.filter(f => now - f.startTime < 80).length
    this.floatItems.push({
      id: this.nextFloatId++,
      text,
      color: color ?? Color4.create(1, 0.85, 0.1, 1),
      startTime: now,
      lifeMs: lifeMsOverride ?? 1500,
      stackOffset: recentCount * 32,
    })
  }

  updateFloats(): void {
    if (this.floatItems.length === 0) return
    const now = Date.now()
    this.floatItems = this.floatItems.filter(f => now - f.startTime < f.lifeMs)
  }

  // ─── Loot Window ──────────────────────────────────────────────────────────

  openLootWindow(items: LootItem[], title: string, onTakeAll: (items: LootItem[]) => void): void {
    this.pendingLootItems = items
    this.lootTitle = title
    this.onTakeAll = onTakeAll
    this.popupType = 'loot'
  }

  takeLoot(): void {
    if (this.onTakeAll) this.onTakeAll(this.pendingLootItems)
    this._clearLoot()
  }

  // ─── Choice Popup ─────────────────────────────────────────────────────────

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

  makeChoice(chosen: ChoiceItem): void {
    if (this.onChoiceMade) this.onChoiceMade(chosen)
    this._clearChoice()
  }

  // ─── Crafting Window ──────────────────────────────────────────────────────

  /**
   * Open the crafting window for a station.
   * @param stationName  Display name of the station (e.g. 'Workbench')
   * @param recipes      Recipes available at this station
   * @param onCraftItem  Callback invoked when player confirms a craft.
   *                     Caller handles: ingredient check + consume + inventory add + float + closePopup.
   */
  openCraftingWindow(
    stationName: string,
    recipes: Recipe[],
    onCraftItem: (recipe: Recipe) => void
  ): void {
    this.craftingStationName = stationName
    this.craftingRecipes = recipes
    this.onCraftItem = onCraftItem
    // Default to first category + first recipe
    this.craftingActiveCategory = recipes.length > 0 ? recipes[0].category : ''
    this.craftingSelectedRecipe = recipes.length > 0 ? recipes[0] : null
    this.popupType = 'crafting'
  }

  /** Switch the active category tab and select the first recipe in it. */
  setCraftingCategory(category: string): void {
    this.craftingActiveCategory = category
    const first = this.craftingRecipes.find(r => r.category === category)
    this.craftingSelectedRecipe = first ?? null
  }

  /** Highlight a recipe in the list. */
  selectCraftingRecipe(recipe: Recipe): void {
    this.craftingSelectedRecipe = recipe
  }

  /** Execute the currently selected recipe. Calls onCraftItem callback. */
  doCraft(): void {
    if (!this.craftingSelectedRecipe || !this.onCraftItem) return
    this.onCraftItem(this.craftingSelectedRecipe)
  }

  // ─── General ──────────────────────────────────────────────────────────────

  closePopup(): void {
    this._clearLoot()
    this._clearChoice()
    this._clearCrafting()
  }

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

  private _clearCrafting(): void {
    this.craftingStationName = ''
    this.craftingRecipes = []
    this.craftingActiveCategory = ''
    this.craftingSelectedRecipe = null
    this.onCraftItem = null
    if (this.popupType === 'crafting') this.popupType = 'none'
  }
}
