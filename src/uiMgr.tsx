/**
 * uiMgr.tsx — React-ECS UI for dcl_popupInteractiveA
 *
 * Layout (all absolute-positioned, layered):
 *   [top-left]    CoordsModule  — X/Y/Z position + Y rotation (key debug tool)
 *   [top-right]   PlayerInfoModule — player name
 *   [mid-right]   InventoryPanel — items collected so far
 *   [lower-right] FloatNotificationModule — drift-up loot notifications
 *   [overlay]     LootWindowModule — "you received" chest modal
 *   [overlay]     ChoicePopupModule — binary item choice
 *   [bottom-center] HintPanel — control hints
 */

import ReactEcs, { Label, UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { GameManager } from './gameMgr'
import { CoordsModule } from './dn-framework/ui/modules/coordsModule'
import { PlayerInfoModule } from './dn-framework/ui/modules/playerInfoModule'
import { FloatNotificationModule } from './dn-framework/ui/modules/floatNotificationModule'
import { LootWindowModule } from './dn-framework/ui/modules/lootWindowModule'
import { ChoicePopupModule } from './dn-framework/ui/modules/choicePopupModule'

export function uiSetup(gameMgr: GameManager): void {
  ReactEcsRenderer.setUiRenderer(() => [
    // ── Debug HUD (always visible) ────────────────────────────────────────────
    CoordsModule(gameMgr),
    PlayerInfoModule(gameMgr),

    // ── Popups (absolute overlays — show/hide based on popupType) ────────────
    FloatNotificationModule({ popupMgr: gameMgr.popupMgr }),
    LootWindowModule({ popupMgr: gameMgr.popupMgr }),
    ChoicePopupModule({ popupMgr: gameMgr.popupMgr }),

    // ── Persistent side panels ────────────────────────────────────────────────
    InventoryPanel({ gameMgr }),
    HintPanel(),
  ])
}

// ─── Inventory Panel ──────────────────────────────────────────────────────────

function InventoryPanel({ gameMgr }: { gameMgr: GameManager }) {
  const items = gameMgr.playerInventory.getAllItems()

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
      <Label
        value="— Inventory —"
        fontSize={13}
        color={Color4.create(0.8, 0.75, 0.5, 1)}
        uiTransform={{ margin: { bottom: 8 } }}
      />
      {items.length === 0 && (
        <Label value="(empty)" fontSize={12} color={Color4.create(0.5, 0.5, 0.55, 1)} />
      )}
      {items.map((item, idx) => (
        <UiEntity
          key={idx.toString()}
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            margin: { bottom: 4 },
          }}
        >
          <Label value={item.name} fontSize={13} color={Color4.White()} />
          <Label value={`x${item.quantity}`} fontSize={13} color={Color4.create(1, 0.85, 0.1, 1)} />
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
        width: 360,
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 8, left: 14, right: 14, bottom: 8 },
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <Label
        value="[E] Open Chest   [X] Close Popup"
        fontSize={13}
        color={Color4.create(0.7, 0.7, 0.75, 1)}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}
