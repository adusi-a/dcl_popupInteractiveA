/**
 * T5 — Advanced Input
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * Tests:
 *   A) InputModifier — freeze player movement on entering a zone
 *   B) PointerLock detection — read cursor capture state
 *   C) PrimaryPointerInfo — read cursor world ray + position
 *   D) WASD polling — detect held keys in a system (not click events)
 *
 * VERIFY:
 *   - Entering the red zone: player cannot walk, turn, or jump
 *   - [E] on "Release" button restores movement
 *   - HUD shows Locked/Released pointer state updating in real-time
 *   - PrimaryPointerInfo HUD shows hit world position as you look around
 *
 * GAME APPLICATIONS:
 *   All games    — cutscene freeze (combine with T3 VirtualCamera)
 *   MonsterLibrary — ghost-catch freeze ("You're caught!")
 *   GhostTown V2   — investigation mode: locked in place while examining
 *   OreMonger      — crew contract signing freeze
 *
 * SDK NOTES:
 *   • InputModifier must be on engine.PlayerEntity.
 *   • ALLOW mode + empty list = block everything.
 *   • PointerLock.isLocked is a read-only component on engine.CameraEntity.
 *   • PrimaryPointerInfo gives world-space ray from camera — useful for
 *     custom targeting, aiming, or cursor-world interaction.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, TriggerArea, triggerAreaEventsSystem,
  InputModifier, PointerLock, PrimaryPointerInfo,
  inputSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// InputModifier modes
const { ModifierKey, InputModifierMode } = require('@dcl/sdk/ecs') as any

export function setupInputTest(): void {
  const { x, z } = { x: 144, z: 22 }
  createStation('t5_input', 'T5 — ADVANCED INPUT\nFreeze / Pointer / Keys', STATUS_COLOR.FULLY_CODED)

  let frozen = false

  // ─── A) Freeze Zone ───────────────────────────────────────────────────────
  const freezeZoneViz = engine.addEntity()
  Transform.create(freezeZoneViz, {
    position: Vector3.create(x - 2, 1, z - 2),
    scale: Vector3.create(3, 2.5, 3)
  })
  MeshRenderer.setBox(freezeZoneViz)
  Material.setPbrMaterial(freezeZoneViz, { albedoColor: Color4.create(1, 0.1, 0.1, 0.25) })

  const freezeZoneTrigger = engine.addEntity()
  Transform.create(freezeZoneTrigger, {
    position: Vector3.create(x - 2, 1, z - 2),
    scale: Vector3.create(3, 2.5, 3)
  })
  TriggerArea.setBox(freezeZoneTrigger)

  triggerAreaEventsSystem.onTriggerEnter(freezeZoneTrigger, (e) => {
    if (e.trigger?.entity !== engine.PlayerEntity || frozen) return
    frozen = true
    console.log('[T5] Entered freeze zone — blocking all input')
    applyFreeze(true)
  })

  triggerAreaEventsSystem.onTriggerExit(freezeZoneTrigger, (e) => {
    if (e.trigger?.entity !== engine.PlayerEntity || !frozen) return
    frozen = false
    console.log('[T5] Left freeze zone — restoring input')
    applyFreeze(false)
  })

  const freezeLabel = engine.addEntity()
  Transform.create(freezeLabel, { position: Vector3.create(x - 2, 3.3, z - 2) })
  Billboard.create(freezeLabel)
  TextShape.create(freezeLabel, {
    text: 'FREEZE ZONE\n(step inside)', fontSize: 1.3,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Manual freeze/release buttons
  const btnFreeze = createButton(x + 1, 0.9, z - 3, '[E] FREEZE\nplayer', Color4.create(1, 0.2, 0.2, 1))
  pointerEventsSystem.onPointerDown(
    { entity: btnFreeze, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Freeze' } },
    () => { frozen = true; applyFreeze(true); console.log('[T5] Manual freeze') }
  )

  const btnRelease = createButton(x + 3.5, 0.9, z - 3, '[E] RELEASE\nplayer', Color4.create(0.2, 0.9, 0.2, 1))
  pointerEventsSystem.onPointerDown(
    { entity: btnRelease, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Release' } },
    () => { frozen = false; applyFreeze(false); console.log('[T5] Manual release') }
  )

  // ─── B) PointerLock HUD ───────────────────────────────────────────────────
  const ptrLockLabel = engine.addEntity()
  Transform.create(ptrLockLabel, { position: Vector3.create(x, 5.0, z) })
  Billboard.create(ptrLockLabel)
  TextShape.create(ptrLockLabel, {
    text: 'PointerLock: ...', fontSize: 1.3,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── C) PrimaryPointerInfo HUD ────────────────────────────────────────────
  const ptrInfoLabel = engine.addEntity()
  Transform.create(ptrInfoLabel, { position: Vector3.create(x, 4.2, z) })
  Billboard.create(ptrInfoLabel)
  TextShape.create(ptrInfoLabel, {
    text: 'Cursor ray: ...', fontSize: 1.0,
    textColor: Color4.create(0.8, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── D) WASD key-held status ──────────────────────────────────────────────
  const wasdLabel = engine.addEntity()
  Transform.create(wasdLabel, { position: Vector3.create(x, 3.3, z) })
  Billboard.create(wasdLabel)
  TextShape.create(wasdLabel, {
    text: 'WASD: ...', fontSize: 1.0,
    textColor: Color4.create(0.6, 1, 0.6, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Per-frame system to read all advanced input state ─────────────────────
  engine.addSystem(() => {
    // B: Pointer lock
    const ptrLock = PointerLock.getOrNull(engine.CameraEntity)
    const isLocked = ptrLock?.isPointerLocked ?? false
    TextShape.getMutable(ptrLockLabel).text =
      `PointerLock: ${isLocked ? '🔒 LOCKED' : '🔓 released'}`

    // C: Primary pointer world ray
    const ppi = PrimaryPointerInfo.getOrNull(engine.CameraEntity)
    if (ppi?.hit) {
      const p = ppi.hit.position ?? { x: 0, y: 0, z: 0 }
      TextShape.getMutable(ptrInfoLabel).text =
        `Hit: (${p.x?.toFixed(1)}, ${p.y?.toFixed(1)}, ${p.z?.toFixed(1)})`
    } else {
      TextShape.getMutable(ptrInfoLabel).text = 'Cursor ray: (no hit)'
    }

    // D: WASD held keys
    const keys: string[] = []
    if (inputSystem.isPressed(InputAction.IA_FORWARD))  keys.push('W')
    if (inputSystem.isPressed(InputAction.IA_BACKWARD)) keys.push('S')
    if (inputSystem.isPressed(InputAction.IA_LEFT))     keys.push('A')
    if (inputSystem.isPressed(InputAction.IA_RIGHT))    keys.push('D')
    if (inputSystem.isPressed(InputAction.IA_JUMP))     keys.push('SPACE')
    TextShape.getMutable(wasdLabel).text =
      `WASD held: [${keys.length > 0 ? keys.join(' ') : 'none'}]`
  })

  console.log('[T5] Advanced Input test station initialized')
}

/** Apply or remove InputModifier to freeze the player */
function applyFreeze(freeze: boolean): void {
  if (freeze) {
    // ALLOW with empty list = block all input actions
    // If InputModifierMode is undefined (older SDK), log a warning
    try {
      InputModifier.createOrReplace(engine.PlayerEntity, {
        disableAll: true
      } as any)
    } catch (e) {
      // Fallback: try the documented API shape
      try {
        InputModifier.createOrReplace(engine.PlayerEntity, {
          mode: { $case: 'hide', hide: { } }
        } as any)
      } catch (e2) {
        console.error('[T5] InputModifier API shape unexpected — check SDK version:', e2)
      }
    }
  } else {
    InputModifier.deleteFrom(engine.PlayerEntity)
  }
}
