/**
 * @file npcPopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0002
 * @status NEEDS_TEST
 *
 * InteractivePopupModule (exported as both NpcPopupModule and InteractivePopupModule).
 * Adaptive popup: reads which behaviors the active entity has, renders only relevant tabs.
 *
 * Tabs rendered by behavior present:
 *   [Talk]    — MessengerBehavior
 *   [Missions] — MissionGiverBehavior
 *   [Craft]   — CrafterBehavior (recipe list + ingredient check + Craft button)
 *   [Refine]  — RefinerBehavior (formula list + input/fuel/output + Refine button)
 *   [Buy]     — SellerBehavior
 *   [Sell]    — BuyerBehavior
 *
 * @changelog
 *   0.0001 - Initial. Talk/Missions/Buy/Sell tabs.
 *   0.0002 - Added Craft tab (CrafterBehavior) and Refine tab (RefinerBehavior).
 *            Renamed NpcComposite→InteractiveComposite. popup type npc→interactive.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'
import { QuestManager } from '../../quests/questState'
import { PlayerInventory } from '../../player/playerInventory'
import { MarketManager } from '../../economy/marketManager'
import { InteractiveComposite } from '../../npcs/npcComposite'
import {
  MissionGiverBehavior,
  SellerBehavior,
  BuyerBehavior,
  CrafterBehavior,
  RefinerBehavior,
  MessengerBehavior,
} from '../../npcs/npcBehaviors'
import { Recipe } from '../popupManager'

interface InteractivePopupModuleProps {
  popupMgr:  PopupManager
  questMgr:  QuestManager
  inventory: PlayerInventory
  market:    MarketManager
}

let _activeTab: string = ''
export function resetInteractiveTab(): void { _activeTab = '' }
// backward compat
export const resetNpcTab = resetInteractiveTab

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG_OVERLAY    = Color4.create(0,    0,    0,    0.85)
const BG_WINDOW     = Color4.create(0.06, 0.06, 0.08, 0.97)
const BG_TITLEBAR   = Color4.create(0.10, 0.10, 0.14, 1)
const BG_TAB_ACTIVE = Color4.create(0.20, 0.40, 0.65, 1)
const BG_TAB_IDLE   = Color4.create(0.10, 0.12, 0.18, 1)
const BG_BODY       = Color4.create(0.05, 0.06, 0.09, 1)
const BG_CLOSE      = Color4.create(0.30, 0.12, 0.12, 1)
const BG_ACCEPT     = Color4.create(0.18, 0.48, 0.22, 1)
const BG_TURNIN     = Color4.create(0.48, 0.32, 0.08, 1)
const BG_ROW        = Color4.create(0.10, 0.12, 0.18, 1)
const BG_ROW_SEL    = Color4.create(0.18, 0.28, 0.45, 1)
const BG_ING_OK     = Color4.create(0.08, 0.20, 0.10, 1)
const BG_ING_MISS   = Color4.create(0.22, 0.07, 0.07, 1)
const BG_CRAFT_ON   = Color4.create(0.18, 0.48, 0.22, 1)
const BG_CRAFT_OFF  = Color4.create(0.18, 0.18, 0.20, 1)
const CLR_HEADER    = Color4.create(0.90, 0.88, 1.00, 1)
const CLR_WHITE     = Color4.White()
const CLR_MUTED     = Color4.create(0.58, 0.60, 0.70, 1)
const CLR_GOLD      = Color4.create(1,    0.85, 0.10, 1)
const CLR_GREEN     = Color4.create(0.45, 0.92, 0.50, 1)
const CLR_PHASE     = Color4.create(0.80, 0.95, 1.00, 1)
const CLR_OK        = Color4.create(0.40, 0.90, 0.45, 1)
const CLR_MISS      = Color4.create(0.95, 0.35, 0.35, 1)

// ─── Main Component ───────────────────────────────────────────────────────────

export function InteractivePopupModule({ popupMgr, questMgr, inventory, market }: InteractivePopupModuleProps) {
  if (popupMgr.popupType !== 'interactive' || !popupMgr.activeEntity) return null

  const entity = popupMgr.activeEntity as InteractiveComposite
  const tabs: string[] = []
  if (entity.messenger)    tabs.push('Talk')
  if (entity.missionGiver) tabs.push('Missions')
  if (entity.crafter)      tabs.push('Craft')
  if (entity.refiner)      tabs.push('Refine')
  if (entity.seller)       tabs.push('Buy')
  if (entity.buyer)        tabs.push('Sell')

  if (tabs.length === 0) { popupMgr.closeInteractivePopup(); return null }
  if (!tabs.includes(_activeTab)) _activeTab = tabs[0]

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute', position: { top: 0, left: 0 },
        width: '100%', height: '100%',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      uiBackground={{ color: BG_OVERLAY }}
    >
      <UiEntity
        uiTransform={{ width: 580, flexDirection: 'column', alignItems: 'stretch' }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title bar */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 46,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: { left: 18, right: 12 },
          }}
          uiBackground={{ color: BG_TITLEBAR }}
        >
          <Label value={entity.displayName.toUpperCase()} fontSize={18} color={CLR_HEADER} />
          <Button
            value="X  Close"
            fontSize={13}
            uiTransform={{ width: 90, height: 30 }}
            uiBackground={{ color: BG_CLOSE }}
            onMouseDown={() => { popupMgr.closeInteractivePopup(); resetInteractiveTab() }}
          />
        </UiEntity>

        {/* Tabs */}
        {tabs.length > 1 && (
          <UiEntity
            uiTransform={{ width: '100%', height: 38, flexDirection: 'row', padding: { left: 10, right: 10, top: 5 } }}
          >
            {tabs.map((tab, i) => (
              <Button
                key={i.toString()}
                value={tab}
                fontSize={13}
                uiTransform={{ width: 86, height: 30, margin: { right: 5 } }}
                uiBackground={{ color: tab === _activeTab ? BG_TAB_ACTIVE : BG_TAB_IDLE }}
                onMouseDown={() => { _activeTab = tab }}
              />
            ))}
          </UiEntity>
        )}

        {/* Body */}
        <UiEntity
          uiTransform={{
            width: '100%', flexDirection: 'column',
            padding: { left: 14, right: 14, top: 12, bottom: 18 },
            minHeight: 200,
          }}
          uiBackground={{ color: BG_BODY }}
        >
          {_activeTab === 'Talk'     && entity.messenger    && <TalkTab    b={entity.messenger} />}
          {_activeTab === 'Missions' && entity.missionGiver && <MissionsTab b={entity.missionGiver} questMgr={questMgr} inventory={inventory} market={market} popupMgr={popupMgr} />}
          {_activeTab === 'Craft'    && entity.crafter      && <CraftTab   b={entity.crafter} inventory={inventory} popupMgr={popupMgr} />}
          {_activeTab === 'Refine'   && entity.refiner      && <RefineTab  b={entity.refiner} inventory={inventory} popupMgr={popupMgr} />}
          {_activeTab === 'Buy'      && entity.seller       && <BuyTab     b={entity.seller} inventory={inventory} popupMgr={popupMgr} />}
          {_activeTab === 'Sell'     && entity.buyer        && <SellTab    b={entity.buyer} inventory={inventory} popupMgr={popupMgr} />}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// Backward-compat export
export const NpcPopupModule = InteractivePopupModule

// ─── Talk Tab ─────────────────────────────────────────────────────────────────

function TalkTab({ b }: { b: MessengerBehavior }) {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value={b.title} fontSize={18} color={CLR_HEADER} uiTransform={{ margin: { bottom: 12 } }} />
      <Label value={b.message} fontSize={14} color={CLR_WHITE} textAlign="middle-left" uiTransform={{ width: '100%' }} />
    </UiEntity>
  )
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────

function MissionsTab({ b, questMgr, inventory, market, popupMgr }: {
  b: MissionGiverBehavior; questMgr: QuestManager; inventory: PlayerInventory
  market: MarketManager; popupMgr: PopupManager
}) {
  const available   = b.getAvailableQuests(questMgr)
  const active      = b.getActiveQuests(questMgr)
  const completable = b.getCompletableQuests(questMgr)
  const turnedIn    = b.questDefinitions.filter(d => questMgr.isTurnedIn(d.id))

  if (available.length === 0 && active.length === 0 && completable.length === 0 && turnedIn.length === 0) {
    return <Label value="No quests available right now." fontSize={15} color={CLR_MUTED} textAlign="middle-center" />
  }

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {completable.map((def, i) => (
        <UiEntity key={`c${i}`} uiTransform={{ width: '100%', flexDirection: 'column', padding: { all: 10 }, margin: { bottom: 8 } }} uiBackground={{ color: BG_ROW }}>
          <Label value={`✓  ${def.title}`} fontSize={16} color={CLR_GREEN} uiTransform={{ margin: { bottom: 6 } }} />
          <Label value="Quest complete! Claim your reward." fontSize={13} color={CLR_MUTED} uiTransform={{ margin: { bottom: 10 } }} />
          {def.reward?.gold && <Label value={`Reward: +${def.reward.gold}g${def.reward.stats ? ' + XP' : ''}`} fontSize={13} color={CLR_GOLD} uiTransform={{ margin: { bottom: 10 } }} />}
          <Button value="Turn In" fontSize={15} uiTransform={{ width: 130, height: 36 }} uiBackground={{ color: BG_TURNIN }}
            onMouseDown={() => { const r = b.turnInQuest(def.id, questMgr, inventory, market); if (r?.gold) popupMgr.showFloat(`Quest complete! +${r.gold}g`, CLR_GOLD, 3000) }} />
        </UiEntity>
      ))}

      {active.map((def, i) => {
        const phase = questMgr.getPhase(def.id)
        const total = questMgr.getTotalPhases(def.id)
        const desc  = questMgr.getCurrentPhaseDescription(def.id)
        const isLast = phase >= total - 1
        return (
          <UiEntity key={`a${i}`} uiTransform={{ width: '100%', flexDirection: 'column', padding: { all: 10 }, margin: { bottom: 8 } }} uiBackground={{ color: BG_ROW }}>
            <Label value={`★  ${def.title}`} fontSize={16} color={CLR_HEADER} uiTransform={{ margin: { bottom: 6 } }} />
            <Label value={`Phase ${phase + 1} / ${total}: ${desc}`} fontSize={13} color={isLast ? CLR_GREEN : CLR_PHASE} uiTransform={{ width: '100%', margin: { bottom: isLast ? 10 : 4 } }} textAlign="middle-left" />
            {isLast && def.reward?.gold && <Label value={`Reward: +${def.reward.gold}g${def.reward.stats ? ' + XP' : ''}`} fontSize={12} color={CLR_GOLD} uiTransform={{ margin: { bottom: 10 } }} />}
            {isLast && (
              <Button value="Claim Reward" fontSize={15} uiTransform={{ width: 150, height: 36 }} uiBackground={{ color: BG_TURNIN }}
                onMouseDown={() => {
                  const r = b.turnInQuest(def.id, questMgr, inventory, market)
                  if (r) {
                    if (r.gold) popupMgr.showFloat(`Quest complete! +${r.gold}g`, CLR_GOLD, 3000)
                    if (r.stats) { for (const [k, v] of Object.entries(r.stats!)) popupMgr.showFloat(`+${v} ${k.replace('_', ' ')}`, CLR_GREEN, 3000) }
                  }
                }} />
            )}
          </UiEntity>
        )
      })}

      {available.map((def, i) => (
        <UiEntity key={`v${i}`} uiTransform={{ width: '100%', flexDirection: 'column', padding: { all: 10 }, margin: { bottom: 8 } }} uiBackground={{ color: BG_ROW }}>
          <Label value={`○  ${def.title}`} fontSize={16} color={CLR_WHITE} uiTransform={{ margin: { bottom: 6 } }} />
          <Label value={def.description} fontSize={13} color={CLR_MUTED} uiTransform={{ width: '100%', margin: { bottom: 10 } }} textAlign="middle-left" />
          {def.reward?.gold && <Label value={`Reward: ${def.reward.gold}g${def.reward.stats ? ' + XP' : ''}`} fontSize={12} color={CLR_GOLD} uiTransform={{ margin: { bottom: 8 } }} />}
          <Button value="Accept Quest" fontSize={14} uiTransform={{ width: 140, height: 36 }} uiBackground={{ color: BG_ACCEPT }}
            onMouseDown={() => { b.acceptQuest(def.id, questMgr); popupMgr.showFloat(`Quest accepted: ${def.title}`, CLR_GREEN, 2500) }} />
        </UiEntity>
      ))}

      {turnedIn.map((def, i) => (
        <UiEntity key={`t${i}`} uiTransform={{ width: '100%', height: 42, flexDirection: 'row', alignItems: 'center', padding: { left: 12 }, margin: { bottom: 6 } }} uiBackground={{ color: BG_ROW }}>
          <Label value={`✓✓  ${def.title}  — Complete`} fontSize={14} color={CLR_MUTED} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Craft Tab ────────────────────────────────────────────────────────────────

function CraftTab({ b, inventory, popupMgr }: { b: CrafterBehavior; inventory: PlayerInventory; popupMgr: PopupManager }) {
  // Auto-select first recipe if nothing selected
  if (!b.selectedRecipeId && b.recipes.length > 0) b.selectedRecipeId = b.recipes[0].id
  if (!b.activeCategory && b.recipes.length > 0) b.activeCategory = b.recipes[0].category ?? ''

  const categories  = b.getCategories()
  const visibleRecs = categories.length > 0 ? b.getRecipesForCategory(b.activeCategory) : b.recipes
  const selected    = b.getSelectedRecipe()
  const canCraft    = selected ? b.canCraft(selected, inventory) : false

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {/* Category tabs */}
      {categories.length > 1 && (
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { bottom: 8 } }}>
          {categories.map((cat, i) => (
            <Button key={i.toString()} value={cat} fontSize={12}
              uiTransform={{ width: 100, height: 26, margin: { right: 5 } }}
              uiBackground={{ color: cat === b.activeCategory ? BG_TAB_ACTIVE : BG_TAB_IDLE }}
              onMouseDown={() => { b.activeCategory = cat; b.selectedRecipeId = b.getRecipesForCategory(cat)[0]?.id ?? '' }} />
          ))}
        </UiEntity>
      )}

      {/* Recipe list */}
      {visibleRecs.map((recipe, i) => {
        const isSel = recipe.id === b.selectedRecipeId
        const brief = `${recipe.ingredients.map(ing => `${ing.quantity}×${ing.name}`).join(' + ')} → ${recipe.output.quantity}×${recipe.output.name}`
        return (
          <UiEntity key={i.toString()}
            uiTransform={{ width: '100%', height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: { left: 10, right: 10 }, margin: { bottom: 4 } }}
            uiBackground={{ color: isSel ? BG_ROW_SEL : BG_ROW }}
          >
            <UiEntity uiTransform={{ flexDirection: 'column' }}>
              <Label value={recipe.name} fontSize={14} color={CLR_WHITE} />
              <Label value={brief} fontSize={11} color={CLR_MUTED} />
            </UiEntity>
            {!isSel && (
              <Button value="▶" fontSize={14} uiTransform={{ width: 32, height: 28 }}
                uiBackground={{ color: BG_TAB_IDLE }}
                onMouseDown={() => { b.selectedRecipeId = recipe.id }} />
            )}
          </UiEntity>
        )
      })}

      {/* Selected recipe detail */}
      {selected && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { top: 10 }, padding: { top: 10, bottom: 6, left: 10, right: 10 } }} uiBackground={{ color: BG_ROW }}>
          <Label value={`Crafting: ${selected.name}`} fontSize={15} color={CLR_HEADER} uiTransform={{ margin: { bottom: 8 } }} />
          <UiEntity uiTransform={{ flexDirection: 'row', flexWrap: 'wrap', margin: { bottom: 8 } }}>
            {selected.ingredients.map((ing, i) => {
              const have = inventory.getCount(ing.itemId)
              const met  = have >= ing.quantity
              return (
                <UiEntity key={i.toString()}
                  uiTransform={{ width: 120, height: 72, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: { right: 8, bottom: 4 }, padding: { all: 6 } }}
                  uiBackground={{ color: met ? BG_ING_OK : BG_ING_MISS }}>
                  <Label value={ing.name}            fontSize={12} color={CLR_WHITE} textAlign="middle-center" />
                  <Label value={`Need ×${ing.quantity}`} fontSize={11} color={CLR_MUTED} uiTransform={{ margin: { top: 3 } }} textAlign="middle-center" />
                  <Label value={`Have ×${have}`}     fontSize={11} color={CLR_GOLD} uiTransform={{ margin: { top: 2 } }} textAlign="middle-center" />
                  <Label value={met ? '✓' : '✗'}    fontSize={14} color={met ? CLR_OK : CLR_MISS} uiTransform={{ margin: { top: 3 } }} textAlign="middle-center" />
                </UiEntity>
              )
            })}
          </UiEntity>
          <Label value={`Makes: ${selected.output.name} ×${selected.output.quantity}`} fontSize={13} color={CLR_WHITE} uiTransform={{ margin: { bottom: 10 } }} />
          <Button
            value={canCraft ? 'CRAFT' : 'Missing ingredients'}
            fontSize={16} uiTransform={{ width: 220, height: 42 }}
            uiBackground={{ color: canCraft ? BG_CRAFT_ON : BG_CRAFT_OFF }}
            onMouseDown={() => {
              if (!canCraft) return
              const ok = b.craft(selected.id, inventory)
              if (ok) {
                popupMgr.showFloat(`Crafted: ${selected.name} ×${selected.output.quantity}`, CLR_GREEN, 2000)
                popupMgr.closeInteractivePopup()
              }
            }} />
        </UiEntity>
      )}
    </UiEntity>
  )
}

// ─── Refine Tab ───────────────────────────────────────────────────────────────

function RefineTab({ b, inventory, popupMgr }: { b: RefinerBehavior; inventory: PlayerInventory; popupMgr: PopupManager }) {
  if (!b.selectedFormulaId && b.formulas.length > 0) b.selectedFormulaId = b.formulas[0].id
  const selected   = b.getSelectedFormula()
  const canRefine  = selected ? b.canRefine(selected, inventory) : false

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {/* Formula list */}
      {b.formulas.map((formula, i) => {
        const isSel = formula.id === b.selectedFormulaId
        const brief = `${formula.inputQuantity}×${formula.inputName} + ${formula.fuelQuantity}×${formula.fuelName} → ${formula.outputQuantity}×${formula.outputName}`
        return (
          <UiEntity key={i.toString()}
            uiTransform={{ width: '100%', height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: { left: 10, right: 10 }, margin: { bottom: 4 } }}
            uiBackground={{ color: isSel ? BG_ROW_SEL : BG_ROW }}
          >
            <UiEntity uiTransform={{ flexDirection: 'column' }}>
              <Label value={formula.name} fontSize={14} color={CLR_WHITE} />
              <Label value={brief} fontSize={11} color={CLR_MUTED} />
            </UiEntity>
            {!isSel && (
              <Button value="▶" fontSize={14} uiTransform={{ width: 32, height: 28 }}
                uiBackground={{ color: BG_TAB_IDLE }}
                onMouseDown={() => { b.selectedFormulaId = formula.id }} />
            )}
          </UiEntity>
        )
      })}

      {/* Selected formula detail */}
      {selected && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { top: 10 }, padding: { all: 10 } }} uiBackground={{ color: BG_ROW }}>
          <Label value={selected.name} fontSize={15} color={CLR_HEADER} uiTransform={{ margin: { bottom: 10 } }} />
          {[
            { label: 'Input', itemId: selected.inputItemId, name: selected.inputName, qty: selected.inputQuantity },
            { label: 'Fuel',  itemId: selected.fuelItemId,  name: selected.fuelName,  qty: selected.fuelQuantity  },
          ].map((row, i) => {
            const have = inventory.getCount(row.itemId)
            const met  = have >= row.qty
            return (
              <UiEntity key={i.toString()}
                uiTransform={{ width: '100%', height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: { left: 8, right: 8 }, margin: { bottom: 5 } }}
                uiBackground={{ color: met ? BG_ING_OK : BG_ING_MISS }}>
                <Label value={`${row.label}: ${row.name} ×${row.qty}`} fontSize={13} color={CLR_WHITE} />
                <Label value={`Have: ×${have}  ${met ? '✓' : '✗'}`} fontSize={13} color={met ? CLR_OK : CLR_MISS} />
              </UiEntity>
            )
          })}
          <Label value={`→ Output: ${selected.outputName} ×${selected.outputQuantity}`} fontSize={14} color={CLR_GREEN} uiTransform={{ margin: { top: 8, bottom: 10 } }} />
          <Button
            value={canRefine ? `SMELT` : 'Need materials'}
            fontSize={16} uiTransform={{ width: 200, height: 42 }}
            uiBackground={{ color: canRefine ? BG_CRAFT_ON : BG_CRAFT_OFF }}
            onMouseDown={() => {
              if (!canRefine) return
              const ok = b.refine(selected.id, inventory)
              if (ok) {
                popupMgr.showFloat(`Refined: ${selected.outputName} ×${selected.outputQuantity}`, CLR_GREEN, 2000)
                popupMgr.closeInteractivePopup()
              }
            }} />
        </UiEntity>
      )}
    </UiEntity>
  )
}

// ─── Buy Tab ──────────────────────────────────────────────────────────────────

function BuyTab({ b, inventory, popupMgr }: { b: SellerBehavior; inventory: PlayerInventory; popupMgr: PopupManager }) {
  const gold = inventory.getCurrency('gold')
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value={`Gold: ${gold}g`} fontSize={13} color={CLR_GOLD} uiTransform={{ margin: { bottom: 10 } }} />
      {b.items.map((item, i) => {
        const canBuy = inventory.canAfford(item.cost, item.currencyKey ?? 'gold')
        const qty    = item.quantity ?? 1
        return (
          <UiEntity key={i.toString()}
            uiTransform={{ width: '100%', height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: { left: 10, right: 10 }, margin: { bottom: 6 } }}
            uiBackground={{ color: BG_ROW }}>
            <UiEntity uiTransform={{ flexDirection: 'column' }}>
              <Label value={qty > 1 ? `${item.name} ×${qty}` : item.name} fontSize={15} color={CLR_WHITE} />
              {item.description && <Label value={item.description} fontSize={11} color={CLR_MUTED} />}
            </UiEntity>
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <Label value={`${item.cost}g`} fontSize={14} color={canBuy ? CLR_GOLD : CLR_MUTED} uiTransform={{ margin: { right: 10 } }} />
              <Button value={canBuy ? 'BUY' : 'Need gold'} fontSize={13} uiTransform={{ width: 90, height: 32 }}
                uiBackground={{ color: canBuy ? BG_ACCEPT : Color4.create(0.2, 0.2, 0.2, 1) }}
                onMouseDown={() => { if (!canBuy) return; const ok = b.buy(item.id, inventory); if (ok) popupMgr.showFloat(`Bought: ${item.name}`, CLR_WHITE) }} />
            </UiEntity>
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

// ─── Sell Tab ─────────────────────────────────────────────────────────────────

function SellTab({ b, inventory, popupMgr }: { b: BuyerBehavior; inventory: PlayerInventory; popupMgr: PopupManager }) {
  const sellable = b.getBuyableItems(inventory)
  if (sellable.length === 0) {
    return <Label value="Nothing to sell here." fontSize={15} color={CLR_MUTED} textAlign="middle-center" uiTransform={{ margin: { top: 20 } }} />
  }
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {sellable.map(({ item, price }, i) => (
        <UiEntity key={i.toString()}
          uiTransform={{ width: '100%', height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: { left: 10, right: 10 }, margin: { bottom: 6 } }}
          uiBackground={{ color: BG_ROW }}>
          <Label value={`${item.name}  ×${item.quantity}`} fontSize={15} color={CLR_WHITE} />
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
            <Label value={`${price}g`} fontSize={13} color={CLR_GOLD} uiTransform={{ margin: { right: 10 } }} />
            <Button value="SELL 1" fontSize={13} uiTransform={{ width: 80, height: 32 }} uiBackground={{ color: BG_TURNIN }}
              onMouseDown={() => { const ok = b.sell(item.itemId, inventory); if (ok) popupMgr.showFloat(`Sold: ${item.name}  +${price}g`, CLR_GOLD) }} />
          </UiEntity>
        </UiEntity>
      ))}
    </UiEntity>
  )
}
