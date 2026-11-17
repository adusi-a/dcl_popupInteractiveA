/**
 * cb_hpMine.ts — CB1: HP Entity + CB2: Proximity Mine
 * STATUS: 🟩 FULLY CODED
 *
 * CB1 — DAMAGEABLE ENTITY WITH HP BAR
 * Entity with a MaxHP/CurrentHP pair. World-space health bar = two box entities
 * (background bar + foreground bar scaled to match HP%). On death: entity
 * disappears, callback fires. Framework function: damageEntity(entity, amount)
 *
 * CB2 — PROXIMITY MINE
 * Stationary entity, explodes when player walks within fuseRadius.
 * Brief beeping/warning → BOOM → knockback → reset after delay.
 * Optional: single-use (stays dead) or repeating (resets).
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'
import { showDamageNumber } from './fb_screenFeedback'
import { triggerHitFlash } from './fb_screenFeedback'

// ─── CB1 — Damageable Entity with HP Bar ──────────────────────────────────────

interface DamageableEntry {
  entity:       ReturnType<typeof engine.addEntity>
  barFg:        ReturnType<typeof engine.addEntity>  // foreground HP bar
  barBg:        ReturnType<typeof engine.addEntity>  // background bar
  hpLabel:      ReturnType<typeof engine.addEntity>
  currentHp:    number
  maxHp:        number
  dead:         boolean
  baseColor:    Color4
  barWidth:     number  // world units
  onDeath?:     () => void
}

const damageables: DamageableEntry[] = []

export function damageEntity(entry: DamageableEntry, amount: number): void {
  if (entry.dead) return
  entry.currentHp = Math.max(0, entry.currentHp - amount)
  updateHpBar(entry)
  triggerHitFlash(entry.entity, entry.baseColor)
  showDamageNumber(Transform.getOrNull(entry.entity)?.position ?? Vector3.create(0, 2, 0), amount)
  console.log(`[CB1] Entity hit: ${entry.currentHp}/${entry.maxHp} HP`)
  if (entry.currentHp <= 0) killEntity(entry)
}

export function healEntity(entry: DamageableEntry, amount: number): void {
  if (entry.dead) return
  entry.currentHp = Math.min(entry.maxHp, entry.currentHp + amount)
  updateHpBar(entry)
}

function updateHpBar(entry: DamageableEntry): void {
  const frac = entry.currentHp / entry.maxHp
  const barT = Transform.getMutableOrNull(entry.barFg)
  if (barT) {
    barT.scale = Vector3.create(entry.barWidth * frac, 0.2, 0.08)
    barT.position.x = (Transform.getOrNull(entry.entity)?.position.x ?? 0) - entry.barWidth * (1 - frac) * 0.5
  }
  // Color: green → yellow → red
  const r = frac < 0.5 ? 1 : (1 - frac) * 2
  const g = frac > 0.5 ? 1 : frac * 2
  Material.setPbrMaterial(entry.barFg, { albedoColor: Color4.create(r, g, 0, 1), emissiveColor: { r: r * 0.3, g: g * 0.3, b: 0 }, emissiveIntensity: 0.5 })
  TextShape.getMutable(entry.hpLabel).text = `${entry.currentHp}/${entry.maxHp} HP`
}

function killEntity(entry: DamageableEntry): void {
  entry.dead = true
  Transform.getMutable(entry.entity).scale = Vector3.create(0, 0, 0)
  Transform.getMutable(entry.barBg).scale  = Vector3.create(0, 0, 0)
  Transform.getMutable(entry.barFg).scale  = Vector3.create(0, 0, 0)
  TextShape.getMutable(entry.hpLabel).text = '☠ DEAD'
  TextShape.getMutable(entry.hpLabel).textColor = Color4.create(0.6, 0.6, 0.6, 1)
  console.log('[CB1] Entity KILLED — onDeath() callback')
  if (entry.onDeath) entry.onDeath()
}

function reviveEntity(entry: DamageableEntry): void {
  entry.dead = false; entry.currentHp = entry.maxHp
  const eT = Transform.getOrNull(entry.entity)
  Transform.getMutable(entry.entity).scale = Vector3.create(1.2, 2.0, 0.6)
  updateHpBar(entry)
  if (eT) Transform.getMutable(entry.barBg).scale = Vector3.create(entry.barWidth + 0.1, 0.25, 0.1)
  TextShape.getMutable(entry.hpLabel).textColor = Color4.White()
}

function buildDamageable(
  x: number, y: number, z: number,
  maxHp: number, baseColor: Color4, label: string,
  onDeath?: () => void
): DamageableEntry {
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(x, y, z), scale: Vector3.create(1.2, 2.0, 0.6) })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(entity, { albedoColor: baseColor })

  const barWidth = 1.5
  // Background bar
  const barBg = engine.addEntity()
  Transform.create(barBg, { position: Vector3.create(x, y + 1.5, z), scale: Vector3.create(barWidth + 0.1, 0.25, 0.1) })
  MeshRenderer.setBox(barBg)
  Material.setPbrMaterial(barBg, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

  // Foreground bar
  const barFg = engine.addEntity()
  Transform.create(barFg, { position: Vector3.create(x, y + 1.5, z - 0.02), scale: Vector3.create(barWidth, 0.2, 0.08) })
  MeshRenderer.setBox(barFg)
  Material.setPbrMaterial(barFg, { albedoColor: Color4.create(0.3, 1, 0.2, 1) })

  const hpLabel = engine.addEntity()
  Transform.create(hpLabel, { position: Vector3.create(x, y + 2.0, z) })
  Billboard.create(hpLabel, {})
  TextShape.create(hpLabel, { text: `${maxHp}/${maxHp} HP`, fontSize: 1.1, textColor: Color4.White() })

  const nameLbl = engine.addEntity()
  Transform.create(nameLbl, { position: Vector3.create(x, y + 2.5, z) })
  Billboard.create(nameLbl, {})
  TextShape.create(nameLbl, { text: label, fontSize: 1.2, textColor: baseColor })

  const entry: DamageableEntry = { entity, barFg, barBg, hpLabel, currentHp: maxHp, maxHp, dead: false, baseColor, barWidth, onDeath }
  damageables.push(entry)
  return entry
}

export function setupCBHpEntity(): void {
  const { x, z } = { x: 16, z: 146 }
  createStation('cb1_hp', 'CB1 — HP ENTITY\nWorld-space health bar', STATUS_COLOR.FULLY_CODED)

  // Three enemies with different HP pools
  const e1 = buildDamageable(x - 2.5, 1.0, z - 0.5, 50,  Color4.create(0.3, 0.5, 1, 1), 'Guard',      () => { console.log('[CB1] Guard killed!') })
  const e2 = buildDamageable(x,       1.0, z - 0.5, 100, Color4.create(0.9, 0.2, 0.1, 1), 'Brute',    () => { console.log('[CB1] Brute killed!') })
  const e3 = buildDamageable(x + 2.5, 1.0, z - 0.5, 25,  Color4.create(0.5, 0.2, 0.9, 1), 'Specter', () => { console.log('[CB1] Specter killed!') })

  pointerEventsSystem.onPointerDown({ entity: e1.entity, opts: { button: 1, hoverText: '[E] Hit Guard (10 dmg)' } }, () => damageEntity(e1, 10))
  pointerEventsSystem.onPointerDown({ entity: e2.entity, opts: { button: 1, hoverText: '[E] Hit Brute (20 dmg)' } }, () => damageEntity(e2, 20))
  pointerEventsSystem.onPointerDown({ entity: e3.entity, opts: { button: 1, hoverText: '[E] Hit Specter (8 dmg)' } }, () => damageEntity(e3, 8))

  const reviveBtn = createButton(x, 0.8, z - 3.6, '+ Revive All', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: reviveBtn, opts: { button: 1, hoverText: '[E] Revive' } }, () => { [e1, e2, e3].forEach(reviveEntity) })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'barFg.scale.x = width × (hp/maxHp)\nColor shifts green → yellow → red\ndamageEntity(entry, amount)',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB1] HP entities initialized — 3 enemies, click to damage')
}

// ─── CB2 — Proximity Mine ──────────────────────────────────────────────────────

export function setupCBProximityMine(): void {
  const { x, z } = { x: 28, z: 146 }
  createStation('cb2_mine', 'CB2 — PROXIMITY MINE\nFuse → BOOM → reset', STATUS_COLOR.FULLY_CODED)

  const FUSE_RADIUS   = 2.0   // metres — player trips the mine
  const BLAST_RADIUS  = 3.0   // metres — knockback range
  const FUSE_TIME     = 1.5   // seconds of beeping before explosion
  const RESET_TIME    = 4.0   // seconds before mine rearms

  // Mine body
  const mine = engine.addEntity()
  Transform.create(mine, {
    position: Vector3.create(x, 0.35, z),
    scale: Vector3.create(0.4, 0.4, 0.4)
  })
  MeshRenderer.setCylinder(mine)
  MeshCollider.setCylinder(mine, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(mine, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

  // Mine light (blinks during fuse)
  const mineLight = engine.addEntity()
  Transform.create(mineLight, {
    position: Vector3.create(x, 0.56, z),
    scale: Vector3.create(0.12, 0.12, 0.12)
  })
  MeshRenderer.setCylinder(mineLight)
  Material.setPbrMaterial(mineLight, { albedoColor: Color4.create(0.2, 0.9, 0.2, 1), emissiveColor: { r: 0, g: 0.6, b: 0 }, emissiveIntensity: 1 })

  // Radius indicator ring
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    const dot = engine.addEntity()
    Transform.create(dot, {
      position: Vector3.create(x + Math.cos(a) * FUSE_RADIUS, 0.52, z + Math.sin(a) * FUSE_RADIUS),
      scale: Vector3.create(0.08, 0.06, 0.08)
    })
    MeshRenderer.setCylinder(dot)
    Material.setPbrMaterial(dot, { albedoColor: Color4.create(0.9, 0.5, 0.1, 0.5) })
  }

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 1.4, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '💣 ARMED', fontSize: 1.3, textColor: Color4.create(0.3, 0.9, 0.3, 1) })

  type MineState = 'armed' | 'fuse' | 'exploded' | 'resetting'
  let mineState: MineState = 'armed'
  let mineTimer = 0; let blinkTimer = 0; let blinkOn = true

  engine.addSystem((dt: number) => {
    blinkTimer += dt

    switch (mineState) {
      case 'armed': {
        const pT = Transform.getOrNull(engine.PlayerEntity)
        if (!pT) break
        const dx = pT.position.x - x; const dz = pT.position.z - z
        if (Math.sqrt(dx*dx + dz*dz) < FUSE_RADIUS) {
          mineState = 'fuse'; mineTimer = FUSE_TIME
          TextShape.getMutable(statusLbl).text = `💣 FUSE! ${FUSE_TIME.toFixed(1)}s`
          console.log('[CB2] MINE TRIPPED — fuse burning!')
        }
        break
      }

      case 'fuse': {
        mineTimer -= dt
        TextShape.getMutable(statusLbl).text = `💣 ${Math.max(0, mineTimer).toFixed(1)}s`
        // Blink faster as fuse burns down
        const blinkRate = 2 + (1 - mineTimer / FUSE_TIME) * 8
        if (blinkTimer > 1 / blinkRate) {
          blinkOn = !blinkOn; blinkTimer = 0
          Material.setPbrMaterial(mineLight, {
            albedoColor: blinkOn ? Color4.create(1, 0.2, 0, 1) : Color4.create(0.1, 0.1, 0.1, 1),
            emissiveColor: blinkOn ? { r: 0.8, g: 0, b: 0 } : { r: 0, g: 0, b: 0 }, emissiveIntensity: blinkOn ? 2 : 0
          })
        }
        if (mineTimer <= 0) {
          // BOOM!
          mineState = 'exploded'; mineTimer = RESET_TIME
          // Flash mine + knockback
          Transform.getMutable(mine).scale = Vector3.create(1.5, 1.5, 1.5)
          Material.setPbrMaterial(mine, { albedoColor: Color4.create(1, 0.6, 0, 1), emissiveColor: { r: 1, g: 0.4, b: 0 }, emissiveIntensity: 3 })
          Material.setPbrMaterial(mineLight, { albedoColor: Color4.create(1, 0.6, 0, 1), emissiveColor: { r: 1, g: 0.4, b: 0 }, emissiveIntensity: 4 })
          TextShape.getMutable(statusLbl).text = '💥 BOOM!'
          TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.4, 0.1, 1)

          const pT = Transform.getOrNull(engine.PlayerEntity)
          if (pT) {
            const dx = pT.position.x - x; const dz = pT.position.z - z
            const dist = Math.sqrt(dx*dx + dz*dz)
            if (dist < BLAST_RADIUS) {
              const nx = dist > 0.1 ? dx / dist : 0.5; const nz = dist > 0.1 ? dz / dist : 0.5
              Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 15)
              console.log('[CB2] BLAST HIT — knockback!')
            }
          }
          console.log('[CB2] MINE EXPLODED')
        }
        break
      }

      case 'exploded': {
        mineTimer -= dt
        // Gradually shrink explosion flash
        const flashFrac = mineTimer / RESET_TIME
        Transform.getMutable(mine).scale = Vector3.create(0.4 + flashFrac * 1.1, 0.4 + flashFrac * 1.1, 0.4 + flashFrac * 1.1)
        if (mineTimer <= 0) {
          mineState = 'armed'
          Transform.getMutable(mine).scale = Vector3.create(0.4, 0.4, 0.4)
          Material.setPbrMaterial(mine, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
          Material.setPbrMaterial(mineLight, { albedoColor: Color4.create(0.2, 0.9, 0.2, 1), emissiveColor: { r: 0, g: 0.6, b: 0 }, emissiveIntensity: 1 })
          TextShape.getMutable(statusLbl).text = '💣 ARMED'
          TextShape.getMutable(statusLbl).textColor = Color4.create(0.3, 0.9, 0.3, 1)
          console.log('[CB2] Mine REARMED')
        }
        break
      }
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'fuseRadius: 2m trip / blastRadius: 3m\nFuse blinks faster as it burns\nResets + rearms after 4s',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB2] ProximityMine initialized — trip=2m, blast=3m, reset=4s')
}
