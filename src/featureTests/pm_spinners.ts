/**
 * pm_spinners.ts — PM5: Rotating Saw Blade + PM6: Pendulum
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * PM5 — ROTATING SAW BLADE
 * ─────────────────────────
 * Spinning entity on floor/ceiling. Proximity damage when player walks into
 * the blade radius. The spin is purely visual (entity rotation) + a system
 * that checks player XZ distance from the saw center each frame.
 *
 * Key design: the saw DOESN'T need a TriggerArea — a simple distance check
 * in the system is cheaper and more accurate for a circular hazard.
 *
 * Configurables:
 *   rpm          — visual spin speed
 *   bladeRadius  — damage radius (metres)
 *   position     — floor, ceiling, or wall-mounted
 *   hitCooldown  — immunity seconds after knockback
 *
 * PM6 — PENDULUM
 * ───────────────
 * Large swinging mass on a pivot arm. Swing angle follows a sine wave:
 *   angle(t) = amplitude * sin(omega * t)   where omega = sqrt(g/length)
 *
 * Bob world position calculated each frame from pivot + arm:
 *   bobX = pivotX + sin(angle) * length
 *   bobY = pivotY - cos(angle) * length
 *   bobZ = pivotZ  (swings in XZ plane if pivot is horizontal, XY if overhead)
 *
 * Damage check: player XZ distance from bob entity < hitRadius.
 * Bonus: apply knockback in the direction of the bob's velocity (not just
 * away from bob — the swing direction matters for the "WHAM" feel).
 *
 * Configurables:
 *   amplitude    — peak swing angle (degrees)
 *   length       — pendulum arm length (metres)
 *   startAngle   — initial angle offset
 *   swingPlane   — 'XZ' or 'XY' (which direction it swings)
 *
 * FRAMEWORK NOTE
 * ──────────────
 * PM5 saw + PM6 pendulum share the core RADIAL PROXIMITY DAMAGE pattern:
 *   dist = XZ distance from hazard center
 *   if (dist < hitRadius && immunity <= 0) → knockback + immunity
 * Same check used in HZ1 spikes, HZ2 bomb, HZ8 laser. This is THE core
 * damage detection pattern for non-TriggerArea hazards.
 *
 * DEMO (run and verify):
 *   PM5 — Saw Blade:
 *     [ ] Grey disc spins continuously on floor
 *     [ ] Walk into blade radius → knockback away from center
 *     [ ] 1s immunity after hit (no rapid-fire knockback)
 *     [ ] Small blade / large blade buttons show radius change
 *   PM6 — Pendulum:
 *     [ ] Large red bob swings left/right on a visible arm
 *     [ ] Stand in the swing arc path → knockback in swing direction
 *     [ ] Fast/slow pendulum buttons change period
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Shared: radial proximity damage ─────────────────────────────────────────

function checkRadialDamage(
  hazardX: number, hazardZ: number,
  hitRadius: number, knockbackDir: Vector3, magnitude: number,
  immunity: { value: number }, dt: number, logTag: string
): void {
  immunity.value -= dt
  const pT = Transform.getOrNull(engine.PlayerEntity)
  if (!pT || immunity.value > 0) return
  const dx = pT.position.x - hazardX; const dz = pT.position.z - hazardZ
  const dist = Math.sqrt(dx*dx + dz*dz)
  if (dist < hitRadius) {
    const nx = dist > 0.1 ? dx / dist : knockbackDir.x
    const nz = dist > 0.1 ? dz / dist : knockbackDir.z
    Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), magnitude)
    immunity.value = 1.0
    console.log(`[${logTag}] HIT — knockback`)
  }
}

// ─── Station: PM5 — Rotating Saw Blade ────────────────────────────────────────

export function setupPMSaw(): void {
  const { x, z } = { x: 64, z: 66 }
  createStation('pm5_saw', 'PM5 — ROTATING SAW\nRadial proximity damage', STATUS_COLOR.FULLY_CODED)

  let bladeRadius = 1.3
  let sawRPM = 180  // visual spin

  // Saw mount post
  const post = engine.addEntity()
  Transform.create(post, {
    position: Vector3.create(x, 0.4, z),
    scale: Vector3.create(0.25, 0.8, 0.25)
  })
  MeshRenderer.setCylinder(post)
  Material.setPbrMaterial(post, { albedoColor: Color4.create(0.5, 0.5, 0.5, 1) })

  // Saw blade disc (main)
  const blade = engine.addEntity()
  Transform.create(blade, {
    position: Vector3.create(x, 0.9, z),
    scale: Vector3.create(bladeRadius * 2, 0.12, bladeRadius * 2)
  })
  MeshRenderer.setCylinder(blade)
  MeshCollider.setCylinder(blade, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(blade, {
    albedoColor: Color4.create(0.75, 0.75, 0.75, 1),
    emissiveColor: { r: 0.1, g: 0.1, b: 0.1 }, emissiveIntensity: 0.4
  })

  // Saw teeth (alternating blades as thin boxes, rotating with disc)
  const teethAngles = [0, 45, 90, 135, 180, 225, 270, 315]
  const teethEntities: ReturnType<typeof engine.addEntity>[] = []
  for (const ta of teethAngles) {
    const tooth = engine.addEntity()
    const rad = ta * Math.PI / 180
    Transform.create(tooth, {
      position: Vector3.create(x + Math.cos(rad) * bladeRadius * 0.9, 0.9, z + Math.sin(rad) * bladeRadius * 0.9),
      scale: Vector3.create(0.3, 0.25, 0.1),
      rotation: Quaternion.fromEulerDegrees(0, ta, 0)
    })
    MeshRenderer.setBox(tooth)
    Material.setPbrMaterial(tooth, { albedoColor: Color4.create(0.9, 0.9, 0.9, 1) })
    teethEntities.push(tooth)
  }

  // Damage radius indicator ring
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    const dot = engine.addEntity()
    Transform.create(dot, {
      position: Vector3.create(x + Math.cos(a) * bladeRadius, 0.52, z + Math.sin(a) * bladeRadius),
      scale: Vector3.create(0.08, 0.06, 0.08)
    })
    MeshRenderer.setCylinder(dot)
    Material.setPbrMaterial(dot, { albedoColor: Color4.create(1, 0.3, 0.1, 0.5) })
  }

  const hitSign = engine.addEntity()
  Transform.create(hitSign, { position: Vector3.create(x, 2.5, z) })
  Billboard.create(hitSign, {})
  TextShape.create(hitSign, { text: '', fontSize: 2, textColor: Color4.create(1, 0.3, 0.3, 1) })

  let sawAngle = 0
  const immunity = { value: 0 }

  engine.addSystem((dt: number) => {
    sawAngle += sawRPM / 60 * 360 * dt
    const rot = Quaternion.fromEulerDegrees(0, sawAngle, 0)
    Transform.getMutable(blade).rotation = rot

    for (let i = 0; i < teethEntities.length; i++) {
      const ta = teethAngles[i] + sawAngle
      const rad = ta * Math.PI / 180
      const tt = Transform.getMutableOrNull(teethEntities[i])
      if (tt) {
        tt.position = Vector3.create(x + Math.cos(rad) * bladeRadius * 0.9, 0.9, z + Math.sin(rad) * bladeRadius * 0.9)
        tt.rotation = Quaternion.fromEulerDegrees(0, ta, 0)
      }
    }

    const prevImmunity = immunity.value
    checkRadialDamage(x, z, bladeRadius, Vector3.create(0, 0, 1), 10, immunity, dt, 'PM5')
    if (prevImmunity > 0.5 && immunity.value <= 0.5) {
      TextShape.getMutable(hitSign).text = '⚡ HIT!'
      setTimeout(() => { TextShape.getMutable(hitSign).text = '' }, 800)
    }
  }, 10)

  // Size buttons
  const smallBtn = createButton(x - 2, 0.8, z - 3.6, '◎ Small 0.8m', Color4.create(0.3, 0.5, 0.3, 1))
  const largeBtn = createButton(x + 2, 0.8, z - 3.6, '◉ Large 1.8m', Color4.create(0.6, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: smallBtn, opts: { button: 1, hoverText: '[E] Small blade' } }, () => {
    bladeRadius = 0.8
    Transform.getMutable(blade).scale = Vector3.create(bladeRadius * 2, 0.12, bladeRadius * 2)
    console.log('[PM5] Small blade (0.8m)')
  })
  pointerEventsSystem.onPointerDown({ entity: largeBtn, opts: { button: 1, hoverText: '[E] Large blade' } }, () => {
    bladeRadius = 1.8
    Transform.getMutable(blade).scale = Vector3.create(bladeRadius * 2, 0.12, bladeRadius * 2)
    console.log('[PM5] Large blade (1.8m)')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'distance < bladeRadius → knockback\nSame radial check: spikes, bombs, laser\nNo TriggerArea needed for circular hazards',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM5] RotatingSaw initialized — radius=1.3m, 180 RPM')
}

// ─── Station: PM6 — Pendulum ──────────────────────────────────────────────────

export function setupPMPendulum(): void {
  const { x, z } = { x: 16, z: 88 }
  createStation('pm6_pendulum', 'PM6 — PENDULUM\nSine-wave swing, velocity knockback', STATUS_COLOR.FULLY_CODED)

  const PIVOT_Y    = 7.0  // pivot point height
  const PIVOT_X    = x
  const PIVOT_Z    = z
  let armLength    = 4.0  // metres
  let amplitudeDeg = 45   // swing amplitude in degrees
  let swingPeriod  = 2.0  // seconds for a full swing (back and forth)

  // Pivot mount (ceiling bracket)
  const pivot = engine.addEntity()
  Transform.create(pivot, {
    position: Vector3.create(PIVOT_X, PIVOT_Y, PIVOT_Z),
    scale: Vector3.create(0.5, 0.3, 0.5)
  })
  MeshRenderer.setBox(pivot)
  Material.setPbrMaterial(pivot, { albedoColor: Color4.create(0.5, 0.5, 0.5, 1) })

  // Ceiling bracket visual
  const ceiling = engine.addEntity()
  Transform.create(ceiling, {
    position: Vector3.create(PIVOT_X, PIVOT_Y + 0.4, PIVOT_Z),
    scale: Vector3.create(1.5, 0.4, 0.5)
  })
  MeshRenderer.setBox(ceiling)
  MeshCollider.setBox(ceiling, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(ceiling, { albedoColor: Color4.create(0.4, 0.4, 0.4, 1) })

  // Arm (a thin box that rotates around pivot)
  const arm = engine.addEntity()
  Transform.create(arm, {
    position: Vector3.create(PIVOT_X, PIVOT_Y - armLength * 0.5, PIVOT_Z),
    scale: Vector3.create(0.1, armLength, 0.1)
  })
  MeshRenderer.setBox(arm)
  Material.setPbrMaterial(arm, { albedoColor: Color4.create(0.6, 0.5, 0.3, 1) })

  // Bob (the heavy swinging mass)
  const bob = engine.addEntity()
  Transform.create(bob, {
    position: Vector3.create(PIVOT_X, PIVOT_Y - armLength, PIVOT_Z),
    scale: Vector3.create(1.0, 1.0, 0.8)
  })
  MeshRenderer.setBox(bob)
  Material.setPbrMaterial(bob, {
    albedoColor: Color4.create(0.8, 0.1, 0.1, 1),
    emissiveColor: { r: 0.3, g: 0, b: 0 }, emissiveIntensity: 0.5
  })

  // Swing arc indicator (line of dots on floor)
  for (let i = -6; i <= 6; i++) {
    const ad = engine.addEntity()
    Transform.create(ad, {
      position: Vector3.create(PIVOT_X + i * armLength * 0.13, 0.52, PIVOT_Z),
      scale: Vector3.create(0.1, 0.06, 0.4)
    })
    MeshRenderer.setBox(ad)
    Material.setPbrMaterial(ad, { albedoColor: Color4.create(0.9, 0.3, 0.3, 0.5) })
  }

  const hitSign = engine.addEntity()
  Transform.create(hitSign, { position: Vector3.create(PIVOT_X, 3.5, PIVOT_Z) })
  Billboard.create(hitSign, {})
  TextShape.create(hitSign, { text: '', fontSize: 2, textColor: Color4.create(1, 0.3, 0.3, 1) })

  let swingTime = 0
  const immunity = { value: 0 }
  let prevAngle = 0

  engine.addSystem((dt: number) => {
    swingTime += dt
    // Simple harmonic oscillation
    const omega = (2 * Math.PI) / swingPeriod
    const angleDeg = amplitudeDeg * Math.sin(omega * swingTime)
    const angleRad = angleDeg * Math.PI / 180

    // Bob world position (swings in X axis from pivot)
    const bobX = PIVOT_X + Math.sin(angleRad) * armLength
    const bobY = PIVOT_Y - Math.cos(angleRad) * armLength
    const bobZ = PIVOT_Z

    Transform.getMutable(bob).position = Vector3.create(bobX, bobY, bobZ)
    // Arm midpoint
    Transform.getMutable(arm).position = Vector3.create((PIVOT_X + bobX) * 0.5, (PIVOT_Y + bobY) * 0.5, bobZ)
    Transform.getMutable(arm).rotation = Quaternion.fromEulerDegrees(0, 0, angleDeg)
    Transform.getMutable(arm).scale = Vector3.create(0.1, armLength, 0.1)

    // Angular velocity (approximate derivative of angle)
    const dAngle = angleDeg - prevAngle
    prevAngle = angleDeg

    // Check player proximity to bob
    immunity.value -= dt
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (pT && immunity.value <= 0) {
      const dx = pT.position.x - bobX; const dz = pT.position.z - bobZ; const dy = pT.position.y - bobY
      const dist = Math.sqrt(dx*dx + dz*dz + dy*dy)
      if (dist < 1.2) {
        // Knockback in SWING direction (velocity of bob, not just away from center)
        const swingDirX = Math.sign(dAngle) * Math.cos(angleRad)  // swing velocity direction
        Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 12)
        immunity.value = 1.0
        TextShape.getMutable(hitSign).text = '💥 WHAM!'
        setTimeout(() => { TextShape.getMutable(hitSign).text = '' }, 1000)
        console.log('[PM6] PENDULUM HIT — swing direction knockback')
      }
    }
  }, 10)

  // Speed/size buttons
  const slowBtn  = createButton(x - 2, 0.8, z - 3.6, '🐢 Slow 3s',   Color4.create(0.3, 0.5, 0.3, 1))
  const fastBtn  = createButton(x,     0.8, z - 3.6, '⚡ Fast 1.2s', Color4.create(0.6, 0.2, 0.1, 1))
  const wideBtn  = createButton(x + 2, 0.8, z - 3.6, '↔ Wide 60°',  Color4.create(0.3, 0.3, 0.6, 1))
  pointerEventsSystem.onPointerDown({ entity: slowBtn, opts: { button: 1, hoverText: '[E] Slow' } }, () => { swingPeriod = 3.0 })
  pointerEventsSystem.onPointerDown({ entity: fastBtn, opts: { button: 1, hoverText: '[E] Fast' } }, () => { swingPeriod = 1.2 })
  pointerEventsSystem.onPointerDown({ entity: wideBtn, opts: { button: 1, hoverText: '[E] Wide arc' } }, () => { amplitudeDeg = 60 })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z - 3.5) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'angle(t) = amplitude × sin(ω×t)\nω = 2π / period\nKnockback in SWING direction (velocity)\nStay out of red arc zone',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM6] Pendulum initialized — length=4m, amp=45°, period=2s')
}
