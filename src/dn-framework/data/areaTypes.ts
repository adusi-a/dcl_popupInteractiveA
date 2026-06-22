/**
 * @file areaTypes.ts
 * @module DN DCL Framework / data
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Type interfaces for the DN data-driven scene architecture.
 *
 * HIERARCHY:
 *   Scene  → DCL container (scene.json + index.ts)
 *   Area   → loadable/unloadable entity set (one active at a time)
 *   Zone   → trigger cube within an area (no load/unload, behavioral)
 *
 * DATA PATTERN:
 *   All behavior data fields support dataMethod: 'inline' | 'preset'
 *   inline → inlineContent holds the data directly
 *   preset → presetId references a global registry entry
 *
 * @changelog
 *   0.0001 - Initial. AreaDefinition, EntityDef union, ZoneDef, BehaviorDataRef,
 *            drop types, trade item types, all entity behavior field types.
 */

import { Recipe } from '../ui/popupManager'
import { GiverDrop, SaleItem, RefinementFormula, DialogueBehaviorDef, LootBehaviorDef, FarmPlotBehaviorDef, MovementBehaviorDef, HealthBehaviorDef, EnemyAIBehaviorDef } from '../npcs/npcBehaviors'

// Re-export so area data files only need to import from areaTypes
export type { LootBehaviorDef, FarmPlotBehaviorDef, MovementBehaviorDef, HealthBehaviorDef, EnemyAIBehaviorDef }

// ─── BehaviorDataRef — the core inline/preset wrapper ─────────────────────────

/**
 * Every behavior data field can be defined inline OR reference a preset by ID.
 * Leave the unused param undefined / omit it.
 *
 * @example inline:  { dataMethod: 'inline', inlineContent: [...] }
 * @example preset:  { dataMethod: 'preset', presetId: 'iron_vein' }
 */
export interface BehaviorDataRef<T> {
  dataMethod: 'inline' | 'preset'
  inlineContent?: T
  presetId?: string
}

// ─── Drop types ───────────────────────────────────────────────────────────────

/** Always gives exactly these items/amounts. */
export interface SetDropData {
  type: 'set'
  drops: GiverDrop[]
}

/** Gives this item with a random quantity in range [min, max]. */
export interface RandomCountDropData {
  type: 'randomCount'
  itemId: string
  name: string
  min: number
  max: number
  isCurrency?: boolean
}

/** Each entry has a weight; one item is picked, quantity can be fixed or random. */
export interface WeightedLootEntry {
  itemId: string
  name: string
  weight: number            // relative weight (higher = more likely)
  quantity?: number         // fixed quantity, default 1
  minQuantity?: number      // OR random range
  maxQuantity?: number
  isCurrency?: boolean
}

export interface WeightedLootTableDropData {
  type: 'weightedLootTable'
  entries: WeightedLootEntry[]
}

export type DropData = SetDropData | RandomCountDropData | WeightedLootTableDropData

// ─── Trade item types (with price modes) ─────────────────────────────────────

/** Item for sale — static or dynamic pricing. */
export interface TradeSaleItem extends Omit<SaleItem, 'cost'> {
  priceMode: 'static' | 'dynamic'
  cost?: number             // required when priceMode === 'static'
  // dynamic: MarketManager.getPrice(id) is called at runtime
}

/** Item the entity buys from the player — static or dynamic pricing. */
export interface TradeBuyItem {
  itemId: string
  buyPriceMode: 'static' | 'dynamic'
  buyPrice?: number         // required when buyPriceMode === 'static'
  /**
   * Name of a method on GameManager to call after a successful sell of this item.
   * Follows the same dispatch pattern as ZoneDef.onEnter/onExit.
   * Example: 'onFishSold' → calls gameMgr.onFishSold(itemId, price)
   */
  onSellAction?: string
}

// ─── Workbench level definitions ──────────────────────────────────────────────

export interface WorkbenchLevel {
  level: number
  /** Recipe IDs available at this level (resolved from global RECIPES registry). */
  recipeIds: string[]
  /** What it costs to upgrade to the NEXT level. null = max level. */
  upgradeRequirement: BehaviorDataRef<Array<{ itemId: string; quantity: number }>> | null
}

export interface WorkbenchStationData {
  stationName: string
  levels: WorkbenchLevel[]
}

// ─── Behavior field types (per behavior) ─────────────────────────────────────

export interface ResourceNodeBehaviorDef {
  drops: BehaviorDataRef<DropData>
  cooldownMs?: number
  cooldownLabel?: string
}

export interface SellerBehaviorDef {
  dataMethod: 'inline' | 'preset'
  items?: TradeSaleItem[]   // inline
  shopId?: string           // preset
}

export interface BuyerBehaviorDef {
  dataMethod: 'inline' | 'preset'
  items?: TradeBuyItem[]    // inline
  shopId?: string           // preset
}

export interface CrafterBehaviorDef {
  dataMethod: 'inline' | 'preset'
  // inline: full station def with levels
  inlineContent?: WorkbenchStationData
  // preset: station preset ID from STATION_PRESETS
  presetId?: string
  // simple single-level (no upgrading): just a recipe list
  stationName?: string
  recipeIds?: string[]
}

export interface RefinerBehaviorDef {
  dataMethod: 'inline' | 'preset'
  inlineContent?: { stationName: string; formulas: RefinementFormula[] }
  presetId?: string
}

export interface MessengerBehaviorDef {
  title: string
  message: string
  closeLabel?: string
}

export interface MissionGiverBehaviorDef {
  dataMethod: 'inline' | 'preset'
  inlineContent?: any[]     // QuestDefinition[] — typed properly when quests module is stable
  presetId?: string
}

/** All behaviors that can be attached to an interactive entity. */
export interface InteractiveBehaviorSet {
  messenger?:    MessengerBehaviorDef
  missionGiver?: MissionGiverBehaviorDef
  crafter?:      CrafterBehaviorDef
  refiner?:      RefinerBehaviorDef
  seller?:       SellerBehaviorDef
  buyer?:        BuyerBehaviorDef
  dialogue?:     DialogueBehaviorDef
}

// ─── Entity definitions (discriminated union by type) ─────────────────────────

/** Base fields every entity definition has. */
interface EntityDefBase {
  id: string
  /** World position [x, y, z]. */
  pos: [number, number, number]
  /** Y-axis rotation in euler degrees. Default 0. */
  rotY?: number
  /** Scale [x, y, z]. Default [1,1,1]. */
  scale?: [number, number, number]
  /**
   * Optional: if set, GameManager stores the created entity/composite
   * as gameMgr[storyRole] for direct named access.
   * Use for unique story entities (the blacksmith, the quest giver, etc.)
   */
  storyRole?: string
  /**
   * Optional movement behavior — any entity type can move.
   * Registered with NPCMovementSystem by AreaManager at load time.
   */
  movement?: MovementBehaviorDef
}

/** Static GLB — placed once, no interaction. Walls, floors, props. */
export interface GlbEntityDef extends EntityDefBase {
  type: 'glb'
  src: string
}

/** Moving GLB — Tween yoyo between startPos and endPos. */
export interface MovingGlbEntityDef extends EntityDefBase {
  type: 'moving_glb'
  src: string
  startPos: [number, number, number]
  endPos: [number, number, number]
  durationMs: number
}

/** Resource node — click to receive drops, optional cooldown. */
export interface ResourceNodeEntityDef extends EntityDefBase {
  type: 'resource_node'
  label?: string
  hoverText?: string
  color?: [number, number, number, number]  // RGBA 0-1
  nodeScale?: [number, number, number]
  drops: BehaviorDataRef<DropData>
  cooldownMs?: number
  cooldownLabel?: string
}

/** Auto-collect coin/currency — player walks into trigger zone. */
export interface GoldCoinEntityDef extends EntityDefBase {
  type: 'gold_coin'
  amount: number
  triggerRadius?: number
}

/** Full interactive entity — any combination of behaviors via InteractiveComposite. */
export interface InteractiveEntityDef extends EntityDefBase {
  type: 'interactive'
  label: string
  hoverText: string
  color?: [number, number, number, number]  // RGBA 0-1
  entityScale?: [number, number, number]
  behaviors: InteractiveBehaviorSet
}

/** Fishing spot — cast/wait/catch entity. */
export interface FishingPondEntityDef extends EntityDefBase {
  type: 'fishing_pond'
  pondId: string
}

/** Loot chest — opens loot/choice/auto popup with defined drops. */
export interface ChestEntityDef extends EntityDefBase {
  type: 'chest'
  src?: string
  drops: BehaviorDataRef<DropData>
  /** Popup subtype. Default 'loot_window'. See LootBehaviorDef. */
  chestType?: 'auto' | 'loot_window' | 'choice'
  lootTitle?: string
  /** If false, chest can be re-opened infinitely. Default true (one-time). */
  oneTime?: boolean
}

/** Farm plot — specialized plant/grow/harvest entity. */
export interface FarmPlotBehaviorEntityDef extends EntityDefBase {
  type: 'farm_plot'
  plotId: string
  growthMs?: number
  outputItemId?: string
  outputName?: string
  outputQuantity?: number
  seedItemId?: string
  seedName?: string
}

/** Enemy NPC — has health + AI state machine. Box placeholder until GLB is available. */
export interface EnemyEntityDef extends EntityDefBase {
  type: 'enemy'
  /** Display label (billboard above entity). */
  label?: string
  color?: [number, number, number, number]
  entityScale?: [number, number, number]
  /** Health configuration — HP, faction, tags, loot, respawn. */
  health: HealthBehaviorDef
  /** AI configuration — aggro radius, attack radius, speed, etc. */
  ai: EnemyAIBehaviorDef
}

/** All supported entity definition types. */
export type EntityDef =
  | GlbEntityDef
  | MovingGlbEntityDef
  | ResourceNodeEntityDef
  | GoldCoinEntityDef
  | InteractiveEntityDef
  | FarmPlotBehaviorEntityDef
  | FishingPondEntityDef
  | ChestEntityDef
  | EnemyEntityDef

// ─── Zone definition ──────────────────────────────────────────────────────────

/**
 * A 3D trigger box within an area — no load/unload.
 * When player enters/exits, named callbacks fire on GameManager.
 */
export interface ZoneDef {
  id: string
  pos: [number, number, number]
  scale: [number, number, number]
  /** GameManager method name to call on zone enter, e.g. 'onEnterDesertZone' */
  onEnter?: string
  /** GameManager method name to call on zone exit */
  onExit?: string
  /** Show a visible debug box (for development). Default false. */
  debug?: boolean
}

// ─── Area definition ──────────────────────────────────────────────────────────

export interface SpawnPoint {
  pos: [number, number, number]
  look: [number, number, number]
}

/**
 * Complete definition of a loadable area.
 * Pass to AreaManager.loadArea() to instantiate the area in the DCL engine.
 */
export interface AreaDefinition {
  id: string
  spawnPoints: SpawnPoint[]
  entities: EntityDef[]
  zones?: ZoneDef[]
}
