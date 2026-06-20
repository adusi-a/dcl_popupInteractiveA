/**
 * @file npcPopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Adaptive NPC popup for DCL SDK7 React-ECS.
 *
 * Reads which behaviors the active NPC has and renders only the relevant tabs:
 *   [Talk]    — MessengerBehavior present → shows static message text
 *   [Missions] — MissionGiverBehavior present → shows quest list
 *   [Buy]     — SellerBehavior present → shows items for sale
 *   [Sell]    — BuyerBehavior present → shows player's sellable items
 *
 * A fishing mission board with only MissionGiverBehavior shows one Missions tab.
 * A full NPC with all four behaviors shows all four tabs.
 *
 * This module needs access to QuestManager and PlayerInventory to render
 * missions and buy/sell tabs — pass them in via props from uiMgr.tsx.
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA behavior-system sprint.
 *            Missions tab fully implemented. Buy/Sell/Talk tab stubs included.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'
import { QuestManager } from '../../quests/questState'
import { PlayerInventory } from '../../player/playerInventory'
import { MarketManager } from '../../economy/marketManager'
import {
  NpcComposite,
  MissionGiverBehavior,
  SellerBehavior,
  BuyerBehavior,
  MessengerBehavior,
} from '../../npcs/npcBehaviors'

// re-export so we can reference from outside
export { NpcComposite }

interface NpcPopupModuleProps {
  popupMgr:  PopupManager
  questMgr:  QuestManager
  inventory: PlayerInventory
  market:    MarketManager
  // Internal active tab state — must be a mutable ref tracked outside (module-level var)
}

// ─── Tab state (module-level, resets on each open) ────────────────────────────
let _activeTab: string = ''

export function resetNpcTab(): void { _activeTab = '' }

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
const BG_QUEST_ROW  = Color4.create(0.10, 0.12, 0.18, 1)
const CLR_HEADER    = Color4.create(0.90, 0.88, 1.00, 1)
const CLR_WHITE     = Color4.White()
const CLR_MUTED     = Color4.create(0.58, 0.60, 0.70, 1)
const CLR_GOLD      = Color4.create(1,    0.85, 0.10, 1)
const CLR_GREEN     = Color4.create(0.45, 0.92, 0.50, 1)
const CLR_PHASE     = Color4.create(0.80, 0.95, 1.00, 1)

// ─── Main Component ───────────────────────────────────────────────────────────

export function NpcPopupModule({ popupMgr, questMgr, inventory, market }: NpcPopupModuleProps) {
  if (popupMgr.popupType !== 'npc' || !popupMgr.activeNpc) return null

  const npc = popupMgr.activeNpc as NpcComposite

  // Build tab list based on present behaviors
  const tabs: string[] = []
  if (npc.messenger)    tabs.push('Talk')
  if (npc.missionGiver) tabs.push('Missions')
  if (npc.seller)       tabs.push('Buy')
  if (npc.buyer)        tabs.push('Sell')

  if (tabs.length === 0) {
    // Nothing to show — close automatically
    popupMgr.closeNpcPopup()
    return null
  }

  // Set default tab on first open
  if (!tabs.includes(_activeTab)) _activeTab = tabs[0]

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%', height: '100%',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      uiBackground={{ color: BG_OVERLAY }}
    >
      <UiEntity
        uiTransform={{ width: 560, flexDirection: 'column', alignItems: 'stretch' }}
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
          <Label value={npc.displayName.toUpperCase()} fontSize={18} color={CLR_HEADER} />
          <Button
            value="X  Close"
            fontSize={13}
            uiTransform={{ width: 90, height: 30 }}
            uiBackground={{ color: BG_CLOSE }}
            onMouseDown={() => { popupMgr.closeNpcPopup(); resetNpcTab() }}
          />
        </UiEntity>

        {/* Tabs row (only shown when 2+ tabs) */}
        {tabs.length > 1 && (
          <UiEntity
            uiTransform={{
              width: '100%', height: 38,
              flexDirection: 'row',
              padding: { left: 10, right: 10, top: 5 },
            }}
          >
            {tabs.map((tab, i) => (
              <Button
                key={i.toString()}
                value={tab}
                fontSize={14}
                uiTransform={{ width: 100, height: 30, margin: { right: 6 } }}
                uiBackground={{ color: tab === _activeTab ? BG_TAB_ACTIVE : BG_TAB_IDLE }}
                onMouseDown={() => { _activeTab = tab }}
              />
            ))}
          </UiEntity>
        )}

        {/* Tab body */}
        <UiEntity
          uiTransform={{
            width: '100%', flexDirection: 'column',
            padding: { left: 14, right: 14, top: 12, bottom: 18 },
            minHeight: 180,
          }}
          uiBackground={{ color: BG_BODY }}
        >
          {_activeTab === 'Talk'     && npc.messenger    && <TalkTab    behavior={npc.messenger} />}
          {_activeTab === 'Missions' && npc.missionGiver && <MissionsTab behavior={npc.missionGiver} questMgr={questMgr} inventory={inventory} market={market} popupMgr={popupMgr} npc={npc} />}
          {_activeTab === 'Buy'      && npc.seller       && <BuyTab      behavior={npc.seller} inventory={inventory} popupMgr={popupMgr} />}
          {_activeTab === 'Sell'     && npc.buyer        && <SellTab     behavior={npc.buyer} inventory={inventory} popupMgr={popupMgr} />}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── Talk Tab ─────────────────────────────────────────────────────────────────

function TalkTab({ behavior }: { behavior: MessengerBehavior }) {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value={behavior.title} fontSize={18} color={CLR_HEADER} uiTransform={{ margin: { bottom: 12 } }} />
      <Label value={behavior.message} fontSize={14} color={CLR_WHITE} textAlign="middle-left" uiTransform={{ width: '100%' }} />
    </UiEntity>
  )
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────

interface MissionsTabProps {
  behavior:  MissionGiverBehavior
  questMgr:  QuestManager
  inventory: PlayerInventory
  market:    MarketManager
  popupMgr:  PopupManager
  npc:       NpcComposite
}

function MissionsTab({ behavior, questMgr, inventory, market, popupMgr, npc }: MissionsTabProps) {
  const available   = behavior.getAvailableQuests(questMgr)
  const active      = behavior.getActiveQuests(questMgr)
  const completable = behavior.getCompletableQuests(questMgr)
  const turnedIn    = behavior.questDefinitions.filter(d => questMgr.isTurnedIn(d.id))

  // Nothing at all
  if (available.length === 0 && active.length === 0 && completable.length === 0 && turnedIn.length === 0) {
    return <Label value="No quests available right now." fontSize={15} color={CLR_MUTED} textAlign="middle-center" />
  }

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>

      {/* Completable — turn in */}
      {completable.map((def, i) => (
        <UiEntity
          key={`c${i}`}
          uiTransform={{
            width: '100%', flexDirection: 'column',
            padding: { top: 10, bottom: 10, left: 12, right: 12 },
            margin: { bottom: 8 },
          }}
          uiBackground={{ color: BG_QUEST_ROW }}
        >
          <Label value={`✓  ${def.title}`} fontSize={16} color={CLR_GREEN} uiTransform={{ margin: { bottom: 6 } }} />
          <Label value="Quest complete! Claim your reward." fontSize={13} color={CLR_MUTED} uiTransform={{ margin: { bottom: 10 } }} />
          {def.reward?.gold && (
            <Label value={`Reward: +${def.reward.gold}g${def.reward.stats ? '  +XP' : ''}`} fontSize={13} color={CLR_GOLD} uiTransform={{ margin: { bottom: 10 } }} />
          )}
          <Button
            value="Turn In"
            fontSize={15}
            uiTransform={{ width: 130, height: 36 }}
            uiBackground={{ color: BG_TURNIN }}
            onMouseDown={() => {
              const reward = behavior.turnInQuest(def.id, questMgr, inventory, market)
              if (reward) {
                if (reward.gold) {
                  popupMgr.showFloat(`Quest complete! +${reward.gold}g`, CLR_GOLD, 3000)
                }
                if (reward.stats) {
                  for (const [k, v] of Object.entries(reward.stats)) {
                    popupMgr.showFloat(`+${v} ${k.replace('_', ' ')}`, CLR_GREEN, 3000)
                  }
                }
              }
            }}
          />
        </UiEntity>
      ))}

      {/* Active quests — show current phase */}
      {active.map((def, i) => {
        const phase      = questMgr.getPhase(def.id)
        const totalPhase = questMgr.getTotalPhases(def.id)
        const phaseDesc  = questMgr.getCurrentPhaseDescription(def.id)
        return (
          <UiEntity
            key={`a${i}`}
            uiTransform={{
              width: '100%', flexDirection: 'column',
              padding: { top: 10, bottom: 10, left: 12, right: 12 },
              margin: { bottom: 8 },
            }}
            uiBackground={{ color: BG_QUEST_ROW }}
          >
            <Label value={`★  ${def.title}`} fontSize={16} color={CLR_HEADER} uiTransform={{ margin: { bottom: 6 } }} />
            <Label
              value={`Phase ${phase + 1} / ${totalPhase}: ${phaseDesc}`}
              fontSize={13}
              color={CLR_PHASE}
              uiTransform={{ width: '100%', margin: { bottom: 4 } }}
              textAlign="middle-left"
            />
          </UiEntity>
        )
      })}

      {/* Available — accept */}
      {available.map((def, i) => (
        <UiEntity
          key={`v${i}`}
          uiTransform={{
            width: '100%', flexDirection: 'column',
            padding: { top: 10, bottom: 10, left: 12, right: 12 },
            margin: { bottom: 8 },
          }}
          uiBackground={{ color: BG_QUEST_ROW }}
        >
          <Label value={`○  ${def.title}`} fontSize={16} color={CLR_WHITE} uiTransform={{ margin: { bottom: 6 } }} />
          <Label value={def.description} fontSize={13} color={CLR_MUTED} uiTransform={{ width: '100%', margin: { bottom: 10 } }} textAlign="middle-left" />
          {def.reward?.gold && (
            <Label value={`Reward: ${def.reward.gold}g${def.reward.stats ? ' + XP' : ''}`} fontSize={12} color={CLR_GOLD} uiTransform={{ margin: { bottom: 8 } }} />
          )}
          <Button
            value="Accept Quest"
            fontSize={14}
            uiTransform={{ width: 140, height: 36 }}
            uiBackground={{ color: BG_ACCEPT }}
            onMouseDown={() => {
              behavior.acceptQuest(def.id, questMgr)
              popupMgr.showFloat(`Quest accepted: ${def.title}`, CLR_GREEN, 2500)
            }}
          />
        </UiEntity>
      ))}

      {/* Turned in quests */}
      {turnedIn.map((def, i) => (
        <UiEntity
          key={`t${i}`}
          uiTransform={{
            width: '100%', height: 42,
            flexDirection: 'row', alignItems: 'center',
            padding: { left: 12 }, margin: { bottom: 6 },
          }}
          uiBackground={{ color: BG_QUEST_ROW }}
        >
          <Label value={`✓✓  ${def.title}  — Complete`} fontSize={14} color={CLR_MUTED} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Buy Tab (stub — fully implement when first seller NPC is built) ──────────

function BuyTab({ behavior, inventory, popupMgr }: { behavior: SellerBehavior, inventory: PlayerInventory, popupMgr: PopupManager }) {
  const gold = inventory.getCurrency('gold')
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <Label value={`Gold: ${gold}g`} fontSize={14} color={CLR_GOLD} uiTransform={{ margin: { bottom: 12 } }} />
      {behavior.items.map((item, i) => {
        const canBuy = inventory.canAfford(item.cost, item.currencyKey ?? 'gold')
        return (
          <UiEntity
            key={i.toString()}
            uiTransform={{
              width: '100%', height: 48,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              padding: { left: 10, right: 10 }, margin: { bottom: 6 },
            }}
            uiBackground={{ color: BG_QUEST_ROW }}
          >
            <UiEntity uiTransform={{ flexDirection: 'column' }}>
              <Label value={item.name} fontSize={15} color={CLR_WHITE} />
              {item.description && <Label value={item.description} fontSize={11} color={CLR_MUTED} />}
            </UiEntity>
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <Label value={`${item.cost}g`} fontSize={14} color={canBuy ? CLR_GOLD : CLR_MUTED} uiTransform={{ margin: { right: 10 } }} />
              <Button
                value={canBuy ? 'BUY' : 'Need gold'}
                fontSize={13}
                uiTransform={{ width: 90, height: 32 }}
                uiBackground={{ color: canBuy ? BG_ACCEPT : Color4.create(0.2, 0.2, 0.2, 1) }}
                onMouseDown={() => {
                  if (!canBuy) return
                  const ok = behavior.buy(item.itemId, inventory)
                  if (ok) popupMgr.showFloat(`Bought: ${item.name}`, CLR_WHITE)
                }}
              />
            </UiEntity>
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

// ─── Sell Tab (stub — fully implement when first buyer NPC is built) ──────────

function SellTab({ behavior, inventory, popupMgr }: { behavior: BuyerBehavior, inventory: PlayerInventory, popupMgr: PopupManager }) {
  const sellable = behavior.getBuyableItems(inventory)
  if (sellable.length === 0) {
    return <Label value="Nothing to sell here." fontSize={15} color={CLR_MUTED} textAlign="middle-center" uiTransform={{ margin: { top: 20 } }} />
  }
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {sellable.map(({ item, price }, i) => (
        <UiEntity
          key={i.toString()}
          uiTransform={{
            width: '100%', height: 48,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: { left: 10, right: 10 }, margin: { bottom: 6 },
          }}
          uiBackground={{ color: BG_QUEST_ROW }}
        >
          <Label value={`${item.name}  ×${item.quantity}`} fontSize={15} color={CLR_WHITE} />
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
            <Label value={`${price}g each`} fontSize={13} color={CLR_GOLD} uiTransform={{ margin: { right: 10 } }} />
            <Button
              value="SELL 1"
              fontSize={13}
              uiTransform={{ width: 80, height: 32 }}
              uiBackground={{ color: BG_TURNIN }}
              onMouseDown={() => {
                const ok = behavior.sell(item.itemId, inventory)
                if (ok) popupMgr.showFloat(`Sold: ${item.name}  +${price}g`, CLR_GOLD)
              }}
            />
          </UiEntity>
        </UiEntity>
      ))}
    </UiEntity>
  )
}
