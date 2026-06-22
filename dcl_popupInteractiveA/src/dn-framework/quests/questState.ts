/**
 * @file questState.ts
 * @module DN DCL Framework / quests
 * @version 0.0003
 * @status NEEDS_TEST
 *
 * Multi-phase quest state machine for DCL SDK7 scenes.
 *
 * QUEST FLOW:
 *   locked → available → active (phase 1 → 2 → ... → N) → complete → turned_in
 *
 * PHASES:
 *   A quest has 1..N phases. Each phase has a description shown in the mission
 *   board while that phase is active. advancePhase() increments the phase; when
 *   the last phase completes, the quest status auto-moves to 'complete'.
 *
 * REWARDS:
 *   QuestDefinition.reward specifies gold, stat gains, and item drops.
 *   MissionGiverBehavior.turnInQuest() applies rewards via PlayerInventory.
 *
 * BACKWARD COMPAT:
 *   Simple register(id, title, desc, status) still works — creates a single-phase
 *   quest with that description as the phase text.
 *
 * @changelog
 *   0.0001 - Initial. Locked/available/active/complete/turned_in state machine.
 *   0.0002 - Added QuestDefinition with phases array, advancePhase(),
 *            getCurrentPhaseDescription(), QuestReward. Backward-compat register().
 *   0.0003 - Added KillObjective on QuestPhase. Added reportKill() — call on entity death
 *            to auto-increment kill progress and advance phase when count is met.
 *            getCurrentPhaseDescription() interpolates {kills} token.
 */

export type QuestStatus = 'locked' | 'available' | 'active' | 'complete' | 'turned_in'

// ─── Quest Definition (what the game designer specifies) ──────────────────────

/** Kill-count objective attached to a quest phase. */
export interface KillObjective {
  type: 'kill'
  /** Entity tag that must be present on the killed entity (e.g. 'goblin'). */
  tag: string
  /** Optional: only count kills of this specific entity ID. */
  entityId?: string
  /** Total kills needed to auto-advance this phase. */
  count: number
}

export interface QuestPhase {
  /** Text shown in the mission board UI when this phase is active.
   *  Use {kills} as a placeholder to show current/required kill count. */
  description: string
  /** Optional objective that auto-advances the phase when its target is met. */
  objective?: KillObjective
}

export interface QuestReward {
  /** Gold added to player currency. */
  gold?: number
  /** Stat gains: { fishing_xp: 50, xp: 100 } */
  stats?: Record<string, number>
  /** Items dropped: [{ itemId: 'iron_bar', name: 'Iron Bar', quantity: 2 }] */
  items?: Array<{ itemId: string; name: string; quantity: number }>
}

export interface QuestDefinition {
  id: string
  title: string
  /** Shown when quest is 'available' (not yet accepted). */
  description: string
  /** Sequential phases. Must have at least one. */
  phases: QuestPhase[]
  reward?: QuestReward
}

// ─── Quest State (runtime, what gets saved) ───────────────────────────────────

export interface Quest {
  definition: QuestDefinition
  status: QuestStatus
  /** 0-based index into definition.phases. 0 = first phase. */
  currentPhase: number
  /** Arbitrary extra progress data. */
  progress: Record<string, string | number>
}

type QuestChangeListener = (quest: Quest) => void

// ─── QuestManager ─────────────────────────────────────────────────────────────

export class QuestManager {

  private _quests:          Map<string, Quest>                       = new Map()
  private _listeners:       Map<string, QuestChangeListener[]>       = new Map()
  private _globalListeners: QuestChangeListener[]                    = []

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a quest from a full QuestDefinition.
   * No-op if quest id already registered.
   */
  register(def: QuestDefinition, initialStatus?: QuestStatus): void
  /**
   * Convenience overload: register a simple single-phase quest.
   * @deprecated prefer register(QuestDefinition) for new code
   */
  register(id: string, title: string, description: string, initialStatus?: QuestStatus): void
  register(
    defOrId: QuestDefinition | string,
    titleOrStatus?: QuestStatus | string,
    description?: string,
    initialStatus?: QuestStatus
  ): void {
    if (typeof defOrId === 'string') {
      // Legacy overload: build a single-phase QuestDefinition
      const def: QuestDefinition = {
        id: defOrId,
        title: titleOrStatus as string ?? defOrId,
        description: description ?? '',
        phases: [{ description: description ?? '' }],
      }
      const status: QuestStatus = initialStatus ?? 'locked'
      if (!this._quests.has(def.id)) {
        this._quests.set(def.id, { definition: def, status, currentPhase: 0, progress: {} })
      }
    } else {
      const def    = defOrId as QuestDefinition
      const status = (titleOrStatus as QuestStatus) ?? 'locked'
      if (!this._quests.has(def.id)) {
        this._quests.set(def.id, { definition: def, status, currentPhase: 0, progress: {} })
      }
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  setStatus(id: string, status: QuestStatus): void {
    const q = this._quests.get(id)
    if (!q) { console.error(`[QuestManager] Unknown quest: ${id}`); return }
    q.status = status
    this._fire(q)
  }

  getStatus(id: string): QuestStatus {
    return this._quests.get(id)?.status ?? 'locked'
  }

  isLocked(id: string):    boolean { return this.getStatus(id) === 'locked'    }
  isAvailable(id: string): boolean { return this.getStatus(id) === 'available' }
  isActive(id: string):    boolean { return this.getStatus(id) === 'active'    }
  isComplete(id: string):  boolean { const s = this.getStatus(id); return s === 'complete' || s === 'turned_in' }
  isTurnedIn(id: string):  boolean { return this.getStatus(id) === 'turned_in' }

  // ── Phase ────────────────────────────────────────────────────────────────────

  /** Returns current 0-based phase index. 0 = first phase. */
  getPhase(id: string): number {
    return this._quests.get(id)?.currentPhase ?? 0
  }

  /** Returns 1-based display phase number (for UI: "Phase 1 of 3"). */
  getPhaseDisplay(id: string): number {
    return this.getPhase(id) + 1
  }

  /** Returns description of the current phase (for mission board display).
   *  Interpolates {kills} with current/required kill count if a kill objective is present. */
  getCurrentPhaseDescription(id: string): string {
    const q = this._quests.get(id)
    if (!q) return ''
    const phases = q.definition.phases
    const phase  = phases[q.currentPhase]
    if (!phase) return ''

    let desc = phase.description
    if (phase.objective?.type === 'kill') {
      const key     = `kills_p${q.currentPhase}`
      const current = (q.progress[key] as number) ?? 0
      const total   = phase.objective.count
      desc = desc.replace('{kills}', `${current}/${total}`)
    }
    return desc
  }

  getTotalPhases(id: string): number {
    return this._quests.get(id)?.definition.phases.length ?? 1
  }

  /**
   * Advance the quest to the next phase.
   * If this was the last phase, status moves to 'complete' automatically.
   * @returns true if advanced, false if quest not active or already complete
   */
  advancePhase(id: string): boolean {
    const q = this._quests.get(id)
    if (!q || q.status !== 'active') return false

    const totalPhases = q.definition.phases.length
    if (q.currentPhase >= totalPhases - 1) {
      // Already at last phase — mark complete
      q.status = 'complete'
      this._fire(q)
      return true
    }

    q.currentPhase++
    this._fire(q)
    return true
  }

  // ── Kill Objectives ───────────────────────────────────────────────────────────

  /**
   * Call when any entity dies. Checks all active quests for a kill objective on
   * the current phase. If the entity's tags include the required tag (and optional
   * entityId matches), increments kill progress and auto-advances the phase when
   * the target count is reached.
   *
   * @param entityId  The unique ID of the entity that died.
   * @param tags      String tags on that entity (e.g. ['goblin', 'enemy']).
   */
  reportKill(entityId: string, tags: string[]): void {
    for (const quest of this.getActiveQuests()) {
      const phase = quest.definition.phases[quest.currentPhase]
      if (!phase?.objective || phase.objective.type !== 'kill') continue

      const obj = phase.objective
      // Check tag match
      if (!tags.includes(obj.tag)) continue
      // Check optional specific entity ID
      if (obj.entityId && obj.entityId !== entityId) continue

      // Increment kill count
      const key     = `kills_p${quest.currentPhase}`
      const current = (quest.progress[key] as number) ?? 0
      const next    = current + 1
      this.setProgress(quest.definition.id, { [key]: next })

      // Auto-advance phase when objective met
      if (next >= obj.count) {
        this.advancePhase(quest.definition.id)
      }
    }
  }

  // ── Progress ─────────────────────────────────────────────────────────────────

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

  // ── Definition Access ────────────────────────────────────────────────────────

  getDefinition(id: string): QuestDefinition | undefined {
    return this._quests.get(id)?.definition
  }

  getReward(id: string): QuestReward | undefined {
    return this._quests.get(id)?.definition.reward
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  getQuest(id: string): Quest | undefined {
    return this._quests.get(id)
  }

  getAllQuests(): Quest[] {
    return Array.from(this._quests.values())
  }

  getActiveQuests(): Quest[] {
    return Array.from(this._quests.values()).filter(q => q.status === 'active')
  }

  getAvailableQuests(): Quest[] {
    return Array.from(this._quests.values()).filter(q => q.status === 'available')
  }

  getCompletableQuests(): Quest[] {
    return Array.from(this._quests.values()).filter(q => q.status === 'complete')
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  onQuestChange(id: string, fn: QuestChangeListener): () => void {
    if (!this._listeners.has(id)) this._listeners.set(id, [])
    this._listeners.get(id)!.push(fn)
    return () => {
      const arr = this._listeners.get(id)
      if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1) }
    }
  }

  onAnyQuestChange(fn: QuestChangeListener): () => void {
    this._globalListeners.push(fn)
    return () => {
      const i = this._globalListeners.indexOf(fn)
      if (i >= 0) this._globalListeners.splice(i, 1)
    }
  }

  private _fire(q: Quest): void {
    this._listeners.get(q.definition.id)?.forEach(fn => fn({ ...q }))
    this._globalListeners.forEach(fn => fn({ ...q }))
  }
}
