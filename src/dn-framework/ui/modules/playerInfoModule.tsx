/**
 * @file playerInfoModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status CONFIRMED
 *
 * Player display name HUD module for DCL ReactECS.
 *
 * CONFIRMED (near-identical across 7/10 fragment projects):
 *   - Shows player display name from PlayerManager.playerUserData
 *   - Shows "loading..." until playerInfoRec is true
 *   - Semi-transparent black panel, top-right area
 *
 * Usage:
 *   const ui = () => [ PlayerInfoModule(gameMgr) ]
 *   ReactEcsRenderer.setUiRenderer(ui)
 *
 * @changelog
 *   0.0001 - Extracted from ghosttown, portparadox, rainbowArchive, dcl_triggerAreaMultiplayerTestA (near-identical).
 */

import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

/**
 * PlayerInfoModule — displays the local player's display name.
 *
 * @param gameMgr  GameManager ref (must have .playerMgr.playerInfoRec + .playerMgr.displayName)
 */
export function PlayerInfoModule(gameMgr: any) {
  const ready = gameMgr?.playerMgr?.playerInfoRec
  const name = gameMgr?.playerMgr?.displayName || 'unknown'

  return (
    <UiEntity
      uiTransform={{
        width: 300,
        height: 40,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        positionType: 'absolute',
        position: { right: '10px', top: '10px' },
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
    >
      <Label
        value={ready ? `Player: ${name}` : 'Player: loading...'}
        fontSize={16}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}
