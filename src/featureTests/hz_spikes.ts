/**
 * hz_spikes.ts — HZ1: Spike Wall + HZ2: Single Spike Box
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Spikes that protrude from a surface on a cycle (timed or player-triggered).
 * Warning flash → extend → retract. Proximity damage when extended.
 *
 * CONFIGURABLES:
 *   rows / cols        — grid of spikes (HZ1 = 3×2, HZ2 = 1×1)
 *   spikeLength        — how far spikes protrude (metres)
 *   spikeDiameter      — thickness of each spike
 *   wallThickness      — depth of the backing wall
 *   direction          — which axis spikes extend along (here: +Z for HZ1, -Z for HZ2)
 *   warnTime / activeTime / cooldownTime
 *   mode               — 'timed' (always cycling) | 'player_triggered'
 *
 * FRAMEWORK NOTE — HazardState machine
 * ──────────────────────────────────────
 *   idle → warning (flash) → active (spikes out + damage) → cooldown → idle
 *
 * This exact state machine also drives:
 *   HZ9 Thwomp:          idle → warning (shake) → active (fall) → cooldown (rise)
 *   HZ3 Dart Wall:       idle → active (dart flies) → cooldown
 *   HZ8 Laser Turret:    alternating active/cooldown with no warning
 * Extract to hz_shared.ts when the pattern is confirmed across 3+ uses.
 *
 * DAMAGE MODEL
 * ────────────
 * When spikes are active and player is within hitRadius of the spike tips:
 *   → Physics.applyKnockbackToPlayer (knockback away from wall)
 *   → 1-second immunity so single contact doesn't chain-hit
 *   → Hit counter shown above hazard
 *
 * DEMO (run and verify):
 *   HZ1 — Spike Wall (3×2 grid):
 *     [ ] Walk to green platform → triggers spike cycle
 *     [ ] Wall flashes orange/red for 0.8s → spikes extend 1.5m
 *     [ ] Stand in front of extended spikes → knockback away from wall
 *     [ ] Spikes retract after 1.5s → 3s cooldown
 *   HZ2 — Single Spike Box:
 *     [ ] Box runs on timed 1s/2s/2s cycle automatically
 *     [ ] Single large spike protrudes from front face
 *     [ ] Green pad shows safe stand position
 *   Both: console logs [HZ1] / [HZ2] state transitions + hits
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Physics } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

type HazardState = 'idle' | 'warning' | 'active' | 'cooldown'

interface SpikeConfig {
  rows: number; cols: number
  spikeLength: number; spikeDiameter: number; wallThickness: number
  warnTime: number; activeTime: number; cooldownTime: number
  hitRadius: number
  mode: 'timed' | 'player_triggered'
  logTag: string
}

interface SpikeEntry {
  config: SpikeConfig
  wallEntity: ReturnType<typeof engine.addEntity>
  spikeEntities: ReturnType<typeof engine.addEntity>[]
  spikeBasePositions: Map<ReturnType<typeof engine.addEntity>, Vector3>
  spikeDir: Vector3        // unit vector: direction spikes extend
  wallFacePos: Vector3     // position of the wall FACE center (where spikes start)
  hitSignEntity: ReturnType<typeof engine.addEntity>
  state: HazardState
  timer: number
  hitImmunity: number
  hitCount: number
}

const spikeHazards: SpikeEntry[] = []
let spikeSystemRegistered = false

// ─── Spike visual update ──────────────────────────────────────────────────────

function setSpikeExtension(entry: SpikeEntry, length: number): void {
  for (const spike of entry.spikeEntities) {
    const t = Transform.getMutableOrNull(spike)
    if (!t) continue
    const base = entry.spikeBasePositions.get(spike)
    if (!base) continue
    const halfLen = length * 0.5
    t.position = Vector3.create(
      base.x + entry.spikeDir.x * halfLen,
      base.y + entry.spikeDir.y * halfLen,
      base.z + entry.spikeDir.z * halfLen
    )
    // Scale the spike box so it extrudes along spikeDir
    // spikeDir = +Z → scale is (diam, diam, length)
    // spikeDir = +X → scale is (length, diam, diam)
    // spikeDir = +Y → scale is (diam, length, diam)
    const ad = entry.config.spikeDiameter
    const ax = Math.abs(entry.spikeDir.x) > 0.5 ? Math.max(0.001, length) : ad
    const ay = Math.abs(entry.spikeDir.y) > 0.5 ? Math.max(0.001, length) : ad
    const az = Math.abs(entry.spikeDir.z) > 0.5 ? Math.max(0.001, length) : ad
    t.scale = Vector3.create(ax, ay, az)
  }
}

function setWallColor(e: ReturnType<typeof engine.addEntity>, c: Color4): void {
  Material.setPbrMaterial(e, { albedoColor: c })
}

// ─── Spike system ─────────────────────────────────────────────────────────────

function ensureSpikeSystem(): void {
  if (spikeSystemRegistered) return
  spikeSystemRegistered = true

  engine.addSystem((dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    const pp = pT?.position ?? Vector3.create(0, -100, 0)

    for (const h of spikeHazards) {
      if (h.hitImmunity > 0) h.hitImmunity -= dt

      switch (h.state) {
        case 'idle':
          if (h.config.mode === 'timed') {
            h.state = 'warning'; h.timer = h.config.warnTime
            setWallColor(h.wallEntity, Color4.create(1, 0.3, 0, 1))
          }
          break

        case 'warning': {
          h.timer -= dt
          const pulse = Math.abs(Math.sin(h.timer * 10))
          setWallColor(h.wallEntity, Color4.create(1, pulse * 0.4, 0, 1))
          if (h.timer <= 0) {
            setSpikeExtension(h, h.config.spikeLength)
            h.state = 'active'; h.timer = h.config.activeTime
            setWallColor(h.wallEntity, Color4.create(0.6, 0.0, 0.0, 1))
            console.log(`[${h.config.logTag}] SPIKES EXTENDED`)
          }
          break
        }

        case 'active': {
          h.timer -= dt
          // Proximity damage check: distance from player to spike tip zone
          const tipX = h.wallFacePos.x + h.spikeDir.x * h.config.spikeLength
          const tipY = h.wallFacePos.y + h.spikeDir.y * h.config.spikeLength
          const tipZ = h.wallFacePos.z + h.spikeDir.z * h.config.spikeLength
          const dx = pp.x - tipX; const dy = pp.y - 1.0 - tipY; const dz = pp.z - tipZ
          const dist = Math.sqrt(dx*dx + dz*dz)  // XZ plane distance
          if (dist < h.config.hitRadius && h.hitImmunity <= 0) {
            Physics.applyKnockbackToPlayer(Vector3.create(0, 0, 0), 10)
            h.hitImmunity = 1.2; h.hitCount++
            TextShape.getMutable(h.hitSignEntity).text = `⚡ HIT! (${h.hitCount})`
            TextShape.getMutable(h.hitSignEntity).textColor = Color4.create(1, 0.2, 0.2, 1)
            console.log(`[${h.config.logTag}] SPIKE HIT #${h.hitCount}`)
          }
          if (h.timer <= 0) {
            setSpikeExtension(h, 0)
            h.state = 'cooldown'; h.timer = h.config.cooldownTime
            setWallColor(h.wallEntity, Color4.create(0.3, 0.3, 0.6, 1))
            setTimeout(() => { TextShape.getMutable(h.hitSignEntity).text = '' }, 1200)
          }
          break
        }

        case 'cooldown':
          h.timer -= dt
          if (h.timer <= 0) {
            if (h.config.mode === 'timed') {
              h.state = 'warning'; h.timer = h.config.warnTime
              setWallColor(h.wallEntity, Color4.create(1, 0.3, 0, 1))
            } else {
              h.state = 'idle'
              setWallColor(h.wallEntity, Color4.create(0.3, 0.3, 0.6, 1))
            }
          }
          break
      }
    }
  }, 10)
}

// ─── Spike hazard builder ─────────────────────────────────────────────────────

function buildSpikeHazard(
  config: SpikeConfig,
  wallCenter: Vector3,     // center of the backing wall
  spikeDir: Vector3        // unit vector — which way spikes extend
): SpikeEntry {
  ensureSpikeSystem()

  // Wall backing
  const wallW = config.cols * (config.spikeDiameter * 2.5)
  const wallH = config.rows * (config.spikeDiameter * 2.5)
  const wallScaleX = Math.abs(spikeDir.z) > 0.5 ? wallW : config.wallThickness
  const wallScaleZ = Math.abs(spikeDir.z) > 0.5 ? config.wallThickness : wallW

  const wallEntity = engine.addEntity()
  Transform.create(wallEntity, {
    position: Vector3.create(wallCenter.x, wallCenter.y, wallCenter.z),
    scale: Vector3.create(wallScaleX, wallH, wallScaleZ)
  })
  MeshRenderer.setBox(wallEntity)
  MeshCollider.setBox(wallEntity, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(wallEntity, { albedoColor: Color4.create(0.3, 0.3, 0.6, 1) })

  // Wall face position (the face from which spikes emerge)
  const wallFacePos = Vector3.create(
    wallCenter.x + spikeDir.x * (Math.abs(spikeDir.x) > 0.5 ? config.wallThickness * 0.5 : 0),
    wallCenter.y,
    wallCenter.z + spikeDir.z * (Math.abs(spikeDir.z) > 0.5 ? config.wallThickness * 0.5 : 0)
  )

  // Spike entities
  const spikeEntities: ReturnType<typeof engine.addEntity>[] = []
  const spikeBasePositions = new Map<ReturnType<typeof engine.addEntity>, Vector3>()
  const spacing = config.spikeDiameter * 2.5

  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      // Grid offset perpendicular to spike direction
      const lx = (c - (config.cols - 1) * 0.5) * spacing
      const ly = (r - (config.rows - 1) * 0.5) * spacing

      // Base position: on the wall face, grid-distributed
      let bx = wallFacePos.x + (Math.abs(spikeDir.z) > 0.5 ? lx : 0)
      let by = wallFacePos.y + ly
      let bz = wallFacePos.z + (Math.abs(spikeDir.x) > 0.5 ? lx : 0)

      const basePos = Vector3.create(bx, by, bz)
      const spike = engine.addEntity()
      Transform.create(spike, {
        position: Vector3.create(bx, by, bz),
        scale: Vector3.create(config.spikeDiameter, config.spikeDiameter, 0.001)
      })
      MeshRenderer.setBox(spike)
      Material.setPbrMaterial(spike, {
        albedoColor: Color4.create(0.75, 0.75, 0.75, 1),
        emissiveColor: { r: 0.1, g: 0.1, b: 0.1 }, emissiveIntensity: 0.3
      })
      spikeEntities.push(spike)
      spikeBasePositions.set(spike, basePos)
    }
  }

  // Hit sign
  const hitSignEntity = engine.addEntity()
  Transform.create(hitSignEntity, {
    position: Vector3.create(wallCenter.x, wallCenter.y + wallH * 0.5 + 0.9, wallCenter.z)
  })
  Billboard.create(hitSignEntity, {})
  TextShape.create(hitSignEntity, { text: '', fontSize: 2, textColor: Color4.White() })

  const entry: SpikeEntry = {
    config, wallEntity, spikeEntities, spikeBasePositions,
    spikeDir, wallFacePos, hitSignEntity,
    state: config.mode === 'timed' ? 'warning' : 'idle',
    timer: config.mode === 'timed' ? config.warnTime : 0,
    hitImmunity: 0, hitCount: 0
  }
  if (config.mode === 'timed') {
    setWallColor(wallEntity, Color4.create(1, 0.3, 0, 1))
  }
  spikeHazards.push(entry)
  return entry
}

// ─── Station: HZ1 — Spike Wall ───────────────────────────────────────────────

export function setupHZSpikeWall(): void {
  const { x, z } = { x: 96, z: 118 }
  createStation('hz1_spikewall', 'HZ1 — SPIKE WALL\n3×2 grid, player trigger', STATUS_COLOR.FULLY_CODED)

  // Green trigger platform in front of the wall
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(x, 0.52, z + 1.5),
    scale: Vector3.create(3.5, 0.08, 2.0)
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(platform, { albedoColor: Color4.create(0.1, 0.6, 0.2, 1) })

  const platLbl = engine.addEntity()
  Transform.create(platLbl, { position: Vector3.create(x, 0.68, z + 1.5) })
  Billboard.create(platLbl, {})
  TextShape.create(platLbl, {
    text: '⚠ Step here', fontSize: 1.0, textColor: Color4.create(1, 0.9, 0, 1)
  })

  // Build the spike wall (spikes extend toward +Z — toward the player on the platform)
  const wallCenter = Vector3.create(x, 1.5, z - 2.0)
  const entry = buildSpikeHazard(
    {
      rows: 2, cols: 3,
      spikeLength: 1.6, spikeDiameter: 0.14, wallThickness: 0.4,
      warnTime: 0.8, activeTime: 1.5, cooldownTime: 3.0,
      hitRadius: 1.3, mode: 'player_triggered', logTag: 'HZ1'
    },
    wallCenter, Vector3.create(0, 0, 1)   // +Z direction
  )

  // Trigger area on the platform
  const triggerEntity = engine.addEntity()
  Transform.create(triggerEntity, {
    position: Vector3.create(x, 0.9, z + 1.5),
    scale: Vector3.create(3.5, 1.5, 2.0)
  })
  TriggerArea.setBox(triggerEntity)
  triggerAreaEventsSystem.onTriggerEnter(triggerEntity, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    if (entry.state === 'idle') {
      entry.state = 'warning'; entry.timer = entry.config.warnTime
      setWallColor(entry.wallEntity, Color4.create(1, 0.3, 0, 1))
      console.log('[HZ1] Player triggered spike wall')
    }
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.2, z - 2.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'rows=2, cols=3, spikeLen=1.6m\nwarn=0.8s, active=1.5s, cool=3s\nSame FSM: Thwomp, Darts, Laser',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ1] SpikeWall initialized — 3×2, player triggered')
}

// ─── Station: HZ2 — Single Spike Box ─────────────────────────────────────────

export function setupHZSpikeBox(): void {
  const { x, z } = { x: 108, z: 118 }
  createStation('hz2_spikebox', 'HZ2 — SINGLE SPIKE\nTimed cycle', STATUS_COLOR.FULLY_CODED)

  // Box at center, single spike extends toward -Z (toward player standing south)
  buildSpikeHazard(
    {
      rows: 1, cols: 1,
      spikeLength: 2.2, spikeDiameter: 0.28, wallThickness: 0.6,
      warnTime: 1.0, activeTime: 2.0, cooldownTime: 2.0,
      hitRadius: 0.9, mode: 'timed', logTag: 'HZ2'
    },
    Vector3.create(x, 1.0, z - 1.0),
    Vector3.create(0, 0, 1)  // +Z (toward player standing at z+2)
  )

  // Green safe zone
  const safePad = engine.addEntity()
  Transform.create(safePad, {
    position: Vector3.create(x, 0.52, z + 2.5),
    scale: Vector3.create(1.6, 0.06, 1.6)
  })
  MeshRenderer.setBox(safePad)
  Material.setPbrMaterial(safePad, { albedoColor: Color4.create(0.1, 0.9, 0.2, 0.8) })

  const safeLbl = engine.addEntity()
  Transform.create(safeLbl, { position: Vector3.create(x, 0.65, z + 2.5) })
  Billboard.create(safeLbl, {})
  TextShape.create(safeLbl, {
    text: '▲ SAFE ZONE\nStand here to test timing',
    fontSize: 1.0, textColor: Color4.create(0.5, 1, 0.5, 1)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.4, z - 1.0) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Single large spike, timed cycle\n1s warn / 2s active / 2s cooldown\nConfigurable length + diameter',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ2] SingleSpikeBox initialized — timed, dir=+Z')
}
