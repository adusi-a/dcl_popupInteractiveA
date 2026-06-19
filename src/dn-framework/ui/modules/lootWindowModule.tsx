/**
 * @file lootWindowModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Loot window UI module for DCL SDK7 React-ECS.
 * Formal "you received" modal — shows a list of items received from a chest.
 * "Take All" button adds items to inventory via the onTakeAll callback.
 *
 * Appearance:
 *   - Full-screen dark overlay (blocks world interaction)
 *   - Centered window: title + scrollable item list + "Take All" button
 *   - Dark navy window style
 *   - Up to ~6 items displayed cleanly; more will overflow (add scroll later)
 *
 * Usage (in uiMgr layout builder):
 *   LootWindowModule({ popupMgr })
 *
 * Trigger:
 *   popupMgr.openLootWindow(
 *     [{ itemId: 'sword', name: 'Iron Sword', quantity: 1 }, ...],
 *     'Found in the chest:',
 *     (items) => items.forEach(i => playerInventory.addItem(i.itemId, i.name, i.quantity))
 *   )
 *
 * @changelog
 *   0.0001 - Initial. Portparadox had the window shell but no wired loot data/callbacks.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'

interface LootWindowModuleProps {
  popupMgr: PopupManager
}

// Palette
const BG_OVERLAY   = Color4.create(0,    0,    0,    0.82)
const BG_WINDOW    = Color4.create(0.06, 0.08, 0.14, 0.97)
const BG_ITEM_ROW  = Color4.create(0.12, 0.14, 0.20, 1)
const BG_TAKE_BTN  = Color4.create(0.18, 0.48, 0.22, 1)
const BG_CLOSE_BTN = Color4.create(0.35, 0.18, 0.18, 1)
const CLR_TITLE    = Color4.create(0.95, 0.90, 0.70, 1)  // warm off-white
const CLR_NAME     = Color4.White()
const CLR_QTY      = Color4.create(1,    0.85, 0.1,  1)  // gold

/**
 * Loot window module. Returns null when not active.
 */
export function LootWindowModule({ popupMgr }: LootWindowModuleProps) {
  if (popupMgr.popupType !== 'loot') return null

  const items = popupMgr.pendingLootItems

  return (
    // Full-screen overlay
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: BG_OVERLAY }}
    >
      {/* Window */}
      <UiEntity
        uiTransform={{
          width: 520,
          flexDirection: 'column',
          alignItems: 'center',
          padding: { top: 28, bottom: 28, left: 30, right: 30 },
        }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title */}
        <UiEntity
          uiTransform={{ width: '100%', height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: { bottom: 16 } }}
        >
          <Label value={popupMgr.lootTitle} fontSize={24} color={CLR_TITLE} textAlign="middle-center" />
        </UiEntity>

        {/* Item rows */}
        {items.map((item, idx) => (
          <UiEntity
            key={idx.toString()}
            uiTransform={{
              width: '100%',
              height: 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: { bottom: 8 },
              padding: { left: 14, right: 14 },
            }}
            uiBackground={{ color: BG_ITEM_ROW }}
          >
            <Label value={item.name} fontSize={20} color={CLR_NAME} textAlign="middle-left" />
            <Label value={`x${item.quantity}`} fontSize={22} color={CLR_QTY} textAlign="middle-right" />
          </UiEntity>
        ))}

        {/* Buttons row */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            margin: { top: 20 },
          }}
        >
          {/* Take All button — runs callback then closes */}
          <Button
            value="Take All"
            fontSize={18}
            uiTransform={{ width: 180, height: 46, margin: { right: 16 } }}
            uiBackground={{ color: BG_TAKE_BTN }}
            onMouseDown={() => popupMgr.takeLoot()}
          />

          {/* Leave (ESC equivalent) — closes WITHOUT giving items */}
          <Button
            value="Leave (X)"
            fontSize={16}
            uiTransform={{ width: 130, height: 46 }}
            uiBackground={{ color: BG_CLOSE_BTN }}
            onMouseDown={() => popupMgr.closePopup()}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
