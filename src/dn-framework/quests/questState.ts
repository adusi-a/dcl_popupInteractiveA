/**
 * @file questState.ts
 * @module DN DCL Framework / quests
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Quest state machine for DCL SDK7 scenes.
 * Tracks each quest through: locked → available → active → complete → turned_in
 * Stores per-quest progress data (arbitrary key/value).
 * Serializable for future server/Storage persistence.
 *
 * This module is INDEPENDENT of the Notice Board popup.
 * Notice Board = static text display. Quest Board = future separate complex entity.
 *
 * Usage:
 *   const questMgr = new QuestManager()
 *   questMgr.register('catch_fish', 'First Catch', 'Catch your first fish.', 'available')
 *   questMgr.setStatus('catch_fish', 'active')
 *   questMgr.isActive('catch_fish')   // true
 *   questMgr.setProgress('catch_fish', { fishCaught: 1 })
 *   questMgr.setStatus('catch_fish', 'complete')
 *
 * @changelog
 *   0.0001 - Initial. Ported to dcl_popupInteractiveA from dcl_frameworkStart sprint.
 */

export type QuestStatus = 'locked' | 'available' | 'active' | 'complete' | 'turned_in'

export interface Quest {
  id: string
  title: string
  description: string
  status: QuestStatus
  /** Arbitrary per-quest progress data (e.g. { fishCaught: 1, wormsCollected: 3 }). */
  progress: Record<string, string | number>
}

export interface QuestSaveData {
  quests: Array<{ id: string; status: QuestStatus; progress: Record<string, string | number> }>
}

type QuestChangeListener = (quest: Quest) => void

export class QuestManager {

  private _quests: Map<string, Quest> = new Map()
  private _listeners: Map<string, QuestChangeListener[]> = new Map()
  private _globalListeners: QuestChangeListener[] = []

  // ── Registration ──────────────────────────────────────────────────────────────

  /**
   * Register a quest. No-op if quest with this id already exists.
   * @param id           Unique quest ID (e.g. 'catch_fish')
   * @param title        Display title
   * @param description  Short description (for quest log / future quest board UI)
   * @param initialStatus  Default: 'locked'. Use 'available' if visible from the start.
   */
  register(
    id: string,
    title: string,
    description: string,
    initialStatus: QuestStatus = 'locked'
  ): void {
    if (!this._quests.has(id)) {
      this._quests.set(id, { id, title, description, status: initialStatus, progress: {} })
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────────

  /** Update quest status and fire all listeners. */
  setStatus(id: string, status: QuestStatus): void {
    const q = this._quests.get(id)
    if (!q) { console.warn(`[QuestManager] Unknown quest id: ${id}`); return }
    q.status = status
    this._fire(q)
  }

  getStatus(id: string): QuestStatus {
    return this._quests.get(id)?.status ?? 'locked'
  }

  isLocked(id: string): boolean    { return this.getStatus(id) === 'locked'    }
  isAvailable(id: string): boolean { return this.getStatus(id) === 'available' }
  isActive(id: string): boolean    { return this.getStatus(id) === 'active'    }
  isComplete(id: string): boolean  {
    const s = this.getStatus(id)
    return s === 'complete' || s === 'turned_in'
  }
  isTurnedIn(id: string): boolean  { return this.getStatus(id) === 'turned_in' }

  // ── Progress ──────────────────────────────────────────────────────────────────

  /** Merge new data into per-quest progress. */
  setProgress(id: string, data: Record<string, string | number>): void {
    const q = this._quests.get(id)
    if (!q) return
    q.progress = { ...q.progress, ...data }
    this._fire(q)
  }

  getProgress(id: string): Record<string, string | number> {
    return this._quests.get(id)?.progress ?? {}
  }

  getProgressValue(id: string, key: string): string | number | undefined {
    return this._quests.get(id)?.progress[key]
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  getQuest(id: string): Quest | undefined {
    return this._quests.get(id)
  }

  getAllQuests(): Quest[] {
    return Array.from(this._quests.values())
  }

  getActiveQuests(): Quest[] {
    return Array.from(this._quests.values()).filter(q => q.status === 'active')
  }

  // ── Listeners ─────────────────────────────────────────────────────────────────

  /** Listen for changes on a specific quest. Returns unsubscribe function. */
  onQuestChange(id: string, fn: QuestChangeListener): () => void {
    if (!this._listeners.has(id)) this._listeners.set(id, [])
    this._listeners.get(id)!.push(fn)
    return () => {
      const arr = this._listeners.get(id)
      if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1) }
    }
  }

  /** Listen for changes on any quest. Returns unsubscribe function. */
  onAnyQuestChange(fn: QuestChangeListener): () => void {
    this._globalListeners.push(fn)
    return () => {
      const i = this._globalListeners.indexOf(fn)
      if (i >= 0) this._globalListeners.splice(i, 1)
    }
  }

  private _fire(q: Quest): void {
    this._listeners.get(q.id)?.forEach(fn => fn({ ...q }))
    this._globalListeners.forEach(fn => fn({ ...q }))
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  /** Export for server/Storage persistence. */
  exportSaveData(): QuestSaveData {
    return {
      quests: Array.from(this._quests.values()).map(q => ({
        id: q.id,
        status: q.status,
        progress: { ...q.progress },
      }))
    }
  }

  /**
   * Restore from save data. Quests must be registered first.
   * Unknown IDs in the save are silently skipped (handles new quests added in updates).
   */
  loadSaveData(raw: QuestSaveData): void {
    if (!raw?.quests) return
    for (const saved of raw.quests) {
      const q = this._quests.get(saved.id)
      if (!q) continue
      q.status   = saved.status
      q.progress = { ...saved.progress }
    }
  }
}
