/**
 * fb_hudSystems.ts — FB4: Score + FB5: Timer + FB6: Objectives + FB7: Alert
 * STATUS: 🟩 FULLY CODED
 *
 * All four HUD systems demonstrated here use world-space billboard panels
 * rather than ReactECS (can't add to the existing scene's UiRenderer).
 * In production, each would be a ReactECS UiEntity positioned on screen.
 * The DATA LOGIC shown here (increment/decrement, countdown, objective tracking,
 * timed notification) is 100% identical whether rendering to world or to screen.
 *
 * FB4 — SCORE HUD: Counter with add/subtract/reset. Shows score + hi-score.
 * FB5 — COUNTDOWN TIMER: Configurable start time, fires event at 0.
 * FB6 — OBJECTIVE TRACKER: N objectives with individual complete flags.
 * FB7 — ALERT NOTIFICATION: Brief banner that fades after N seconds.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── FB4 — Score HUD ──────────────────────────────────────────────────────────

let globalScore = 0
let highScore   = 0
let scoreDisplayEntity: ReturnType<typeof engine.addEntity> | null = null

export function addScore(points: number): void {
  globalScore += points
  if (globalScore > highScore) highScore = globalScore
  if (scoreDisplayEntity) {
    TextShape.getMutable(scoreDisplayEntity).text =
      `SCORE\n${globalScore}\n──────\nBEST: ${highScore}`
  }
  console.log(`[FB4] Score: ${globalScore} (best: ${highScore})`)
}

export function setupFBScore(): void {
  const { x, z } = { x: 52, z: 110 }
  createStation('fb4_score', 'FB4 — SCORE HUD\nPersistent counter', STATUS_COLOR.FULLY_CODED)

  // HUD panel (simulates screen overlay — world-space billboard panel)
  const panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(x + 3.0, 2.5, z),
    scale: Vector3.create(1.8, 2.5, 0.08)
  })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, { albedoColor: Color4.create(0.08, 0.08, 0.1, 0.9) })

  scoreDisplayEntity = engine.addEntity()
  Transform.create(scoreDisplayEntity, { position: Vector3.create(x + 3.0, 2.5, z - 0.1) })
  Billboard.create(scoreDisplayEntity, {})
  TextShape.create(scoreDisplayEntity, {
    text: 'SCORE\n0\n──────\nBEST: 0',
    fontSize: 1.5, textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Target boxes to shoot (each gives points)
  const pointValues = [10, 25, 50]
  for (let i = 0; i < 3; i++) {
    const ev = pointValues[i]
    const target = engine.addEntity()
    Transform.create(target, {
      position: Vector3.create(x - 2.5 + i * 2.0, 1.2, z - 1.5),
      scale: Vector3.create(0.9, 0.9, 0.5)
    })
    MeshRenderer.setBox(target)
    MeshCollider.setBox(target, ColliderLayer.CL_POINTER)
    Material.setPbrMaterial(target, {
      albedoColor: Color4.create(0.8 - i * 0.2, 0.3 + i * 0.3, 0.1, 1)
    })
    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(x - 2.5 + i * 2.0, 2.0, z - 1.5) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, { text: `+${ev}`, fontSize: 1.5, textColor: Color4.White() })

    pointerEventsSystem.onPointerDown({ entity: target, opts: { button: 1, hoverText: `[E] +${ev} pts` } }, () => {
      addScore(ev)
    })
  }

  const resetBtn = createButton(x, 0.8, z - 3.6, '↺ Reset Score', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset' } }, () => {
    globalScore = 0; addScore(0)
    console.log('[FB4] Score reset')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'addScore(points) updates panel\nIn production: ReactECS UiText overlay\nData logic identical either way',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB4] Score HUD initialized')
}

// ─── FB5 — Countdown Timer ────────────────────────────────────────────────────

interface CountdownEntry {
  timeLeft:   number
  maxTime:    number
  running:    boolean
  displayEnt: ReturnType<typeof engine.addEntity>
  onExpire:   () => void
}

const countdowns: CountdownEntry[] = []
let countdownSystemRegistered = false

function ensureCountdownSystem(): void {
  if (countdownSystemRegistered) return; countdownSystemRegistered = true
  engine.addSystem((dt: number) => {
    for (const c of countdowns) {
      if (!c.running) continue
      c.timeLeft = Math.max(0, c.timeLeft - dt)
      const mins   = Math.floor(c.timeLeft / 60)
      const secs   = Math.floor(c.timeLeft % 60)
      const tenths = Math.floor((c.timeLeft % 1) * 10)
      TextShape.getMutable(c.displayEnt).text = `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`
      const frac = c.timeLeft / c.maxTime
      TextShape.getMutable(c.displayEnt).textColor = frac > 0.3
        ? Color4.create(0.3 + 0.7 * (1 - frac), 0.9 * frac, 0, 1)
        : Color4.create(1, 0.2 * frac / 0.3, 0, 1)  // red when low
      if (c.timeLeft <= 0) {
        c.running = false
        TextShape.getMutable(c.displayEnt).text = '⏱ TIME!'
        TextShape.getMutable(c.displayEnt).textColor = Color4.create(1, 0.3, 0.3, 1)
        c.onExpire()
      }
    }
  }, 3)
}

export function setupFBTimer(): void {
  const { x, z } = { x: 64, z: 110 }
  createStation('fb5_timer', 'FB5 — COUNTDOWN TIMER\nClock fires event at 0', STATUS_COLOR.FULLY_CODED)
  ensureCountdownSystem()

  const timerPanel = engine.addEntity()
  Transform.create(timerPanel, {
    position: Vector3.create(x, 2.5, z),
    scale: Vector3.create(2.5, 1.2, 0.08)
  })
  MeshRenderer.setBox(timerPanel)
  Material.setPbrMaterial(timerPanel, { albedoColor: Color4.create(0.05, 0.05, 0.08, 0.9) })

  const timerDisplay = engine.addEntity()
  Transform.create(timerDisplay, { position: Vector3.create(x, 2.5, z - 0.1) })
  Billboard.create(timerDisplay, {})
  TextShape.create(timerDisplay, { text: '1:00.0', fontSize: 2.5, textColor: Color4.create(0.3, 1, 0.5, 1) })

  const expireLbl = engine.addEntity()
  Transform.create(expireLbl, { position: Vector3.create(x, 1.8, z - 0.1) })
  Billboard.create(expireLbl, {})
  TextShape.create(expireLbl, { text: '', fontSize: 1.4, textColor: Color4.create(1, 0.3, 0.3, 1) })

  const entry: CountdownEntry = {
    timeLeft: 60, maxTime: 60, running: false,
    displayEnt: timerDisplay,
    onExpire: () => {
      TextShape.getMutable(expireLbl).text = '💀 TIME UP!'
      console.log('[FB5] Timer expired — onExpire() callback fired')
    }
  }
  countdowns.push(entry)

  const start60Btn = createButton(x - 2, 0.8, z - 3.6, '▶ 1:00', Color4.create(0.2, 0.6, 0.3, 1))
  const start30Btn = createButton(x,     0.8, z - 3.6, '▶ 0:30', Color4.create(0.5, 0.4, 0.1, 1))
  const stopBtn    = createButton(x + 2, 0.8, z - 3.6, '■ Stop',  Color4.create(0.5, 0.2, 0.1, 1))

  pointerEventsSystem.onPointerDown({ entity: start60Btn, opts: { button: 1, hoverText: '[E] Start 1:00' } }, () => {
    entry.timeLeft = 60; entry.maxTime = 60; entry.running = true
    TextShape.getMutable(expireLbl).text = ''
    console.log('[FB5] Timer started: 60s')
  })
  pointerEventsSystem.onPointerDown({ entity: start30Btn, opts: { button: 1, hoverText: '[E] Start 0:30' } }, () => {
    entry.timeLeft = 30; entry.maxTime = 30; entry.running = true
    TextShape.getMutable(expireLbl).text = ''
    console.log('[FB5] Timer started: 30s')
  })
  pointerEventsSystem.onPointerDown({ entity: stopBtn, opts: { button: 1, hoverText: '[E] Stop' } }, () => {
    entry.running = false; console.log('[FB5] Timer stopped')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'timeLeft -= dt each frame\nColors shift: green → orange → red\nonExpire() fires at 0',
    fontSize: 1.1, textColor: Color4.create(0.7, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB5] Countdown timer initialized')
}

// ─── FB6 — Objective Tracker ──────────────────────────────────────────────────

export function setupFBObjectiveTracker(): void {
  const { x, z } = { x: 16, z: 130 }
  createStation('fb6_obj', 'FB6 — OBJECTIVE TRACKER\nComplete 3 tasks', STATUS_COLOR.FULLY_CODED)

  const objectives = [
    { label: 'Find the ghost',    done: false },
    { label: 'Return 3 books',    done: false },
    { label: 'Escape the library',done: false },
  ]

  // Objective panel
  const panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(x + 2.8, 2.0, z),
    scale: Vector3.create(2.5, 2.0, 0.08)
  })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, { albedoColor: Color4.create(0.06, 0.06, 0.1, 0.9) })

  const objDisplay = engine.addEntity()
  Transform.create(objDisplay, { position: Vector3.create(x + 2.8, 2.0, z - 0.1) })
  Billboard.create(objDisplay, {})
  TextShape.create(objDisplay, { text: '', fontSize: 1.2, textColor: Color4.White() })

  function updateDisplay(): void {
    const lines = objectives.map(o => `${o.done ? '✓' : '○'} ${o.label}`).join('\n')
    TextShape.getMutable(objDisplay).text = lines
  }
  updateDisplay()

  // Buttons to complete each objective
  for (let i = 0; i < objectives.length; i++) {
    const btn = createButton(x - 2.0, 1.4 - i * 0.8, z - 3.6, `Complete ${i + 1}`, Color4.create(0.3, 0.4, 0.6, 1))
    const idx = i
    pointerEventsSystem.onPointerDown({ entity: btn, opts: { button: 1, hoverText: `[E] Complete obj ${i + 1}` } }, () => {
      objectives[idx].done = true
      updateDisplay()
      const allDone = objectives.every(o => o.done)
      if (allDone) {
        TextShape.getMutable(objDisplay).text = '⭐ ALL DONE!\nMission complete!'
        TextShape.getMutable(objDisplay).textColor = Color4.create(1, 0.9, 0.2, 1)
        console.log('[FB6] All objectives complete! onAllComplete() callback')
      }
      console.log(`[FB6] Objective ${idx + 1} completed`)
    })
  }

  const resetBtn = createButton(x, 0.5, z - 3.6, '↺ Reset', Color4.create(0.4, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset' } }, () => {
    objectives.forEach(o => o.done = false)
    TextShape.getMutable(objDisplay).textColor = Color4.White()
    updateDisplay()
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Array of {label, done} flags\nonAllComplete() when all true\nSame pattern: ML book orders\nGhostTown V2 mission steps',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB6] ObjectiveTracker initialized — 3 objectives')
}

// ─── FB7 — Alert Notification ─────────────────────────────────────────────────

let alertBannerEntity: ReturnType<typeof engine.addEntity> | null = null
let alertTimer = 0; let alertMaxTime = 0
let alertSystemRegistered = false

export function showAlert(message: string, duration: number = 3.0, worldPos?: Vector3): void {
  if (!alertBannerEntity) return
  alertTimer = duration; alertMaxTime = duration
  TextShape.getMutable(alertBannerEntity).text = message
  TextShape.getMutable(alertBannerEntity).textColor = Color4.create(1, 0.3, 0.3, 1)
  if (worldPos) Transform.getMutable(alertBannerEntity).position = Vector3.create(worldPos.x, worldPos.y, worldPos.z)
  console.log(`[FB7] ALERT: "${message}" for ${duration}s`)
}

function ensureAlertSystem(): void {
  if (alertSystemRegistered) return; alertSystemRegistered = true
  engine.addSystem((dt: number) => {
    if (alertTimer <= 0 || !alertBannerEntity) return
    alertTimer -= dt
    const frac = alertTimer / alertMaxTime
    TextShape.getMutable(alertBannerEntity).textColor = Color4.create(1, 0.3 * (1 - frac), 0.3 * (1 - frac), frac)
    if (alertTimer <= 0) {
      TextShape.getMutable(alertBannerEntity).text = ''
    }
  }, 3)
}

export function setupFBAlert(): void {
  const { x, z } = { x: 28, z: 130 }
  createStation('fb7_alert', 'FB7 — ALERT NOTIFICATION\nFading banner, configurable', STATUS_COLOR.FULLY_CODED)
  ensureAlertSystem()

  // Large billboard banner (simulates HUD overlay)
  const panelBg = engine.addEntity()
  Transform.create(panelBg, {
    position: Vector3.create(x, 3.5, z),
    scale: Vector3.create(5.0, 0.9, 0.08)
  })
  MeshRenderer.setBox(panelBg)
  Material.setPbrMaterial(panelBg, { albedoColor: Color4.create(0.6, 0.0, 0.0, 0.0) })

  alertBannerEntity = engine.addEntity()
  Transform.create(alertBannerEntity, { position: Vector3.create(x, 3.5, z - 0.1) })
  Billboard.create(alertBannerEntity, {})
  TextShape.create(alertBannerEntity, { text: '', fontSize: 2.0, textColor: Color4.create(1, 0.3, 0.3, 1) })

  // Demo buttons for different alerts
  const alerts = [
    { msg: '👻 GHOST INCOMING!',       duration: 3.0, color: 'Red',    btn: 'Ghost' },
    { msg: '⚠ CUSTOMER LOSING PATIENCE', duration: 4.0, color: 'Orange', btn: 'Patient' },
    { msg: '📚 NEW ORDER AVAILABLE',    duration: 2.5, color: 'Green',  btn: 'Order' },
    { msg: '💀 HEALTH CRITICAL',        duration: 5.0, color: 'Red',    btn: 'Health' },
  ]

  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i]
    const btn = createButton(x - 3.5 + i * 2.3, 0.8, z - 3.6, a.btn, Color4.create(0.3, 0.3, 0.5, 1))
    pointerEventsSystem.onPointerDown({ entity: btn, opts: { button: 1, hoverText: `[E] "${a.msg}"` } }, () => {
      showAlert(a.msg, a.duration)
    })
  }

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 5.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'showAlert(message, duration)\nFades over lifetime (alpha lerp)\nUse for game events: ghost, order, health',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB7] Alert notification initialized')
}
