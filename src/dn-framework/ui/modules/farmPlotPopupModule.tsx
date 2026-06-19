/**
 * @file farmPlotPopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Farm plot interaction popup for DCL SDK7 React-ECS.
 * Shows different UI based on plot state (empty / growing / ready).
 * Progress bar and countdown update live every frame from timestamps.
 *
 * Empty:   seed selector -> PLANT button
 * Growing: crop name + live progress bar + countdown
 * Ready:   harvest prompt + HARVEST button
 *
 * Usage:
 *   FarmPlotPopupModule({ popupMgr })
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA farming sprint.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'

interface FarmPlotPopupModuleProps {
  popupMgr: PopupManager
}

// Palette
const BG_OVERLAY  = Color4.create(0,    0,    0,    0.82)
const BG_WINDOW   = Color4.create(0.06, 0.09, 0.06, 0.97)  // green-tinted dark
const BG_TITLE    = Color4.create(0.07, 0.14, 0.07, 1)
const BG_BODY     = Color4.create(0.05, 0.08, 0.05, 1)
const BG_SEED_BTN = Color4.create(0.12, 0.28, 0.12, 1)
const BG_HARVEST  = Color4.create(0.18, 0.50, 0.18, 1)
const BG_CLOSE    = Color4.create(0.30, 0.12, 0.12, 1)
const BG_BAR_BG   = Color4.create(0.12, 0.15, 0.12, 1)
const BG_BAR_FILL = Color4.create(0.28, 0.78, 0.22, 1)
const CLR_HEADER  = Color4.create(0.88, 0.95, 0.72, 1)
const CLR_WHITE   = Color4.White()
const CLR_MUTED   = Color4.create(0.55, 0.62, 0.52, 1)
const CLR_READY   = Color4.create(0.60, 0.98, 0.30, 1)
const CLR_GOLD    = Color4.create(1,    0.85, 0.10, 1)

export function FarmPlotPopupModule({ popupMgr }: FarmPlotPopupModuleProps) {
  if (popupMgr.popupType !== 'farm_plot' || popupMgr.farmPlotRef == null) return null

  const plot = popupMgr.farmPlotRef
  const now = Date.now()

  // Compute live status from timestamps (may advance growing->ready in real time)
  let liveStatus = plot.status
  let progressPct = 0
  let remainingS = 0

  if (plot.status === 'growing' && plot.plantedAt !== null) {
    const elapsed = now - plot.plantedAt
    progressPct = Math.min(100, Math.round((elapsed / plot.growthMs) * 100))
    remainingS = Math.max(0, Math.round((plot.growthMs - elapsed) / 1000))
    if (progressPct >= 100) liveStatus = 'ready'
  }

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%', height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: BG_OVERLAY }}
    >
      <UiEntity
        uiTransform={{
          width: 500,
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title bar */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: { left: 18, right: 12 },
          }}
          uiBackground={{ color: BG_TITLE }}
        >
          <Label value="FARM PLOT" fontSize={18} color={CLR_HEADER} />
          <Button
            value="X  Close"
            fontSize={13}
            uiTransform={{ width: 110, height: 30 }}
            uiBackground={{ color: BG_CLOSE }}
            onMouseDown={() => popupMgr.closePopup()}
          />
        </UiEntity>

        {/* Body */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            padding: { top: 24, bottom: 24, left: 24, right: 24 },
          }}
          uiBackground={{ color: BG_BODY }}
        >
          {liveStatus === 'empty'   && EmptyState({ plot, popupMgr })}
          {liveStatus === 'growing' && GrowingState({ plot, progressPct, remainingS })}
          {liveStatus === 'ready'   && ReadyState({ plot, popupMgr })}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ plot, popupMgr }: { plot: any, popupMgr: PopupManager }) {
  const seeds = plot.availableSeeds as Array<{ itemId: string, name: string, quantity: number }>

  return (
    <UiEntity
      uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}
    >
      <Label
        value="This plot is empty."
        fontSize={18}
        color={CLR_MUTED}
        uiTransform={{ margin: { bottom: 20 } }}
      />

      {seeds.length === 0 ? (
        <Label
          value="No seeds in inventory.\nBuy seeds from the Trader."
          fontSize={15}
          color={CLR_MUTED}
          textAlign="middle-center"
        />
      ) : (
        <UiEntity
          uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}
        >
          <Label
            value="Plant seeds:"
            fontSize={14}
            color={CLR_MUTED}
            uiTransform={{ margin: { bottom: 12 } }}
          />
          {seeds.map((seed, i) => (
            <UiEntity
              key={i.toString()}
              uiTransform={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: { bottom: 10 },
                padding: { left: 12, right: 12, top: 4, bottom: 4 },
              }}
              uiBackground={{ color: BG_SEED_BTN }}
            >
              <Label value={`${seed.name}  (x${seed.quantity} in bag)`} fontSize={15} color={CLR_WHITE} />
              <Button
                value="PLANT"
                fontSize={15}
                uiTransform={{ width: 90, height: 36 }}
                uiBackground={{ color: Color4.create(0.20, 0.52, 0.20, 1) }}
                onMouseDown={() => plot.onPlant(seed.itemId, seed.name)}
              />
            </UiEntity>
          ))}
        </UiEntity>
      )}
    </UiEntity>
  )
}

// ── Growing state ──────────────────────────────────────────────────────────────

function GrowingState({ plot, progressPct, remainingS }: { plot: any, progressPct: number, remainingS: number }) {
  const fillWidth = `${progressPct}%`

  return (
    <UiEntity
      uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}
    >
      <Label
        value={`Growing: ${plot.seedName}`}
        fontSize={20}
        color={CLR_HEADER}
        uiTransform={{ margin: { bottom: 20 } }}
      />

      {/* Progress bar */}
      <UiEntity
        uiTransform={{ width: 400, height: 22, margin: { bottom: 10 } }}
        uiBackground={{ color: BG_BAR_BG }}
      >
        <UiEntity
          uiTransform={{ width: fillWidth, height: '100%' }}
          uiBackground={{ color: BG_BAR_FILL }}
        />
      </UiEntity>

      <Label
        value={`${progressPct}%  --  ${remainingS}s remaining`}
        fontSize={14}
        color={CLR_MUTED}
        uiTransform={{ margin: { bottom: 20 } }}
        textAlign="middle-center"
      />

      <Label
        value="Come back when it's ready!"
        fontSize={15}
        color={CLR_MUTED}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}

// ── Ready state ────────────────────────────────────────────────────────────────

function ReadyState({ plot, popupMgr }: { plot: any, popupMgr: PopupManager }) {
  return (
    <UiEntity
      uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}
    >
      <Label
        value="Ready to harvest!"
        fontSize={24}
        color={CLR_READY}
        uiTransform={{ margin: { bottom: 16 } }}
        textAlign="middle-center"
      />
      <Label
        value={`You will receive: ${plot.outputName} x${plot.outputQuantity}`}
        fontSize={17}
        color={CLR_GOLD}
        uiTransform={{ margin: { bottom: 28 } }}
        textAlign="middle-center"
      />
      <Button
        value="HARVEST"
        fontSize={20}
        uiTransform={{ width: 200, height: 52 }}
        uiBackground={{ color: BG_HARVEST }}
        onMouseDown={() => plot.onHarvest()}
      />
    </UiEntity>
  )
}
