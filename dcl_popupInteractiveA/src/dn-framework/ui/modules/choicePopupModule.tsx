/**
 * @file choicePopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Binary choice popup UI module for DCL SDK7 React-ECS.
 * Presents two item cards side by side — player picks one, the other is abandoned.
 *
 * Appearance:
 *   - Full-screen dark overlay
 *   - Centered "Choose One" header with note "(The other will be left behind)"
 *   - Two item cards side by side with name, optional description, and "Choose" button
 *   - No cancel/ESC — the choice is forced (can still press X key via interactionUiSystem
 *     which calls closePopup() — items are NOT given on raw close)
 *
 * Usage (in uiMgr layout builder):
 *   ChoicePopupModule({ popupMgr })
 *
 * Trigger:
 *   popupMgr.openChoicePopup(
 *     { itemId: 'sword', name: 'Enchanted Sword', description: '+25 ATK' },
 *     { itemId: 'shield', name: 'Shield of Fortitude', description: '+50 DEF' },
 *     (chosen) => playerInventory.addItem(chosen.itemId, chosen.name, 1)
 *   )
 *
 * @changelog
 *   0.0001 - Initial. Completely new — no equivalent in existing fragments.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager, ChoiceItem } from '../popupManager'

interface ChoicePopupModuleProps {
  popupMgr: PopupManager
}

// Palette
const BG_OVERLAY   = Color4.create(0,    0,    0,    0.88)
const BG_WINDOW    = Color4.create(0.06, 0.08, 0.14, 0.97)
const BG_CARD      = Color4.create(0.10, 0.13, 0.20, 1)
const BG_CARD_HOVER = Color4.create(0.15, 0.20, 0.30, 1)  // use on active card later
const BG_CHOOSE_BTN = Color4.create(0.18, 0.38, 0.60, 1)
const CLR_HEADER   = Color4.create(0.95, 0.90, 0.70, 1)
const CLR_SUB      = Color4.create(0.60, 0.60, 0.65, 1)
const CLR_ITEM_NAME = Color4.White()
const CLR_DESC     = Color4.create(0.70, 0.72, 0.78, 1)

/**
 * Choice popup module. Returns null when not active.
 */
export function ChoicePopupModule({ popupMgr }: ChoicePopupModuleProps) {
  if (popupMgr.popupType !== 'choice') return null

  const a = popupMgr.choiceItemA!
  const b = popupMgr.choiceItemB!

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
      {/* Main window */}
      <UiEntity
        uiTransform={{
          width: 720,
          flexDirection: 'column',
          alignItems: 'center',
          padding: { top: 32, bottom: 32, left: 30, right: 30 },
        }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Header */}
        <UiEntity
          uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center', margin: { bottom: 24 } }}
        >
          <Label value="Choose One" fontSize={30} color={CLR_HEADER} textAlign="middle-center" />
          <Label
            value="The other will be left behind"
            fontSize={14}
            color={CLR_SUB}
            textAlign="middle-center"
            uiTransform={{ margin: { top: 6 } }}
          />
        </UiEntity>

        {/* Two item cards */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'stretch',
            justifyContent: 'space-between',
          }}
        >
          {ItemCard({ item: a, popupMgr })}
          {ItemCard({ item: b, popupMgr })}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: ChoiceItem
  popupMgr: PopupManager
}

function ItemCard({ item, popupMgr }: ItemCardProps) {
  return (
    <UiEntity
      uiTransform={{
        width: 310,
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 24, bottom: 24, left: 20, right: 20 },
      }}
      uiBackground={{ color: BG_CARD }}
    >
      {/* Item name */}
      <Label
        value={item.name}
        fontSize={22}
        color={CLR_ITEM_NAME}
        textAlign="middle-center"
        uiTransform={{ margin: { bottom: 12 } }}
      />

      {/* Description (optional) */}
      {item.description != null && (
        <Label
          value={item.description}
          fontSize={14}
          color={CLR_DESC}
          textAlign="middle-center"
          uiTransform={{ margin: { bottom: 20 } }}
        />
      )}

      {/* Choose button */}
      <Button
        value="Choose This"
        fontSize={17}
        uiTransform={{ width: 160, height: 44 }}
        uiBackground={{ color: BG_CHOOSE_BTN }}
        onMouseDown={() => popupMgr.makeChoice(item)}
      />
    </UiEntity>
  )
}
