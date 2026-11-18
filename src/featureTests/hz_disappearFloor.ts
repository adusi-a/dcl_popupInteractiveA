/**
 * hz_disappearFloor.ts — HZ5: Disappearing Floor
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Floor tiles that disappear (become non-collidable) on a trigger or cycle.
 * Uses MeshCollider.deleteFrom() / MeshCollider.setBox() for real collider
 * add/remove — the player genuinely falls through, not just visually gone.
 *
 * TWO MODES (shown side by side in this station):
 *   Mode A — Player-triggered:
 *     Step on tile → tile flashes → after 0.8s disappears → player falls → 
 *     tile comes back after 2s and flashes back in
 *
 *   Mode B — Timed cycle:
 *     Tiles cycle on/off on configurable independent timers
 *     Visual changes (opacity/color) + real collider changes
 *     Tiles can be offset from each other for staggered patterns
 *
 * CONFIGURABLES:
 *   warnTime     — flash duration before disappearing (Mode A)
 *   goneTime     — how long it stays gone (both modes)
 *   onTime       — solid duration per tile (Mode B)
 *   offTime      — gone duration per tile (Mode B)
 *   offsetTime   — stagger start time per tile (Mode B — creates wave)
 *   restoreFlash — flash duration when coming back
 *
 * FRAMEWORK NOTE
 * ──────────────
 * This prototype confirms:
 *   • MeshCollider.deleteFrom(entity) works in SDK7 for real collider removal
 *   • The pattern for state-dependent collider toggling
 *   • Staggered timer offsets for visual patterns (wave, checkerboard)
 *
 * Any platformer with floor gimmicks uses this. MonsterLibrary basement
 * section ("floor crumbles as the chase intensifies") is a direct use.
 *
 * DEMO (run and verify):
 *   Mode A (LEFT side):
 *     [ ] Walk onto blue tile → tile flashes orange → disappears after 0.8s
 *     [ ] Player falls through (the tile has NO COLLIDER while gone)
 *     [ ] Tile fades back after 2s (can't use it again immediately)
 *   Mode B (RIGHT side, 4 tiles):
 *     [ ] Tiles cycle in a wave pattern — one at a time goes dark + non-solid
 *     [ ] Try to run across — you fall through dark tiles
 *     [ ] Each tile independent: different on/off timing
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

type FloorState = 'solid' | 'warning' | 'gone' | 'restoring'

interface FloorTileEntry {
  entity:    ReturnType<typeof engine.addEntity>
  state:     FloorState
  timer:     number
  baseColor: Color4
  warnTime:  number
  goneTime:  number
  restoreTime: number
  logTag:    string
  tileX:     number   // world X center — for proximity check on restore
  tileZ:     number   // world Z center
  tileY:     number   // world Y center
  onPlayerStep?: () => void
}

interface CycleFloorEntry {
  entity:   ReturnType<typeof engine.addEntity>
  state:    'solid' | 'gone'
  timer:    number
  onTime:   number
  offTime:  number
  baseColor: Color4
}

const floorTiles: FloorTileEntry[] = []
const cycleTiles: CycleFloorEntry[] = []
let floorSystemRegistered = false

// ─── Floor tile system ────────────────────────────────────────────────────────

function ensureFloorSystem(): void {
  if (floorSystemRegistered) return
  floorSystemRegistered = true

  engine.addSystem((dt: number) => {
    // Mode A: triggered floor tiles
    for (const tile of floorTiles) {
      switch (tile.state) {
        case 'solid': break  // waiting for player step

        case 'warning': {
          tile.timer -= dt
          // Flash between base color and orange
          const pulse = Math.abs(Math.sin(tile.timer * 10))
          Material.setPbrMaterial(tile.entity, {
            albedoColor: Color4.create(1, pulse * 0.8, 0, 1)
          })
          if (tile.timer <= 0) {
            // Go gone: remove collider, make transparent
            MeshCollider.deleteFrom(tile.entity)
            Material.setPbrMaterial(tile.entity, {
              albedoColor: Color4.create(0.3, 0.3, 0.6, 0.15),
              transparencyMode: 1
            })
            tile.state = 'gone'
            tile.timer = tile.goneTime
            console.log(`[${tile.logTag}] GONE — collider removed`)
          }
          break
        }

        case 'gone':
          tile.timer -= dt
          if (tile.timer <= 0) {
            // Start restore: flash back
            tile.state = 'restoring'
            tile.timer = tile.restoreTime
            Material.setPbrMaterial(tile.entity, {
              albedoColor: Color4.create(0.5, 0.5, 1, 0.5),
              transparencyMode: 1
            })
          }
          break

        case 'restoring': {
          tile.timer -= dt
          const phase = 1 - tile.timer / tile.restoreTime
          Material.setPbrMaterial(tile.entity, {
            albedoColor: Color4.create(
              tile.baseColor.r * phase + 0.5 * (1 - phase),
              tile.baseColor.g * phase + 0.5 * (1 - phase),
              tile.baseColor.b * phase + 1.0 * (1 - phase),
              phase * 0.85 + 0.15
            )
          })
          if (tile.timer <= 0) {
            // Fully restored: add collider back
            MeshCollider.setBox(tile.entity, ColliderLayer.CL_PHYSICS)
            Material.setPbrMaterial(tile.entity, {
              albedoColor: Color4.create(tile.baseColor.r, tile.baseColor.g, tile.baseColor.b, 1)
            })
            tile.state = 'solid'
            console.log(`[${tile.logTag}] SOLID — collider restored`)
            // onTriggerEnter won't fire if the player is ALREADY in the trigger zone
            // when the tile restores (they were standing there during gone/restoring).
            // Proximity check here catches that case.
            const pT2 = Transform.getOrNull(engine.PlayerEntity)
            if (pT2) {
              const rdx = pT2.position.x - tile.tileX
              const rdz = pT2.position.z - tile.tileZ
              const rdy = pT2.position.y - tile.tileY
              if (Math.abs(rdx) < 1.0 && Math.abs(rdz) < 1.0 && rdy > 0 && rdy < 2.0) {
                tile.state = 'warning'
                tile.timer = tile.warnTime
                console.log(`[${tile.logTag}] Player on tile at restore — starting warning`)
              }
            }
          }
          break
        }
      }
    }

    // Mode B: cycle tiles
    for (const ct of cycleTiles) {
      ct.timer -= dt
      if (ct.timer <= 0) {
        if (ct.state === 'solid') {
          ct.state = 'gone'
          ct.timer = ct.offTime
          MeshCollider.deleteFrom(ct.entity)
          Material.setPbrMaterial(ct.entity, {
            albedoColor: Color4.create(0.1, 0.1, 0.2, 0.2),
            transparencyMode: 1
          })
        } else {
          ct.state = 'solid'
          ct.timer = ct.onTime
          MeshCollider.setBox(ct.entity, ColliderLayer.CL_PHYSICS)
          Material.setPbrMaterial(ct.entity, {
            albedoColor: Color4.create(ct.baseColor.r, ct.baseColor.g, ct.baseColor.b, 1)
          })
        }
      }
    }
  }, 10)
}

// ─── Station: HZ5 — Disappearing Floor ───────────────────────────────────────

export function setupHZDisappearFloor(): void {
  const { x, z } = { x: 144, z: 118 }
  createStation('hz5_disappear', 'HZ5 — DISAPPEAR FLOOR\nMode A trigger + Mode B cycle', STATUS_COLOR.FULLY_CODED)
  ensureFloorSystem()

  // ─── Mode A: Player-triggered disappearing tiles (LEFT side) ──────────────

  const modeALabel = engine.addEntity()
  Transform.create(modeALabel, { position: Vector3.create(x - 2.5, 2.5, z - 3.5) })
  Billboard.create(modeALabel, {})
  TextShape.create(modeALabel, {
    text: 'MODE A\nStep → flash → fall\n2s to restore',
    fontSize: 1.2, textColor: Color4.create(0.7, 0.9, 1, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Create a 2×2 set of triggered tiles
  const tilePositions = [
    Vector3.create(x - 2.5, 0.52, z - 1.5),
    Vector3.create(x - 2.5, 0.52, z + 0.5),
  ]

  for (let i = 0; i < tilePositions.length; i++) {
    const tp = tilePositions[i]
    const baseColor = Color4.create(0.3, 0.5, 0.9, 1)

    const tileEntity = engine.addEntity()
    Transform.create(tileEntity, {
      position: tp,
      scale: Vector3.create(1.8, 0.12, 1.8)
    })
    MeshRenderer.setBox(tileEntity)
    MeshCollider.setBox(tileEntity, ColliderLayer.CL_PHYSICS)
    Material.setPbrMaterial(tileEntity, { albedoColor: baseColor })

    const tileEntry: FloorTileEntry = {
      entity: tileEntity,
      state: 'solid', timer: 0,
      baseColor, warnTime: 0.8, goneTime: 2.0, restoreTime: 0.6,
      logTag: `HZ5-A${i + 1}`,
      tileX: tp.x, tileY: tp.y, tileZ: tp.z
    }
    floorTiles.push(tileEntry)

    // Trigger area on this tile (top surface)
    const triggerEntity = engine.addEntity()
    Transform.create(triggerEntity, {
      position: Vector3.create(tp.x, tp.y + 0.5, tp.z),
      scale: Vector3.create(1.8, 0.8, 1.8)
    })
    TriggerArea.setBox(triggerEntity)

    const tileEntryRef = tileEntry  // capture for closure
    triggerAreaEventsSystem.onTriggerEnter(triggerEntity, (r) => {
      if (r.trigger?.entity !== engine.PlayerEntity) return
      if (tileEntryRef.state === 'solid') {
        tileEntryRef.state = 'warning'
        tileEntryRef.timer = tileEntryRef.warnTime
        console.log(`[${tileEntryRef.logTag}] Player stepped on — warning`)
      }
    })

    // Label on each tile
    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(tp.x, tp.y + 0.3, tp.z) })
    Billboard.create(lbl, {})
    TextShape.create(lbl, {
      text: `A${i + 1}`, fontSize: 1.5, textColor: Color4.White(),
      outlineColor: Color4.Black(), outlineWidth: 0.1
    })
  }

  // ─── Mode B: Timed cycle tiles (RIGHT side, 4 tiles in a row) ────────────

  const modeBLabel = engine.addEntity()
  Transform.create(modeBLabel, { position: Vector3.create(x + 2.0, 2.5, z - 3.5) })
  Billboard.create(modeBLabel, {})
  TextShape.create(modeBLabel, {
    text: 'MODE B\nStaggered on/off cycle\nReal collider add/remove',
    fontSize: 1.2, textColor: Color4.create(1, 0.9, 0.5, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // 4 tiles in a column, staggered (wave pattern)
  const cycleTilePositions = [
    { pos: Vector3.create(x + 2.0, 0.52, z - 2.0), onTime: 2.0, offTime: 1.0, offset: 0.0 },
    { pos: Vector3.create(x + 2.0, 0.52, z - 0.5), onTime: 2.0, offTime: 1.0, offset: 0.75 },
    { pos: Vector3.create(x + 2.0, 0.52, z + 1.0), onTime: 2.0, offTime: 1.0, offset: 1.5 },
    { pos: Vector3.create(x + 2.0, 0.52, z + 2.5), onTime: 2.0, offTime: 1.0, offset: 2.25 },
  ]

  for (const tSpec of cycleTilePositions) {
    const baseColor = Color4.create(0.9, 0.6, 0.1, 1) // amber
    const ctEntity = engine.addEntity()
    Transform.create(ctEntity, {
      position: tSpec.pos,
      scale: Vector3.create(1.8, 0.12, 1.4)
    })
    MeshRenderer.setBox(ctEntity)
    MeshCollider.setBox(ctEntity, ColliderLayer.CL_PHYSICS)
    Material.setPbrMaterial(ctEntity, { albedoColor: baseColor })

    // Stagger: offset tiles start in 'gone' state if their offset is in the offTime window
    const startSolid = tSpec.offset < tSpec.onTime
    const ctEntry: CycleFloorEntry = {
      entity: ctEntity,
      state: startSolid ? 'solid' : 'gone',
      timer: startSolid ? tSpec.onTime - tSpec.offset : tSpec.offset - tSpec.onTime,
      onTime: tSpec.onTime, offTime: tSpec.offTime,
      baseColor
    }

    if (!startSolid) {
      MeshCollider.deleteFrom(ctEntity)
      Material.setPbrMaterial(ctEntity, {
        albedoColor: Color4.create(0.1, 0.1, 0.2, 0.2),
        transparencyMode: 1
      })
    }
    cycleTiles.push(ctEntry)
  }

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z - 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'MeshCollider.deleteFrom() = real fall-through\nMode B: 4 tiles, 0.75s stagger\nPatterns: wave, checkerboard, blink',
    fontSize: 1.1, textColor: Color4.create(1, 0.95, 0.8, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[HZ5] DisappearFloor initialized — Mode A (2 triggered) + Mode B (4 cycle)')
}
