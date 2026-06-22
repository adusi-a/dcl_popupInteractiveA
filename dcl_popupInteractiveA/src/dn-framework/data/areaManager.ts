/**
 * @file areaManager.ts
 * @module DN DCL Framework / data
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * AreaManager — loads and unloads a defined area into the DCL engine.
 *
 * RESPONSIBILITIES:
 *   - Read an AreaDefinition and create DCL entities for each EntityDef
 *   - Track all created entity refs in typed arrays for clean unloadArea()
 *   - Activate ZoneDefs as TriggerArea entities
 *   - Store story-role entities on GameManager by storyRole key
 *
 * DOES NOT:
 *   - Define what entities exist or where (that's the AreaDefinition data)
 *   - Manage game state or popups (that's GameManager / PopupManager)
 *   - Resolve global preset lookups (that's DataManager)
 *
 * @changelog
 *   0.0001 - Initial. loadArea, unloadArea, zone activation, all EntityDef type handlers.
 */

import { engine, Entity, Transform, GltfContainer, Tween, EasingFunction, TweenSequence, TweenLoop } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'

import { DataManager } from './dataManager'
import {
  AreaDefinition, EntityDef, ZoneDef,
  ResourceNodeEntityDef, GoldCoinEntityDef,
  InteractiveEntityDef, FarmPlotEntityDef,
  FishingPondEntityDef, ChestEntityDef,
  GlbEntityDef, MovingGlbEntityDef,
  SetDropData, RandomCountDropData, WeightedLootTableDropData,
  SellerBehaviorDef, BuyerBehaviorDef,
  CrafterBehaviorDef, RefinerBehaviorDef
} from './areaTypes'

import {
  SimpleGiverBehavior, GiverDrop,
  SellerBehavior, BuyerBehavior, SaleItem,
  CrafterBehavior, RefinerBehavior,
  MessengerBehavior,
} from '../npcs/npcBehaviors'
import { InteractiveComposite, createInteractiveEntity, createInteractableBox } from '../npcs/npcComposite'
import { createTriggerZone } from '../triggers/triggerZone'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toVec3(arr: [number, number, number]): Vector3 {
  return Vector3.create(arr[0], arr[1], arr[2])
}

function toColor4(arr?: [number, number, number, number]): Color4 {
  return arr ? Color4.create(arr[0], arr[1], arr[2], arr[3]) : Color4.create(0.5, 0.5, 0.5, 1)
}

function resolveDrops(dropData: SetDropData | RandomCountDropData | WeightedLootTableDropData): GiverDrop[] {
  if (dropData.type === 'set') {
    return dropData.drops
  }
  if (dropData.type === 'randomCount') {
    const qty = dropData.min + Math.floor(Math.random() * (dropData.max - dropData.min + 1))
    return [{ itemId: dropData.itemId, name: dropData.name, quantity: qty, isCurrency: dropData.isCurrency }]
  }
  if (dropData.type === 'weightedLootTable') {
    const totalWeight = dropData.entries.reduce((sum, e) => sum + e.weight, 0)
    let roll = Math.random() * totalWeight
    for (const entry of dropData.entries) {
      roll -= entry.weight
      if (roll <= 0) {
        const qty = entry.minQuantity !== undefined && entry.maxQuantity !== undefined
          ? entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1))
          : (entry.quantity ?? 1)
        return [{ itemId: entry.itemId, name: entry.name, quantity: qty, isCurrency: entry.isCurrency }]
      }
    }
    // fallback: first entry
    const e = dropData.entries[0]
    return [{ itemId: e.itemId, name: e.name, quantity: e.quantity ?? 1, isCurrency: e.isCurrency }]
  }
  return []
}

// ─── AreaManager ───────────────────────────────────────────────────────────────

export class AreaManager {

  gameMgr: any
  dataMgr: DataManager

  // Tracked entity refs — all cleared on unloadArea()
  private _staticEntities:      Entity[] = []
  private _interactiveEntities: Entity[] = []
  private _resourceEntities:    Entity[] = []
  private _coinEntities:        Entity[] = []
  private _zoneEntities:        Entity[] = []
  private _miscEntities:        Entity[] = []

  currentAreaId: string = ''

  constructor(_gameMgr: any, _dataMgr: DataManager) {
    this.gameMgr = _gameMgr
    this.dataMgr = _dataMgr
  }

  // ── Public API ────────────────────────────────────────────────────────────

  loadArea(areaDef: AreaDefinition): void {
    this.currentAreaId = areaDef.id
    console.log(`[AreaManager] Loading area: ${areaDef.id} (${areaDef.entities.length} entities)`)

    for (const entityDef of areaDef.entities) {
      this._spawnEntity(entityDef)
    }

    if (areaDef.zones) {
      for (const zoneDef of areaDef.zones) {
        this._spawnZone(zoneDef)
      }
    }

    console.log(`[AreaManager] Area loaded: ${areaDef.id}`)
  }

  unloadArea(): void {
    console.log(`[AreaManager] Unloading area: ${this.currentAreaId}`)

    const allArrays = [
      this._staticEntities,
      this._interactiveEntities,
      this._resourceEntities,
      this._coinEntities,
      this._zoneEntities,
      this._miscEntities,
    ]

    for (const arr of allArrays) {
      for (const e of arr) {
        if (engine.getEntityOrNullByName !== undefined) engine.removeEntity(e)
        else engine.removeEntity(e)
      }
      arr.length = 0
    }

    // Clear any story-role refs stored on gameMgr
    // (gameMgr sets them — we just null them out on unload)
    this.currentAreaId = ''
    console.log('[AreaManager] Area unloaded')
  }

  // ── Entity spawners ───────────────────────────────────────────────────────

  private _spawnEntity(def: EntityDef): void {
    switch (def.type) {
      case 'glb':           this._spawnGlb(def); break
      case 'moving_glb':    this._spawnMovingGlb(def); break
      case 'resource_node': this._spawnResourceNode(def); break
      case 'gold_coin':     this._spawnGoldCoin(def); break
      case 'interactive':   this._spawnInteractive(def); break
      case 'farm_plot':     this._spawnFarmPlot(def); break
      case 'fishing_pond':  this._spawnFishingPond(def); break
      case 'chest':         this._spawnChest(def); break
      default:
        console.error(`[AreaManager] Unknown entity type:`, (def as any).type)
    }
  }

  private _spawnGlb(def: GlbEntityDef): void {
    const e = engine.addEntity()
    GltfContainer.create(e, { src: def.src })
    Transform.create(e, {
      position: toVec3(def.pos),
      rotation: Quaternion.fromEulerDegrees(0, def.rotY ?? 0, 0),
      scale: def.scale ? toVec3(def.scale) : Vector3.One()
    })
    this._staticEntities.push(e)
    this._storeStoryRole(def, e)
  }

  private _spawnMovingGlb(def: MovingGlbEntityDef): void {
    const e = engine.addEntity()
    GltfContainer.create(e, { src: def.src })
    const startPos = toVec3(def.startPos)
    const endPos   = toVec3(def.endPos)
    Transform.create(e, {
      position: startPos,
      rotation: Quaternion.fromEulerDegrees(0, def.rotY ?? 0, 0),
      scale: def.scale ? toVec3(def.scale) : Vector3.One()
    })
    Tween.create(e, {
      mode: Tween.Mode.Move({ start: startPos, end: endPos }),
      duration: def.durationMs,
      easingFunction: EasingFunction.EF_LINEAR,
    })
    TweenSequence.create(e, { sequence: [], loop: TweenLoop.TL_YOYO })
    this._staticEntities.push(e)
  }

  private _spawnResourceNode(def: ResourceNodeEntityDef): void {
    const rawDropData = this.dataMgr.resolveDropData(def.drops)
    if (!rawDropData) {
      console.error(`[AreaManager] resource_node '${def.id}': could not resolve drop data`)
      return
    }

    const drops = resolveDrops(rawDropData)
    const behavior = new SimpleGiverBehavior(drops, def.cooldownMs ?? 0, def.cooldownLabel)

    const e = createInteractableBox({
      pos: toVec3(def.pos),
      scale: def.nodeScale ? toVec3(def.nodeScale) : Vector3.create(2.0, 1.5, 2.0),
      color: toColor4(def.color),
      label: def.label ?? drops[0]?.name ?? 'Resource',
      hoverText: def.hoverText ?? 'Gather [E]',
      onClick: () => behavior.give(this.gameMgr.playerInventory, this.gameMgr.popupMgr)
    })

    this._resourceEntities.push(e)
    this._storeStoryRole(def, e)
  }

  private _spawnGoldCoin(def: GoldCoinEntityDef): void {
    const radius = def.triggerRadius ?? 1.5
    const amount = def.amount
    const pos = toVec3(def.pos)

    const zoneEntity = createTriggerZone(
      pos,
      Vector3.create(radius, radius, radius),
      () => {
        this.gameMgr.playerInventory.addCurrency(amount, 'gold')
        this.gameMgr.popupMgr.showFloat(`+${amount} Gold`)
        // Remove this coin entity on collect
        engine.removeEntity(zoneEntity)
        const idx = this._coinEntities.indexOf(zoneEntity)
        if (idx >= 0) this._coinEntities.splice(idx, 1)
      }
    )

    this._coinEntities.push(zoneEntity)
  }

  private _spawnInteractive(def: InteractiveEntityDef): void {
    const composite: InteractiveComposite = { displayName: def.label }

    // Messenger
    if (def.behaviors.messenger) {
      const m = def.behaviors.messenger
      composite.messenger = new MessengerBehavior(m.title, m.message, m.closeLabel)
    }

    // Seller
    if (def.behaviors.seller) {
      const sellerDef = def.behaviors.seller
      let saleItems: SaleItem[] = []
      if (sellerDef.dataMethod === 'inline' && sellerDef.items) {
        saleItems = sellerDef.items.map((i): SaleItem => ({
          id: i.id, name: i.name, description: i.description,
          category: i.category, quantity: i.quantity,
          cost: i.priceMode === 'static' ? (i.cost ?? 0)
                : this.gameMgr.market.getPrice(i.id),
          currencyKey: 'gold'
        }))
      } else if (sellerDef.dataMethod === 'preset' && sellerDef.shopId) {
        const preset = this.dataMgr.resolveShopPreset(sellerDef.shopId)
        if (preset?.sellItems) {
          saleItems = preset.sellItems.map((i): SaleItem => ({
            id: i.id, name: i.name, description: i.description,
            category: i.category, quantity: i.quantity,
            cost: i.priceMode === 'static' ? (i.cost ?? 0)
                  : this.gameMgr.market.getPrice(i.id),
            currencyKey: 'gold'
          }))
        }
      }
      composite.seller = new SellerBehavior(saleItems)
    }

    // Buyer
    if (def.behaviors.buyer) {
      const buyerDef = def.behaviors.buyer
      let acceptedTypes: string[] = []
      let priceMap: Record<string, number> = {}

      if (buyerDef.dataMethod === 'inline' && buyerDef.items) {
        for (const item of buyerDef.items) {
          acceptedTypes.push(item.itemId)
          if (item.buyPriceMode === 'static') priceMap[item.itemId] = item.buyPrice ?? 0
        }
      } else if (buyerDef.dataMethod === 'preset' && buyerDef.shopId) {
        const preset = this.dataMgr.resolveShopPreset(buyerDef.shopId)
        if (preset?.buyItems) {
          for (const item of preset.buyItems) {
            acceptedTypes.push(item.itemId)
            if (item.buyPriceMode === 'static') priceMap[item.itemId] = item.buyPrice ?? 0
          }
        }
      }

      composite.buyer = new BuyerBehavior(
        acceptedTypes,
        (itemId) => priceMap[itemId] ?? this.gameMgr.market.getPrice(itemId),
        'gold'
      )
    }

    // Crafter
    if (def.behaviors.crafter) {
      const crafterDef = def.behaviors.crafter
      let stationName = crafterDef.stationName ?? def.label
      let recipes = crafterDef.recipeIds
        ? this.dataMgr.resolveRecipes(crafterDef.recipeIds)
        : []

      if (crafterDef.dataMethod === 'preset' && crafterDef.presetId) {
        const preset = this.dataMgr.resolveStationPreset(crafterDef.presetId)
        if (preset) {
          stationName = preset.stationName
          // Use level 0 recipes for now (full leveling system: future sprint)
          if (preset.levels.length > 0) {
            recipes = this.dataMgr.resolveRecipes(preset.levels[0].recipeIds)
          }
        }
      }
      composite.crafter = new CrafterBehavior(stationName, recipes)
    }

    // Refiner
    if (def.behaviors.refiner) {
      const refinerDef = def.behaviors.refiner
      if (refinerDef.dataMethod === 'inline' && refinerDef.inlineContent) {
        composite.refiner = new RefinerBehavior(
          refinerDef.inlineContent.stationName,
          refinerDef.inlineContent.formulas
        )
      }
      // preset refiner: deferred (no station presets in this scene yet)
    }

    // MissionGiver: handled by existing entity files for now — deferred to full integration sprint

    const e = createInteractiveEntity({
      pos: toVec3(def.pos),
      scale: def.entityScale ? toVec3(def.entityScale) : undefined,
      color: toColor4(def.color),
      label: def.label,
      hoverText: def.hoverText,
      entity: composite,
      gameMgr: this.gameMgr,
    })

    this._interactiveEntities.push(e)

    // Store story role on gameMgr if defined
    if (def.storyRole) {
      ;(this.gameMgr as any)[def.storyRole] = composite
      ;(this.gameMgr as any)[`${def.storyRole}Entity`] = e
    }
  }

  private _spawnFarmPlot(def: FarmPlotEntityDef): void {
    // Farm plots use specialized setup — delegate to existing setupFarmPlots()
    // for now. Full AreaManager integration: future sprint once FarmPlotBehavior lands.
    console.log(`[AreaManager] farm_plot '${def.id}' (${def.plotId}): delegated to setupFarmPlots() — not yet AreaManager-native`)
  }

  private _spawnFishingPond(def: FishingPondEntityDef): void {
    // Fishing pond uses specialized setup — delegate to existing setupFishingPond()
    console.log(`[AreaManager] fishing_pond '${def.id}': delegated to setupFishingPond() — not yet AreaManager-native`)
  }

  private _spawnChest(def: ChestEntityDef): void {
    // Chests use specialized popup — delegate to existing setupChests() for now.
    // Full integration: replace when LootBehavior lands.
    console.log(`[AreaManager] chest '${def.id}': delegated to setupChests() — not yet AreaManager-native`)
  }

  // ── Zone spawner ──────────────────────────────────────────────────────────

  private _spawnZone(def: ZoneDef): void {
    const pos   = toVec3(def.pos)
    const scale = toVec3(def.scale)

    const e = createTriggerZone(
      pos, scale,
      () => {
        if (def.onEnter && typeof (this.gameMgr as any)[def.onEnter] === 'function') {
          ;(this.gameMgr as any)[def.onEnter]()
        }
      },
      () => {
        if (def.onExit && typeof (this.gameMgr as any)[def.onExit] === 'function') {
          ;(this.gameMgr as any)[def.onExit]()
        }
      },
      def.debug ?? false
    )

    this._zoneEntities.push(e)
  }

  // ── Story role helper ─────────────────────────────────────────────────────

  private _storeStoryRole(def: EntityDef, e: Entity): void {
    if (def.storyRole) {
      ;(this.gameMgr as any)[def.storyRole + 'Entity'] = e
    }
  }
}
