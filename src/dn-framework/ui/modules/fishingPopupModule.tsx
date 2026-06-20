/**
 * @file fishingPopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Fishing cast popup for DCL SDK7 React-ECS.
 * Two phases driven by FishingCastLive (read every frame):
 *
 *   casting — rod/bait labels + live countdown progress bar + "Forfeit" button
 *   caught  — fish name (with weight) + approx gold value + COLLECT button
 *
 * Popup stays until the player clicks COLLECT or Forfeit (bait already consumed).
 *
 * Usage: register in uiMgr.tsx alongside other popup modules.
 *   FishingPopupModule({ popupMgr: gameMgr.popupMgr })
 *
 * @changelog
 *   0.0001 - Built for dcl_popupInteractiveA fishing sprint.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'

interface FishingPopupModuleProps {
  popupMgr: PopupManager
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG_OVERLAY   = Color4.create(0,    0,    0,    0.82)
const BG_WINDOW    = Color4.create(0.04, 0.08, 0.14, 0.97)
const BG_TITLE     = Color4.create(0.05, 0.11, 0.20, 1)
const BG_BODY      = Color4.create(0.04, 0.07, 0.13, 1)
const BG_BAR_BG    = Color4.create(0.10, 0.14, 0.22, 1)
const BG_BAR_FILL  = Color4.create(0.18, 0.55, 0.90, 1)
const BG_COLLECT   = Color4.create(0.18, 0.50, 0.18, 1)
const BG_FORFEIT   = Color4.create(0.30, 0.12, 0.12, 1)
const BG_INFO_ROW  = Color4.create(0.08, 0.12, 0.20, 1)
const CLR_HEADER   = Color4.create(0.75, 0.92, 1.00, 1)
const CLR_WHITE    = Color4.White()
const CLR_MUTED    = Color4.create(0.55, 0.65, 0.75, 1)
const CLR_FISH     = Color4.create(0.50, 1.00, 0.55, 1)
const CLR_GOLD     = Color4.create(1,    0.85, 0.10, 1)
const CLR_CAUGHT   = Color4.create(0.40, 1.00, 0.50, 1)

export function FishingPopupModule({ popupMgr }: FishingPopupModuleProps) {
  if (popupMgr.popupType !== 'fishing' || popupMgr.fishingRef == null) return null

  const cast = popupMgr.fishingRef
  const now  = Date.now()
  const elapsed     = now - cast.castStartTime
  const progressPct = Math.min(100, Math.round((elapsed / cast.castDurationMs) * 100))
  const remainingS  = Math.max(0, Math.round((cast.castDurationMs - elapsed) / 1000))

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
        uiTransform={{ width: 460, flexDirection: 'column', alignItems: 'stretch' }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title bar */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 46,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: { left: 18, right: 12 },
          }}
          uiBackground={{ color: BG_TITLE }}
        >
          <Label
            value={cast.phase === 'casting' ? '~ FISHING ~' : '!! CATCH !!'}
            fontSize={20}
            color={cast.phase === 'casting' ? CLR_HEADER : CLR_CAUGHT}
          />
          {cast.phase === 'casting' && (
            <Button
              value="Forfeit"
              fontSize={13}
              uiTransform={{ width: 80, height: 30 }}
              uiBackground={{ color: BG_FORFEIT }}
              onMouseDown={() => popupMgr.closeFishingPopup()}
            />
          )}
        </UiEntity>

        {/* Body */}
        <UiEntity
          uiTransform={{
            width: '100%', flexDirection: 'column', alignItems: 'center',
            padding: { top: 18, bottom: 22, left: 22, right: 22 },
          }}
          uiBackground={{ color: BG_BODY }}
        >
          {/* Rod + Bait info */}
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 18 } }}>
            <InfoRow label="Rod:" value={cast.poleLabel} />
            <InfoRow label="Bait:" value={cast.baitLabel} />
          </UiEntity>

          {cast.phase === 'casting'
            ? <CastingBody progressPct={progressPct} remainingS={remainingS} />
            : <CaughtBody
                catchLabel={cast.catchLabel ?? '???'}
                catchGold={cast.catchGoldValue ?? 0}
                onCollect={() => cast.onCollect()}
              />
          }
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function CastingBody({ progressPct, remainingS }: { progressPct: number, remainingS: number }) {
  const BAR_WIDTH = 380
  const fillPx    = Math.round((progressPct / 100) * BAR_WIDTH)
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}>
      <Label
        value="Line is in the water..."
        fontSize={15}
        color={CLR_MUTED}
        uiTransform={{ margin: { bottom: 14 } }}
        textAlign="middle-center"
      />
      <UiEntity
        uiTransform={{ width: BAR_WIDTH, height: 20, margin: { bottom: 8 } }}
        uiBackground={{ color: BG_BAR_BG }}
      >
        <UiEntity uiTransform={{ width: fillPx, height: '100%' }} uiBackground={{ color: BG_BAR_FILL }} />
      </UiEntity>
      <Label
        value={remainingS > 0 ? `${remainingS}s remaining...` : 'Something is biting!'}
        fontSize={13}
        color={remainingS > 0 ? CLR_MUTED : CLR_CAUGHT}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}

function CaughtBody({ catchLabel, catchGold, onCollect }: { catchLabel: string, catchGold: number, onCollect: () => void }) {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}>
      <Label value="You caught:" fontSize={15} color={CLR_MUTED} uiTransform={{ margin: { bottom: 8 } }} textAlign="middle-center" />
      <Label value={catchLabel} fontSize={26} color={CLR_FISH} uiTransform={{ margin: { bottom: 8 } }} textAlign="middle-center" />
      <Label value={`Worth ~${catchGold}g at the Fishmonger`} fontSize={14} color={CLR_GOLD} uiTransform={{ margin: { bottom: 26 } }} textAlign="middle-center" />
      <Button
        value="COLLECT"
        fontSize={20}
        uiTransform={{ width: 200, height: 50 }}
        uiBackground={{ color: BG_COLLECT }}
        onMouseDown={() => onCollect()}
      />
    </UiEntity>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%', height: 34,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: { left: 10, right: 10 }, margin: { bottom: 5 },
      }}
      uiBackground={{ color: BG_INFO_ROW }}
    >
      <Label value={label} fontSize={13} color={CLR_MUTED} />
      <Label value={value}  fontSize={14} color={CLR_WHITE} />
    </UiEntity>
  )
}
