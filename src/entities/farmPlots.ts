/**
 * farmPlots.ts — Farm plot entities and growth management
 *
 * Four plots at Z~138-152:
 *   Plot 1 (62, 0.3, 138), Plot 2 (76, 0.3, 138)
 *   Plot 3 (62, 0.3, 152), Plot 4 (76, 0.3, 152)
 *
 * State machine: empty -> growing (30s) -> ready -> empty (on harvest)
 * ECS system updates state transitions every second and changes plot color.
 * Popup reads live timestamps for real-time progress bar.
 *
 * Plant cost: 1 Wheat Seed
 * Harvest yield: Wheat x3
 */

import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  Billboard,
  TextShape,
  pointerEventsSystem,
  InputAction,
  Entity,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { GameManager } from '../gameMgr'
import { FarmPlotLive } from '../dn-framework/ui/popupManager'

// Plot colors by state
const COLOR_EMPTY   = Color4.create(0.35, 0.22, 0.10, 1)   // dark brown dirt
const COLOR_GROWING = Color4.create(0.22, 0.55, 0.18, 1)   // medium green
const COLOR_READY   = Color4.create(0.58, 0.92, 0.12, 1)   // bright yellow-green

const GROWTH_MS = 30000  // 30 seconds

// Internal plot record
interface FarmPlotRecord {
  id: string
  entity: Entity
  labelEntity: Entity
  live: FarmPlotLive
}

const allPlots: FarmPlotRecord[] = []

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupFarmPlots(gameMgr: GameManager): void {
  const plotPositions = [
    { id: 'plot_1', pos: Vector3.create(62, 0.3, 138) },
    { id: 'plot_2', pos: Vector3.create(76, 0.3, 138) },
    { id: 'plot_3', pos: Vector3.create(62, 0.3, 152) },
    { id: 'plot_4', pos: Vector3.create(76, 0.3, 152) },
  ]

  for (const def of plotPositions) {
    createFarmPlot(gameMgr, def.id, def.pos)
  }

  // ECS system: check for growth completion every ~1 second
  let lastCheckMs = 0
  engine.addSystem(() => {
    const now = Date.now()
    if (now - lastCheckMs < 1000) return
    lastCheckMs = now
    for (const rec of allPlots) {
      if (rec.live.status === 'growing' && rec.live.plantedAt !== null) {
        if (now - rec.live.plantedAt >= rec.live.growthMs) {
          rec.live.status = 'ready'
          Material.setPbrMaterial(rec.entity, { albedoColor: COLOR_READY, roughness: 0.6 })
          updateLabel(rec.labelEntity, rec.live)
          console.log(`[Farm] ${rec.id} is ready to harvest!`)
        }
      }
    }
  })
}

// ─── Create single plot ────────────────────────────────────────────────────────

function createFarmPlot(gameMgr: GameManager, id: string, position: Vector3): void {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position,
    scale: Vector3.create(5.0, 0.5, 5.0),
  })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: COLOR_EMPTY, roughness: 0.95 })

  // Label
  const labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(position.x, position.y + 1.8, position.z),
  })
  TextShape.create(labelEntity, {
    text: 'Empty Plot\n[E] Plant',
    fontSize: 2.2,
    textColor: Color4.White(),
    textWrapping: false,
  })
  Billboard.create(labelEntity)

  // Build the live ref — this object is mutated in-place so popup reads latest state
  const live: FarmPlotLive = {
    plotId: id,
    status: 'empty',
    seedName: '',
    outputItemId: 'wheat',
    outputName: 'Wheat',
    outputQuantity: 3,
    plantedAt: null,
    growthMs: GROWTH_MS,
    availableSeeds: [],  // populated fresh on each popup open
    onPlant: (seedItemId: string, seedName: string) => {
      if (!gameMgr.playerInventory.removeItem(seedItemId, 1)) return
      live.status = 'growing'
      live.seedName = seedName
      live.plantedAt = Date.now()
      Material.setPbrMaterial(entity, { albedoColor: COLOR_GROWING, roughness: 0.8 })
      updateLabel(labelEntity, live)
      gameMgr.popupMgr.showFloat(`${seedName} planted!`, Color4.create(0.5, 0.9, 0.35, 1))
      gameMgr.popupMgr.closePopup()
      console.log(`[Farm] ${id}: planted ${seedName}`)
    },
    onHarvest: () => {
      gameMgr.playerInventory.addItem(live.outputItemId, live.outputName, live.outputQuantity)
      gameMgr.popupMgr.showFloat(`+${live.outputQuantity} ${live.outputName}`, Color4.create(0.58, 0.92, 0.12, 1))
      live.status = 'empty'
      live.seedName = ''
      live.plantedAt = null
      Material.setPbrMaterial(entity, { albedoColor: COLOR_EMPTY, roughness: 0.95 })
      updateLabel(labelEntity, live)
      gameMgr.popupMgr.closePopup()
      console.log(`[Farm] ${id}: harvested ${live.outputName}`)
    },
  }

  // Store record
  allPlots.push({ id, entity, labelEntity, live })

  // Click handler — recomputes availableSeeds fresh each time
  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Farm Plot', maxDistance: 8 } },
    () => {
      if (gameMgr.popupMgr.isPopupOpen()) return

      // Refresh available seeds from current inventory
      live.availableSeeds = [
        { itemId: 'wheat_seeds', name: 'Wheat Seeds', quantity: gameMgr.playerInventory.getCount('wheat_seeds') },
      ].filter(s => s.quantity > 0)

      gameMgr.popupMgr.openFarmPlotPopup(live)
    }
  )
}

/** Update the billboard label text based on current plot state. */
function updateLabel(labelEntity: Entity, live: FarmPlotLive): void {
  const ts = TextShape.getMutableOrNull(labelEntity)
  if (!ts) return
  if (live.status === 'empty') {
    ts.text = 'Empty Plot\n[E] Plant'
  } else if (live.status === 'growing') {
    ts.text = `${live.seedName}\nGrowing...`
  } else {
    ts.text = `${live.outputName}\nReady!`
  }
}
