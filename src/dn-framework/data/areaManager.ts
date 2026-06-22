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

import {
  engine, Entity, Transform, GltfContainer, Tween, EasingFunction, TweenSequence, TweenLoop,
  MeshRenderer, MeshCollider, Material, TextShape, Billboard, ColliderLayer,
  pointerEventsSystem, InputAction,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'

import { DataManager } from './dataManager'
import {
  AreaDefinition, EntityDef, ZoneDef,
  ResourceNodeEntityDef, GoldCoinEntityDef,
  InteractiveEntityDef, FarmPlotBehaviorEntityDef,
  FishingPondEntityDef, ChestEntityDef, EnemyEntityDef,
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
  DialogueBehavior,
  LootBehavior,
  FarmPlotBehavior,
  MovementBehavior,
  HealthBehavior,
  EnemyAIBehavior,
} from '../npcs/npcBehaviors'
import { registerFarmPlot, registerMovingEntity, registerEnemyEntity } from '../systems/worldSystems'
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
    let spawnedEntity: Entity | null = null
    let spawnedComposite: any = null

    switch (def.type) {
      case 'glb':           spawnedEntity = this._spawnGlb(def); break
      case 'moving_glb':    this._spawnMovingGlb(def); break
      case 'resource_node': spawnedEntity = this._spawnResourceNode(def); break
      case 'gold_coin':     this._spawnGoldCoin(def); break
      case 'interactive':   { const r = this._spawnInteractive(def); spawnedEntity = r?.entity ?? null; spawnedComposite = r?.composite ?? null; break }
      case 'farm_plot':     this._spawnFarmPlot(def); break
      case 'fishing_pond':  this._spawnFishingPond(def); break
      case 'chest':         spawnedEntity = this._spawnChest(def); break
      case 'enemy':         this._spawnEnemy(def); break
      default:
        console.error(`[AreaManager] Unknown entity type:`, (def as any).type)
    }

    // Register movement behavior on any entity that has one
    if (def.movement && spawnedEntity !== null) {
      const behavior = new MovementBehavior(def.movement)
      const t = Transform.getMutableOrNull(spawnedEntity)
      if (t) {
        behavior.spawnPos = { x: t.position.x, y: t.position.y, z: t.position.z }
      } else {
        behavior.spawnPos = { x: def.pos[0], y: def.pos[1], z: def.pos[2] }
      }
      registerMovingEntity(spawnedEntity, behavior, spawnedComposite)
    }
  }

  private _spawnGlb(def: GlbEntityDef): Entity {
    const e = engine.addEntity()
    GltfContainer.create(e, { src: def.src })
    Transform.create(e, {
      position: toVec3(def.pos),
      rotation: Quaternion.fromEulerDegrees(0, def.rotY ?? 0, 0),
      scale: def.scale ? toVec3(def.scale) : Vector3.One()
    })
    this._staticEntities.push(e)
    this._storeStoryRole(def, e)
    return e
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

  private _spawnResourceNode(def: ResourceNodeEntityDef): Entity | null {
    const rawDropData = this.dataMgr.resolveDropData(def.drops)
    if (!rawDropData) {
      console.error(`[AreaManager] resource_node '${def.id}': could not resolve drop data`)
      return null
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
    return e
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

  private _spawnInteractive(def: InteractiveEntityDef): { entity: Entity; composite: InteractiveComposite } {
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
      // Per-item sell action map: itemId → gameMgr method name
      const onSellActions = new Map<string, string>()

      if (buyerDef.dataMethod === 'inline' && buyerDef.items) {
        for (const item of buyerDef.items) {
          acceptedTypes.push(item.itemId)
          if (item.buyPriceMode === 'static') priceMap[item.itemId] = item.buyPrice ?? 0
          if (item.onSellAction) onSellActions.set(item.itemId, item.onSellAction)
        }
      } else if (buyerDef.dataMethod === 'preset' && buyerDef.shopId) {
        const preset = this.dataMgr.resolveShopPreset(buyerDef.shopId)
        if (preset?.buyItems) {
          for (const item of preset.buyItems) {
            acceptedTypes.push(item.itemId)
            if (item.buyPriceMode === 'static') priceMap[item.itemId] = item.buyPrice ?? 0
            if (item.onSellAction) onSellActions.set(item.itemId, item.onSellAction)
          }
        }
      }

      // Build onSell callback: dispatches to named GameManager method per item sold
      const onSellCallback = onSellActions.size > 0
        ? (itemId: string, price: number) => {
            const action = onSellActions.get(itemId)
            if (action && typeof (this.gameMgr as any)[action] === 'function') {
              ;(this.gameMgr as any)[action](itemId, price)
            }
          }
        : undefined

      composite.buyer = new BuyerBehavior(
        acceptedTypes,
        (itemId) => priceMap[itemId] ?? this.gameMgr.market.getPrice(itemId),
        'gold',
        onSellCallback
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

    // Dialogue
    if (def.behaviors.dialogue) {
      composite.dialogue = new DialogueBehavior(def.behaviors.dialogue)
    }

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

    return { entity: e, composite }
  }

  private _spawnFarmPlot(def: FarmPlotBehaviorEntityDef): void {
    const behavior = new FarmPlotBehavior({
      plotId:         def.plotId,
      growthMs:       def.growthMs,
      outputItemId:   def.outputItemId,
      outputName:     def.outputName,
      outputQuantity: def.outputQuantity,
      seedItemId:     def.seedItemId,
      seedName:       def.seedName,
    }, this.gameMgr)

    const pos = toVec3(def.pos)

    // Invisible interaction collider (click target — no MeshRenderer)
    const interactEntity = engine.addEntity()
    Transform.create(interactEntity, {
      position: Vector3.create(pos.x, 0.25, pos.z),
      scale: Vector3.create(4.8, 0.5, 4.8),
    })
    MeshCollider.setBox(interactEntity)

    // Visual GLB entity (no collision — swap src freely)
    const visualEntity = engine.addEntity()
    Transform.create(visualEntity, { position: Vector3.create(pos.x, 0, pos.z), scale: Vector3.One() })
    GltfContainer.create(visualEntity, {
      src: FarmPlotBehavior.GLB_EMPTY,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      visibleMeshesCollisionMask:   ColliderLayer.CL_NONE,
    })

    // Billboard label
    const labelEntity = engine.addEntity()
    Transform.create(labelEntity, { position: Vector3.create(pos.x, 2.4, pos.z) })
    TextShape.create(labelEntity, {
      text: 'Empty Plot\n[E] Plant',
      fontSize: 2.2,
      textColor: { r: 1, g: 1, b: 1, a: 1 },
      textWrapping: false,
    })
    Billboard.create(labelEntity)
    this._miscEntities.push(labelEntity)

    // Click handler on invisible collider
    pointerEventsSystem.onPointerDown(
      { entity: interactEntity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Farm Plot', maxDistance: 8 } },
      () => behavior.openPopup(this.gameMgr)
    )

    // Register with FarmSystem for growth ticks + GLB swaps
    registerFarmPlot(behavior, visualEntity)

    this._miscEntities.push(interactEntity, visualEntity)
    console.log(`[AreaManager] farm_plot '${def.id}' (${def.plotId}): FarmPlotBehavior active`)
  }

  private _spawnFishingPond(def: FishingPondEntityDef): void {
    // Fishing pond uses specialized setup — stays legacy until FishingSpotBehavior lands.
    console.log(`[AreaManager] fishing_pond '${def.id}': delegated to legacy setupFishingPond()`)
  }

  private _spawnChest(def: ChestEntityDef): Entity {
    const rawDropData = this.dataMgr.resolveDropData(def.drops)
    const drops = rawDropData ? resolveDrops(rawDropData) : []

    const behavior = new LootBehavior({
      chestType: def.chestType ?? 'loot_window',
      lootTitle: def.lootTitle,
      oneTime:   def.oneTime,
    })
    behavior.drops = drops

    const pos   = toVec3(def.pos)
    const scale = def.scale ? toVec3(def.scale) : Vector3.create(2.5, 2.5, 2.5)
    const color = Color4.create(0.85, 0.62, 0.08, 1)  // gold chest color

    const e = createInteractableBox({
      pos,
      scale,
      color,
      label: def.lootTitle ?? 'Chest',
      hoverText: 'Open Chest [E]',
      onClick: () => {
        if (this.gameMgr.popupMgr.isPopupOpen()) return
        behavior.onInteract(this.gameMgr)
      }
    })

    this._miscEntities.push(e)
    this._storeStoryRole(def, e)
    console.log(`[AreaManager] chest '${def.id}' (${def.chestType ?? 'loot_window'}): LootBehavior active`)
    return e
  }

  private _spawnEnemy(def: EnemyEntityDef): void {
    const pos   = toVec3(def.pos)
    const scale = def.entityScale ? toVec3(def.entityScale) : Vector3.create(1.8, 1.8, 1.8)
    const color = toColor4(def.color)

    const e = engine.addEntity()
    Transform.create(e, { position: pos, scale })
    MeshRenderer.setBox(e)
    MeshCollider.setBox(e)
    Material.setPbrMaterial(e, { albedoColor: color })

    // Billboard label
    if (def.label) {
      const label = engine.addEntity()
      Transform.create(label, { position: Vector3.create(pos.x, pos.y + scale.y * 0.5 + 0.8, pos.z) })
      TextShape.create(label, {
        text: def.label,
        fontSize: 2.0,
        textColor: Color4.create(1, 0.3, 0.3, 1),
        textWrapping: false,
      })
      Billboard.create(label)
      this._miscEntities.push(label)
    }

    const health = new HealthBehavior(def.health)
    const ai     = new EnemyAIBehavior(def.ai)
    ai.spawnPos  = { x: pos.x, y: pos.y, z: pos.z }

    const entityId = def.id

    // Register with EnemyAISystem
    registerEnemyEntity(e, entityId, health, ai, { x: scale.x, y: scale.y, z: scale.z })

    this._miscEntities.push(e)
    this._storeStoryRole(def, e)
    console.log(`[AreaManager] enemy '${def.id}' (${def.health.maxHp}HP, tags: ${def.health.tags?.join(',') ?? 'none'}): registered`)
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
