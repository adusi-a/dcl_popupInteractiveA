/**
 * @file messageModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status CONFIRMED
 *
 * Temporary on-screen message display module.
 *
 * CONFIRMED (ghosttown, portparadox):
 *   - Shows a message string for a given duration then hides
 *   - Driven by GameManager.showMessage(text, duration)
 *   - Centered at bottom of screen
 *
 * Usage:
 *   // In GameManager:
 *   showMessage(text: string, duration: number = 3) {
 *     this.currentMessage = text
 *     this.messageTimer = duration
 *   }
 *   // In engine.addSystem: decrement messageTimer, clear currentMessage when <= 0
 *
 *   // In uiMgr:
 *   const ui = () => [ MessageModule(gameMgr) ]
 *
 * @changelog
 *   0.0001 - Extracted from ghosttown messageModule + portparadox messageModule (near-identical).
 */

import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

/**
 * MessageModule — displays a temporary status message centered on screen.
 *
 * @param gameMgr  GameManager ref (must have .currentMessage string)
 */
export function MessageModule(gameMgr: any) {
  const msg: string = gameMgr?.currentMessage || ''
  if (!msg) return null

  return (
    <UiEntity
      uiTransform={{
        width: 500,
        height: 60,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        positionType: 'absolute',
        position: { bottom: '80px', left: '50%' },
        margin: { left: '-250px' },
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.75) }}
    >
      <Label
        value={msg}
        fontSize={20}
        textAlign="middle-center"
        color={Color4.White()}
      />
    </UiEntity>
  )
}
