/**
 * farmPlots.ts — Farm plot entities and growth management
 *
 * Four plots at Z~138-152:
 *   Plot 1 (62, 0.3, 138), Plot 2 (76, 0.3, 138)
 *   Plot 3 (62, 0.3, 152), Plot 4 (76, 0.3, 152)
 *
 * Two-entity pattern (SDK7 best practice for clickable GLBs):
 *   interaction entity — invisible MeshCollider box (NO MeshRenderer).
 *                        Drives pointerEventsSystem. Never changes.
 *   visual entity      — GltfContainer only, collision disabled.
 *                        Swaps src between growth GLBs freely without
 *                        affecting click detection.
 *
 * GLB models (assets/farm/):
 *   fa_unplantedA.glb        — empty/ready-to-plant
 *   fa_plantedA_{0-100}.glb  — 11 growth stages in 10% increments
 *   fa_unpreparedA.glb       — needs hoe (skipped for now)
 *   fa_highlightA.glb        — hover highlight (future build)
 *
 * State machine: empty -> growing (30s) -> ready -> empty (on harvest)
 * ECS system (1s tick): drives state transition + swaps GLB every 10% progress.
 * Popup reads live FarmPlotLive timestamps for real-time progress bar.
 *
 * Plant cost: 1 Wheat Seed  |  Harvest yield: Wheat x3
 */

import {
  engine,
  Transform,
  MeshCollider,
  Billboard,
  TextShape,
  GltfContainer,
  ColliderLayer,
  pointerEventsSystem,
  InputAction,
  Entity,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { FarmPlotLive } from '../dn-framework/ui/popupManager'

// Asset paths
const FARM_ASSETS = 'assets/farm'
const GLB_EMPTY   = `${FARM_ASSETS}/fa_unplantedA.glb`

function growthGlb(pct: number): string {
  // Clamp to 0-100, round to nearest 10
  const step = Math.min(100, Math.max(0, Math.round(pct / 10) * 10))
  return `${FARM_ASSETS}/fa_plantedA_${step}.glb`
}

const GROWTH_MS = 30000  // 30 seconds

// Internal plot record
interface FarmPlotRecord {
  id: string
  interactEntity: Entity   // invisible collider — never changes
  visualEntity: Entity     // GltfContainer — swaps freely
  labelEntity: Entity
  lastGlbPct: number       // track last rendered growth % to avoid redundant swaps
  live: FarmPlotLive
}

const allPlots: FarmPlotRecord[] = []

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupFarmPlots(gameMgr: GameManager): void {
  const plotPositions = [
    { id: 'plot_1', pos: Vector3.create(62, 0, 138) },
    { id: 'plot_2', pos: Vector3.create(76, 0, 138) },
    { id: 'plot_3', pos: Vector3.create(62, 0, 152) },
    { id: 'plot_4', pos: Vector3.create(76, 0, 152) },
  ]

  for (const def of plotPositions) {
    createFarmPlot(gameMgr, def.id, def.pos)
  }

  // ECS system — runs every ~1 second:
  //   • advances growing → ready state transitions
  //   • swaps visual GLB every 10% progress increment
  let lastCheckMs = 0
  engine.addSystem(() => {
    const now = Date.now()
    if (now - lastCheckMs < 1000) return
    lastCheckMs = now

    for (const rec of allPlots) {
      if (rec.live.status !== 'growing' || rec.live.plantedAt === null) continue

      const elapsed = now - rec.live.plantedAt
      const pct = Math.min(100, Math.round((elapsed / rec.live.growthMs) * 100))
      const glbStep = Math.min(100, Math.floor(pct / 10) * 10)

      // Swap GLB only when the 10% step changes
      if (glbStep !== rec.lastGlbPct) {
        rec.lastGlbPct = glbStep
        GltfContainer.getMutable(rec.visualEntity).src = growthGlb(glbStep)
      }

      // State transition: growing → ready
      if (pct >= 100 && rec.live.status === 'growing') {
        rec.live.status = 'ready'
        updateLabel(rec.labelEntity, rec.live)
        console.log(`[Farm] ${rec.id} is ready to harvest!`)
      }
    }
  })
}

// ─── Create single plot ────────────────────────────────────────────────────────

function createFarmPlot(gameMgr: GameManager, id: string, position: Vector3): void {

  // ── Interaction entity (invisible collider only) ──────────────────────────
  // Flat box slightly above ground — never changes, drives all pointer events.
  const interactEntity = engine.addEntity()
  Transform.create(interactEntity, {
    position: Vector3.create(position.x, 0.25, position.z),
    scale: Vector3.create(4.8, 0.5, 4.8),
  })
  MeshCollider.setBox(interactEntity)   // click target — no MeshRenderer = invisible

  // ── Visual entity (GltfContainer, no collision) ───────────────────────────
  // Placed at ground level. Swap src freely — no effect on interaction.
  const visualEntity = engine.addEntity()
  Transform.create(visualEntity, {
    position: Vector3.create(position.x, 0, position.z),
    scale: Vector3.One(),
  })
  GltfContainer.create(visualEntity, {
    src: GLB_EMPTY,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    visibleMeshesCollisionMask:   ColliderLayer.CL_NONE,
  })

  // ── Billboard label ────────────────────────────────────────────────────────
  const labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(position.x, 2.4, position.z),
  })
  TextShape.create(labelEntity, {
    text: 'Empty Plot\n[E] Plant',
    fontSize: 2.2,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(labelEntity)

  // ── Live ref — mutated in-place, popup reads latest state each frame ───────
  const live: FarmPlotLive = {
    plotId: id,
    status: 'empty',
    seedName: '',
    outputItemId: 'wheat',
    outputName: 'Wheat',
    outputQuantity: 3,
    plantedAt: null,
    growthMs: GROWTH_MS,
    availableSeeds: [],

    onPlant: (seedItemId: string, seedName: string) => {
      if (!gameMgr.playerInventory.removeItem(seedItemId, 1)) return
      live.status = 'growing'
      live.seedName = seedName
      live.plantedAt = Date.now()

      // Start at growth_0 immediately
      const rec = allPlots.find(r => r.id === id)
      if (rec) {
        rec.lastGlbPct = 0
        GltfContainer.getMutable(visualEntity).src = growthGlb(0)
      }

      updateLabel(labelEntity, live)
      gameMgr.popupMgr.showFloat(`${seedName} planted!`, Color4.create(0.5, 0.9, 0.35, 1))
      gameMgr.popupMgr.closePopup()
      console.log(`[Farm] ${id}: planted ${seedName}`)
    },

    onHarvest: () => {
      gameMgr.playerInventory.addItem(live.outputItemId, live.outputName, live.outputQuantity)
      gameMgr.popupMgr.showFloat(
        `+${live.outputQuantity} ${live.outputName}`,
        Color4.create(0.58, 0.92, 0.12, 1)
      )

      live.status = 'empty'
      live.seedName = ''
      live.plantedAt = null

      // Back to empty GLB
      const rec = allPlots.find(r => r.id === id)
      if (rec) {
        rec.lastGlbPct = -1
        GltfContainer.getMutable(visualEntity).src = GLB_EMPTY
      }

      updateLabel(labelEntity, live)
      gameMgr.popupMgr.closePopup()
      console.log(`[Farm] ${id}: harvested ${live.outputName}`)
    },
  }

  // ── Store record ──────────────────────────────────────────────────────────
  allPlots.push({ id, interactEntity, visualEntity, labelEntity, lastGlbPct: -1, live })

  // ── Click handler (on invisible interactEntity) ───────────────────────────
  pointerEventsSystem.onPointerDown(
    {
      entity: interactEntity,
      opts: { button: InputAction.IA_PRIMARY, hoverText: 'Farm Plot', maxDistance: 8 }
    },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return

      // Refresh available seeds fresh from inventory at open time
      live.availableSeeds = [
        {
          itemId: 'wheat_seeds',
          name: 'Wheat Seeds',
          quantity: gameMgr.playerInventory.getCount('wheat_seeds'),
        },
      ].filter(s => s.quantity > 0)

      gameMgr.popupMgr.openFarmPlotPopup(live)
    }
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateLabel(labelEntity: Entity, live: FarmPlotLive): void {
  const ts = TextShape.getMutableOrNull(labelEntity)
  if (!ts) return
  if (live.status === 'empty') {
    ts.text = 'Empty Plot\n[E] Plant'
  } else if (live.status === 'growing') {
    ts.text = `${live.seedName}\nGrowing...`
  } else {
    ts.text = `${live.outputName}\nReady! [E]`
  }
}
