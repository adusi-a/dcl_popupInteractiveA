/**
 * @file uiManager.ts
 * @module DN DCL Framework / ui
 * @version 0.0001
 * @status CONFIRMED
 *
 * Base UiManager for Decentraland SDK7 scenes (ReactECS).
 *
 * CONFIRMED (pattern across 7/10 fragment projects):
 *   - ReactEcsRenderer.setUiRenderer() called once with a composition of module functions
 *   - Layout switching via setLayout(name) for game-state-driven UI changes
 *   - Each module = standalone .tsx function returning JSX
 *
 * Usage:
 *   class MyUiManager extends UiManager {
 *     constructor(gameMgr) {
 *       super(gameMgr)
 *       this.registerLayout('intro', () => [CoordsModule(this.gameMgr)])
 *       this.registerLayout('playing', () => [
 *         CoordsModule(this.gameMgr),
 *         PlayerInfoModule(this.gameMgr),
 *         MessageModule(this.gameMgr)
 *       ])
 *       this.setLayout('intro')
 *     }
 *   }
 *
 * @changelog
 *   0.0001 - Extracted from ghosttown uiMgr + portparadox uiMgr.
 *            Added registerLayout/setLayout pattern to formalize state switching.
 */

import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

/**
 * Base UiManager.
 * Manages ReactECS layout switching by game state.
 */
export class UiManager {

  gameMgr: any
  private layouts: Map<string, () => any[]> = new Map()
  private currentLayout: string = ''

  constructor(_gameMgr: any) {
    this.gameMgr = _gameMgr
  }

  /**
   * Register a named UI layout.
   * @param name    Layout name (e.g. 'intro', 'playing', 'gameover')
   * @param builder Function returning an array of ReactECS module elements
   */
  registerLayout(name: string, builder: () => any[]): void {
    this.layouts.set(name, builder)
  }

  /**
   * Switch to a registered layout.
   * @param name Layout name previously registered with registerLayout()
   */
  setLayout(name: string): void {
    const builder = this.layouts.get(name)
    if (!builder) {
      console.warn(`UiManager: layout '${name}' not registered`)
      return
    }
    this.currentLayout = name
    ReactEcsRenderer.setUiRenderer(() => builder())
  }

  /** Returns the name of the currently active layout */
  getCurrentLayout(): string {
    return this.currentLayout
  }
}
