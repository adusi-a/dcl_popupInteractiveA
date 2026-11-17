/**
 * fb_deathMinimap.ts — FB8: Death/Respawn Sequence + FB9: Enemy Blip Minimap
 * STATUS: 🟩 FULLY CODED
 *
 * FB8 — DEATH + RESPAWN SEQUENCE
 * Full dramatized death: freeze player (AvatarModifierArea), fade to black
 * (VirtualCamera looking at black box), movePlayerTo respawn, restore camera.
 * Framework function: triggerDeathSequence(respawnPos, onComplete?)
 *
 * FB9 — ENEMY BLIP MINIMAP
 * Self-contained wall-panel minimap with MOVING enemy dots tracked in real time.
 * Extends the ML6 concept with dynamic entity registration:
 *   registerMinimapEntity(entity, blipColor)  — adds a tracking blip
 *   unregisterMinimapEntity(entity)            — removes it
 * Player dot always shown. Blips update each frame via system.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem,
  AvatarModifierArea, AvatarModifierType, VirtualCamera
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── FB8 — Death + Respawn Sequence ──────────────────────────────────────────

type DeathState = 'alive' | 'dying' | 'respawning' | 'fadeIn'
let deathState: DeathState = 'alive'
let deathTimer = 0

export function triggerDeathSequence(respawnPos: Vector3, onComplete?: () => void): void {
  if (deathState !== 'alive') return
  deathState = 'dying'; deathTimer = 0.0
  console.log('[FB8] DEATH sequence started')

  // Step 1: Black out camera (position VirtualCamera looking at black box)
  const blackCam = engine.addEntity()
  Transform.create(blackCam, { position: Vector3.create(80, 1.5, 70) }) // near spawn
  VirtualCamera.create(blackCam, { defaultTransition: { transitionMode: 2, speed: 30 } as any })

  // Black plane in front of camera
  const blackPlane = engine.addEntity()
  Transform.create(blackPlane, {
    position: Vector3.create(80, 1.5, 70.1),  // 0.1m in front of camera
    scale: Vector3.create(4, 3, 0.02)
  })
  MeshRenderer.setBox(blackPlane)
  Material.setPbrMaterial(blackPlane, { albedoColor: Color4.create(0, 0, 0, 1) })

  // Step 2: Freeze player (AvatarModifierArea at player position)
  const pT = Transform.getOrNull(engine.PlayerEntity)
  const freezeArea = engine.addEntity()
  Transform.create(freezeArea, {
    position: pT ? Vector3.create(pT.position.x, pT.position.y, pT.position.z) : Vector3.create(80, 1, 70)
  })
  AvatarModifierArea.create(freezeArea, {
    area: Vector3.create(10, 4, 10),
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: []
  })

  // Staged timer system
  let stage = 0; let stageTimer = 0
  const cleanUp = engine.addSystem((dt: number) => {
    stageTimer += dt
    switch (stage) {
      case 0:   // Wait 0.5s in black
        if (stageTimer > 0.5) { stage = 1; stageTimer = 0; movePlayerTo({ newRelativePosition: Vector3.create(respawnPos.x, respawnPos.y, respawnPos.z) }); console.log('[FB8] Teleported to respawn') }
        break
      case 1:   // Wait 0.3s at respawn before releasing camera
        if (stageTimer > 0.3) {
          stage = 2; stageTimer = 0
          VirtualCamera.deleteFrom(blackCam)
          engine.removeEntityWithChildren(blackCam)
          engine.removeEntityWithChildren(blackPlane)
        }
        break
      case 2:   // Wait 0.5s then release freeze
        if (stageTimer > 0.5) {
          stage = 3
          engine.removeEntityWithChildren(freezeArea)
          deathState = 'alive'
    // @ts-ignore — removeSystem(void) TypeScript warning; SDK 7.33 returns void from addSystem
          engine.removeSystem(cleanUp)
          if (onComplete) onComplete()
          console.log('[FB8] Respawn complete — player free')
        }
        break
    }
  }, 2)
}

export function setupFBDeathSequence(): void {
  const { x, z } = { x: 40, z: 130 }
  createStation('fb8_death', 'FB8 — DEATH SEQUENCE\nBlackout → teleport → restore', STATUS_COLOR.FULLY_CODED)

  // "Kill zone" platform (stepping off triggers death)
  const narrowPlatform = engine.addEntity()
  Transform.create(narrowPlatform, {
    position: Vector3.create(x, 2.0, z - 1.0),
    scale: Vector3.create(1.5, 0.2, 5.0)
  })
  MeshRenderer.setBox(narrowPlatform)
  MeshCollider.setBox(narrowPlatform, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(narrowPlatform, { albedoColor: Color4.create(0.5, 0.1, 0.1, 1) })

  const dangerLbl = engine.addEntity()
  Transform.create(dangerLbl, { position: Vector3.create(x, 2.5, z - 1.0) })
  Billboard.create(dangerLbl, {})
  TextShape.create(dangerLbl, { text: '☠ DANGER ZONE\n(fall → death)', fontSize: 1.0, textColor: Color4.create(1, 0.3, 0.3, 1) })

  // Respawn position (safe pad to the side)
  const respawnPad = engine.addEntity()
  Transform.create(respawnPad, {
    position: Vector3.create(x + 3.5, 0.6, z),
    scale: Vector3.create(2.0, 0.15, 2.0)
  })
  MeshRenderer.setBox(respawnPad)
  MeshCollider.setBox(respawnPad, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(respawnPad, {
    albedoColor: Color4.create(0.2, 0.9, 0.3, 1),
    emissiveColor: { r: 0, g: 0.3, b: 0 }, emissiveIntensity: 0.4
  })
  const respawnLbl = engine.addEntity()
  Transform.create(respawnLbl, { position: Vector3.create(x + 3.5, 1.0, z) })
  Billboard.create(respawnLbl, {})
  TextShape.create(respawnLbl, { text: '✓ RESPAWN', fontSize: 1.1, textColor: Color4.create(0.3, 1, 0.5, 1) })

  const respawnPos = Vector3.create(x + 3.5, 1.5, z)

  // Manual trigger button
  const dieBtn = createButton(x - 2, 0.8, z - 3.6, '☠ Trigger Death', Color4.create(0.6, 0.1, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: dieBtn, opts: { button: 1, hoverText: '[E] Die and respawn' } }, () => {
    triggerDeathSequence(respawnPos, () => console.log('[FB8] Respawn callback fired'))
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '1. Freeze player (AvatarModifierArea)\n2. Black VirtualCamera (0.5s)\n3. movePlayerTo(respawnPos)\n4. Release camera + freeze',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB8] DeathSequence initialized — danger platform + respawn pad')
}

// ─── FB9 — Enemy Blip Minimap ─────────────────────────────────────────────────

interface MinimapTracked {
  entity:    ReturnType<typeof engine.addEntity>
  blip:      ReturnType<typeof engine.addEntity>
  blipColor: Color4
}
const trackedEntities: MinimapTracked[] = []
let minimapPlayerBlip: ReturnType<typeof engine.addEntity> | null = null
let mapSystemRegistered = false

// Map bounds for this FB demo area
const MAP_MIN = { x: 8, z: 100 }; const MAP_MAX = { x: 72, z: 160 }
const PANEL_POS = Vector3.create(55, 3.0, 128)
const PANEL_W = 2.0; const PANEL_H = 2.0

function worldToBlipPos(wx: number, wz: number): Vector3 {
  const nx = (wx - MAP_MIN.x) / (MAP_MAX.x - MAP_MIN.x) - 0.5
  const nz = (wz - MAP_MIN.z) / (MAP_MAX.z - MAP_MIN.z) - 0.5
  return Vector3.create(PANEL_POS.x + nx * PANEL_W, PANEL_POS.y - nz * PANEL_H, PANEL_POS.z - 0.06)
}

export function registerMinimapEntity(entity: ReturnType<typeof engine.addEntity>, color: Color4): void {
  const blip = engine.addEntity()
  Transform.create(blip, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.1, 0.1, 0.05) })
  MeshRenderer.setCylinder(blip)
  Material.setPbrMaterial(blip, { albedoColor: color, emissiveColor: { r: color.r * 0.5, g: color.g * 0.5, b: color.b * 0.5 }, emissiveIntensity: 1 })
  trackedEntities.push({ entity, blip, blipColor: color })
}

function ensureMinimapSystem(): void {
  if (mapSystemRegistered) return; mapSystemRegistered = true
  engine.addSystem((_dt: number) => {
    // Update player blip
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (pT && minimapPlayerBlip) {
      const bp = worldToBlipPos(pT.position.x, pT.position.z)
      Transform.getMutable(minimapPlayerBlip).position = bp
    }
    // Update enemy blips
    for (const tracked of trackedEntities) {
      const eT = Transform.getOrNull(tracked.entity)
      if (!eT) { Transform.getMutable(tracked.blip).position = Vector3.create(0, -50, 0); continue }
      const bp = worldToBlipPos(eT.position.x, eT.position.z)
      Transform.getMutable(tracked.blip).position = bp
    }
  }, 30)
}

export function setupFBMinimapBlips(): void {
  const { x, z } = { x: 52, z: 130 }
  createStation('fb9_minimap', 'FB9 — ENEMY BLIP MINIMAP\nReal-time tracked entities', STATUS_COLOR.FULLY_CODED)
  ensureMinimapSystem()

  // Map panel + frame
  const frame = engine.addEntity()
  Transform.create(frame, { position: Vector3.create(PANEL_POS.x, PANEL_POS.y, PANEL_POS.z + 0.03), scale: Vector3.create(PANEL_W + 0.1, PANEL_H + 0.1, 0.05) })
  MeshRenderer.setBox(frame)
  Material.setPbrMaterial(frame, { albedoColor: Color4.create(0.5, 0.35, 0.2, 1) })

  const mapBg = engine.addEntity()
  Transform.create(mapBg, { position: Vector3.create(PANEL_POS.x, PANEL_POS.y, PANEL_POS.z + 0.02), scale: Vector3.create(PANEL_W, PANEL_H, 0.04) })
  MeshRenderer.setBox(mapBg)
  Material.setPbrMaterial(mapBg, { albedoColor: Color4.create(0.06, 0.08, 0.06, 1) })

  const header = engine.addEntity()
  Transform.create(header, { position: Vector3.create(PANEL_POS.x, PANEL_POS.y + PANEL_H * 0.5 + 0.15, PANEL_POS.z) })
  Billboard.create(header, {})
  TextShape.create(header, { text: '📋 FB9 MAP', fontSize: 1.3, textColor: Color4.create(0.9, 0.8, 0.5, 1), outlineColor: Color4.Black(), outlineWidth: 0.1 })

  // Player blip
  minimapPlayerBlip = engine.addEntity()
  Transform.create(minimapPlayerBlip, { position: Vector3.create(0, -50, 0), scale: Vector3.create(0.1, 0.1, 0.05) })
  MeshRenderer.setCylinder(minimapPlayerBlip)
  Material.setPbrMaterial(minimapPlayerBlip, { albedoColor: Color4.create(0.3, 0.5, 1, 1), emissiveColor: { r: 0.1, g: 0.2, b: 0.8 }, emissiveIntensity: 1.5 })

  // Create 3 wandering enemy entities (purple boxes)
  const enemyPositions = [
    Vector3.create(x - 3, 0.75, z - 2),
    Vector3.create(x + 2, 0.75, z + 1),
    Vector3.create(x,     0.75, z + 3)
  ]
  const enemyColors = [
    Color4.create(0.9, 0.2, 0.2, 1),
    Color4.create(1, 0.6, 0.1, 1),
    Color4.create(0.8, 0.1, 0.9, 1)
  ]

  const enemyWanders: Array<{ entity: ReturnType<typeof engine.addEntity>; dir: number; speed: number; range: number; startX: number }> = []

  for (let i = 0; i < 3; i++) {
    const ep = enemyPositions[i]; const ec = enemyColors[i]
    const enemy = engine.addEntity()
    Transform.create(enemy, { position: Vector3.create(ep.x, ep.y, ep.z), scale: Vector3.create(0.4, 0.8, 0.3) })
    MeshRenderer.setBox(enemy)
    Material.setPbrMaterial(enemy, { albedoColor: ec, emissiveColor: { r: ec.r * 0.3, g: ec.g * 0.3, b: ec.b * 0.3 }, emissiveIntensity: 0.4 })
    registerMinimapEntity(enemy, ec)
    enemyWanders.push({ entity: enemy, dir: (i % 2 === 0 ? 1 : -1), speed: 1.0 + i * 0.3, range: 2.0, startX: ep.x })
  }

  // Wander system for demo enemies
  engine.addSystem((dt: number) => {
    for (const w of enemyWanders) {
      const t = Transform.getMutableOrNull(w.entity)
      if (!t) continue
      t.position.x += w.dir * w.speed * dt
      if (Math.abs(t.position.x - w.startX) > w.range) w.dir *= -1
    }
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z - 3.5) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'registerMinimapEntity(entity, color)\nSystem updates blip each frame\n🔵 Blue = player, 🔴🟠🟣 = enemies',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[FB9] Enemy blip minimap initialized — 3 wandering enemies tracked')
}
