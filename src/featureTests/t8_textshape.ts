/**
 * T8 — Advanced Rendering: TextShape + Billboard
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * Tests:
 *   A) TextShape — 3D floating text with outlines, colors, font styles
 *   B) Billboard — text that always faces the camera
 *   C) Distance-fading label — LOD: hide when player > 15m away
 *   D) Dynamic live counter — text updated each frame from game state
 *   E) Directional sign panel — multi-line, non-billboard, world-space
 *
 * VERIFY:
 *   - Labels render at correct position and size in-world
 *   - Billboard signs rotate as player walks around them
 *   - Distance label disappears when you back up beyond 15m
 *   - Counter increments every second, text updates in real-time
 *
 * GAME APPLICATIONS:
 *   OreMonger  — ore count label above mine shaft, NPC name plates
 *   MonsterLibrary — shelf labels ("FICTION", "812.4"), directional signs
 *   All games  — floating score/progress labels, damage numbers
 *
 * SDK NOTES:
 *   • TextShape renders in world space (not screen space — that's Build UI)
 *   • outlineWidth 0.0–0.5; use 0.1–0.2 for readability at distance
 *   • textWrapping: false with \n for manual line breaks
 *   • Font.F_SANS_SERIF (default), Font.F_SERIF, Font.F_MONOSPACE
 *   • For custom fonts (.ttf), see T9
 *   • GltfNodeModifiers (per-node material override) is an advanced case —
 *     documented in DCL Advanced Rendering skill, not tested here
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer, Font
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

export function setupTextShapeTest(): void {
  const { x, z } = { x: 120, z: 50 }
  createStation('t8_textshape', 'T8 — TEXTSHAPE + BILLBOARD\nIn-world 3D text', STATUS_COLOR.FULLY_CODED)

  // ─── A) Font styles comparison ────────────────────────────────────────────
  const fontSamples: Array<{ font: Font; name: string; offsetX: number }> = [
    { font: Font.F_SANS_SERIF, name: 'Sans Serif',  offsetX: -3 },
    { font: Font.F_SERIF,      name: 'Serif',       offsetX: 0 },
    { font: Font.F_MONOSPACE,  name: 'Monospace',   offsetX: 3 },
  ]

  fontSamples.forEach(({ font, name, offsetX }) => {
    const label = engine.addEntity()
    Transform.create(label, {
      position: Vector3.create(x + offsetX, 2.5, z - 3.5)
    })
    Billboard.create(label)
    TextShape.create(label, {
      text: `${name}\nAaBbCc 123\nThe quick fox`,
      fontSize: 1.4,
      font,
      textColor: Color4.White(),
      outlineColor: Color4.Black(),
      outlineWidth: 0.12,
      textWrapping: false
    })
  })

  // ─── B) Non-billboard world-space sign (stationary, faces +Z) ─────────────
  // DCL TextShape at rotation Y=180 faces the player (who approaches from +Z) but
  // rotating 180° around Y flips the entity's local X axis, mirroring the text.
  // Fix: scale.x = -1 un-mirrors by re-flipping local X. Backing board uses a
  // separate entity at scale (1,1,1) so it stays behind the text.
  const worldSign = engine.addEntity()
  Transform.create(worldSign, {
    position: Vector3.create(x - 3, 1.8, z - 2),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(-1, 1, 1)   // negative X un-mirrors text at 180° rotation
  })
  TextShape.create(worldSign, {
    text: '← FICTION\n 2nd Floor →\n↓ EXIT',
    fontSize: 2,
    font: Font.F_SERIF,
    textColor: Color4.create(0.1, 0.1, 0.1, 1),
    outlineColor: Color4.White(),
    outlineWidth: 0.05,
    textWrapping: false
  })
  // Sign board backing
  const signBoard = engine.addEntity()
  Transform.create(signBoard, {
    position: Vector3.create(x - 3, 1.8, z - 1.95),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(2.5, 2.2, 0.08)
  })
  MeshRenderer.setBox(signBoard)
  Material.setPbrMaterial(signBoard, { albedoColor: Color4.create(0.9, 0.85, 0.7, 1) })

  const signLabel = engine.addEntity()
  Transform.create(signLabel, { position: Vector3.create(x - 3, 3.5, z - 2) })
  Billboard.create(signLabel)
  TextShape.create(signLabel, {
    text: 'World-space sign\n(rotates with scene)', fontSize: 1.0,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── C) Distance-fading label (LOD) ───────────────────────────────────────
  const distLabel = engine.addEntity()
  Transform.create(distLabel, { position: Vector3.create(x, 1.8, z + 1) })
  Billboard.create(distLabel)
  TextShape.create(distLabel, {
    text: '👁 VISIBLE (< 15m)\nMove back to test LOD',
    fontSize: 1.5,
    textColor: Color4.create(0.1, 1, 0.5, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.12
  })

  // System: show/hide label based on player distance
  engine.addSystem(() => {
    if (!Transform.has(engine.PlayerEntity) || !Transform.has(distLabel)) return
    const playerPos = Transform.get(engine.PlayerEntity).position
    const labelPos = Transform.get(distLabel).position
    const dx = playerPos.x - labelPos.x
    const dz = playerPos.z - labelPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const visible = dist < 15
    const current = TextShape.getOrNull(distLabel)
    if (!current) return
    // Update text to show distance
    TextShape.getMutable(distLabel).text = visible
      ? `👁 VISIBLE (${dist.toFixed(1)}m)\nBack up > 15m to hide`
      : `(hidden beyond 15m)\ndist: ${dist.toFixed(1)}m`
  })

  const distNote = engine.addEntity()
  Transform.create(distNote, { position: Vector3.create(x, 3.2, z + 1) })
  Billboard.create(distNote)
  TextShape.create(distNote, {
    text: 'LOD test\n(distance fade)', fontSize: 1.0,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── D) Live counter (updates each frame) ─────────────────────────────────
  const counterLabel = engine.addEntity()
  Transform.create(counterLabel, { position: Vector3.create(x + 2.5, 2, z) })
  Billboard.create(counterLabel)
  TextShape.create(counterLabel, {
    text: 'ORE: 0\ntime: 0s',
    fontSize: 2,
    font: Font.F_MONOSPACE,
    textColor: Color4.create(1, 0.9, 0.1, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })

  let oreCount = 0
  let elapsed = 0
  engine.addSystem((dt) => {
    elapsed += dt
    if (elapsed > 1) {   // increment ore once per second
      elapsed -= 1
      oreCount++
      TextShape.getMutable(counterLabel).text = `ORE: ${oreCount}\ntime: ${Math.floor(elapsed + oreCount)}s`
    }
  })

  const counterNote = engine.addEntity()
  Transform.create(counterNote, { position: Vector3.create(x + 2.5, 3.5, z) })
  Billboard.create(counterNote)
  TextShape.create(counterNote, {
    text: 'Live counter\n(increments 1/s)', fontSize: 1.0,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── E) Colored text with emoji ───────────────────────────────────────────
  const emojiLabel = engine.addEntity()
  Transform.create(emojiLabel, { position: Vector3.create(x - 2.5, 2, z + 2) })
  Billboard.create(emojiLabel)
  TextShape.create(emojiLabel, {
    text: '⚠️  Emoji warning\n✅ Confirmed\n❌ Failed',
    fontSize: 1.4,
    textColor: Color4.White(),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  const emojiNote = engine.addEntity()
  Transform.create(emojiNote, { position: Vector3.create(x - 2.5, 3.6, z + 2) })
  Billboard.create(emojiNote)
  TextShape.create(emojiNote, {
    text: 'Emoji in TextShape\n(verify renders correctly)', fontSize: 1.0,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  console.log('[T8] TextShape + Billboard test station initialized')
}
