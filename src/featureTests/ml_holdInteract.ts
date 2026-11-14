/**
 * ml_holdInteract.ts — T14: Hold-to-Interact with Progress Display
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Timed hold interaction: press [E] on an object and hold for N seconds.
 * Visual progress bar fills as you hold. Release early = no effect.
 * Complete = action fires (clears blockage, opens door, etc.).
 *
 * This is the core pattern for:
 *   MonsterLibrary  — clearing a "book pile" blockage in an aisle
 *                     ("hold E for 3s to clear path")
 *   OreMonger       — reinforcing a weakened tunnel segment
 *   GhostTown V2    — placing a candle or inscribing a rune
 *   Any puzzle      — interacting with a mechanism slowly
 *
 * FRAMEWORK NOTE
 * ──────────────
 * The HoldInteractSystem is a single engine system tracking all registered
 * hold interactions. Each registration provides:
 *   - The entity to hold against
 *   - Hold duration (seconds)
 *   - onComplete callback
 *   - Optional onCancel callback
 *
 * The system handles:
 *   - Pointer down → start accumulating
 *   - Pointer up → reset accumulator
 *   - Accumulator ≥ duration → fire onComplete
 *   - Decay when not holding (so you can't hold-pause-hold)
 *
 * PROGRESS DISPLAY
 * ────────────────
 * Uses a row of 10 small box entities above the blockage. As you hold [E],
 * boxes switch from grey to green (left to right). Full green = complete.
 * In production, replace with a ReactECS circular progress ring.
 *
 * DEMO (run and verify):
 *   [ ] Orange box visible in "aisle" at station
 *   [ ] Walk up and hold [E] on the box
 *   [ ] 10 bar segments fill from left to right over 3 seconds
 *   [ ] Box vanishes and green "CLEARED" sign appears on completion
 *   [ ] Release before done → bars drain back to empty
 *   [ ] Completion is permanent until Reset button pressed
 *   [ ] Console logs [ML4] progress and completion
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── HoldInteract system ─────────────────────────────────────────────────────

interface HoldEntry {
  entity:          ReturnType<typeof engine.addEntity>
  duration:        number
  accumulator:     number
  isHolding:       boolean
  completed:       boolean
  onComplete:      () => void
  onCancel?:       () => void
  onProgress?:     (fraction: number) => void
}

const holdEntries: HoldEntry[] = []
let holdSystemRegistered = false

function ensureHoldSystem(): void {
  if (holdSystemRegistered) return
  holdSystemRegistered = true

  engine.addSystem((dt: number) => {
    for (const h of holdEntries) {
      if (h.completed) continue

      if (h.isHolding) {
        h.accumulator += dt
        const fraction = Math.min(h.accumulator / h.duration, 1)
        if (h.onProgress) h.onProgress(fraction)

        if (h.accumulator >= h.duration) {
          h.completed = true
          h.isHolding = false
          h.onComplete()
          console.log('[ML4] Hold complete!')
        }
      } else {
        // Drain when not holding (decay at 1.5× fill rate)
        if (h.accumulator > 0) {
          h.accumulator = Math.max(0, h.accumulator - dt * 1.5)
          const fraction = h.accumulator / h.duration
          if (h.onProgress) h.onProgress(fraction)
        }
      }
    }
  }, 10)
}

function registerHoldInteract(
  entity: ReturnType<typeof engine.addEntity>,
  duration: number,
  hoverText: string,
  callbacks: {
    onComplete: () => void,
    onCancel?: () => void,
    onProgress?: (fraction: number) => void
  }
): HoldEntry {
  ensureHoldSystem()

  const entry: HoldEntry = {
    entity, duration,
    accumulator: 0,
    isHolding: false,
    completed: false,
    onComplete: callbacks.onComplete,
    onCancel: callbacks.onCancel,
    onProgress: callbacks.onProgress
  }
  holdEntries.push(entry)

  // Wire pointer events on the entity
  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: 1, hoverText, maxDistance: 3.5 } },
    () => {
      if (entry.completed) return
      entry.isHolding = true
      console.log('[ML4] Hold started...')
    }
  )
  pointerEventsSystem.onPointerUp(
    { entity, opts: { button: 1, hoverText: '' } },
    () => {
      if (entry.isHolding) {
        entry.isHolding = false
        if (callbacks.onCancel && entry.accumulator > 0) callbacks.onCancel()
        console.log(`[ML4] Hold released at ${(entry.accumulator / duration * 100).toFixed(0)}%`)
      }
    }
  )

  return entry
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLHoldInteract(): void {
  const { x, z } = { x: 132, z: 78 }
  createStation('ml4_holdinteract', 'ML4 — HOLD INTERACT\nAisle blockage clear', STATUS_COLOR.FULLY_CODED)

  // ─── Fake aisle ───────────────────────────────────────────────────────────
  const aisleFloor = engine.addEntity()
  Transform.create(aisleFloor, {
    position: Vector3.create(x, 0.52, z),
    scale: Vector3.create(1.8, 0.04, 7)
  })
  MeshRenderer.setBox(aisleFloor)
  Material.setPbrMaterial(aisleFloor, {
    albedoColor: Color4.create(0.5, 0.4, 0.3, 0.6)
  })

  // Fake shelves flanking the aisle
  for (const side of [-1.5, 1.5]) {
    const shelf = engine.addEntity()
    Transform.create(shelf, {
      position: Vector3.create(x + side * 1.3, 1.0, z),
      scale: Vector3.create(0.4, 2.0, 7)
    })
    MeshRenderer.setBox(shelf)
    Material.setPbrMaterial(shelf, {
      albedoColor: Color4.create(0.3, 0.2, 0.1, 1)
    })
  }

  // ─── Blockage entity (orange pile-of-books placeholder) ───────────────────
  const blockage = engine.addEntity()
  Transform.create(blockage, {
    position: Vector3.create(x, 0.9, z),
    scale: Vector3.create(1.6, 1.4, 1.0)
  })
  MeshRenderer.setBox(blockage)
  MeshCollider.setBox(blockage, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(blockage, {
    albedoColor: Color4.create(0.9, 0.5, 0.1, 1),
    emissiveColor: { r: 0.3, g: 0.1, b: 0 }, emissiveIntensity: 0.2
  })

  // Blockage label
  const blockLbl = engine.addEntity()
  Transform.create(blockLbl, { position: Vector3.create(x, 2.0, z) })
  Billboard.create(blockLbl, {})
  TextShape.create(blockLbl, {
    text: '📚 BOOK PILE\n[Hold E to clear]',
    fontSize: 1.4, textColor: Color4.create(1, 0.7, 0.3, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Progress bar (10 small boxes above blockage) ─────────────────────────
  const BAR_SEGMENTS = 10
  const barEntities: ReturnType<typeof engine.addEntity>[] = []
  for (let i = 0; i < BAR_SEGMENTS; i++) {
    const seg = engine.addEntity()
    Transform.create(seg, {
      position: Vector3.create(x - 0.9 + i * 0.2, 2.5, z - 0.55),
      scale: Vector3.create(0.16, 0.16, 0.08)
    })
    MeshRenderer.setBox(seg)
    Material.setPbrMaterial(seg, {
      albedoColor: Color4.create(0.3, 0.3, 0.3, 1)
    })
    barEntities.push(seg)
  }

  // Progress label
  const progressLbl = engine.addEntity()
  Transform.create(progressLbl, { position: Vector3.create(x, 2.8, z - 0.55) })
  Billboard.create(progressLbl, {})
  TextShape.create(progressLbl, {
    text: '0%',
    fontSize: 1.2, textColor: Color4.White(),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Cleared state display (hidden until complete) ────────────────────────
  const clearedSign = engine.addEntity()
  Transform.create(clearedSign, {
    position: Vector3.create(x, 1.0, z),
    scale: Vector3.create(1.6, 1.4, 0.05)
  })
  MeshRenderer.setBox(clearedSign)
  Material.setPbrMaterial(clearedSign, {
    albedoColor: Color4.create(0.1, 0.9, 0.2, 0.0) // invisible initially
  })

  const clearedLbl = engine.addEntity()
  Transform.create(clearedLbl, { position: Vector3.create(x, 1.4, z - 0.1) })
  Billboard.create(clearedLbl, {})
  TextShape.create(clearedLbl, { text: '', fontSize: 1.8, textColor: Color4.create(0, 1, 0.3, 0) })

  // Track visible state
  let isCleared = false

  // ─── Register hold interaction ────────────────────────────────────────────
  const holdEntry = registerHoldInteract(
    blockage, 3.0, '[Hold E] Clear the aisle',
    {
      onProgress: (fraction) => {
        // Update bar segments
        const filledCount = Math.floor(fraction * BAR_SEGMENTS)
        for (let i = 0; i < BAR_SEGMENTS; i++) {
          if (i < filledCount) {
            Material.setPbrMaterial(barEntities[i], {
              albedoColor: Color4.create(0.1, 0.9, 0.2, 1),
              emissiveColor: { r: 0, g: 0.4, b: 0 }, emissiveIntensity: 0.5
            })
          } else {
            Material.setPbrMaterial(barEntities[i], {
              albedoColor: Color4.create(0.3, 0.3, 0.3, 1)
            })
          }
        }
        // Update percent label
        const pct = Math.round(fraction * 100)
        TextShape.getMutable(progressLbl).text = `${pct}%`
        TextShape.getMutable(progressLbl).textColor = Color4.create(0.1 + 0.9 * fraction, 0.9, 0.1 + 0.3 * (1 - fraction), 1)
      },

      onComplete: () => {
        isCleared = true
        // Hide blockage
        Transform.getMutable(blockage).scale = Vector3.create(0, 0, 0)
        // Hide labels
        TextShape.getMutable(blockLbl).text = ''
        // All bar segments green
        for (const seg of barEntities) {
          Material.setPbrMaterial(seg, {
            albedoColor: Color4.create(0.1, 0.9, 0.2, 1),
            emissiveColor: { r: 0, g: 0.5, b: 0 }, emissiveIntensity: 0.8
          })
        }
        TextShape.getMutable(progressLbl).text = '✓ CLEARED'
        // Show cleared sign
        Material.setPbrMaterial(clearedSign, {
          albedoColor: Color4.create(0.1, 0.9, 0.2, 0.3)
        })
        TextShape.getMutable(clearedLbl).text = '✓ PATH CLEAR'
        TextShape.getMutable(clearedLbl).textColor = Color4.create(0.1, 1, 0.3, 1)
        console.log('[ML4] Blockage CLEARED — aisle is passable')
      }
    }
  )

  // ─── Reset button ─────────────────────────────────────────────────────────
  const resetBtn = createButton(x, 1.0, z - 3.6, '↺ Reset Blockage',
    Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown(
    { entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset' } },
    () => {
      isCleared = false
      holdEntry.accumulator = 0
      holdEntry.completed   = false
      holdEntry.isHolding   = false

      // Show blockage again
      Transform.getMutable(blockage).scale = Vector3.create(1.6, 1.4, 1.0)
      TextShape.getMutable(blockLbl).text = '📚 BOOK PILE\n[Hold E to clear]'

      // Reset bar
      for (const seg of barEntities) {
        Material.setPbrMaterial(seg, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })
      }
      TextShape.getMutable(progressLbl).text = '0%'
      TextShape.getMutable(progressLbl).textColor = Color4.White()

      // Hide cleared sign
      Material.setPbrMaterial(clearedSign, { albedoColor: Color4.create(0.1, 0.9, 0.2, 0.0) })
      TextShape.getMutable(clearedLbl).text = ''

      console.log('[ML4] Blockage RESET')
    }
  )

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.4, z - 3.8) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Hold [E] 3 seconds to clear\nRelease early = progress drains\nReusable for any timed interaction',
    fontSize: 1.2, textColor: Color4.create(1, 0.9, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML4] HoldInteract station initialized — walk to X=132 Z=78')
}
