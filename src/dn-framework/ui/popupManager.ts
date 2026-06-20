/**
 * @file popupManager.ts
 * @module DN DCL Framework / ui
 * @version 0.0004
 * @status NEEDS_TEST
 *
 * Popup state manager for DCL SDK7 scenes.
 * Popup types: float | loot | choice | crafting | farm_plot | fishing
 *
 * @changelog
 *   0.0001 - Initial. Float, LootWindow, ChoicePopup.
 *   0.0002 - Added Recipe/RecipeIngredient types + CraftingWindow state.
 *   0.0003 - Added FarmPlotLive + farm_plot popup type. Added craftingButtonLabel.
 *   0.0004 - Added FishingCastLive + fishing popup type.
 */

import { Color4 } from '@dcl/sdk/math'

export type PopupType = 'none' | 'loot' | 'choice' | 'crafting' | 'farm_plot' | 'pause' | 'fishing'

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
  craftTimeMs?: number
}

/**
 * Live state of a fishing cast — passed by reference so popup reads fresh data each frame.
 * The fishing mechanic system updates `phase` from 'casting' → 'caught' when the timer expires.
 */
export interface FishingCastLive {
  poleLabel: string        // e.g. "Basic Rod"
  baitLabel: string        // e.g. "Worm"
  castStartTime: number    // Date.now() when cast began
  castDurationMs: number   // total wait in ms
  phase: 'casting' | 'caught'
  catchLabel?: string      // "Bass (2.2lb)" — set when phase transitions to caught
  catchGoldValue?: number  // approx gold when sold — set when phase transitions
  onCollect: () => void    // add fish to inventory, close popup
}

/** Live state of a farm plot — passed by reference so popup reads fresh data each frame. */
export interface FarmPlotLive {
  plotId: string
  status: 'empty' | 'growing' | 'ready'
  seedName: string         // name of what's planted (empty string when empty)
  outputItemId: string     // itemId of what will be harvested (e.g. 'wheat')
  outputName: string       // name of what will be harvested
  outputQuantity: number
  plantedAt: number | null // Date.now() when planted
  growthMs: number         // total growth duration
  availableSeeds: Array<{ itemId: string, name: string, quantity: number }>
  onPlant: (seedItemId: string, seedName: string) => void
  onHarvest: () => void
}

export class PopupManager {

  popupType: PopupType = 'none'

  // Loot window
  lootTitle: string = 'You received:'
  pendingLootItems: LootItem[] = []
  private onTakeAll: ((items: LootItem[]) => void) | null = null

  // Choice popup
  choiceItemA: ChoiceItem | null = null
  choiceItemB: ChoiceItem | null = null
  private onChoiceMade: ((chosen: ChoiceItem) => void) | null = null

  // Crafting window
  craftingStationName: string = ''
  craftingRecipes: Recipe[] = []
  craftingActiveCategory: string = ''
  craftingSelectedRecipe: Recipe | null = null
  craftingButtonLabel: string = 'CRAFT'
  private onCraftItem: ((recipe: Recipe) => void) | null = null

  // Farm plot popup
  farmPlotRef: FarmPlotLive | null = null

  // Fishing popup
  fishingRef: FishingCastLive | null = null

  // Float notifications
  floatItems: FloatItem[] = []
  private nextFloatId: number = 0

  // ── Float ─────────────────────────────────────────────────────────────────

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

  // ── Loot Window ────────────────────────────────────────────────────────────

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

  // ── Choice Popup ──────────────────────────────────────────────────────────

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

  // ── Crafting Window ───────────────────────────────────────────────────────

  openCraftingWindow(
    stationName: string,
    recipes: Recipe[],
    onCraftItem: (recipe: Recipe) => void,
    craftButtonLabel?: string
  ): void {
    this.craftingStationName = stationName
    this.craftingRecipes = recipes
    this.onCraftItem = onCraftItem
    this.craftingButtonLabel = craftButtonLabel ?? 'CRAFT'
    this.craftingActiveCategory = recipes.length > 0 ? recipes[0].category : ''
    this.craftingSelectedRecipe = recipes.length > 0 ? recipes[0] : null
    this.popupType = 'crafting'
  }

  setCraftingCategory(category: string): void {
    this.craftingActiveCategory = category
    const first = this.craftingRecipes.find(r => r.category === category)
    this.craftingSelectedRecipe = first ?? null
  }

  selectCraftingRecipe(recipe: Recipe): void {
    this.craftingSelectedRecipe = recipe
  }

  doCraft(): void {
    if (!this.craftingSelectedRecipe || !this.onCraftItem) return
    this.onCraftItem(this.craftingSelectedRecipe)
  }

  // ── Farm Plot Popup ───────────────────────────────────────────────────────

  /**
   * Open the farm plot popup.
   * Pass a live reference — the popup reads it every render frame for live progress.
   */
  openFarmPlotPopup(plot: FarmPlotLive): void {
    this.farmPlotRef = plot
    this.popupType = 'farm_plot'
  }

  // ── Fishing Popup ─────────────────────────────────────────────────────────

  /**
   * Open the fishing cast popup.
   * Pass a live FishingCastLive reference — popup reads it every frame.
   * The fishing mechanic system transitions phase from 'casting' to 'caught'.
   */
  openFishingPopup(castLive: FishingCastLive): void {
    this.fishingRef = castLive
    this.popupType = 'fishing'
  }

  closeFishingPopup(): void {
    this.fishingRef = null
    if (this.popupType === 'fishing') this.popupType = 'none'
  }

  // ── General ───────────────────────────────────────────────────────────────

  closePopup(): void {
    this._clearLoot()
    this._clearChoice()
    this._clearCrafting()
    this._clearFarmPlot()
    this.closeFishingPopup()
  }

  isPopupOpen(): boolean {
    return this.popupType !== 'none' && this.popupType !== 'pause'
  }

  // ── Private ───────────────────────────────────────────────────────────────

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
    this.craftingButtonLabel = 'CRAFT'
    if (this.popupType === 'crafting') this.popupType = 'none'
  }

  private _clearFarmPlot(): void {
    this.farmPlotRef = null
    if (this.popupType === 'farm_plot') this.popupType = 'none'
  }
}
