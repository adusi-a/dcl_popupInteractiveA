/**
 * T4 — Lighting Environment: Skybox / Sun / EnvironmentFog (SDK 7.32.0)
 * STATUS: 🟩 CODED (color presets) | 🟨 ONE ASSET NEEDED (custom texture)
 *
 * ASSET NEEDED:
 *   assets/skybox/night_mine.jpg  — equirectangular panorama, 2048×1024 px
 *   Source: Polyhaven.com (search "night sky"), HDR → equirectangular JPG
 *   Or generate via GenerateImage (ask AI for a DCL-compatible 2:1 lat-long sky)
 *
 * Tests:
 *   A) Default  — removes all overrides, back to DCL default sky
 *   B) Mine Night — dark blue-black sky, dense grey fog, dim yellow sun fixed overhead
 *   C) Ghost Moon — purple-tinted sky, pale cool sun, light silver fog
 *   D) Sunrise   — warm gradient (zenith blue, horizon orange), golden sun at angle
 *   E) Full Dark  — sun intensity 0, stars visible, almost no ambient
 *   F) Custom Texture — equirectangular PNG/JPG (ASSET NEEDED — see above)
 *
 * VERIFY:
 *   - Each preset visibly changes the sky on button press
 *   - Neighboring scene content is also affected (expected per DCL docs)
 *   - On Bevy: default sky shows (expected — Skybox/Sun/Fog are Unity desktop only)
 *   - Console logs confirm component create/delete
 *
 * GAME APPLICATIONS:
 *   OreMonger  — dark mine atmosphere (preset B)
 *   GhostTown  — eerie purple moonlit sky (preset C)
 *   MonsterLibrary — dim library interior atmosphere
 *
 * SDK NOTES (7.32.0):
 *   • Skybox, Sun, EnvironmentFog must be on engine.RootEntity ONLY
 *   • Unity Desktop only — Bevy/mobile show default sky
 *   • Changes apply immediately, no transition (unlike SkyboxTime which transitions)
 *   • Neighboring parcels render with your overrides while player is inside
 *   • ColorGradient: time 0.0=midnight, 0.5=noon, 1.0=midnight
 *   • skyboxTexture must be equirectangular (2:1 lat-long), horizontal center = +Z
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, Skybox, Sun, EnvironmentFog, SkyboxTime,
  ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

/** Helper: set a constant ColorGradient (single key) */
function constGradient(r: number, g: number, b: number, a = 1) {
  return { keys: [{ time: 0, color: { r, g, b, a } }] }
}

export function setupSkyboxTest(): void {
  const { x, z } = { x: 132, z: 22 }
  createStation('t4_skybox', 'T4 — SKYBOX / SUN / FOG\n(SDK 7.32.0 — Unity only)', STATUS_COLOR.FULLY_CODED)

  // Status label — updates on preset change
  const statusLabel = engine.addEntity()
  Transform.create(statusLabel, { position: Vector3.create(x, 5.5, z) })
  Billboard.create(statusLabel)
  TextShape.create(statusLabel, {
    text: 'Press a preset button →', fontSize: 1.4,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  function setStatus(msg: string) {
    TextShape.getMutable(statusLabel).text = msg
    console.log(`[T4] Skybox preset: ${msg}`)
  }

  // ─── Preset buttons ─────────────────────────────────────────────────────

  const presets: Array<{ label: string; color: Color4; apply: () => void }> = [
    {
      label: '[E] A: Default\n(remove overrides)',
      color: COLOR4_GRAY,
      apply: () => {
        setStatus('DEFAULT — overrides removed')
        Skybox.deleteFrom(engine.RootEntity)
        Sun.deleteFrom(engine.RootEntity)
        EnvironmentFog.deleteFrom(engine.RootEntity)
        SkyboxTime.deleteFrom(engine.RootEntity)
      }
    },
    {
      label: '[E] B: Mine Night\n(dark + dense fog)',
      color: Color4.create(0.1, 0.15, 0.3, 1),
      apply: () => {
        setStatus('MINE NIGHT')
        SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 0 })  // midnight
        Skybox.createOrReplace(engine.RootEntity, {
          skyColors: {
            zenith: constGradient(0.02, 0.02, 0.08),
            horizon: constGradient(0.05, 0.08, 0.15),
            nadir: constGradient(0.01, 0.01, 0.03)
          },
          stars: { brightness: 8 }
        })
        Sun.createOrReplace(engine.RootEntity, {
          intensity: 0.08,
          color: constGradient(1, 0.9, 0.5),
          direction: Vector3.create(0, -1, 0)   // straight down (overhead)
        })
        EnvironmentFog.createOrReplace(engine.RootEntity, {
          color: constGradient(0.08, 0.1, 0.12),
          density: 0.025   // heavy — 2/3 of view fogged at ~40m
        })
      }
    },
    {
      label: '[E] C: Ghost Moon\n(purple + mist)',
      color: Color4.create(0.3, 0.1, 0.4, 1),
      apply: () => {
        setStatus('GHOST MOON')
        SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 7200 })  // ~2am
        Skybox.createOrReplace(engine.RootEntity, {
          skyColors: {
            zenith: constGradient(0.08, 0.02, 0.18),
            horizon: constGradient(0.3, 0.1, 0.4),
            nadir: constGradient(0.05, 0.01, 0.1)
          },
          stars: { brightness: 6 }
        })
        Sun.createOrReplace(engine.RootEntity, {
          intensity: 0.15,
          color: constGradient(0.7, 0.75, 1.0),
          direction: Vector3.create(0.3, -0.7, 0.4)
        })
        EnvironmentFog.createOrReplace(engine.RootEntity, {
          color: constGradient(0.2, 0.1, 0.3),
          density: 0.008
        })
      }
    },
    {
      label: '[E] D: Sunrise\n(warm gradient)',
      color: Color4.create(1, 0.5, 0.1, 1),
      apply: () => {
        setStatus('SUNRISE')
        SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 21600 })  // 6am
        Skybox.createOrReplace(engine.RootEntity, {
          skyColors: {
            zenith: constGradient(0.2, 0.4, 0.8),
            horizon: constGradient(1.0, 0.5, 0.15),
            nadir: constGradient(0.3, 0.2, 0.1),
            rim: constGradient(1.2, 0.6, 0.0)   // HDR sunrise glow at horizon
          },
          clouds: { opacity: 0.6, speed: 0.005, color: constGradient(1, 0.7, 0.4) }
        })
        Sun.createOrReplace(engine.RootEntity, {
          intensity: 0.8,
          color: constGradient(1.0, 0.65, 0.3),
          direction: Vector3.create(-0.6, -0.4, 0.5)   // low eastern angle
        })
        EnvironmentFog.createOrReplace(engine.RootEntity, {
          color: constGradient(1.0, 0.7, 0.4),
          density: 0.003
        })
      }
    },
    {
      label: '[E] E: Full Dark\n(sun off, stars)',
      color: Color4.create(0.05, 0.05, 0.05, 1),
      apply: () => {
        setStatus('FULL DARK')
        SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 0 })
        Skybox.createOrReplace(engine.RootEntity, {
          skyColors: {
            zenith: constGradient(0, 0, 0.01),
            horizon: constGradient(0, 0, 0.02),
            nadir: constGradient(0, 0, 0)
          },
          stars: { brightness: 15 },   // HDR stars
          clouds: { opacity: 0 }
        })
        Sun.createOrReplace(engine.RootEntity, {
          intensity: 0,       // sun off
          visible: false      // hide disc
        })
        EnvironmentFog.deleteFrom(engine.RootEntity)
      }
    },
    {
      label: '[E] F: Custom SKY\n(NEEDS ASSET)',
      color: COLOR4_YELLOW,
      apply: () => {
        const path = 'assets/skybox/night_mine.jpg'
        setStatus(`CUSTOM TEXTURE — ${path}`)
        // 🟨 ASSET NEEDED: assets/skybox/night_mine.jpg
        // 2048×1024 equirectangular panorama, JPG for filesize
        // If file missing, default sky stays in place (no error thrown)
        Skybox.createOrReplace(engine.RootEntity, {
          skyboxTexture: path   // horizontal center = +Z (north of scene)
        })
        Sun.createOrReplace(engine.RootEntity, {
          intensity: 0.4,
          visible: false   // hide disc — it would show through the texture
        })
        EnvironmentFog.createOrReplace(engine.RootEntity, {
          color: constGradient(0.05, 0.08, 0.1),
          density: 0.004
        })
      }
    }
  ]

  presets.forEach((p, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const bx = x - 2.5 + col * 2.6
    const bz = z - 3 + row * 2.2
    const btn = createButton(bx, 1.0, bz, p.label, p.color)
    pointerEventsSystem.onPointerDown(
      { entity: btn, opts: { button: InputAction.IA_PRIMARY, hoverText: p.label.split('\n')[0] } },
      p.apply
    )
  })

  console.log('[T4] Skybox/Sun/Fog test station initialized')
  console.log('[T4] ⚠️  Skybox/Sun/Fog requires Unity Desktop — invisible on Bevy')
  console.log('[T4] 🟨 Custom texture test needs: assets/skybox/night_mine.jpg (2048x1024 equirect)')
}

const COLOR4_GRAY = Color4.create(0.5, 0.5, 0.5, 1)
const COLOR4_YELLOW = Color4.create(0.9, 0.7, 0.1, 1)
