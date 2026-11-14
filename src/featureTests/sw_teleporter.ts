/**
 * sw_teleporter.ts — SW7: Teleporter + SW8: Moving Bridge + SW9: Weight Platform
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * SW7 — Teleporter Pair: step in portal A → appear at portal B.
 *   Uses movePlayerTo() (restricted action). Cooldown prevents ping-pong.
 *   Bidirectional: works both ways. Visual swirl effect (rotating ring).
 *
 * SW8 — Moving Bridge: platform extends across a gap when lever activated.
 *   Linear lerp from retracted to extended position (and back).
 *   Player walks onto it normally when extended (no ride mechanic needed —
 *   bridge extends, THEN player crosses; bridge doesn't move under them).
 *
 * SW9 — Weight Platform: sinks when player stands on it, rises when they leave.
 *   TriggerArea detects player presence. Transform.position.y lerps toward
 *   target. Clamps at min Y (sunk) and max Y (floating). Configurable rates.
 *   This IS the "player rides a moving platform" mechanic without needing
 *   movePlayerTo() — the platform sinks under the player naturally via physics.
 *
 * FRAMEWORK NOTE — Teleporter pattern
 * ──────────────────────────────────────
 * Teleporters + checkpoints combine for safe level traversal:
 *   MonsterLibrary:  multi-floor elevator (step in → appear on floor 2)
 *   GhostTown V2:    hidden passageways, graveyard shortcut
 *   OreMonger:       mine shaft elevator between levels
 *
 * FRAMEWORK NOTE — Moving bridge
 * ───────────────────────────────
 * SW8 is the simplest form of "triggered moving platform":
 * the platform moves, THEN the player crosses. No ride tracking needed.
 *   MonsterLibrary:  drawbridge from reception to stacks
 *   OreMonger:       mine cart track extension
 *   Any platformer:  gap-crossing gimmick
 *
 * FRAMEWORK NOTE — Weight platform (SW9)
 * ────────────────────────────────────────
 * Key DCL insight: players NATURALLY sink with a platform that lowers under
 * them because DCL physics keeps them on walkable surfaces. This means weight
 * platforms work WITHOUT needing movePlayerTo() — the platform lowers and
 * the player follows via normal gravity. This is the cheapest "moving platform
 * with player riding" technique in DCL.
 *
 * DEMO (run and verify):
 *   SW7 — Teleporter:
 *     [ ] Walk into portal A (blue swirl) → appear at portal B (orange swirl)
 *     [ ] Walk into portal B → appear back at A (bidirectional)
 *     [ ] Cooldown 2s prevents immediate re-teleport
 *   SW8 — Moving Bridge:
 *     [ ] Gap visible in platform; bridge is retracted (not in position)
 *     [ ] Click lever → bridge extends across gap over 2s
 *     [ ] Cross the bridge
 *     [ ] Click lever again → bridge retracts (don't be on it!)
 *   SW9 — Weight Platform:
 *     [ ] Stand on platform → it slowly sinks (1 m/s)
 *     [ ] Step off → it slowly rises back (0.5 m/s)
 *     [ ] Platform clamps at minY; jumps off bring it back up
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: SW7 — Teleporter Pair ──────────────────────────────────────────

export function setupSWTeleporter(): void {
  const { x, z } = { x: 28, z: 44 }
  createStation('sw7_teleport', 'SW7 — TELEPORTER PAIR\nBidirectional, 2s cooldown', STATUS_COLOR.FULLY_CODED)

  // Portal A (blue) and Portal B (orange)
  const portalA = { pos: Vector3.create(x - 2.5, 0.52, z - 1.5), color: Color4.create(0.2, 0.5, 1, 1), name: 'A', dest: Vector3.create(x + 2.5, 1.0, z + 1.5) }
  const portalB = { pos: Vector3.create(x + 2.5, 0.52, z + 1.5), color: Color4.create(1, 0.5, 0.1, 1), name: 'B', dest: Vector3.create(x - 2.5, 1.0, z - 1.5) }

  let lastTeleportTime = 0
  const COOLDOWN = 2.0  // seconds

  for (const portal of [portalA, portalB]) {
    // Portal ring (flat cylinder on floor)
    const ring = engine.addEntity()
    Transform.create(ring, {
      position: Vector3.create(portal.pos.x, portal.pos.y, portal.pos.z),
      scale: Vector3.create(1.6, 0.08, 1.6)
    })
    MeshRenderer.setCylinder(ring)
    Material.setPbrMaterial(ring, {
      albedoColor: Color4.create(portal.color.r, portal.color.g, portal.color.b, 0.9),
      emissiveColor: { r: portal.color.r * 0.6, g: portal.color.g * 0.6, b: portal.color.b * 0.6 },
      emissiveIntensity: 1.5, transparencyMode: 1
    })

    // Rotating symbol above portal
    const symbol = engine.addEntity()
    Transform.create(symbol, {
      position: Vector3.create(portal.pos.x, portal.pos.y + 1.2, portal.pos.z),
      scale: Vector3.create(0.6, 0.6, 0.1)
    })
    MeshRenderer.setBox(symbol)
    Material.setPbrMaterial(symbol, {
      albedoColor: Color4.create(portal.color.r, portal.color.g, portal.color.b, 0.8),
      emissiveColor: { r: portal.color.r * 0.5, g: portal.color.g * 0.5, b: portal.color.b * 0.5 },
      emissiveIntensity: 2, transparencyMode: 1
    })

    const symAngle = { v: 0 }
    engine.addSystem((dt: number) => {
      symAngle.v += 120 * dt
      Transform.getMutable(symbol).rotation = Quaternion.fromEulerDegrees(0, symAngle.v, 0)
    }, 5)

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(portal.pos.x, portal.pos.y + 2.0, portal.pos.z) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, { text: `⬡ PORTAL ${portal.name}`, fontSize: 1.3, textColor: Color4.create(portal.color.r, portal.color.g, portal.color.b, 1) })

    // Trigger
    const trigger = engine.addEntity()
    Transform.create(trigger, {
      position: Vector3.create(portal.pos.x, portal.pos.y + 0.6, portal.pos.z),
      scale: Vector3.create(1.6, 1.4, 1.6)
    })
    TriggerArea.create(trigger, {
      triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(1.6, 1.4, 1.6) }]
    })

    const dest = portal.dest
    triggerAreaEventsSystem.onEnterArea(trigger, (r) => {
      if (r.otherEntity !== engine.PlayerEntity) return
      const now = Date.now() / 1000
      if (now - lastTeleportTime < COOLDOWN) return
      lastTeleportTime = now
      movePlayerTo({ newRelativePosition: Vector3.create(dest.x, dest.y, dest.z) })
      console.log(`[SW7] TELEPORT: Portal ${portal.name} → ${portal.name === 'A' ? 'B' : 'A'}`)
    })
  }

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.5, z - 3.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'movePlayerTo() — DCL restricted action\n2s cooldown stops ping-pong\nBidirectional: same system both portals',
    fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[SW7] Teleporter pair initialized — A↔B, 2s cooldown')
}

// ─── Station: SW8 — Moving Bridge ─────────────────────────────────────────────

export function setupSWMovingBridge(): void {
  const { x, z } = { x: 40, z: 44 }
  createStation('sw8_bridge', 'SW8 — MOVING BRIDGE\nLever activated', STATUS_COLOR.FULLY_CODED)

  // Gap in the floor
  const leftSide = engine.addEntity()
  Transform.create(leftSide, {
    position: Vector3.create(x - 2.5, 0.52, z),
    scale: Vector3.create(2.5, 0.12, 5.5)
  })
  MeshRenderer.setBox(leftSide)
  MeshCollider.setBox(leftSide, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(leftSide, { albedoColor: Color4.create(0.3, 0.3, 0.4, 1) })

  const rightSide = engine.addEntity()
  Transform.create(rightSide, {
    position: Vector3.create(x + 2.5, 0.52, z),
    scale: Vector3.create(2.5, 0.12, 5.5)
  })
  MeshRenderer.setBox(rightSide)
  MeshCollider.setBox(rightSide, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(rightSide, { albedoColor: Color4.create(0.3, 0.3, 0.4, 1) })

  // Gap label
  const gapLbl = engine.addEntity()
  Transform.create(gapLbl, { position: Vector3.create(x, 0.6, z + 0.5) })
  Billboard.create(gapLbl, {})
  TextShape.create(gapLbl, { text: '🔽 GAP\nActivate lever →', fontSize: 1.0, textColor: Color4.create(1, 0.5, 0.2, 1) })

  // Bridge entity (starts retracted — to the left off-screen)
  const bridgeRetractedX = x - 5.0  // retracted position (hidden to left)
  const bridgeExtendedX  = x        // extended position (across gap)

  const bridge = engine.addEntity()
  Transform.create(bridge, {
    position: Vector3.create(bridgeRetractedX, 0.52, z),
    scale: Vector3.create(3.0, 0.15, 2.0)  // width spans the gap
  })
  MeshRenderer.setBox(bridge)
  MeshCollider.setBox(bridge, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(bridge, { albedoColor: Color4.create(0.5, 0.35, 0.2, 1) })

  // Bridge state
  let bridgeExtended = false
  let bridgeCurrentX = bridgeRetractedX
  let bridgeTargetX  = bridgeRetractedX
  const BRIDGE_SPEED = 2.0  // m/s

  engine.addSystem((dt: number) => {
    const diff = bridgeTargetX - bridgeCurrentX
    if (Math.abs(diff) < 0.05) {
      bridgeCurrentX = bridgeTargetX
      Transform.getMutable(bridge).position = Vector3.create(bridgeCurrentX, 0.52, z)
      return
    }
    bridgeCurrentX += Math.sign(diff) * Math.min(Math.abs(diff), BRIDGE_SPEED * dt)
    Transform.getMutable(bridge).position = Vector3.create(bridgeCurrentX, 0.52, z)
  }, 5)

  // Lever base (on left platform)
  const leverBase = engine.addEntity()
  Transform.create(leverBase, {
    position: Vector3.create(x - 3.5, 1.1, z + 1.0),
    scale: Vector3.create(0.2, 1.0, 0.2)
  })
  MeshRenderer.setBox(leverBase)
  MeshCollider.setBox(leverBase, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(leverBase, { albedoColor: Color4.create(0.5, 0.4, 0.3, 1) })

  const leverHandle = engine.addEntity()
  Transform.create(leverHandle, {
    position: Vector3.create(x - 3.5, 1.7, z + 1.0),
    scale: Vector3.create(0.12, 0.6, 0.12),
    rotation: Quaternion.fromEulerDegrees(-35, 0, 0)
  })
  MeshRenderer.setBox(leverHandle)
  Material.setPbrMaterial(leverHandle, { albedoColor: Color4.create(0.9, 0.3, 0.1, 1) })

  const bridgeLbl = engine.addEntity()
  Transform.create(bridgeLbl, { position: Vector3.create(x - 3.5, 2.5, z + 1.0) })
  Billboard.create(bridgeLbl, {})
  TextShape.create(bridgeLbl, { text: '⬛ BRIDGE', fontSize: 1.0, textColor: Color4.create(0.9, 0.5, 0.1, 1) })

  pointerEventsSystem.onPointerDown(
    { entity: leverBase, opts: { button: 1, hoverText: '[E] Bridge lever', maxDistance: 5 } },
    () => {
      bridgeExtended = !bridgeExtended
      bridgeTargetX = bridgeExtended ? bridgeExtendedX : bridgeRetractedX
      Transform.getMutable(leverHandle).rotation = Quaternion.fromEulerDegrees(bridgeExtended ? 35 : -35, 0, 0)
      TextShape.getMutable(bridgeLbl).text = bridgeExtended ? '⬛ RETRACT →' : '⬛ BRIDGE'
      console.log(`[SW8] Bridge: ${bridgeExtended ? 'EXTENDING' : 'RETRACTING'}`)
    }
  )

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.5, z - 3.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Platform lerps on/off across gap\nNo ride tracking needed (extends, THEN cross)\nSame lever driver as SW2',
    fontSize: 1.1, textColor: Color4.create(1, 0.85, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[SW8] MovingBridge initialized — lever-activated, 2 m/s')
}

// ─── Station: SW9 — Weight Platform ──────────────────────────────────────────

export function setupSWWeightPlatform(): void {
  const { x, z } = { x: 52, z: 44 }
  createStation('sw9_weight', 'SW9 — WEIGHT PLATFORM\nSinks under player', STATUS_COLOR.FULLY_CODED)

  const MAX_Y   = 2.5  // platform height when unloaded
  const MIN_Y   = 0.6  // maximum sink depth
  const SINK_RATE = 1.0  // m/s sinking
  const RISE_RATE = 0.5  // m/s rising

  // The sinking platform
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(x, MAX_Y, z),
    scale: Vector3.create(3.5, 0.3, 3.5)
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(platform, {
    albedoColor: Color4.create(0.5, 0.4, 0.8, 1),
    emissiveColor: { r: 0.1, g: 0.05, b: 0.3 }, emissiveIntensity: 0.3
  })

  // Support pillars (visual only — show that platform is elevated)
  for (const px of [x - 1.5, x + 1.5]) {
    for (const pz of [z - 1.5, z + 1.5]) {
      const pillar = engine.addEntity()
      Transform.create(pillar, {
        position: Vector3.create(px, 1.0, pz),
        scale: Vector3.create(0.2, 2.5, 0.2)
      })
      MeshRenderer.setBox(pillar)
      Material.setPbrMaterial(pillar, { albedoColor: Color4.create(0.4, 0.3, 0.6, 0.8) })
    }
  }

  // Status display
  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, MAX_Y + 1.5, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '🔼 FLOATING', fontSize: 1.2, textColor: Color4.create(0.6, 0.6, 1, 1) })

  // Depth indicator strip on a wall
  const depthWall = engine.addEntity()
  Transform.create(depthWall, {
    position: Vector3.create(x + 2.5, 1.5, z),
    scale: Vector3.create(0.08, 2.5, 0.5)
  })
  MeshRenderer.setBox(depthWall)
  Material.setPbrMaterial(depthWall, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  const depthIndicator = engine.addEntity()
  Transform.create(depthIndicator, {
    position: Vector3.create(x + 2.5, MAX_Y, z),
    scale: Vector3.create(0.12, 0.12, 0.12)
  })
  MeshRenderer.setCylinder(depthIndicator)
  Material.setPbrMaterial(depthIndicator, {
    albedoColor: Color4.create(0.5, 0.4, 1, 1),
    emissiveColor: { r: 0.3, g: 0.2, b: 0.8 }, emissiveIntensity: 1
  })

  // Weight system
  let currentY = MAX_Y
  let playerOnPlatform = false

  // Trigger area on top of platform
  const trigger = engine.addEntity()
  Transform.create(trigger, {
    position: Vector3.create(x, MAX_Y + 0.5, z),
    scale: Vector3.create(3.5, 0.6, 3.5)
  })
  TriggerArea.create(trigger, {
    triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(3.5, 0.6, 3.5) }]
  })
  triggerAreaEventsSystem.onEnterArea(trigger, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    playerOnPlatform = true
    TextShape.getMutable(statusLbl).text = '⬇ SINKING'
    TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.4, 0.4, 1)
    console.log('[SW9] Player on platform — sinking')
  })
  triggerAreaEventsSystem.onExitArea(trigger, (r) => {
    if (r.otherEntity !== engine.PlayerEntity) return
    playerOnPlatform = false
    TextShape.getMutable(statusLbl).text = '🔼 RISING'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 1, 0.5, 1)
    console.log('[SW9] Player left platform — rising')
  })

  engine.addSystem((dt: number) => {
    if (playerOnPlatform && currentY > MIN_Y) {
      currentY = Math.max(MIN_Y, currentY - SINK_RATE * dt)
    } else if (!playerOnPlatform && currentY < MAX_Y) {
      currentY = Math.min(MAX_Y, currentY + RISE_RATE * dt)
      if (currentY >= MAX_Y) {
        TextShape.getMutable(statusLbl).text = '🔼 FLOATING'
        TextShape.getMutable(statusLbl).textColor = Color4.create(0.6, 0.6, 1, 1)
      }
    }
    Transform.getMutable(platform).position = Vector3.create(x, currentY, z)
    Transform.getMutable(trigger).position = Vector3.create(x, currentY + 0.5, z)
    Transform.getMutable(statusLbl).position = Vector3.create(x, currentY + 1.5, z)
    Transform.getMutable(depthIndicator).position = Vector3.create(x + 2.5, currentY, z)

    // Update platform color (purple when floating → red when sunk)
    const t = (MAX_Y - currentY) / (MAX_Y - MIN_Y)  // 0=floating, 1=sunk
    Material.setPbrMaterial(platform, {
      albedoColor: Color4.create(0.5 + 0.4 * t, 0.4 - 0.3 * t, 0.8 - 0.5 * t, 1),
      emissiveColor: { r: 0.1 + 0.3 * t, g: 0.05, b: 0.3 - 0.2 * t }, emissiveIntensity: 0.3 + t * 0.5
    })
  }, 10)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z - 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Player naturally follows via DCL physics!\nNo movePlayerTo() needed\nSink: 1 m/s | Rise: 0.5 m/s',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[SW9] WeightPlatform initialized — maxY=2.5, minY=0.6, sink=1m/s, rise=0.5m/s')
}
