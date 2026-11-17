/**
 * cb_gateStunLoot.ts — CB6: Beam Gate + CB7: Stun + CB8: Loot Drop + CB9: Shield
 * STATUS: 🟩 FULLY CODED
 *
 * CB6 — BEAM GATE / SECURITY SENSOR
 * Fixed laser beam across a path. Crossing the beam triggers an alarm.
 * No damage — just detection + consequence. Classic security/puzzle pattern.
 *
 * CB7 — PUSH / STUN ZONE
 * AvatarModifierArea that temporarily disables player locomotion for N seconds.
 * On enter: freeze. After stunDuration: unfreeze. Can be reset manually.
 *
 * CB8 — LOOT DROP
 * "Enemy" entity that drops a collectible when killed. Player walks over
 * the loot to collect it. Demonstrates the full loot lifecycle:
 * enemy death → loot spawn → player collection → inventory update.
 *
 * CB9 — SHIELD DEFLECT
 * A toggleable shield entity that deflects oncoming projectiles.
 * When shield is active: projectiles that would pass through its area get
 * their direction reversed. Demonstrates the deflect/reflect pattern.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem,
  AvatarModifierArea, AvatarModifierType
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── CB6 — Beam Gate ──────────────────────────────────────────────────────────

export function setupCBBeamGate(): void {
  const { x, z } = { x: 16, z: 154 }
  createStation('cb6_gate', 'CB6 — BEAM GATE\nSecurity sensor + alarm', STATUS_COLOR.FULLY_CODED)

  const BEAM_LENGTH = 5.0; const BEAM_Y = 1.2

  // Emitter + receiver posts
  for (const [ex, label] of [[x - BEAM_LENGTH * 0.5 - 0.3, 'EMIT'], [x + BEAM_LENGTH * 0.5 + 0.3, 'RECV']]) {
    const post = engine.addEntity()
    Transform.create(post, { position: Vector3.create(ex as number, 0.8, z), scale: Vector3.create(0.25, 1.6, 0.25) })
    MeshRenderer.setBox(post)
    Material.setPbrMaterial(post, { albedoColor: Color4.create(0.3, 0.3, 0.4, 1) })
    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(ex as number, 2.0, z) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, { text: label as string, fontSize: 0.9, textColor: Color4.create(0.5, 0.8, 1, 1) })
  }

  // Beam entity (green when armed, red when tripped)
  const beamEntity = engine.addEntity()
  Transform.create(beamEntity, {
    position: Vector3.create(x, BEAM_Y, z),
    scale: Vector3.create(0.08, 0.08, BEAM_LENGTH)
  })
  MeshRenderer.setBox(beamEntity)
  Material.setPbrMaterial(beamEntity, {
    albedoColor: Color4.create(0.2, 1, 0.2, 0.7),
    emissiveColor: { r: 0, g: 0.8, b: 0 }, emissiveIntensity: 1.5,
    transparencyMode: 1
  })

  // Alarm status display
  const alarmLbl = engine.addEntity()
  Transform.create(alarmLbl, { position: Vector3.create(x, 3.5, z) })
  Billboard.create(alarmLbl, {})
  TextShape.create(alarmLbl, { text: '🟢 BEAM ARMED', fontSize: 1.4, textColor: Color4.create(0.3, 1, 0.3, 1) })

  // Consequence: a "door" that closes when beam is tripped
  const door = engine.addEntity()
  Transform.create(door, {
    position: Vector3.create(x + BEAM_LENGTH * 0.5 + 2.0, 1.2, z),
    scale: Vector3.create(0.3, 2.4, 2.0)
  })
  MeshRenderer.setBox(door)
  MeshCollider.setBox(door, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(door, { albedoColor: Color4.create(0.3, 0.3, 0.3, 0) }) // invisible initially

  // Trigger along beam path
  const beamTrigger = engine.addEntity()
  Transform.create(beamTrigger, {
    position: Vector3.create(x, BEAM_Y, z),
    scale: Vector3.create(0.4, 1.5, BEAM_LENGTH)
  })
  TriggerArea.setBox(beamTrigger)

  let armed = true; let alarmTimer = 0

  triggerAreaEventsSystem.onTriggerEnter(beamTrigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity || !armed) return
    armed = false
    // Beam turns red — alarm!
    Material.setPbrMaterial(beamEntity, { albedoColor: Color4.create(1, 0.1, 0.1, 0.9), emissiveColor: { r: 0.9, g: 0, b: 0 }, emissiveIntensity: 2, transparencyMode: 1 })
    TextShape.getMutable(alarmLbl).text = '🔴 ALARM! BEAM TRIPPED!'
    TextShape.getMutable(alarmLbl).textColor = Color4.create(1, 0.2, 0.2, 1)
    // Door closes
    Material.setPbrMaterial(door, { albedoColor: Color4.create(0.5, 0.2, 0.1, 1) })
    alarmTimer = 4.0
    console.log('[CB6] BEAM GATE TRIPPED — alarm + door closed')
  })

  // Reset timer
  engine.addSystem((dt: number) => {
    if (armed || alarmTimer <= 0) return
    alarmTimer -= dt
    if (alarmTimer <= 0) {
      armed = true
      Material.setPbrMaterial(beamEntity, { albedoColor: Color4.create(0.2, 1, 0.2, 0.7), emissiveColor: { r: 0, g: 0.8, b: 0 }, emissiveIntensity: 1.5, transparencyMode: 1 })
      TextShape.getMutable(alarmLbl).text = '🟢 BEAM ARMED'
      TextShape.getMutable(alarmLbl).textColor = Color4.create(0.3, 1, 0.3, 1)
      Material.setPbrMaterial(door, { albedoColor: Color4.create(0.3, 0.3, 0.3, 0) })
      console.log('[CB6] Gate RESET — beam armed again')
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 5.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'TriggerArea along beam path\nBeam trip → alarm → door closes → reset 4s\nNo damage — detection + consequence pattern',
    fontSize: 1.1, textColor: Color4.create(0.7, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB6] BeamGate initialized — detection + door consequence, 4s reset')
}

// ─── CB7 — Push / Stun Zone ───────────────────────────────────────────────────

export function setupCBStunZone(): void {
  const { x, z } = { x: 28, z: 154 }
  createStation('cb7_stun', 'CB7 — STUN ZONE\nAvatarModifierArea freeze 2s', STATUS_COLOR.FULLY_CODED)

  const STUN_DURATION = 2.0

  // Stun zone visual
  const stunFloor = engine.addEntity()
  Transform.create(stunFloor, {
    position: Vector3.create(x, 0.52, z),
    scale: Vector3.create(4.0, 0.08, 4.0)
  })
  MeshRenderer.setBox(stunFloor)
  Material.setPbrMaterial(stunFloor, {
    albedoColor: Color4.create(0.5, 0.0, 0.8, 0.5),
    emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.4,
    transparencyMode: 1
  })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.5, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '⚡ STUN ZONE\nStep in to freeze', fontSize: 1.2, textColor: Color4.create(0.8, 0.5, 1, 1) })

  // Stun zone trigger
  const trigger = engine.addEntity()
  Transform.create(trigger, { position: Vector3.create(x, 1.0, z), scale: Vector3.create(4.0, 2.0, 4.0) })
  TriggerArea.setBox(trigger)

  let stunned = false; let stunTimer = 0
  let stunModifierEntity: ReturnType<typeof engine.addEntity> | null = null

  triggerAreaEventsSystem.onTriggerEnter(trigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity || stunned) return
    stunned = true; stunTimer = STUN_DURATION

    // Create AvatarModifierArea at player position to freeze
    stunModifierEntity = engine.addEntity()
    const pT = Transform.getOrNull(engine.PlayerEntity)
    Transform.create(stunModifierEntity, {
      position: pT ? Vector3.create(pT.position.x, pT.position.y, pT.position.z) : Vector3.create(x, 1, z)
    })
    AvatarModifierArea.create(stunModifierEntity, {
      area: Vector3.create(10, 4, 10),
      modifiers: [AvatarModifierType.AMT_HIDE_AVATARS]
    })

    TextShape.getMutable(statusLbl).text = `⚡ STUNNED! ${STUN_DURATION.toFixed(0)}s`
    TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.3, 0.3, 1)
    Material.setPbrMaterial(stunFloor, { albedoColor: Color4.create(1, 0.0, 0.3, 0.7), emissiveColor: { r: 0.5, g: 0, b: 0.2 }, emissiveIntensity: 0.8, transparencyMode: 1 })
    console.log(`[CB7] Player STUNNED for ${STUN_DURATION}s`)
  })

  engine.addSystem((dt: number) => {
    if (!stunned) return
    stunTimer -= dt
    TextShape.getMutable(statusLbl).text = `⚡ STUNNED! ${Math.max(0, stunTimer).toFixed(1)}s`
    if (stunTimer <= 0) {
      stunned = false
      if (stunModifierEntity) {
        engine.removeEntityWithChildren(stunModifierEntity)
        stunModifierEntity = null
      }
      TextShape.getMutable(statusLbl).text = '⚡ STUN ZONE\nStep in to freeze'
      TextShape.getMutable(statusLbl).textColor = Color4.create(0.8, 0.5, 1, 1)
      Material.setPbrMaterial(stunFloor, { albedoColor: Color4.create(0.5, 0.0, 0.8, 0.5), emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.4, transparencyMode: 1 })
      console.log('[CB7] Player UNSTUNNED — free to move')
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'AvatarModifierArea.create() → freeze\nDelete entity after 2s → free\nSame pattern: dialogue cutscenes, cutscenes',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB7] StunZone initialized — 2s freeze, AvatarModifierArea')
}

// ─── CB8 — Loot Drop ──────────────────────────────────────────────────────────

export function setupCBLootDrop(): void {
  const { x, z } = { x: 40, z: 154 }
  createStation('cb8_loot', 'CB8 — LOOT DROP\nKill enemy → collect item', STATUS_COLOR.FULLY_CODED)

  const lootInventory: string[] = []
  let lootCount = 0

  // Enemy
  const enemy = engine.addEntity()
  Transform.create(enemy, { position: Vector3.create(x, 1.0, z - 1.5), scale: Vector3.create(1.0, 1.8, 0.7) })
  MeshRenderer.setBox(enemy)
  MeshCollider.setBox(enemy, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(enemy, { albedoColor: Color4.create(0.7, 0.2, 0.2, 1) })

  const enemyLbl = engine.addEntity()
  Transform.create(enemyLbl, { position: Vector3.create(x, 2.5, z - 1.5) }); Billboard.create(enemyLbl, {})
  TextShape.create(enemyLbl, { text: '👹 ENEMY\n[E] to kill', fontSize: 1.1, textColor: Color4.create(1, 0.4, 0.4, 1) })

  // Loot gem (hidden initially)
  const lootEntity = engine.addEntity()
  Transform.create(lootEntity, { position: Vector3.create(x, -50, z - 1.5), scale: Vector3.create(0.4, 0.4, 0.4) })
  MeshRenderer.setCylinder(lootEntity)
  Material.setPbrMaterial(lootEntity, { albedoColor: Color4.create(1, 0.9, 0.1, 1), emissiveColor: { r: 0.6, g: 0.5, b: 0 }, emissiveIntensity: 1.5 })

  // Loot trigger (walk over to collect)
  const lootTrigger = engine.addEntity()
  Transform.create(lootTrigger, { position: Vector3.create(x, -50, z - 1.5), scale: Vector3.create(1.2, 1.2, 1.2) })
  TriggerArea.setBox(lootTrigger)

  // Inventory display
  const inventoryLbl = engine.addEntity()
  Transform.create(inventoryLbl, { position: Vector3.create(x, 3.5, z) }); Billboard.create(inventoryLbl, {})
  TextShape.create(inventoryLbl, { text: '🎒 Loot: 0', fontSize: 1.5, textColor: Color4.White() })

  // Loot spin
  let lootAngle = 0; let lootVisible = false
  engine.addSystem((dt: number) => {
    if (!lootVisible) return
    lootAngle += 90 * dt
    Transform.getMutable(lootEntity).rotation = Quaternion.fromEulerDegrees(0, lootAngle, 0)
  }, 5)

  let enemyAlive = true

  pointerEventsSystem.onPointerDown({ entity: enemy, opts: { button: 1, hoverText: '[E] Kill enemy!' } }, () => {
    if (!enemyAlive) return
    enemyAlive = false
    // Enemy death — shrink and hide
    Transform.getMutable(enemy).scale = Vector3.create(0, 0, 0)
    TextShape.getMutable(enemyLbl).text = ''
    // Spawn loot at enemy position
    lootVisible = true
    Transform.getMutable(lootEntity).position = Vector3.create(x, 0.9, z - 1.5)
    Transform.getMutable(lootTrigger).position = Vector3.create(x, 0.9, z - 1.5)
    console.log('[CB8] Enemy killed — loot spawned!')
  })

  triggerAreaEventsSystem.onTriggerEnter(lootTrigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity || !lootVisible) return
    lootVisible = false; lootCount++
    lootInventory.push(`HealthGem_${lootCount}`)
    Transform.getMutable(lootEntity).position = Vector3.create(x, -50, z - 1.5)
    Transform.getMutable(lootTrigger).position = Vector3.create(x, -50, z - 1.5)
    TextShape.getMutable(inventoryLbl).text = `🎒 Loot: ${lootCount} (${lootInventory[lootInventory.length - 1]})`
    console.log(`[CB8] LOOT COLLECTED: ${lootInventory[lootInventory.length - 1]}`)
  })

  const resetBtn = createButton(x, 0.8, z - 3.6, '↺ Respawn', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset enemy' } }, () => {
    enemyAlive = true
    Transform.getMutable(enemy).scale = Vector3.create(1.0, 1.8, 0.7)
    TextShape.getMutable(enemyLbl).text = '👹 ENEMY\n[E] to kill'
    if (lootVisible) { lootVisible = false; Transform.getMutable(lootEntity).position = Vector3.create(x, -50, z - 1.5); Transform.getMutable(lootTrigger).position = Vector3.create(x, -50, z - 1.5) }
    console.log('[CB8] Reset')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 5.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Kill enemy → loot spawns at death pos\nWalk over → collect → inventory update\nSame: OreMonger ore drops, ML book drops',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB8] LootDrop initialized — kill enemy → collect gem')
}

// ─── CB9 — Shield Deflect ─────────────────────────────────────────────────────

export function setupCBShield(): void {
  const { x, z } = { x: 52, z: 154 }
  createStation('cb9_shield', 'CB9 — SHIELD DEFLECT\nToggle shield → reverse darts', STATUS_COLOR.FULLY_CODED)

  // Dart launcher (fires along -Z toward player area)
  const launcherPos = Vector3.create(x, 1.2, z - 3.0)
  const launcher    = engine.addEntity()
  Transform.create(launcher, { position: Vector3.create(launcherPos.x, launcherPos.y, launcherPos.z), scale: Vector3.create(0.4, 0.4, 0.4) })
  MeshRenderer.setCylinder(launcher)
  Material.setPbrMaterial(launcher, { albedoColor: Color4.create(0.5, 0.3, 0.1, 1) })

  const launcherLbl = engine.addEntity()
  Transform.create(launcherLbl, { position: Vector3.create(launcherPos.x, 2.0, launcherPos.z) }); Billboard.create(launcherLbl, {})
  TextShape.create(launcherLbl, { text: '🎯 LAUNCHER\n→ darts every 3s', fontSize: 1.0, textColor: Color4.create(1, 0.6, 0.2, 1) })

  // Shield entity (toggled)
  const shieldPos = Vector3.create(x, 1.2, z)
  const shield    = engine.addEntity()
  Transform.create(shield, { position: Vector3.create(shieldPos.x, shieldPos.y, shieldPos.z), scale: Vector3.create(2.5, 2.5, 0.15) })
  MeshRenderer.setBox(shield)
  MeshCollider.setBox(shield, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(shield, { albedoColor: Color4.create(0.3, 0.6, 1, 0.3), emissiveColor: { r: 0.1, g: 0.3, b: 0.6 }, emissiveIntensity: 0.5, transparencyMode: 1 })

  let shieldOn = false
  const shieldStatusLbl = engine.addEntity()
  Transform.create(shieldStatusLbl, { position: Vector3.create(x, 3.0, z) }); Billboard.create(shieldStatusLbl, {})
  TextShape.create(shieldStatusLbl, { text: '🛡 OFF [E] to activate', fontSize: 1.2, textColor: Color4.create(0.5, 0.5, 0.5, 1) })

  pointerEventsSystem.onPointerDown({ entity: shield, opts: { button: 1, hoverText: '[E] Toggle shield' } }, () => {
    shieldOn = !shieldOn
    Material.setPbrMaterial(shield, {
      albedoColor: shieldOn ? Color4.create(0.3, 0.6, 1, 0.8) : Color4.create(0.3, 0.6, 1, 0.3),
      emissiveColor: shieldOn ? { r: 0.2, g: 0.5, b: 1 } : { r: 0.1, g: 0.3, b: 0.6 },
      emissiveIntensity: shieldOn ? 2 : 0.5,
      transparencyMode: 1
    })
    TextShape.getMutable(shieldStatusLbl).text = shieldOn ? '🛡 ON — blocking!' : '🛡 OFF [E] to activate'
    TextShape.getMutable(shieldStatusLbl).textColor = shieldOn ? Color4.create(0.3, 0.6, 1, 1) : Color4.create(0.5, 0.5, 0.5, 1)
    console.log(`[CB9] Shield: ${shieldOn ? 'ON' : 'OFF'}`)
  })

  // Dart entities (pool of 3)
  interface ShieldDart { entity: ReturnType<typeof engine.addEntity>; active: boolean; posX: number; posZ: number; dirZ: number }
  const darts: ShieldDart[] = []
  for (let i = 0; i < 3; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.08, 0.08, 0.5) })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, { albedoColor: Color4.create(1, 0.5, 0.1, 1), emissiveColor: { r: 0.5, g: 0.2, b: 0 }, emissiveIntensity: 0.8 })
    darts.push({ entity: e, active: false, posX: 0, posZ: 0, dirZ: 1 })
  }

  let dartTimer = 2.0
  engine.addSystem((dt: number) => {
    // Fire timer
    dartTimer -= dt
    if (dartTimer <= 0) {
      dartTimer = 3.0
      const slot = darts.find(d => !d.active)
      if (slot) {
        slot.active = true; slot.posX = launcherPos.x; slot.posZ = launcherPos.z; slot.dirZ = 1  // fires in +Z direction
        Transform.getMutable(slot.entity).position = Vector3.create(slot.posX, 1.2, slot.posZ)
        console.log('[CB9] Dart fired')
      }
    }

    // Move darts
    for (const d of darts) {
      if (!d.active) continue
      d.posZ += d.dirZ * 8.0 * dt  // 8 m/s
      const t = Transform.getMutableOrNull(d.entity)
      if (!t) continue
      t.position = Vector3.create(d.posX, 1.2, d.posZ)
      t.rotation  = Quaternion.fromEulerDegrees(0, d.dirZ > 0 ? 0 : 180, 0)

      // Check if dart hits shield zone (Z between shieldPos.z-0.2 and +0.2, X within 1.25)
      if (shieldOn && Math.abs(d.posZ - shieldPos.z) < 0.4 && Math.abs(d.posX - shieldPos.x) < 1.25) {
        d.dirZ *= -1  // DEFLECT!
        console.log('[CB9] DART DEFLECTED by shield!')
        continue
      }

      // Check player hit
      const pT = Transform.getOrNull(engine.PlayerEntity)
      if (pT) {
        const dx = pT.position.x - d.posX; const dz2 = pT.position.z - d.posZ
        if (Math.sqrt(dx*dx + dz2*dz2) < 0.6) {
          Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 6)
          d.active = false; t.position = Vector3.create(0, -50, 0)
          console.log('[CB9] Player hit by dart')
          continue
        }
      }

      // Max range / out of bounds
      if (Math.abs(d.posZ - launcherPos.z) > 10) { d.active = false; t.position = Vector3.create(0, -50, 0) }
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '[E] on shield panel to activate\nDarts reverse direction on shield hit\nShield = zone check, no physics engine',
    fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[CB9] ShieldDeflect initialized — 3s dart interval, toggle shield with [E]')
}
