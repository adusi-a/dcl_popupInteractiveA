/**
 * @file interactionUiSystem.ts
 * @module DN DCL Framework / ui / systems
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * ECS system for popup interaction: ESC key close + float notification updates.
 * Extracted and simplified from portparadox's interactionUiSystem.ts.
 *
 * In portparadox: InputAction.IA_ACTION_4 = X key (mapped as secondary close action).
 * ESC itself is not accessible to DCL scenes — the client intercepts it.
 *
 * Usage:
 *   setupInteractionUiSystem(gameMgr.popupMgr)
 *   // Call once in GameManager constructor AFTER popupMgr is created.
 *
 * @changelog
 *   0.0001 - Extracted from portparadox interactionUiSystem. Simplified to work
 *            with PopupManager instead of raw popupStatus string on GameManager.
 */

import { engine, inputSystem, InputAction } from '@dcl/sdk/ecs'
import { PopupManager } from '../popupManager'

/**
 * Register the interaction UI ECS system.
 * - Updates float notification expiry each frame
 * - Closes active popups when IA_ACTION_4 (X key) is pressed
 *
 * @param popupMgr  The scene's PopupManager instance
 */
export function setupInteractionUiSystem(popupMgr: PopupManager): void {
  engine.addSystem(() => {
    // Update float notifications (removes expired items)
    popupMgr.updateFloats()

    // IA_ACTION_4 (X key in DCL) — close active popup
    // Pattern from portparadox: getInputCommand(action, engine.PlayerEntity)
    if (inputSystem.getInputCommand(InputAction.IA_ACTION_4, engine.PlayerEntity)) {
      if (popupMgr.isPopupOpen()) {
        popupMgr.closePopup()
      }
    }
  })
}
