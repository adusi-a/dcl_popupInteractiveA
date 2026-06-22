/**
 * uiMgr.tsx — React-ECS UI for dcl_popupInteractiveA
 *
 * Popup overlays (in Z-order):
 *   FloatNotificationModule  — drift-up item/gold pickups
 *   LootWindowModule         — chest loot windows
 *   ChoicePopupModule        — binary choice (Chest C)
 *   FarmPlotPopupModule      — farm plot plant/harvest
 *   FishingPopupModule       — fishing cast countdown + catch
 *   NoticeBoardModule        — static text/signs
 *   InteractivePopupModule   — adaptive behavior-driven (Craft/Refine/Buy/Sell/Missions/Talk)
 *
 * Side panel: PlayerHud (gold + fishing_xp + inventory items)
 *
 * NOTE: CraftingPopupModule removed — Smelter/Workbench/Trader/Fishmonger
 *       now use InteractivePopupModule via their behavior tabs.
 */

import ReactEcs, { Label, UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { GameManager } from './gameMgr'
import { CoordsModule } from './dn-framework/ui/modules/coordsModule'
import { PlayerInfoModule } from './dn-framework/ui/modules/playerInfoModule'
import { FloatNotificationModule } from './dn-framework/ui/modules/floatNotificationModule'
import { LootWindowModule } from './dn-framework/ui/modules/lootWindowModule'
import { ChoicePopupModule } from './dn-framework/ui/modules/choicePopupModule'
import { FarmPlotPopupModule } from './dn-framework/ui/modules/farmPlotPopupModule'
import { FishingPopupModule } from './dn-framework/ui/modules/fishingPopupModule'
import { NoticeBoardModule } from './dn-framework/ui/modules/noticeBoardModule'
import { InteractivePopupModule } from './dn-framework/ui/modules/npcPopupModule'

export function uiSetup(gameMgr: GameManager): void {
  ReactEcsRenderer.setUiRenderer(() => [
    CoordsModule(gameMgr),
    PlayerInfoModule(gameMgr),

    FloatNotificationModule({ popupMgr: gameMgr.popupMgr }),
    LootWindowModule({ popupMgr: gameMgr.popupMgr }),
    ChoicePopupModule({ popupMgr: gameMgr.popupMgr }),
    FarmPlotPopupModule({ popupMgr: gameMgr.popupMgr }),
    FishingPopupModule({ popupMgr: gameMgr.popupMgr }),
    NoticeBoardModule({ popupMgr: gameMgr.popupMgr }),
    InteractivePopupModule({
      popupMgr:  gameMgr.popupMgr,
      questMgr:  gameMgr.questMgr,
      inventory: gameMgr.playerInventory,
      market:    gameMgr.market,
      gameMgr:   gameMgr,
    }),

    PlayerHud({ gameMgr }),
    HintPanel(),
  ])
}

// ─── Player HUD ───────────────────────────────────────────────────────────────

function PlayerHud({ gameMgr }: { gameMgr: GameManager }) {
  const inv     = gameMgr.playerInventory
  const items   = inv.getAllItems()
  const gold    = inv.getCurrency('gold')
  const fishXp  = inv.getStat('fishing_xp')
  const CLR_SEC = Color4.create(0.8,  0.75, 0.5,  1)
  const CLR_GLD = Color4.create(1,    0.85, 0.1,  1)
  const CLR_XP  = Color4.create(0.5,  0.88, 0.35, 1)
  const CLR_MUT = Color4.create(0.5,  0.5,  0.55, 1)

  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: '280px', right: '16px' }, width: 220, flexDirection: 'column', alignItems: 'flex-start', padding: { top: 10, left: 12, right: 12, bottom: 12 } }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.82) }}
    >
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 6 } }}>
        <Label value="Gold" fontSize={13} color={CLR_SEC} />
        <Label value={`${gold}g`} fontSize={13} color={CLR_GLD} />
      </UiEntity>
      {fishXp > 0 && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 6 } }}>
          <Label value="Fishing XP" fontSize={12} color={CLR_SEC} />
          <Label value={`${fishXp}`} fontSize={12} color={CLR_XP} />
        </UiEntity>
      )}
      <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 4, bottom: 8 } }} uiBackground={{ color: Color4.create(0.2, 0.25, 0.35, 1) }} />
      <Label value="-- Inventory --" fontSize={13} color={CLR_SEC} uiTransform={{ margin: { bottom: 8 } }} />
      {items.length === 0 && <Label value="(empty)" fontSize={12} color={CLR_MUT} />}
      {items.map((item, idx) => (
        <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
          <Label value={item.name} fontSize={13} color={Color4.White()} />
          <Label value={`x${item.quantity}`} fontSize={13} color={CLR_GLD} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Hint Panel ───────────────────────────────────────────────────────────────

function HintPanel() {
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: '14px', left: '35%' }, width: 440, padding: { top: 8, left: 14, right: 14, bottom: 8 } }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <Label value="[E] Interact / Mine / Craft / Smelt / Fish   [X] Close" fontSize={13} color={Color4.create(0.7, 0.7, 0.75, 1)} textAlign="middle-center" />
    </UiEntity>
  )
}
