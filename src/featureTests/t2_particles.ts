/**
 * T2 — Particle System
 * STATUS: 🟩 FULLY CODED — no assets needed (code-only component)
 *
 * Tests:
 *   A) Continuous campfire (sphere emitter, warm colors, smoke)
 *   B) Ore sparkle burst on button press (gold particles)
 *   C) Rain/snow downward directional emitter
 *   D) Emissive mesh fallback for Bevy (pulsing sphere Tween)
 *
 * VERIFY (Unity Desktop Explorer only):
 *   - Campfire shows orange/red particles rising upward continuously
 *   - Ore sparkle bursts gold/white when button pressed
 *   - Rain/snow streams downward
 *   - On Bevy: NO particles visible (expected) — verify emissive fallback IS visible
 *
 * GAME APPLICATIONS:
 *   OreMonger  — ore vein sparkle, explosion dust on mine blast, lava drops
 *   GhostTown  — ghost VFX (spectral cool particles), haunted smoke/mist
 *   MonsterLibrary — book dust when thrown, ghost trail
 *
 * SDK NOTES:
 *   • ParticleSystem is Unity Explorer only — Bevy/mobile silently ignores it.
 *   • ALWAYS provide a fallback: emissive animated mesh, baked GLTF animation, etc.
 *   • Transform.scale does NOT affect particle size — use the ParticleSystem.initialSize field.
 *   • Per-scene particle budget: 50,000 live particles max (mobile: 25,000 soft limit).
 *   • Per-emitter max: 5,000 particles (mobile: clamped at runtime).
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, Tween, TweenLoop, EasingFunction,
  ColliderLayer, VisibilityComponent
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ParticleSystem import — available in SDK 7.x
// If this import causes a TS error, ensure @dcl/sdk is on latest
let ParticleSystem: any
let PBParticleSystem: any
try {
  // @ts-ignore — require works in DCL/esbuild QuickJS context
  const sdkEcs = require('@dcl/sdk/ecs') as any
  ParticleSystem = sdkEcs.ParticleSystem
  PBParticleSystem = sdkEcs.PBParticleSystem
} catch {
  ParticleSystem = null
  console.error('[T2] ParticleSystem not found in SDK — update @dcl/sdk to latest')
}

function createParticleEmitter(
  position: { x: number; y: number; z: number },
  config: object
): ReturnType<typeof engine.addEntity> {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(position.x, position.y, position.z) })
  if (ParticleSystem) {
    try {
      ParticleSystem.create(e, config)
    } catch (err) {
      console.error('[T2] ParticleSystem.create failed:', err)
    }
  }
  return e
}

export function setupParticlesTest(): void {
  const { x, z } = { x: 108, z: 22 }
  createStation('t2_particles', 'T2 — PARTICLE SYSTEM\n(Unity Desktop only)', STATUS_COLOR.FULLY_CODED)

  // ─── A) Campfire — continuous upward emitter ───────────────────────────────
  const campfireBase = engine.addEntity()
  Transform.create(campfireBase, {
    position: Vector3.create(x - 2.5, 0.6, z - 2),
    scale: Vector3.create(0.8, 0.8, 0.8)
  })
  MeshRenderer.setCylinder(campfireBase)
  Material.setPbrMaterial(campfireBase, { albedoColor: Color4.create(0.3, 0.2, 0.1, 1) })

  createParticleEmitter({ x: x - 2.5, y: 0.9, z: z - 2 }, {
    emitterShape: { $case: 'sphere', sphere: { radius: 0.3 } },
    // Emission
    emissionRate: 20,
    maxParticles: 60,
    // Lifetime
    startLifetime: { min: 1.2, max: 2.0 },
    // Initial velocity — upward with spread
    startSpeed: { min: 1.5, max: 3.0 },
    startDirection: { $case: 'direction', direction: { x: 0, y: 1, z: 0 } },
    spreadAngle: 30,
    // Size
    startSize: { min: 0.08, max: 0.18 },
    // Color gradient: yellow → orange → transparent
    startColor: {
      colorGradient: {
        colors: [
          { time: 0, color: { r: 1.0, g: 0.8, b: 0.1, a: 1.0 } },
          { time: 0.5, color: { r: 1.0, g: 0.3, b: 0.0, a: 0.8 } },
          { time: 1.0, color: { r: 0.3, g: 0.3, b: 0.3, a: 0.0 } }
        ]
      }
    },
    // Gravity — slight upward
    gravity: { x: 0, y: 0.5, z: 0 }
  })

  // Emissive fallback for Bevy (always visible)
  const campfireFallback = engine.addEntity()
  Transform.create(campfireFallback, {
    position: Vector3.create(x - 2.5, 1.1, z - 2),
    scale: Vector3.create(0.3, 0.3, 0.3)
  })
  MeshRenderer.setSphere(campfireFallback)
  Material.setPbrMaterial(campfireFallback, {
    albedoColor: Color4.create(0, 0, 0, 1),
    emissiveColor: Color3.create(1, 0.4, 0),
    emissiveIntensity: 2
  })
  // Pulse tween for Bevy fallback
  Tween.create(campfireFallback, {
    mode: { $case: 'scale', scale: {
      start: Vector3.create(0.3, 0.3, 0.3),
      end: Vector3.create(0.5, 0.6, 0.5)
    } },
    duration: 600,
    easingFunction: EasingFunction.EF_EASEINQUAD,
    currentTime: 0,
    playing: true
  })
  // Loop the tween
  // TweenLoop ping-pong: use Tween pairs instead
  // TweenLoop.createOrReplace not available in SDK 7.33 — skipped

  const campfireLabel = engine.addEntity()
  Transform.create(campfireLabel, { position: Vector3.create(x - 2.5, 2.5, z - 2) })
  Billboard.create(campfireLabel)
  TextShape.create(campfireLabel, {
    text: 'Campfire\n(+ fallback glow)', fontSize: 1.2,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── B) Ore Sparkle — burst on button press ────────────────────────────────
  let sparkleEmitter: ReturnType<typeof engine.addEntity> | null = null
  let sparkleActive = false

  const oreNode = engine.addEntity()
  Transform.create(oreNode, {
    position: Vector3.create(x, 0.9, z - 2),
    scale: Vector3.create(0.7, 0.7, 0.7)
  })
  MeshRenderer.setSphere(oreNode)
  Material.setPbrMaterial(oreNode, {
    albedoColor: Color4.create(0.1, 0.1, 0.1, 1),
    emissiveColor: Color3.create(1, 0.8, 0),
    emissiveIntensity: 0.5,
    metallic: 0.9,
    roughness: 0.2
  })
  MeshCollider.setSphere(oreNode, ColliderLayer.CL_POINTER)

  const oreLabel = engine.addEntity()
  Transform.create(oreLabel, { position: Vector3.create(x, 2.2, z - 2) })
  Billboard.create(oreLabel)
  TextShape.create(oreLabel, {
    text: '[E] ORE SPARKLE\n(burst particles)', fontSize: 1.2,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  pointerEventsSystem.onPointerDown(
    { entity: oreNode, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Mine Ore!' } },
    () => {
      console.log('[T2] Ore sparkle burst triggered')
      if (sparkleEmitter) engine.removeEntity(sparkleEmitter)
      // Create a short-lived burst emitter
      sparkleEmitter = createParticleEmitter({ x, y: 0.9, z: z - 2 }, {
        emitterShape: { $case: 'sphere', sphere: { radius: 0.2 } },
        emissionRate: 0,          // burst mode
        burstCount: 40,           // 40 particles in one burst
        maxParticles: 40,
        startLifetime: { min: 0.5, max: 1.2 },
        startSpeed: { min: 2, max: 5 },
        spreadAngle: 180,         // all directions
        startSize: { min: 0.05, max: 0.15 },
        startColor: {
          colorGradient: {
            colors: [
              { time: 0, color: { r: 1, g: 0.9, b: 0.1, a: 1 } },
              { time: 0.5, color: { r: 1, g: 1, b: 1, a: 0.8 } },
              { time: 1, color: { r: 1, g: 0.5, b: 0, a: 0 } }
            ]
          }
        },
        gravity: { x: 0, y: -2, z: 0 }
      })
    }
  )

  // ─── C) Rain / Snow Zone ───────────────────────────────────────────────────
  createParticleEmitter({ x: x + 2.5, y: 3.5, z: z - 1 }, {
    emitterShape: { $case: 'box', box: { size: { x: 2.5, y: 0.1, z: 2.5 } } },
    emissionRate: 50,
    maxParticles: 200,
    startLifetime: { min: 2, max: 3 },
    startSpeed: { min: 3, max: 5 },
    startDirection: { $case: 'direction', direction: { x: 0, y: -1, z: 0 } },
    spreadAngle: 5,
    startSize: { min: 0.03, max: 0.06 },
    startColor: {
      colorGradient: {
        colors: [
          { time: 0, color: { r: 0.8, g: 0.9, b: 1, a: 0.9 } },
          { time: 1, color: { r: 0.8, g: 0.9, b: 1, a: 0 } }
        ]
      }
    },
    gravity: { x: 0, y: 0, z: 0 }   // gravity disabled — speed drives it down
  })

  const rainLabel = engine.addEntity()
  Transform.create(rainLabel, { position: Vector3.create(x + 2.5, 4.5, z - 1) })
  Billboard.create(rainLabel)
  TextShape.create(rainLabel, {
    text: 'Rain / Snow\nemitter', fontSize: 1.2,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  console.log('[T2] Particle System test station initialized')
  if (!ParticleSystem) {
    console.error('[T2] ⚠️  ParticleSystem unavailable — update SDK to see particles')
  }
}
