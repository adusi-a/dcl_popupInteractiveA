/**
 * @file coordsModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status CONFIRMED
 *
 * Player position + rotation display module for DCL ReactECS HUD.
 *
 * CONFIRMED (near-identical across 6/10 fragment projects):
 *   - Reads engine.PlayerEntity Transform each render
 *   - Displays X/Y/Z position + Y rotation
 *   - Optional checkpoint display line
 *   - Semi-transparent black panel, top-left area
 *
 * Usage:
 *   // In uiMgr.tsx:
 *   const ui = () => [ CoordsModule(gameMgr) ]
 *   ReactEcsRenderer.setUiRenderer(ui)
 *
 * @changelog
 *   0.0001 - Extracted from ghosttown, portparadox, rainbowArchive, dn_dcl_mainTestA (near-identical).
 *            Added optional checkpoint param.
 */

import { engine, Transform } from '@dcl/sdk/ecs'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4, Quaternion } from '@dcl/sdk/math'

/**
 * CoordsModule — renders current player position and rotation.
 *
 * @param gameMgr   Optional GameManager ref (used for checkpoint display)
 * @param showCheckpoint  Whether to show the current checkpoint line
 */
export function CoordsModule(gameMgr?: any, showCheckpoint: boolean = false) {
  return (
    <UiEntity
      uiTransform={{
        width: 300,
        height: showCheckpoint ? 80 : 55,
        margin: { left: '10px', top: '10px' },
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
    >
      <Label
        value={getPlayerPositionString()}
        fontSize={10}
        textAlign="middle-center"
      />
      {showCheckpoint && gameMgr && (
        <Label
          value={`Checkpoint: ${gameMgr.playerMgr?.currentCheckpoint ?? 'none'}`}
          fontSize={14}
          textAlign="middle-center"
        />
      )}
    </UiEntity>
  )
}

function getPlayerPositionString(): string {
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return 'Pos: loading...'
  const { x, y, z } = t.position
  const euler = Quaternion.toEulerAngles(t.rotation)
  return `Pos: X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}  Rot Y:${euler.y.toFixed(0)}°`
}
