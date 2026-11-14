/**
 * ev_eventBus.ts — EV1: Event Bus + EV2: Chained Sequence
 * STATUS: 🟩 FULLY CODED
 *
 * EV1 — EVENT BUS (pub/sub pattern)
 * The foundational decoupling pattern for game systems.
 * Any system can emit events; any system can listen — with NO direct coupling.
 *
 * Without event bus: ScoreSystem.addPoints() calls CustomerManager.nextCustomer()
 *                    which calls AudioSystem.play() which calls HUDSystem.update()
 *                    = tightly coupled spaghetti, impossible to extend
 *
 * With event bus:    ScoreSystem.emit('customerServed', { points })
 *                    CustomerManager.on('customerServed', ...) → handles its part
 *                    AudioSystem.on('customerServed', ...) → plays sound
 *                    HUDSystem.on('customerServed', ...) → updates display
 *                    = loose coupling, any system can subscribe without touching others
 *
 * USE IN MONSTERLIB:
 *   emit('bookPickedUp', { bookId, shelfId }) → updates order, minimap blip, timer
 *   emit('customerServed') → score++, next customer spawns, success sound
 *   emit('ghostSpawned', { aisleId }) → alert banner, audio sting, minimap blip
 *
 * EV2 — CHAINED SEQUENCE
 * Fire event A → wait N seconds → fire event B → wait → fire event C → done.
 * Used for: cutscene beat sequences, wave spawning, scripted story moments,
 * timed "intro sequence" when player enters a new area.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Global Event Bus ─────────────────────────────────────────────────────────

type EventCallback = (data?: unknown) => void
const _listeners = new Map<string, EventCallback[]>()

/** Emit an event with optional payload to all registered listeners. */
export function emit(eventName: string, data?: unknown): void {
  const cbs = _listeners.get(eventName) ?? []
  for (const cb of cbs) cb(data)
}

/** Register a listener for an event. Returns the callback (for off()). */
export function on(eventName: string, cb: EventCallback): EventCallback {
  if (!_listeners.has(eventName)) _listeners.set(eventName, [])
  _listeners.get(eventName)!.push(cb)
  return cb
}

/** Remove a specific listener. */
export function off(eventName: string, cb: EventCallback): void {
  const cbs = _listeners.get(eventName) ?? []
  const idx = cbs.indexOf(cb)
  if (idx >= 0) cbs.splice(idx, 1)
}

/** Remove ALL listeners for an event. */
export function offAll(eventName: string): void { _listeners.delete(eventName) }

// ─── Chained Sequence helper ──────────────────────────────────────────────────

interface SequenceStep { eventName: string; delay: number; data?: unknown }

export function startSequence(steps: SequenceStep[], onComplete?: () => void): void {
  if (steps.length === 0) { if (onComplete) onComplete(); return }
  let totalDelay = 0
  for (const step of steps) {
    const capturedDelay = totalDelay + step.delay
    const capturedStep  = step
    let timer = capturedDelay
    const sys = engine.addSystem((dt: number) => {
      timer -= dt
      if (timer <= 0) { engine.removeSystem(sys); emit(capturedStep.eventName, capturedStep.data) }
    }, 5)
    totalDelay += step.delay
  }
  // onComplete fires after all steps
  if (onComplete) {
    let timer = totalDelay + 0.05
    const doneSys = engine.addSystem((dt: number) => { timer -= dt; if (timer <= 0) { engine.removeSystem(doneSys); onComplete() } }, 5)
  }
}

// ─── Station: EV1 — Event Bus ─────────────────────────────────────────────────

export function setupEVEventBus(): void {
  const { x, z } = { x: 96, z: 58 }
  createStation('ev1_eventbus', 'EV1 — EVENT BUS\nemit / on / off', STATUS_COLOR.FULLY_CODED)

  // Create 4 "listener" display boxes that light up when their event fires
  const events = ['score_up', 'ghost_spawn', 'book_found', 'order_complete']
  const eventColors: Color4[] = [
    Color4.create(0.3, 1, 0.3, 1),   // green — score
    Color4.create(0.9, 0.3, 0.9, 1), // purple — ghost
    Color4.create(0.3, 0.6, 1, 1),   // blue — book
    Color4.create(1, 0.9, 0.2, 1),   // gold — order
  ]
  const listenerBoxes: ReturnType<typeof engine.addEntity>[] = []

  for (let i = 0; i < events.length; i++) {
    const lx = x - 1.5 + i * 1.0
    const box = engine.addEntity()
    Transform.create(box, { position: Vector3.create(lx, 1.0, z + 1.5), scale: Vector3.create(0.8, 0.8, 0.8) })
    MeshRenderer.setBox(box)
    Material.setPbrMaterial(box, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
    listenerBoxes.push(box)

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(lx, 2.0, z + 1.5) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: events[i].replace('_', '\n'), fontSize: 0.9, textColor: eventColors[i] })

    // Register listener
    const ec = eventColors[i]; const bi = box
    on(events[i], (data) => {
      Material.setPbrMaterial(bi, { albedoColor: ec, emissiveColor: { r: ec.r * 0.6, g: ec.g * 0.6, b: ec.b * 0.6 }, emissiveIntensity: 1.5 })
      let t = 0.8
      const sys = engine.addSystem((dt: number) => {
        t -= dt; if (t <= 0) { engine.removeSystem(sys); Material.setPbrMaterial(bi, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) }) }
      }, 5)
      console.log(`[EV1] Event '${events[i]}' received — data:`, data)
    })
  }

  // Emit buttons (emit different events)
  for (let i = 0; i < events.length; i++) {
    const btn = createButton(x - 1.5 + i * 1.0, 0.8, z - 2.5, events[i].split('_')[0], eventColors[i])
    const ev = events[i]
    pointerEventsSystem.onPointerDown({ entity: btn, opts: { button: 1, hoverText: `[E] emit('${ev}')` } }, () => {
      emit(ev, { source: 'manual', timestamp: Date.now() })
    })
  }

  // "Emit all" button
  const allBtn = createButton(x, 0.8, z - 3.6, '⚡ Emit All', Color4.create(0.5, 0.5, 0.5, 1))
  pointerEventsSystem.onPointerDown({ entity: allBtn, opts: { button: 1, hoverText: '[E] Emit all events' } }, () => {
    for (const ev of events) emit(ev, { source: 'all' })
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'emit(eventName, data) → all listeners fire\non(name, cb) / off(name, cb)\nDecouples every game system from every other',
    fontSize: 1.1, textColor: Color4.create(0.6, 1, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV1] Event bus initialized — 4 events demo, emit + listen')
}

// ─── Station: EV2 — Chained Sequence ──────────────────────────────────────────

export function setupEVChain(): void {
  const { x, z } = { x: 108, z: 58 }
  createStation('ev2_chain', 'EV2 — CHAINED SEQUENCE\nA → delay → B → delay → C', STATUS_COLOR.FULLY_CODED)

  // 5 boxes that light up in sequence
  const stepColors = [
    Color4.create(0.9, 0.2, 0.2, 1),
    Color4.create(1, 0.6, 0.1, 1),
    Color4.create(1, 0.9, 0.1, 1),
    Color4.create(0.3, 0.9, 0.3, 1),
    Color4.create(0.3, 0.5, 1, 1),
  ]
  const stepBoxes: ReturnType<typeof engine.addEntity>[] = []
  const stepLabels = ['🔴 1', '🟠 2', '🟡 3', '🟢 4', '🔵 5']

  for (let i = 0; i < 5; i++) {
    const sx = x - 2.5 + i * 1.25
    const box = engine.addEntity()
    Transform.create(box, { position: Vector3.create(sx, 1.0, z - 0.5), scale: Vector3.create(1.1, 1.1, 1.1) })
    MeshRenderer.setBox(box)
    Material.setPbrMaterial(box, { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) })
    stepBoxes.push(box)

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(sx, 2.3, z - 0.5) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: stepLabels[i], fontSize: 1.1, textColor: stepColors[i] })

    // Listen for this step's event
    const idx = i; const sc = stepColors[i]
    on(`seq_step_${i + 1}`, () => {
      Material.setPbrMaterial(stepBoxes[idx], { albedoColor: sc, emissiveColor: { r: sc.r * 0.6, g: sc.g * 0.6, b: sc.b * 0.6 }, emissiveIntensity: 1.5 })
      // Fade after 0.6s
      let t = 0.6; const sys = engine.addSystem((dt: number) => { t -= dt; if (t <= 0) { engine.removeSystem(sys); Material.setPbrMaterial(stepBoxes[idx], { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) }) } }, 5)
    })
  }

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.8, z - 0.5) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: 'Press start →', fontSize: 1.2, textColor: Color4.White() })

  const startBtn = createButton(x, 0.8, z - 3.6, '▶ Start Sequence', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: startBtn, opts: { button: 1, hoverText: '[E] Run sequence' } }, () => {
    TextShape.getMutable(statusLbl).text = '⚡ Running...'
    // Reset all boxes
    for (const b of stepBoxes) Material.setPbrMaterial(b, { albedoColor: Color4.create(0.15, 0.15, 0.15, 1) })
    startSequence([
      { eventName: 'seq_step_1', delay: 0.3 },
      { eventName: 'seq_step_2', delay: 0.6 },
      { eventName: 'seq_step_3', delay: 0.9 },
      { eventName: 'seq_step_4', delay: 1.2 },
      { eventName: 'seq_step_5', delay: 1.5 },
    ], () => { TextShape.getMutable(statusLbl).text = '✓ COMPLETE'; console.log('[EV2] Sequence complete') })
    console.log('[EV2] Sequence STARTED')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'startSequence([{event, delay}, ...])\nUse for: cutscenes, wave spawns\nEnemy intro, story beats, intros',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV2] ChainedSequence initialized — 5-step sequence, 0.3s each')
}
