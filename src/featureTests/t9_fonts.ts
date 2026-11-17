/**
 * T9 — Fonts (.ttf / fontSrc)
 * STATUS: 🟨 NEEDS ASSET — font file(s) needed
 *
 * ASSETS NEEDED (choose one or more based on games to test):
 *   assets/fonts/Cinzel-Regular.ttf    — library/gothic serif (MonsterLibrary)
 *   assets/fonts/Oswald-Bold.ttf       — industrial stencil (OreMonger)
 *   assets/fonts/Creepster-Regular.ttf — horror hand (GhostTown)
 *
 *   Source: Google Fonts (fonts.google.com) — all OFL licensed (redistributable)
 *   Download the .ttf file, place in assets/fonts/
 *   SDK 7.31.0+ required (check package.json — "latest" should be fine)
 *
 * Tests:
 *   A) Built-in font comparison (sans-serif / serif / monospace) — FULLY CODED
 *   B) Custom .ttf on TextShape (3D world text) — NEEDS ASSET
 *   C) Custom .ttf on UI Label (screen overlay) — NEEDS ASSET
 *   D) Mobile fallback demonstration — always shows built-in font
 *
 * VERIFY:
 *   - Built-in fonts show baseline (always works)
 *   - Custom font renders in local preview (after npm run start + asset bundle)
 *   - If asset bundle not ready yet: custom font shows built-in fallback (not an error)
 *   - Mobile/Bevy: always shows built-in fallback font (expected)
 *
 * SDK NOTES:
 *   • fontSrc requires @dcl/sdk 7.31.0+
 *   • Font converts via asset bundle (auto in local preview; delay after deploy)
 *   • ALWAYS set font: (built-in fallback) next to fontSrc
 *   • Mobile app ignores fontSrc entirely — always built-in
 *   • Max 2 distinct font files per scene recommended (each ~700KB asset bundle)
 *   • If the custom font still shows fallback after preview starts:
 *     Check the AB panel in Explorer debug menu for asset bundle errors
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard, Font
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { ReactEcs, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// Font paths — place these files in assets/fonts/ before testing
// NOTE: Variable fonts placed — renders at default weight (regular), not bold for Oswald.
// If bold weight is critical for OreMonger, swap Oswald-VariableFont_wght.ttf for a static Oswald-Bold.ttf.
const FONT_LIBRARY   = 'assets/fonts/Cinzel-VariableFont_wght.ttf'   // ✅ placed
const FONT_INDUSTRIAL = 'assets/fonts/Oswald-VariableFont_wght.ttf'  // ✅ placed (variable — renders regular weight)
const FONT_HORROR    = 'assets/fonts/Creepster-Regular.ttf'          // ✅ placed

export function setupFontsTest(): void {
  const { x, z } = { x: 132, z: 50 }
  createStation('t9_fonts', 'T9 — CUSTOM FONTS\nfontSrc .ttf (SDK 7.31+)', STATUS_COLOR.FULLY_CODED)

  // ─── A) Built-in font comparison (baseline — always works) ────────────────
  const baselines = [
    { font: Font.F_SANS_SERIF, label: 'Sans-Serif (default)', x: x - 3,   color: Color4.White() },
    { font: Font.F_SERIF,      label: 'Serif (fallback)',      x: x,       color: Color4.White() },
    { font: Font.F_MONOSPACE,  label: 'Monospace (fallback)',  x: x + 3,   color: Color4.White() },
  ]
  baselines.forEach(({ font, label, x: bx, color }) => {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(bx, 2.0, z - 3.5) })
    Billboard.create(e)
    TextShape.create(e, {
      text: `${label}\nAaBbCc 0-9\nThe quick fox`,
      fontSize: 1.3, font,
      textColor: color,
      outlineColor: Color4.Black(), outlineWidth: 0.1
    })
  })

  // ─── B) Custom .ttf TextShape (3D world text) ──────────────────────────────
  // These will show the built-in fallback if the font files are missing.
  // Once fonts are placed in assets/fonts/, they auto-bundle in local preview.

  const fontSamples = [
    { path: FONT_LIBRARY,    fallback: Font.F_SERIF,      label: 'Cinzel\n(MonsterLibrary)', color: Color4.create(0.9, 0.85, 0.7, 1), zOffset: -1 },
    { path: FONT_INDUSTRIAL, fallback: Font.F_SANS_SERIF, label: 'Oswald Bold\n(OreMonger)', color: Color4.create(0.7, 0.9, 0.3, 1),  zOffset: 1 },
    { path: FONT_HORROR,     fallback: Font.F_SERIF,      label: 'Creepster\n(GhostTown)',   color: Color4.create(1, 0.3, 0.3, 1),     zOffset: 3 },
  ]

  fontSamples.forEach(({ path, fallback, label, color, zOffset }) => {
    // Font label (3D world sign)
    const sign = engine.addEntity()
    Transform.create(sign, { position: Vector3.create(x, 2.5, z + zOffset) })
    Billboard.create(sign)
    TextShape.create(sign, {
      text: `The Haunted Library\n12 items • Floor 2\n${label}`,
      fontSize: 1.4,
      font: fallback,       // ← ALWAYS set fallback
      fontSrc: path,        // ← custom font (shows fallback if file missing)
      textColor: color,
      outlineColor: Color4.Black(), outlineWidth: 0.12
    })

    // Status note below
    const note = engine.addEntity()
    Transform.create(note, { position: Vector3.create(x, 1.0, z + zOffset) })
    Billboard.create(note)
    TextShape.create(note, {
      text: `fontSrc: ${path.split('/').pop()}\n🟨 file needed in assets/fonts/`,
      fontSize: 0.9,
      textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.08
    })
  })

  // ─── C) UI Label with custom font ─────────────────────────────────────────
  // This wires the font to a React-ECS UI panel.
  // The font file needs to be in assets/fonts/ for it to render.
  // Note: Creator Hub UI Designer doesn't show fontSrc, but it survives saves.

  // We set up a small HUD label that shows the font test.
  // This is a minimal React-ECS label — the full UI system is already running
  // in this scene via UiManager, so we just add an extra element.
  // If font files are missing, this shows the fallback font.

  const { ReactEcsRenderer } = require('@dcl/sdk/react-ecs') as any
  // The UI renderer is already set up by UiManager in this scene.
  // Adding a secondary renderer would conflict.
  // Instead, we document the font usage pattern here and test it via TextShape.
  // A standalone test scene would be better for the UI font test.

  // Note label for the UI font limitation
  const uiNote = engine.addEntity()
  Transform.create(uiNote, { position: Vector3.create(x, 4, z + 5) })
  Billboard.create(uiNote)
  TextShape.create(uiNote, {
    text: 'UI font test:\nSee DCL Fonts skill\nfor Label + fontSrc code\n(needs dedicated scene)',
    fontSize: 1.0,
    textColor: Color4.create(0.7, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  console.log('[T9] Fonts test station initialized')
  console.log('[T9] 🟨 ASSETS NEEDED (place in assets/fonts/):')
  console.log('[T9]   Cinzel-VariableFont_wght.ttf  — placed ✔')
  console.log('[T9]   Oswald-VariableFont_wght.ttf   — placed ✔ (variable font, renders at regular weight)')
  console.log('[T9]   Creepster-Regular.ttf  — fonts.google.com/specimen/Creepster')
  console.log('[T9]   All are OFL licensed (safe to redistribute with the scene)')
  console.log('[T9]   SDK minimum: 7.31.0 (fontSrc field not available on older SDK)')
}
