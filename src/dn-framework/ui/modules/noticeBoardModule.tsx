/**
 * @file noticeBoardModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Static text display popup for DCL SDK7 React-ECS.
 *
 * Purpose: show any static text to the player — signs, lore, rules, map notes,
 * brief NPC messages. The player reads it and closes. That's it.
 *
 * NOT a mission board (no quest lists, no accept/reject, no state changes).
 * NOT a dialogue system (no branching, no callbacks).
 *
 * Usage:
 *   popupMgr.openNoticeBoard({ title: 'Rules of the Mine', bodyText: 'No open flames.\nHard hats required.' })
 *   popupMgr.openNoticeBoard({ title: 'Map', bodyText: 'Fishmonger is northwest.\nPond is far west.', closeLabel: 'Got it' })
 *
 * @changelog
 *   0.0001 - Built for dcl_popupInteractiveA. Intentionally minimal.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'

interface NoticeBoardModuleProps {
  popupMgr: PopupManager
}

// ─── Palette — parchment/notice style ────────────────────────────────────────
const BG_OVERLAY = Color4.create(0,    0,    0,    0.78)
const BG_WINDOW  = Color4.create(0.10, 0.08, 0.04, 0.97)
const BG_TITLE   = Color4.create(0.16, 0.12, 0.05, 1)
const BG_BODY    = Color4.create(0.07, 0.05, 0.02, 1)
const BG_CLOSE   = Color4.create(0.30, 0.20, 0.06, 1)
const CLR_TITLE  = Color4.create(1.00, 0.90, 0.55, 1)
const CLR_BODY   = Color4.create(0.92, 0.86, 0.70, 1)

export function NoticeBoardModule({ popupMgr }: NoticeBoardModuleProps) {
  if (popupMgr.popupType !== 'notice_board' || popupMgr.noticeBoardRef == null) return null

  const notice = popupMgr.noticeBoardRef

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
        uiTransform={{ width: 500, flexDirection: 'column', alignItems: 'stretch' }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 48,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
          uiBackground={{ color: BG_TITLE }}
        >
          <Label
            value={notice.title.toUpperCase()}
            fontSize={20}
            color={CLR_TITLE}
            textAlign="middle-center"
          />
        </UiEntity>

        {/* Body text */}
        <UiEntity
          uiTransform={{
            width: '100%',
            padding: { top: 24, bottom: 24, left: 28, right: 28 },
            minHeight: 80,
          }}
          uiBackground={{ color: BG_BODY }}
        >
          <Label
            value={notice.bodyText}
            fontSize={15}
            color={CLR_BODY}
            textAlign="middle-left"
            uiTransform={{ width: '100%' }}
          />
        </UiEntity>

        {/* Close button */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 56,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
          uiBackground={{ color: BG_TITLE }}
        >
          <Button
            value={notice.closeLabel ?? 'Close'}
            fontSize={16}
            uiTransform={{ width: 160, height: 38 }}
            uiBackground={{ color: BG_CLOSE }}
            onMouseDown={() => popupMgr.closeNoticeBoard()}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
