/**
 * ev_timing.ts — EV6: Rate Limiter + EV7: Countdown Pulse + EV8: One-Shot
 * STATUS: 🟩 FULLY CODED
 *
 * EV6 — RATE LIMITER / COOLDOWN TRIGGER
 * Event can only fire once per N seconds. Silently discards attempts within
 * the cooldown window. Use for: damage prevention spam, action throttling,
 * preventing players from spamming abilities or interactions.
 *
 * EV7 — COUNTDOWN PULSE (N times with delay)
 * Fires N events with configurable interval between them, then stops.
 * Use for: "5-4-3-2-1 GO!" countdowns, wave spawning sequences,
 * burst of collectibles appearing over time, warning sequences.
 *
 * EV8 — ONE-SHOT (fires EXACTLY ONCE, persists state forever)
 * First trigger fires the event and permanently transitions to 'done' state.
 * Reset requires explicit call. Use for: story beats (player discovers secret,
 * enters new area, kills boss for first time), tutorial progression,
 * achievements that should only trigger once per session.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'
import { emit } from './ev_eventBus'

// ─── Station: EV6 — Rate Limiter ──────────────────────────────────────────────

interface RateLimiter { cooldownSeconds: number; lastFired: number; onFire: (count: number) => void; _count?: number }

function tryFire(limiter: RateLimiter): boolean {
  const now = Date.now() / 1000
  if (now - limiter.lastFired < limiter.cooldownSeconds) return false
  limiter.lastFired = now
  limiter._count = (limiter._count ?? 0) + 1
  limiter.onFire(limiter._count)
  return true
}


export function setupEVRateLimiter(): void {
  const { x, z } = { x: 96, z: 70 }
  createStation('ev6_ratelimit', 'EV6 — RATE LIMITER\nCooldown between fires', STATUS_COLOR.FULLY_CODED)

  const hitCounter = engine.addEntity()
  Transform.create(hitCounter, { position: Vector3.create(x, 2.5, z) }); Billboard.create(hitCounter, {})
  TextShape.create(hitCounter, { text: 'Fires: 0\nAttempts: 0', fontSize: 1.5, textColor: Color4.White() })

  const cooldownBar = engine.addEntity()
  Transform.create(cooldownBar, { position: Vector3.create(x, 1.0, z - 0.1), scale: Vector3.create(0, 0.25, 0.1) })
  MeshRenderer.setBox(cooldownBar)
  Material.setPbrMaterial(cooldownBar, { albedoColor: Color4.create(0.2, 0.9, 0.3, 1) })

  const cooldownBg = engine.addEntity()
  Transform.create(cooldownBg, { position: Vector3.create(x, 1.0, z - 0.05), scale: Vector3.create(3.5, 0.2, 0.08) })
  MeshRenderer.setBox(cooldownBg)
  Material.setPbrMaterial(cooldownBg, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

  let totalAttempts = 0
  let cooldownSeconds = 2.0

  const limiter: RateLimiter = {
    cooldownSeconds, lastFired: 0,
    onFire: (count) => {
      TextShape.getMutable(hitCounter).text = `Fires: ${count}\nAttempts: ${totalAttempts}`
      TextShape.getMutable(hitCounter).textColor = Color4.create(0.3, 1, 0.5, 1)
      emit('rate_limited_fired', { count })
      console.log(`[EV6] FIRED #${count} (${totalAttempts} attempts total)`)
    }
  }

  // Update cooldown bar each frame
  engine.addSystem((_dt: number) => {
    const now = Date.now() / 1000
    const elapsed = now - limiter.lastFired
    const frac = Math.min(elapsed / cooldownSeconds, 1)
    Transform.getMutable(cooldownBar).scale = Vector3.create(3.5 * frac, 0.2, 0.08)
    Material.setPbrMaterial(cooldownBar, { albedoColor: frac >= 1 ? Color4.create(0.2, 0.9, 0.3, 1) : Color4.create(0.9, 0.5, 0.1, 1) })
  }, 5)

  // "Attack" button
  const atkBtn = createButton(x, 0.8, z - 3.6, '⚡ Spam Click!', Color4.create(0.6, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: atkBtn, opts: { button: 1, hoverText: '[E] Try to fire' } }, () => {
    totalAttempts++
    const fired = tryFire(limiter)
    if (!fired) {
      TextShape.getMutable(hitCounter).textColor = Color4.create(1, 0.4, 0.4, 1)
      console.log(`[EV6] Attempt ${totalAttempts} — blocked by cooldown`)
    }
  })

  // Cooldown length buttons
  const half = createButton(x - 2, 0.8, z - 3.6, '1s cool', Color4.create(0.3, 0.5, 0.3, 1))
  const two  = createButton(x + 2, 0.8, z - 3.6, '3s cool', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: half, opts: { button: 1, hoverText: '[E] 1s cooldown' } }, () => { limiter.cooldownSeconds = 1; cooldownSeconds = 1 })
  pointerEventsSystem.onPointerDown({ entity: two,  opts: { button: 1, hoverText: '[E] 3s cooldown' } }, () => { limiter.cooldownSeconds = 3; cooldownSeconds = 3 })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'now - lastFired < cooldown → blocked\nBar fills green when ready\nSpam the button — only N per second fire',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV6] RateLimiter initialized — 2s cooldown, bar visual')
}

// ─── Station: EV7 — Countdown Pulse ──────────────────────────────────────────

function startPulse(
  times: number, intervalSeconds: number,
  onPulse: (remaining: number) => void,
  onDone: () => void
): void {
  let remaining = times; let timer = 0
  const sys = engine.addSystem((dt: number) => {
    timer += dt
    if (timer >= intervalSeconds) {
      timer = 0; remaining--
      onPulse(remaining)
      if (remaining <= 0) { engine.removeSystem(sys); onDone() }
    }
  }, 5)
}

export function setupEVPulse(): void {
  const { x, z } = { x: 108, z: 70 }
  createStation('ev7_pulse', 'EV7 — COUNTDOWN PULSE\n5-4-3-2-1-GO!', STATUS_COLOR.FULLY_CODED)

  const countDisplay = engine.addEntity()
  Transform.create(countDisplay, { position: Vector3.create(x, 2.5, z) }); Billboard.create(countDisplay, {})
  TextShape.create(countDisplay, { text: '⏱ PRESS START', fontSize: 2.0, textColor: Color4.White() })

  // 5 boxes to light up in countdown order
  const countColors = [
    Color4.create(1, 0.2, 0.2, 1),
    Color4.create(1, 0.5, 0.1, 1),
    Color4.create(1, 0.9, 0.1, 1),
    Color4.create(0.5, 1, 0.1, 1),
    Color4.create(0.2, 0.9, 0.3, 1),
  ]
  const countBoxes: ReturnType<typeof engine.addEntity>[] = []
  for (let i = 0; i < 5; i++) {
    const box = engine.addEntity()
    Transform.create(box, { position: Vector3.create(x - 2.5 + i * 1.25, 1.0, z - 0.5), scale: Vector3.create(1.1, 1.1, 1.1) })
    MeshRenderer.setBox(box)
    Material.setPbrMaterial(box, { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) })
    countBoxes.push(box)

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(x - 2.5 + i * 1.25, 2.3, z - 0.5) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: `${5 - i}`, fontSize: 1.4, textColor: countColors[4 - i] })
  }

  let isRunning = false
  const startBtn = createButton(x, 0.8, z - 3.6, '▶ Countdown!', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: startBtn, opts: { button: 1, hoverText: '[E] Start 5-4-3-2-1!' } }, () => {
    if (isRunning) return; isRunning = true
    // Reset all boxes
    for (const b of countBoxes) Material.setPbrMaterial(b, { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) })
    let step = 0

    startPulse(5, 0.8,
      (remaining) => {
        const idx = 4 - step  // lights from right to left (5→4→3→2→1)
        if (idx >= 0 && idx < 5) {
          const c = countColors[4 - step]
          Material.setPbrMaterial(countBoxes[idx], { albedoColor: c, emissiveColor: { r: c.r * 0.6, g: c.g * 0.6, b: c.b * 0.6 }, emissiveIntensity: 1.5 })
        }
        TextShape.getMutable(countDisplay).text = remaining > 0 ? `${remaining}...` : 'GO!'
        TextShape.getMutable(countDisplay).textColor = remaining > 0 ? countColors[step] : Color4.create(0.2, 1, 0.3, 1)
        emit('countdown_pulse', { remaining, step })
        console.log(`[EV7] Pulse: ${remaining > 0 ? remaining : 'GO!'}`)
        step++
      },
      () => {
        isRunning = false
        setTimeout(() => {
          TextShape.getMutable(countDisplay).text = '⏱ PRESS START'
          TextShape.getMutable(countDisplay).textColor = Color4.White()
          for (const b of countBoxes) Material.setPbrMaterial(b, { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) })
        }, 2000)
      }
    )
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'startPulse(N, interval, onPulse, onDone)\nUse for: 5-4-3-2-1 GO, wave spawn\nEnemy warnings, rhythm patterns',
    fontSize: 1.1, textColor: Color4.create(0.8, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV7] Countdown pulse initialized — 5 beats at 0.8s each')
}

// ─── Station: EV8 — One-Shot ──────────────────────────────────────────────────

export function setupEVOneShot(): void {
  const { x, z } = { x: 120, z: 70 }
  createStation('ev8_oneshot', 'EV8 — ONE-SHOT\nFires exactly once, persists', STATUS_COLOR.FULLY_CODED)

  let oneShotFired = false

  // "Secret" entity — only reveals once, forever
  const secretEntity = engine.addEntity()
  Transform.create(secretEntity, { position: Vector3.create(x, 1.2, z - 1.5), scale: Vector3.create(1.5, 1.5, 1.5) })
  MeshRenderer.setCylinder(secretEntity)
  MeshCollider.setCylinder(secretEntity, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(secretEntity, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  const secretLbl = engine.addEntity()
  Transform.create(secretLbl, { position: Vector3.create(x, 2.5, z - 1.5) }); Billboard.create(secretLbl, {})
  TextShape.create(secretLbl, { text: '❓ MYSTERY\n[E] to reveal', fontSize: 1.2, textColor: Color4.create(0.5, 0.5, 0.5, 1) })

  const historyLbl = engine.addEntity()
  Transform.create(historyLbl, { position: Vector3.create(x, 1.0, z + 2.5) }); Billboard.create(historyLbl, {})
  TextShape.create(historyLbl, { text: 'Not yet revealed', fontSize: 1.1, textColor: Color4.create(0.6, 0.6, 0.6, 1) })

  pointerEventsSystem.onPointerDown({ entity: secretEntity, opts: { button: 1, hoverText: '[E] Discover' } }, () => {
    if (oneShotFired) {
      // Already discovered — show persistent state
      TextShape.getMutable(historyLbl).text = '(already discovered)'
      console.log('[EV8] One-shot already fired — blocked')
      return
    }
    // FIRES EXACTLY ONCE
    oneShotFired = true
    Material.setPbrMaterial(secretEntity, {
      albedoColor: Color4.create(1, 0.9, 0.2, 1),
      emissiveColor: { r: 0.6, g: 0.5, b: 0 }, emissiveIntensity: 1.5
    })
    TextShape.getMutable(secretLbl).text = '⭐ SECRET!\nFirst discovery!'
    TextShape.getMutable(secretLbl).textColor = Color4.create(1, 0.9, 0.2, 1)
    TextShape.getMutable(historyLbl).text = '✓ Discovered at ' + new Date().toLocaleTimeString()
    TextShape.getMutable(historyLbl).textColor = Color4.create(1, 0.9, 0.3, 1)
    emit('oneshot_fired', { timestamp: Date.now() })
    console.log('[EV8] ONE-SHOT fired — will never fire again this session')
  })

  // Reset button (explicit reset, not from normal play)
  const resetBtn = createButton(x, 0.8, z - 3.6, '↺ Dev Reset', Color4.create(0.4, 0.3, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Dev reset (not in game)' } }, () => {
    oneShotFired = false
    Material.setPbrMaterial(secretEntity, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })
    TextShape.getMutable(secretLbl).text = '❓ MYSTERY\n[E] to reveal'
    TextShape.getMutable(secretLbl).textColor = Color4.create(0.5, 0.5, 0.5, 1)
    TextShape.getMutable(historyLbl).text = 'Not yet revealed'
    TextShape.getMutable(historyLbl).textColor = Color4.create(0.6, 0.6, 0.6, 1)
    console.log('[EV8] Dev reset — one-shot can fire again')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'if (oneShotFired) return  ← blocks replay\nUse for: story beats, first discoveries\nachievements, tutorial milestones',
    fontSize: 1.1, textColor: Color4.create(1, 0.95, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV8] OneShot initialized — fires once, persists state')
}
