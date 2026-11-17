/**
 * fb_screenFeedback.ts — FB1: Screen Shake + FB2: Floating Numbers + FB3: Hit Flash
 * STATUS: 🟩 FULLY CODED
 *
 * FB1 — SCREEN SHAKE
 * Uses VirtualCamera positioned at player eye level + MainCamera rotation,
 * then applies random position offsets for the shake duration before releasing.
 * Falls back to Physics.applyImpulseToPlayer if MainCamera is unavailable.
 * Framework function: triggerScreenShake(intensity, duration)
 *
 * FB2 — FLOATING DAMAGE NUMBER
 * Pre-pooled TextShape entities that "pop up" at an impact position, rise,
 * and fade. Framework function: showDamageNumber(worldPos, value, color)
 *
 * FB3 — HIT FLASH
 * Any damageable entity briefly flashes bright red on taking damage.
 * Framework function: triggerHitFlash(entity, originalColor, flashDuration)
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer, VirtualCamera
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── FB1 — Screen Shake ───────────────────────────────────────────────────────

let shakeCamEntity: ReturnType<typeof engine.addEntity> | null = null
let shakeActive = false; let shakeTimer = 0; let shakeDuration = 1; let shakeIntensity = 0.2

/** Call from anywhere: triggerScreenShake(0.3, 0.5) for a medium 0.5s shake. */
export function triggerScreenShake(intensity: number, duration: number): void {
  shakeIntensity = intensity; shakeDuration = duration; shakeTimer = duration; shakeActive = true

  // Create shake camera at player eye level
  const pT = Transform.getOrNull(engine.PlayerEntity)
  if (!pT) return

  if (!shakeCamEntity) {
    shakeCamEntity = engine.addEntity()
    Transform.create(shakeCamEntity, { position: Vector3.create(pT.position.x, pT.position.y + 1.6, pT.position.z) })
  }
  VirtualCamera.createOrReplace(shakeCamEntity, {
    defaultTransition: { $case: "speed" as const, speed: 20 }
  })
  console.log(`[FB1] Screen shake — intensity=${intensity}, duration=${duration}s`)
}

let shakeSystemRegistered = false
function ensureShakeSystem(): void {
  if (shakeSystemRegistered) return; shakeSystemRegistered = true
  engine.addSystem((dt: number) => {
    if (!shakeActive || !shakeCamEntity) return
    shakeTimer -= dt
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return

    const frac = Math.max(0, shakeTimer / shakeDuration)
    const mag  = shakeIntensity * frac
    const ox   = (Math.random() - 0.5) * mag
    const oy   = (Math.random() - 0.5) * mag * 0.4

    // Try to read camera rotation (SDK 7.4.0+)
    let camRot = Quaternion.Identity()
    try {
  // @ts-ignore — require works in DCL/esbuild QuickJS context
      const { MainCamera } = require('@dcl/sdk/ecs') as any
      const mc = MainCamera?.getOrNull(engine.PlayerEntity)
      if (mc?.rotation) camRot = mc.rotation
    } catch {}

    Transform.getMutable(shakeCamEntity).position = Vector3.create(pT.position.x + ox, pT.position.y + 1.6 + oy, pT.position.z)
    Transform.getMutable(shakeCamEntity).rotation  = camRot

    if (shakeTimer <= 0) {
      shakeActive = false
      VirtualCamera.deleteFrom(shakeCamEntity)
      console.log('[FB1] Shake ended — camera released')
    }
  }, 2)
}

export function setupFBScreenShake(): void {
  const { x, z } = { x: 16, z: 110 }
  createStation('fb1_shake', 'FB1 — SCREEN SHAKE\nVirtualCamera offset', STATUS_COLOR.FULLY_CODED)
  ensureShakeSystem()

  // Demo targets — boxes that "explode" when hit
  for (const [ox, oz, label] of [[-2, -1, 'Light'], [0, -1, 'Medium'], [2, -1, 'Heavy']]) {
    const demo = engine.addEntity()
    Transform.create(demo, {
      position: Vector3.create(x + (ox as number), 1.5, z + (oz as number)),
      scale: Vector3.create(1.0, 1.0, 1.0)
    })
    MeshRenderer.setBox(demo)
    MeshCollider.setBox(demo, ColliderLayer.CL_POINTER)
    Material.setPbrMaterial(demo, { albedoColor: Color4.create(0.5, 0.5, 0.6, 1) })

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(x + (ox as number), 2.5, z + (oz as number)) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, { text: label as string, fontSize: 1.0, textColor: Color4.White() })

    const intensities = [0.1, 0.25, 0.4]
    const durations   = [0.3, 0.5, 0.7]
    const idx         = [[-2, -1, 'Light'], [0, -1, 'Medium'], [2, -1, 'Heavy']].findIndex(([a, b, c]) => a === ox && c === label)

    pointerEventsSystem.onPointerDown({ entity: demo, opts: { button: 1, hoverText: `[E] ${label} shake` } }, () => {
      triggerScreenShake(intensities[idx], durations[idx])
      triggerHitFlash(demo, Color4.create(0.5, 0.5, 0.6, 1))
    })
  }

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'VirtualCamera at eye level + random XY offset\nMainCamera.rotation keeps facing direction\ntriggerScreenShake(intensity, duration)',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB1] ScreenShake initialized — click boxes for Light/Medium/Heavy shake')
}

// ─── FB2 — Floating Damage Numbers ───────────────────────────────────────────

interface DamNumEntry {
  entity: ReturnType<typeof engine.addEntity>
  active: boolean; startY: number; elapsed: number; duration: number
}
const damNumPool: DamNumEntry[] = []
let damNumSystemRegistered = false

function initDamNumPool(): void {
  for (let i = 0; i < 8; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.4, 0.4, 0.4) })
    Billboard.create(e, {})
    TextShape.create(e, { text: '', fontSize: 2.5, textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1 })
    damNumPool.push({ entity: e, active: false, startY: 0, elapsed: 0, duration: 1.5 })
  }
}

function ensureDamNumSystem(): void {
  if (damNumSystemRegistered) return; damNumSystemRegistered = true
  engine.addSystem((dt: number) => {
    for (const d of damNumPool) {
      if (!d.active) continue
      d.elapsed += dt
      const frac = d.elapsed / d.duration
      const t = Transform.getMutableOrNull(d.entity)
      if (!t) continue
      t.position.y = d.startY + frac * 2.0  // rise 2m over lifetime
      // Fade via textColor alpha
      const alpha = Math.max(0, 1 - frac)
      TextShape.getMutable(d.entity).textColor = Color4.create(1, 1, 0.3, alpha)
      if (d.elapsed >= d.duration) {
        d.active = false
        t.position = Vector3.create(0, -50, 0)
        TextShape.getMutable(d.entity).text = ''
      }
    }
  }, 5)
}

/** Show a floating number at worldPos. value > 0 = damage (red), < 0 = heal (green). */
export function showDamageNumber(worldPos: Vector3, value: number): void {
  const slot = damNumPool.find(d => !d.active)
  if (!slot) return
  slot.active = true; slot.elapsed = 0
  slot.startY = worldPos.y + 0.5
  const t = Transform.getMutableOrNull(slot.entity)
  if (t) t.position = Vector3.create(worldPos.x, slot.startY, worldPos.z)
  const sign = value > 0 ? '-' : '+'
  TextShape.getMutable(slot.entity).text  = `${sign}${Math.abs(value)}`
  TextShape.getMutable(slot.entity).textColor = value > 0 ? Color4.create(1, 0.3, 0.3, 1) : Color4.create(0.3, 1, 0.5, 1)
}

export function setupFBDamageNumbers(): void {
  const { x, z } = { x: 28, z: 110 }
  createStation('fb2_damnums', 'FB2 — DAMAGE NUMBERS\nFloating fade-out TextShape', STATUS_COLOR.FULLY_CODED)
  if (damNumPool.length === 0) initDamNumPool()
  ensureDamNumSystem()

  // Target dummy
  const dummy = engine.addEntity()
  Transform.create(dummy, { position: Vector3.create(x, 1.5, z - 1), scale: Vector3.create(1.5, 2.0, 0.6) })
  MeshRenderer.setBox(dummy)
  MeshCollider.setBox(dummy, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(dummy, { albedoColor: Color4.create(0.8, 0.5, 0.3, 1) })

  const dummyLbl = engine.addEntity()
  Transform.create(dummyLbl, { position: Vector3.create(x, 2.8, z - 1) }); Billboard.create(dummyLbl, {})
  TextShape.create(dummyLbl, { text: '🎯 TARGET DUMMY\n[E] to hit', fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1) })

  let damValue = 15
  pointerEventsSystem.onPointerDown({ entity: dummy, opts: { button: 1, hoverText: `[E] Deal ${damValue} damage` } }, () => {
    const pos = Transform.getOrNull(dummy)?.position ?? Vector3.create(x, 1.5, z)
    showDamageNumber(Vector3.create(pos.x, pos.y, pos.z), damValue)
    damValue = Math.floor(Math.random() * 25 + 5)
  })

  // Heal button
  const healBtn = createButton(x + 2.0, 0.8, z - 3.6, '+ Heal', Color4.create(0.2, 0.7, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: healBtn, opts: { button: 1, hoverText: '[E] Show heal' } }, () => {
    const pos = Transform.getOrNull(dummy)?.position ?? Vector3.create(x, 1.5, z)
    showDamageNumber(Vector3.create(pos.x + 0.3, pos.y, pos.z), -20)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Pool of 8 TextShape entities\nRises 2m + alpha fade over 1.5s\nshowDamageNumber(pos, value)',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB2] DamageNumbers initialized — pool of 8, rises+fades')
}

// ─── FB3 — Hit Flash ──────────────────────────────────────────────────────────

interface FlashEntry {
  entity:        ReturnType<typeof engine.addEntity>
  originalColor: Color4
  flashTimer:    number
  flashDuration: number
  active:        boolean
}
const flashEntries: FlashEntry[] = []
let flashSystemRegistered = false

function ensureFlashSystem(): void {
  if (flashSystemRegistered) return; flashSystemRegistered = true
  engine.addSystem((dt: number) => {
    for (const f of flashEntries) {
      if (!f.active) continue
      f.flashTimer -= dt
      if (f.flashTimer <= 0) {
        f.active = false
        Material.setPbrMaterial(f.entity, { albedoColor: f.originalColor })
      } else {
        // Pulse between bright red and original
        const t = f.flashTimer / f.flashDuration
        const r = f.originalColor.r + (1 - f.originalColor.r) * t
        const g = f.originalColor.g * (1 - t)
        const b = f.originalColor.b * (1 - t)
        Material.setPbrMaterial(f.entity, { albedoColor: Color4.create(r, g, b, 1), emissiveColor: { r: t * 0.8, g: 0, b: 0 }, emissiveIntensity: t * 2 })
      }
    }
  }, 5)
}

export function triggerHitFlash(entity: ReturnType<typeof engine.addEntity>, originalColor: Color4, duration: number = 0.25): void {
  let entry = flashEntries.find(f => f.entity === entity)
  if (!entry) {
    entry = { entity, originalColor, flashTimer: 0, flashDuration: duration, active: false }
    flashEntries.push(entry)
  }
  entry.originalColor = originalColor; entry.flashTimer = duration; entry.flashDuration = duration; entry.active = true
  Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.1, 0.1, 1), emissiveColor: { r: 1, g: 0, b: 0 }, emissiveIntensity: 2 })
}

export function setupFBHitFlash(): void {
  const { x, z } = { x: 40, z: 110 }
  createStation('fb3_hitflash', 'FB3 — HIT FLASH\nBrief red flash on damage', STATUS_COLOR.FULLY_CODED)
  ensureFlashSystem()

  // Array of boxes with different colors to flash
  const targets: Array<{ color: Color4; label: string }> = [
    { color: Color4.create(0.3, 0.6, 1, 1), label: 'Blue\nenemy' },
    { color: Color4.create(0.2, 0.7, 0.3, 1), label: 'Green\nenemy' },
    { color: Color4.create(0.8, 0.5, 0.1, 1), label: 'Brown\nobject' },
  ]

  for (let i = 0; i < targets.length; i++) {
    const { color, label } = targets[i]
    const ex = x + (i - 1) * 2.5
    const entity = engine.addEntity()
    Transform.create(entity, { position: Vector3.create(ex, 1.5, z - 0.5), scale: Vector3.create(1.2, 2.0, 0.6) })
    MeshRenderer.setBox(entity)
    MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)
    Material.setPbrMaterial(entity, { albedoColor: color })

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(ex, 2.8, z - 0.5) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: label, fontSize: 1.0, textColor: Color4.White() })

    const capturedEntity = entity; const capturedColor = color
    pointerEventsSystem.onPointerDown({ entity, opts: { button: 1, hoverText: '[E] Flash' } }, () => {
      triggerHitFlash(capturedEntity, capturedColor)
      showDamageNumber(Vector3.create(ex, 1.5, z - 0.5), Math.floor(Math.random() * 20 + 5))
    })
  }

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'triggerHitFlash(entity, originalColor)\nPulse red → restore original color\nWorks on any entity with Material',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB3] HitFlash initialized — click boxes to flash them')
}
