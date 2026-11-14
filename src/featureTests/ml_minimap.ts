/**
 * ml_minimap.ts — T16: World-space Mini-map (Wall Panel)
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * Real-time player position tracking on a wall-mounted 2D map panel.
 * The map is a flat plane in world space (like a map on a wall near the desk).
 * A blue dot moves as the player moves. A yellow "book target" blip is fixed.
 * When the target blip would fall outside the visible map, a rim indicator
 * shows which direction it is.
 *
 * MONSTERLIB MINIMAP DESIGN (from spec)
 * ────────────────────────────────────
 *   • Simplified shelf-bank silhouettes (not individual shelf seams)
 *   • Player dot moves in real time
 *   • Search target: approximate circle offset once per book, stable until found
 *   • Rim blip for off-screen target — shows direction even when off-panel
 *   • Up/down floor indicator (floor number badge)
 *   • Circular crop preferred (but square panel is acceptable for prototype)
 *
 * IMPLEMENTATION APPROACH
 * ────────────────────────
 * World-space panel entity (MeshRenderer.setPlane) + child entities as overlays.
 * Each frame: map player world XZ → panel UV space → move player dot entity.
 *
 * Production version: replace with ReactECS UiEntity overlay.
 * Both approaches use the SAME coordinate math. The world-space version is
 * ideal for MonsterLibrary because a physical map on the wall near the desk
 * is thematically appropriate — the librarian has a floor plan!
 *
 * FRAMEWORK NOTE
 * ──────────────
 * worldToPanel() / panelToWorld() are the cross-platform projection helpers.
 * Extract to a MiniMapSystem that accepts:
 *   - map bounds (world units)
 *   - panel entity ID + position + size
 *   - icons to track (player, enemies, customers, book targets)
 * Same logic works in DCL (this), Three.js (map on a wall or HUD canvas),
 * and web 2D (canvas draw calls).
 *
 * DEMO (run and verify):
 *   [ ] Dark panel visible mounted on wall near ML6 station (X=120, Z=98)
 *   [ ] Walk around the Feature Test Zone — blue dot tracks player position
 *   [ ] Orange "book target" dot fixed at a shelf position
 *   [ ] Walk to X=144 Z=22 — target blip appears on RIM (off-panel indicator)
 *   [ ] Press CYCLE TARGET button — target moves to a new shelf location
 *   [ ] Player dot stays inside panel bounds at all times (clamped)
 *   [ ] Console logs [ML6] when target becomes off-screen
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Map configuration ───────────────────────────────────────────────────────

// The region of the scene we're mapping (the Feature Test Zone)
const MAP_WORLD_ORIGIN = { x: 88, z: 8  }  // top-left corner of mapped area
const MAP_WORLD_SIZE   = { w: 68, h: 92 }  // 68m wide, 92m deep (covers all stations)

// The map panel in world space
const PANEL_CENTER    = Vector3.create(120, 2.0, 94.5)  // face of the wall
const PANEL_SIZE      = 2.4   // metres — panel is 2.4m × 2.0m (w×h, aspect ratio ~0.74)
const PANEL_HEIGHT    = 2.0

// Convert world XZ → panel local coordinates (-0.5..+0.5 range)
function worldToPanel(worldX: number, worldZ: number): { u: number; v: number } {
  const u = (worldX - MAP_WORLD_ORIGIN.x) / MAP_WORLD_SIZE.w - 0.5  // -0.5 to +0.5
  const v = 0.5 - (worldZ - MAP_WORLD_ORIGIN.z) / MAP_WORLD_SIZE.h  // flip Z, 0.5 to -0.5
  return { u, v }
}

// Convert panel UV → world entity position on the panel face
function panelUVtoWorldPos(u: number, v: number): Vector3 {
  return Vector3.create(
    PANEL_CENTER.x + u * PANEL_SIZE,
    PANEL_CENTER.y + v * PANEL_HEIGHT,
    PANEL_CENTER.z - 0.06  // slightly in front of the panel face
  )
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLMinimap(): void {
  const { x, z } = { x: 120, z: 98 }
  createStation('ml6_minimap', 'ML6 — MINI-MAP\nPlayer tracking panel', STATUS_COLOR.FULLY_CODED)

  // ─── Wall backing ─────────────────────────────────────────────────────────
  const wall = engine.addEntity()
  Transform.create(wall, {
    position: Vector3.create(x, 1.5, z - 2.8),
    scale: Vector3.create(3.2, 2.8, 0.1)
  })
  MeshRenderer.setBox(wall)
  Material.setPbrMaterial(wall, {
    albedoColor: Color4.create(0.15, 0.1, 0.08, 1) // dark wood panel
  })

  // Map frame border
  const frame = engine.addEntity()
  Transform.create(frame, {
    position: Vector3.create(PANEL_CENTER.x, PANEL_CENTER.y, PANEL_CENTER.z - 0.03),
    scale: Vector3.create(PANEL_SIZE + 0.1, PANEL_HEIGHT + 0.1, 0.05)
  })
  MeshRenderer.setBox(frame)
  Material.setPbrMaterial(frame, {
    albedoColor: Color4.create(0.5, 0.35, 0.2, 1) // brass/wood frame
  })

  // Map background
  const mapBg = engine.addEntity()
  Transform.create(mapBg, {
    position: Vector3.create(PANEL_CENTER.x, PANEL_CENTER.y, PANEL_CENTER.z - 0.04),
    scale: Vector3.create(PANEL_SIZE, PANEL_HEIGHT, 0.04)
  })
  MeshRenderer.setBox(mapBg)
  Material.setPbrMaterial(mapBg, {
    albedoColor: Color4.create(0.08, 0.1, 0.07, 1) // dark map background
  })

  // "LIBRARY MAP" header
  const header = engine.addEntity()
  Transform.create(header, {
    position: Vector3.create(PANEL_CENTER.x, PANEL_CENTER.y + PANEL_HEIGHT * 0.5 + 0.15, PANEL_CENTER.z - 0.1)
  })
  Billboard.create(header, {})
  TextShape.create(header, {
    text: '📋 LIBRARY MAP',
    fontSize: 1.4, textColor: Color4.create(0.9, 0.8, 0.5, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // ─── Static shelf silhouettes (brown rects on the map) ───────────────────
  const shelfBlocks: Array<{ worldX: number; worldZ: number; worldW: number; worldD: number; label: string }> = [
    { worldX: 92, worldZ: 20, worldW: 20, worldD: 2, label: 'Row1 T1-T5' },  // row of test stations
    { worldX: 92, worldZ: 48, worldW: 20, worldD: 2, label: 'Row2 T6-T10' },
    { worldX: 92, worldZ: 76, worldW: 20, worldD: 2, label: 'Row3 ML1-5'  },
    { worldX: 115, worldZ: 96, worldW: 10, worldD: 2, label: 'Row4 ML6' },
  ]

  for (const block of shelfBlocks) {
    const { u: cu, v: cv } = worldToPanel(block.worldX + block.worldW / 2, block.worldZ)
    const panelW = (block.worldW / MAP_WORLD_SIZE.w) * PANEL_SIZE
    const panelH = (block.worldD / MAP_WORLD_SIZE.h) * PANEL_HEIGHT

    const shelf = engine.addEntity()
    Transform.create(shelf, {
      position: panelUVtoWorldPos(cu, cv),
      scale: Vector3.create(panelW, panelH * 0.5, 0.03)
    })
    MeshRenderer.setBox(shelf)
    Material.setPbrMaterial(shelf, {
      albedoColor: Color4.create(0.5, 0.35, 0.2, 0.9)  // shelf brown
    })
  }

  // ─── Player dot (blue sphere — moves each frame) ─────────────────────────
  const playerDot = engine.addEntity()
  Transform.create(playerDot, {
    position: panelUVtoWorldPos(0, 0),  // start at panel center
    scale: Vector3.create(0.08, 0.08, 0.06)
  })
  MeshRenderer.setCylinder(playerDot)
  Material.setPbrMaterial(playerDot, {
    albedoColor: Color4.create(0.2, 0.4, 1, 1),
    emissiveColor: { r: 0.1, g: 0.2, b: 0.8 }, emissiveIntensity: 1.5
  })

  // Player label above dot
  const playerLbl = engine.addEntity()
  Transform.create(playerLbl, { position: Vector3.create(0, 0, 0) })  // updated in system
  TextShape.create(playerLbl, {
    text: '●', fontSize: 0.8, textColor: Color4.create(0.5, 0.7, 1, 1)
  })

  // ─── Book targets ─────────────────────────────────────────────────────────
  const bookTargets = [
    { worldX: 108, worldZ: 22, label: 'Book A\n(aisle row 1)' },
    { worldX: 132, worldZ: 50, label: 'Book B\n(aisle row 2)' },
    { worldX: 144, worldZ: 78, label: 'Book C\n(deep stacks)' },
    { worldX: 96,  worldZ: 50, label: 'Book D\n(north section)' },
  ]
  let targetIdx = 0

  const targetDot = engine.addEntity()
  Transform.create(targetDot, { position: panelUVtoWorldPos(0, 0), scale: Vector3.create(0.1, 0.1, 0.06) })
  MeshRenderer.setCylinder(targetDot)
  Material.setPbrMaterial(targetDot, {
    albedoColor: Color4.create(1, 0.6, 0, 1),
    emissiveColor: { r: 0.6, g: 0.3, b: 0 }, emissiveIntensity: 1.5
  })

  const targetLbl = engine.addEntity()
  Transform.create(targetLbl, { position: Vector3.create(PANEL_CENTER.x + 0.9, PANEL_CENTER.y, PANEL_CENTER.z - 0.3) })
  Billboard.create(targetLbl, {})
  TextShape.create(targetLbl, { text: '', fontSize: 1.0, textColor: Color4.create(1, 0.7, 0.2, 1) })

  // Rim indicator (shows when target is off-screen)
  const rimIndicator = engine.addEntity()
  Transform.create(rimIndicator, {
    position: Vector3.create(PANEL_CENTER.x, PANEL_CENTER.y, PANEL_CENTER.z - 0.07),
    scale: Vector3.create(0.08, 0.08, 0.04)
  })
  MeshRenderer.setCylinder(rimIndicator)
  Material.setPbrMaterial(rimIndicator, {
    albedoColor: Color4.create(1, 0.6, 0, 0)  // invisible until needed
  })

  // Status text
  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, {
    position: Vector3.create(PANEL_CENTER.x, PANEL_CENTER.y - PANEL_HEIGHT * 0.5 - 0.15, PANEL_CENTER.z - 0.1)
  })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, {
    text: 'Walk around to track your position',
    fontSize: 1.0, textColor: Color4.create(0.7, 0.9, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  // Set initial target
  function setTarget(idx: number): void {
    const t = bookTargets[idx]
    const { u, v } = worldToPanel(t.worldX, t.worldZ)
    const clamped = {
      u: Math.max(-0.48, Math.min(0.48, u)),
      v: Math.max(-0.48, Math.min(0.48, v))
    }
    const isOffPanel = Math.abs(u) > 0.48 || Math.abs(v) > 0.48

    if (!isOffPanel) {
      Transform.getMutable(targetDot).position = panelUVtoWorldPos(u, v)
      Material.setPbrMaterial(targetDot, {
        albedoColor: Color4.create(1, 0.6, 0, 1),
        emissiveColor: { r: 0.6, g: 0.3, b: 0 }, emissiveIntensity: 1.5
      })
      Material.setPbrMaterial(rimIndicator, { albedoColor: Color4.create(1, 0.6, 0, 0) })
    } else {
      // Target off panel — show rim indicator at clamped edge
      Transform.getMutable(targetDot).position = Vector3.create(0, -100, 0) // hide
      Material.setPbrMaterial(rimIndicator, {
        albedoColor: Color4.create(1, 0.4, 0, 1),
        emissiveColor: { r: 0.6, g: 0.2, b: 0 }, emissiveIntensity: 1.5
      })
      Transform.getMutable(rimIndicator).position = panelUVtoWorldPos(clamped.u, clamped.v)
      console.log(`[ML6] Target off-panel — showing rim indicator at u=${clamped.u.toFixed(2)}, v=${clamped.v.toFixed(2)}`)
    }

    TextShape.getMutable(targetLbl).text = `🎯 ${t.label}`
    TextShape.getMutable(statusLbl).text = `Tracking: ${t.label}\nTarget world: ${t.worldX},${t.worldZ}${isOffPanel ? '\n← OFF MAP' : ''}`
  }
  setTarget(0)

  // Cycle target button
  const cycleBtn = createButton(x, 1.0, z + 3.6, '◉ Next Target',
    Color4.create(0.6, 0.3, 0, 1))
  pointerEventsSystem.onPointerDown(
    { entity: cycleBtn, opts: { button: 1, hoverText: '[E] Cycle target' } },
    () => {
      targetIdx = (targetIdx + 1) % bookTargets.length
      setTarget(targetIdx)
      console.log(`[ML6] Target changed to: ${bookTargets[targetIdx].label}`)
    }
  )

  // ─── Real-time player tracking system ─────────────────────────────────────
  engine.addSystem((_dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return

    const { u, v } = worldToPanel(pT.position.x, pT.position.z)
    // Clamp to panel bounds so dot never goes off-panel
    const cu = Math.max(-0.46, Math.min(0.46, u))
    const cv = Math.max(-0.46, Math.min(0.46, v))

    Transform.getMutable(playerDot).position = panelUVtoWorldPos(cu, cv)
    Transform.getMutable(playerLbl).position = panelUVtoWorldPos(cu, cv + 0.04)

    // Update status when player goes outside the mapped zone
    const outOfBounds = Math.abs(u) > 0.5 || Math.abs(v) > 0.5
    // (Don't update text every frame — it's noisy. Just move the dot.)
  }, 30)

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z + 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '🔵 Blue dot = you (real-time)\n🟠 Orange dot = book target\nArrow = target off-panel\n"Map on wall" = thematic + no UI system needed',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.95, 1, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML6] Minimap initialized — panel at X=120 Z=98, tracks Feature Test Zone')
}
