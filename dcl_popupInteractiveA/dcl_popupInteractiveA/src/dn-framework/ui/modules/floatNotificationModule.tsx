/**
 * @file floatNotificationModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Float notification UI module for DCL SDK7 React-ECS.
 * Renders fire-and-forget text notifications that drift upward and fade.
 *
 * Appearance:
 *   - Fixed position: lower-right screen area
 *   - Items drift upward 120px over their lifetime (default 1.5s)
 *   - Alpha fades from 1 → 0 over lifetime
 *   - Simultaneous items are stacked 32px apart via stackOffset
 *
 * Usage (include in your uiMgr layout):
 *   import { FloatNotificationModule } from './modules/floatNotificationModule'
 *   ...
 *   ReactEcsRenderer.setUiRenderer(() => [
 *     FloatNotificationModule({ popupMgr }),
 *     ...otherModules
 *   ])
 *
 *   // Trigger from anywhere:
 *   popupMgr.showFloat('+50 Gold', Color4.create(1, 0.85, 0.1, 1))
 *   popupMgr.showFloat('+3 Wood',  Color4.create(0.6, 0.9, 0.4, 1))
 *
 * @changelog
 *   0.0001 - Initial. New — no equivalent in existing fragments.
 */

import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager } from '../popupManager'

interface FloatNotificationModuleProps {
  popupMgr: PopupManager
}

/**
 * Float notification module.
 * Returns null when no floats are active (zero overhead).
 */
export function FloatNotificationModule({ popupMgr }: FloatNotificationModuleProps) {
  const items = popupMgr.floatItems
  if (items.length === 0) return null

  const now = Date.now()

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        // Lower-right area — items rise upward from here
        position: { top: '58%', left: '70%' },
        width: 280,
        height: 250,
      }}
    >
      {items.map(item => {
        const elapsed = now - item.startTime
        const t = Math.min(1, elapsed / item.lifeMs)

        // Fade: linear from 1.0 → 0.0 (accelerate toward end)
        const alpha = Math.max(0, 1 - t * 1.3)

        // Rise: starts at stackOffset, drifts up 120px over lifetime
        const bottomPx = item.stackOffset + Math.round(t * 120)

        return (
          <UiEntity
            key={item.id.toString()}
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: bottomPx, right: 0 },
              width: 280,
              height: 32,
            }}
          >
            <Label
              value={item.text}
              fontSize={22}
              color={Color4.create(item.color.r, item.color.g, item.color.b, alpha)}
              textAlign="middle-right"
            />
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}
