/**
 * T7 — Avatar Animations (custom scene emotes)
 * STATUS: 🟨 NEEDS ASSET for custom emote; built-in test is 🟩 FULLY CODED
 *
 * ASSET NEEDED:
 *   assets/emotes/carry_emote.glb
 *   Source: Download from Creator Hub Avatar Animations asset pack
 *   In Creator Hub: search_catalog "Avatar Animations" → find "carry" or "pickup"
 *   OR: download via CLI, e.g.:
 *     curl -L "https://builder-api.decentraland.org/v1/assetPacks/..." -o carry_emote.glb
 *   The file MUST end with _emote.glb exactly.
 *
 * Tests:
 *   A) Built-in emotes — 4 buttons test predefined IDs (fully coded)
 *   B) triggerSceneEmote with pack emote file (carry_emote.glb) — NEEDS ASSET
 *   C) Masked upper-body emote while walking (AvatarMask.AM_UPPER_BODY)
 *   D) Loop + stopEmote
 *
 * VERIFY:
 *   - Built-in 'wave', 'robot', 'clap', 'dance' play on button press
 *   - Custom emote file triggers correctly (once file is placed)
 *   - Masked emote keeps legs walking while upper body animates
 *   - Stop button interrupts the looping emote
 *
 * GAME APPLICATIONS:
 *   OreMonger  — mining swing animation while operating a node (masked, loops)
 *   MonsterLibrary — picking up book, running away animation
 *   GhostTown V2   — spooky stumble, scared reaction emote
 *
 * SDK NOTES:
 *   • triggerEmote({ predefinedEmote: 'name' }) — 32 built-ins, free
 *   • triggerSceneEmote({ src, loop, mask }) — custom .glb file in scene assets
 *   • File MUST be named *_emote.glb exactly
 *   • stopEmote({}) — interrupts any active emote
 *   • Emotes play only while player is standing still (walk/jump interrupts)
 *   • Masked emote (AvatarMask.AM_UPPER_BODY) survives locomotion
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'
import { triggerEmote, triggerSceneEmote, stopEmote } from '~system/RestrictedActions'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// AvatarMask — SDK 7.x (may be in different import location)
let AvatarMask: any
try {
  // @ts-ignore — require works in DCL/esbuild QuickJS context
  AvatarMask = (require('@dcl/sdk/ecs') as any).AvatarMask
} catch {
  AvatarMask = null
}

const CUSTOM_EMOTE_PATH = 'assets/emotes/carry_emote.glb'  // ✅ placed (Avatar_CarryBox_emote from dcl-one)

export function setupEmotesTest(): void {
  const { x, z } = { x: 108, z: 50 }
  createStation('t7_emotes', 'T7 — AVATAR ANIMATIONS\nBuilt-in ✅ | carry_emote.glb ✅', STATUS_COLOR.FULLY_CODED)

  // ─── A) Built-in emote buttons ────────────────────────────────────────────
  const builtIns: Array<{ id: string; label: string }> = [
    { id: 'wave',   label: '[E] WAVE' },
    { id: 'robot',  label: '[E] ROBOT' },
    { id: 'clap',   label: '[E] CLAP' },
    { id: 'dance',  label: '[E] DANCE' },
  ]

  builtIns.forEach((emote, i) => {
    const bx = x - 3 + i * 2
    const btn = createButton(bx, 0.9, z - 3.2, emote.label, Color4.create(0.2, 0.6, 0.9, 1))
    pointerEventsSystem.onPointerDown(
      { entity: btn, opts: { button: InputAction.IA_PRIMARY, hoverText: `Play ${emote.id}` } },
      () => {
        console.log(`[T7] Built-in emote: ${emote.id}`)
        triggerEmote({ predefinedEmote: emote.id })
      }
    )
  })

  const builtInLabel = engine.addEntity()
  Transform.create(builtInLabel, { position: Vector3.create(x, 2.5, z - 3.2) })
  Billboard.create(builtInLabel)
  TextShape.create(builtInLabel, {
    text: '← Built-in emotes (32 available) ✅', fontSize: 1.1,
    textColor: Color4.create(0.5, 1, 0.5, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── B) Custom emote from pack ────────────────────────────────────────────
  const customBtn = createButton(x - 2, 0.9, z, `[E] CARRY\n(pack emote)`, Color4.create(1, 0.7, 0.1, 1))
  pointerEventsSystem.onPointerDown(
    { entity: customBtn, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Custom Carry Emote' } },
    () => {
      console.log(`[T7] triggerSceneEmote: ${CUSTOM_EMOTE_PATH}`)
      // 🟨 ASSET NEEDED: assets/emotes/carry_emote.glb
      // If file missing, nothing plays (no error thrown — silent fail)
      triggerSceneEmote({ src: CUSTOM_EMOTE_PATH, loop: false })
    }
  )

  const customLabel = engine.addEntity()
  Transform.create(customLabel, { position: Vector3.create(x - 2, 2.5, z) })
  Billboard.create(customLabel)
  TextShape.create(customLabel, {
    text: 'Custom emote 🟨\nNeeds: carry_emote.glb', fontSize: 1.1,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── C) Masked upper-body emote (loops while walking) ─────────────────────
  const maskedBtn = createButton(x + 0.5, 0.9, z, `[E] WAVE\n(upper only)`, Color4.create(0.5, 0.3, 0.9, 1))
  pointerEventsSystem.onPointerDown(
    { entity: maskedBtn, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Masked Wave (walk + wave)' } },
    () => {
      console.log('[T7] Masked upper-body wave — walk around to verify legs still move')
      const mask = AvatarMask ? AvatarMask.AM_UPPER_BODY : 1  // 1 = upper body flag
      // For built-in emotes, masked loop:
      // Note: built-in emotes via triggerEmote don't support mask directly.
      // For masked loop, we use a _emote.glb file.
      // This button tests with carry_emote if available, otherwise wave.
      try {
        triggerSceneEmote({
          src: CUSTOM_EMOTE_PATH,  // 🟨 ASSET NEEDED
          loop: true,
          mask  // AvatarMask.AM_UPPER_BODY
        })
      } catch {
        // Fallback to built-in (no mask support on predefined emotes)
        triggerEmote({ predefinedEmote: 'wave' })
        console.error('[T7] Masked emote needs pack .glb file — playing built-in wave as fallback')
      }
    }
  )

  const maskedLabel = engine.addEntity()
  Transform.create(maskedLabel, { position: Vector3.create(x + 0.5, 2.5, z) })
  Billboard.create(maskedLabel)
  TextShape.create(maskedLabel, {
    text: 'Masked emote 🟨\n(walk + upper body)', fontSize: 1.1,
    textColor: Color4.create(0.7, 0.5, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── D) Loop + Stop ───────────────────────────────────────────────────────
  const loopBtn = createButton(x + 2.5, 0.9, z, `[E] LOOP DANCE\nstart/stop`, Color4.create(0.9, 0.2, 0.5, 1))
  let emoteLooping = false
  pointerEventsSystem.onPointerDown(
    { entity: loopBtn, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Loop / Stop Dance' } },
    () => {
      if (!emoteLooping) {
        emoteLooping = true
        console.log('[T7] Starting looping dance emote')
        triggerEmote({ predefinedEmote: 'dance' })
        // Note: triggerEmote with loop=true is not currently exposed for built-in emotes.
        // Use triggerSceneEmote with loop:true for custom emotes.
        // Built-in 'dance' naturally loops — press again to stop.
      } else {
        emoteLooping = false
        console.log('[T7] Stopping emote')
        stopEmote({})
      }
      TextShape.getMutable(loopBtn).text = emoteLooping ? '[E] STOP' : '[E] LOOP DANCE\nstart/stop'
    }
  )

  const loopLabel = engine.addEntity()
  Transform.create(loopLabel, { position: Vector3.create(x + 2.5, 2.5, z) })
  Billboard.create(loopLabel)
  TextShape.create(loopLabel, {
    text: 'Loop + stop\n(dance built-in)', fontSize: 1.1,
    textColor: Color4.create(1, 0.5, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  console.log('[T7] Avatar Animations test station initialized')
  console.log('[T7] 🟨 ASSET NEEDED: assets/emotes/carry_emote.glb')
  console.log('[T7]    Source: Creator Hub Avatar Animations pack → "carry" or similar clip')
  console.log('[T7]    File MUST be named *_emote.glb')
}
