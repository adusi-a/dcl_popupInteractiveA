/**
 * @file dataManager.ts
 * @module DN DCL Framework / data
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * DataManager — single source of truth for all game data.
 *
 * RESPONSIBILITIES:
 *   - Hold global registries (items, recipes, drop presets, shop presets, station presets)
 *   - Resolve BehaviorDataRef (inline vs preset lookup)
 *   - Save/load game state (localStorage stub — server auth deferred)
 *   - Single entry point for data requests from any manager
 *
 * DOES NOT:
 *   - Create DCL entities (that's AreaManager's job)
 *   - Track runtime state (that's each behavior class's job)
 *   - Manage popups or player state
 *
 * @changelog
 *   0.0001 - Initial. Registries, resolvers, localStorage save/load stub.
 */

import { Recipe } from '../ui/popupManager'
import {
  BehaviorDataRef,
  DropData,
  TradeSaleItem,
  TradeBuyItem,
  WorkbenchStationData,
} from './areaTypes'

// ─── Item definition (for future item tooltips, icon, rarity etc.) ────────────

export interface ItemDefinition {
  id: string
  name: string
  description?: string
  icon?: string
  stackable?: boolean
  maxStack?: number
}

// ─── Shop preset ──────────────────────────────────────────────────────────────

export interface ShopPreset {
  sellItems?: TradeSaleItem[]
  buyItems?: TradeBuyItem[]
}

// ─── DataManager ──────────────────────────────────────────────────────────────

export class DataManager {

  // Global registries — populated via registerX() at scene init
  private _items:          Map<string, ItemDefinition>        = new Map()
  private _recipes:        Map<string, Recipe>                 = new Map()
  private _dropPresets:    Map<string, DropData>               = new Map()
  private _shopPresets:    Map<string, ShopPreset>             = new Map()
  private _stationPresets: Map<string, WorkbenchStationData>   = new Map()

  // ── Registry population ────────────────────────────────────────────────────

  registerItems(items: ItemDefinition[]): void {
    for (const item of items) this._items.set(item.id, item)
  }

  registerRecipes(recipes: Recipe[]): void {
    for (const recipe of recipes) this._recipes.set(recipe.id, recipe)
  }

  registerDropPreset(id: string, data: DropData): void {
    this._dropPresets.set(id, data)
  }

  registerDropPresets(presets: Record<string, DropData>): void {
    for (const [id, data] of Object.entries(presets)) this._dropPresets.set(id, data)
  }

  registerShopPreset(id: string, preset: ShopPreset): void {
    this._shopPresets.set(id, preset)
  }

  registerShopPresets(presets: Record<string, ShopPreset>): void {
    for (const [id, preset] of Object.entries(presets)) this._shopPresets.set(id, preset)
  }

  registerStationPreset(id: string, data: WorkbenchStationData): void {
    this._stationPresets.set(id, data)
  }

  // ── Resolvers — inline vs preset lookup ───────────────────────────────────

  /**
   * Resolve a BehaviorDataRef<T>: returns inlineContent directly,
   * or fetches from the provided registry map by presetId.
   */
  resolve<T>(ref: BehaviorDataRef<T>, registry: Map<string, T>): T | null {
    if (ref.dataMethod === 'inline') {
      return ref.inlineContent ?? null
    }
    if (ref.dataMethod === 'preset' && ref.presetId) {
      const preset = registry.get(ref.presetId)
      if (!preset) {
        console.error(`[DataManager] Preset not found: '${ref.presetId}'`)
        return null
      }
      return preset
    }
    console.error(`[DataManager] Invalid BehaviorDataRef — missing inlineContent or presetId`)
    return null
  }

  resolveDropData(ref: BehaviorDataRef<DropData>): DropData | null {
    return this.resolve(ref, this._dropPresets)
  }

  resolveShopPreset(shopId: string): ShopPreset | null {
    const preset = this._shopPresets.get(shopId)
    if (!preset) {
      console.error(`[DataManager] Shop preset not found: '${shopId}'`)
      return null
    }
    return preset
  }

  resolveRecipes(recipeIds: string[]): Recipe[] {
    const recipes: Recipe[] = []
    for (const id of recipeIds) {
      const r = this._recipes.get(id)
      if (r) recipes.push(r)
      else console.error(`[DataManager] Recipe not found: '${id}'`)
    }
    return recipes
  }

  resolveStationPreset(presetId: string): WorkbenchStationData | null {
    const preset = this._stationPresets.get(presetId)
    if (!preset) {
      console.error(`[DataManager] Station preset not found: '${presetId}'`)
      return null
    }
    return preset
  }

  // ── Direct getters ─────────────────────────────────────────────────────────

  getItem(id: string): ItemDefinition | undefined { return this._items.get(id) }
  getRecipe(id: string): Recipe | undefined        { return this._recipes.get(id) }

  // ── Save / Load (localStorage stub — server integration deferred) ─────────

  private _saveKey: string = 'dn_game_state'

  setSaveKey(key: string): void { this._saveKey = key }

  saveState(state: Record<string, unknown>): void {
    try {
      // DCL QuickJS has localStorage via ~system/Storage — stub for now
      // TODO: replace with Storage.setItem() from '@dcl/sdk/src/~system/Storage'
      //       and/or send to auth server
      console.log(`[DataManager] saveState (stub) key=${this._saveKey}`, JSON.stringify(state))
    } catch (e) {
      console.error('[DataManager] saveState failed:', e)
    }
  }

  loadState(): Record<string, unknown> | null {
    try {
      // TODO: replace with Storage.getItem() and/or auth server load
      console.log(`[DataManager] loadState (stub) key=${this._saveKey}`)
      return null
    } catch (e) {
      console.error('[DataManager] loadState failed:', e)
      return null
    }
  }

  // ── Discovery watch list ───────────────────────────────────────────────────

  /**
   * Set of itemIds that could trigger a recipe/content unlock when first collected.
   * Populated at scene init from all recipe discoveryRequirements.
   * Items removed from the set once the player has collected them once.
   */
  discoveryWatchList: Set<string> = new Set()

  buildDiscoveryWatchList(recipes: Recipe[]): void {
    this.discoveryWatchList.clear()
    for (const recipe of recipes) {
      if ((recipe as any).discoveryRequirement) {
        for (const reqId of (recipe as any).discoveryRequirement as string[]) {
          this.discoveryWatchList.add(reqId)
        }
      }
    }
  }

  isDiscoveryItem(itemId: string): boolean {
    return this.discoveryWatchList.has(itemId)
  }

  markDiscovered(itemId: string): void {
    this.discoveryWatchList.delete(itemId)
  }
}
