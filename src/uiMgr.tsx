/**
 * uiMgr.tsx — React-ECS UI for dcl_popupInteractiveA
 *
 * Layout:
 *   [top-left]     CoordsModule — X/Y/Z + rotation debug
 *   [top-right]    PlayerInfoModule — player name
 *   [mid-right]    PlayerHud — currency (gold) + stats (fishing_xp) + items
 *   [lower-right]  FloatNotificationModule — drift-up notifications
 *   [overlay]      LootWindowModule, ChoicePopupModule, CraftingPopupModule,
 *                  FarmPlotPopupModule, FishingPopupModule, NoticeBoardModule,
 *                  NpcPopupModule (behavior-driven adaptive)
 *   [bottom-center] HintPanel
 */

import ReactEcs, { Label, UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { GameManager } from './gameMgr'
import { CoordsModule } from './dn-framework/ui/modules/coordsModule'
import { PlayerInfoModule } from './dn-framework/ui/modules/playerInfoModule'
import { FloatNotificationModule } from './dn-framework/ui/modules/floatNotificationModule'
import { LootWindowModule } from './dn-framework/ui/modules/lootWindowModule'
import { ChoicePopupModule } from './dn-framework/ui/modules/choicePopupModule'
import { CraftingPopupModule } from './dn-framework/ui/modules/craftingPopupModule'
import { FarmPlotPopupModule } from './dn-framework/ui/modules/farmPlotPopupModule'
import { FishingPopupModule } from './dn-framework/ui/modules/fishingPopupModule'
import { NoticeBoardModule } from './dn-framework/ui/modules/noticeBoardModule'
import { NpcPopupModule } from './dn-framework/ui/modules/npcPopupModule'

export function uiSetup(gameMgr: GameManager): void {
  ReactEcsRenderer.setUiRenderer(() => [
    // ── Debug HUD ──────────────────────────────────────────────────────────────
    CoordsModule(gameMgr),
    PlayerInfoModule(gameMgr),

    // ── Popup overlays ─────────────────────────────────────────────────────────
    FloatNotificationModule({ popupMgr: gameMgr.popupMgr }),
    LootWindowModule({ popupMgr: gameMgr.popupMgr }),
    ChoicePopupModule({ popupMgr: gameMgr.popupMgr }),
    CraftingPopupModule({ popupMgr: gameMgr.popupMgr, inventory: gameMgr.playerInventory }),
    FarmPlotPopupModule({ popupMgr: gameMgr.popupMgr }),
    FishingPopupModule({ popupMgr: gameMgr.popupMgr }),
    NoticeBoardModule({ popupMgr: gameMgr.popupMgr }),
    NpcPopupModule({
      popupMgr:  gameMgr.popupMgr,
      questMgr:  gameMgr.questMgr,
      inventory: gameMgr.playerInventory,
      market:    gameMgr.market,
    }),

    // ── Side panels ────────────────────────────────────────────────────────────
    PlayerHud({ gameMgr }),
    HintPanel(),
  ])
}

// ─── Player HUD ───────────────────────────────────────────────────────────────
// Shows: gold (currency) | fishing_xp (stat) | inventory items
// Gold and stats are now separate from inventory items in v0.0002.

function PlayerHud({ gameMgr }: { gameMgr: GameManager }) {
  const inv      = gameMgr.playerInventory
  const items    = inv.getAllItems()
  const gold     = inv.getCurrency('gold')
  const fishXp   = inv.getStat('fishing_xp')
  const hasStats = fishXp > 0

  const CLR_SECTION = Color4.create(0.8, 0.75, 0.5,  1)
  const CLR_GOLD    = Color4.create(1,   0.85, 0.1,  1)
  const CLR_XP      = Color4.create(0.5, 0.88, 0.35, 1)
  const CLR_ITEM    = Color4.White()
  const CLR_QTY     = Color4.create(1,   0.85, 0.1,  1)
  const CLR_MUTED   = Color4.create(0.5, 0.5,  0.55, 1)

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '280px', right: '16px' },
        width: 220,
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: { top: 10, left: 12, right: 12, bottom: 12 },
      }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.82) }}
    >
      {/* Currency row */}
      <UiEntity
        uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 6 } }}
      >
        <Label value="Gold" fontSize={13} color={CLR_SECTION} />
        <Label value={`${gold}g`} fontSize={13} color={CLR_GOLD} />
      </UiEntity>

      {/* Stats (only shown when non-zero) */}
      {hasStats && (
        <UiEntity
          uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 6 } }}
        >
          <Label value="Fishing XP" fontSize={12} color={CLR_SECTION} />
          <Label value={`${fishXp}`} fontSize={12} color={CLR_XP} />
        </UiEntity>
      )}

      {/* Divider */}
      <UiEntity
        uiTransform={{ width: '100%', height: 1, margin: { top: 4, bottom: 8 } }}
        uiBackground={{ color: Color4.create(0.2, 0.25, 0.35, 1) }}
      />

      {/* Item header */}
      <Label value="-- Inventory --" fontSize={13} color={CLR_SECTION} uiTransform={{ margin: { bottom: 8 } }} />

      {items.length === 0 && (
        <Label value="(empty)" fontSize={12} color={CLR_MUTED} />
      )}

      {items.map((item, idx) => (
        <UiEntity
          key={idx.toString()}
          uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}
        >
          <Label value={item.name} fontSize={13} color={CLR_ITEM} />
          <Label value={`x${item.quantity}`} fontSize={13} color={CLR_QTY} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Hint Panel ───────────────────────────────────────────────────────────────

function HintPanel() {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '14px', left: '35%' },
        width: 400,
        padding: { top: 8, left: 14, right: 14, bottom: 8 },
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <Label
        value="[E] Interact / Mine / Craft / Fish   [X] Close Popup"
        fontSize={13}
        color={Color4.create(0.7, 0.7, 0.75, 1)}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}
