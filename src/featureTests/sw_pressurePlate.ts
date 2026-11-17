/**
 * sw_pressurePlate.ts — SW1: Pressure Plate + SW2: Toggle Lever
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES
 * ────────────────
 * SW1 — Pressure Plate: step on to activate linked object(s).
 *   Two modes:
 *   - 'momentary': active while player stands on it; deactivates when player leaves
 *   - 'latch': activates once and stays active until reset
 *
 * SW2 — Toggle Lever: click to flip between two states; drives linked entities.
 *   Same driver as a pressure plate but click-triggered, not proximity.
 *
 * FRAMEWORK NOTE — Interaction Driver Pattern
 * ────────────────────────────────────────────
 * Both SW1 and SW2 follow the same driver/listener pattern:
 *
 *   Driver (plate or lever) → fires onActivate() / onDeactivate() callbacks
 *   Listener (door, platform, light) → reacts to those callbacks
 *
 * This decouples the trigger from the effect. One plate can drive N listeners.
 * One listener can receive signals from N drivers (OR logic: any one activates).
 *
 * Extract to sw_driver.ts when confirmed across 3+ uses:
 *   registerDriver(entity, config, callbacks)
 *   registerListener(entity, { onActivate, onDeactivate })
 *   linkDriverToListener(driverId, listenerId)
 *
 * USE IN MONSTERLIB:
 *   Pressure plate at the desk → starts customer queue timer
 *   Lever in stacks → unlocks a bookcase section
 *   Plate near bookshelf → triggers a shelf ghost (ML2)
 *
 * DEMO (run and verify):
 *   SW1 — Pressure Plate:
 *     [ ] Walk onto grey pressure plate → it compresses (scale.y drops)
 *     [ ] Small platform 2m away rises while plate is held
 *     [ ] Walk off → platform lowers (momentary mode)
 *     [ ] Press 'Latch Mode' button → plate stays active after stepping off
 *     [ ] Press 'Reset' button → resets to unactivated
 *   SW2 — Toggle Lever:
 *     [ ] Click lever → handle rotates 70°, platform appears
 *     [ ] Click again → handle flips back, platform lowers
 *     [ ] Console logs SW1/SW2 state changes
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Shared driver/listener pattern ──────────────────────────────────────────

type DriverMode = 'momentary' | 'latch'

interface DriverEntry {
  mode:        DriverMode
  activated:   boolean
  onActivate:  () => void
  onDeactivate: () => void
}

/** Create a simple linked platform that rises/falls as a demo listener. */
function createLinkedPlatform(
  x: number, y: number, z: number,
  raisedY: number, loweredY: number,
  color: Color4
): {
  entity: ReturnType<typeof engine.addEntity>
  activate: () => void
  deactivate: () => void
} {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(x, loweredY, z),
    scale: Vector3.create(2.0, 0.3, 2.0)
  })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(entity, { albedoColor: color })

  let currentY = loweredY
  let targetY  = loweredY
  let moving   = false

  engine.addSystem((dt: number) => {
    if (!moving) return
    const diff = targetY - currentY
    if (Math.abs(diff) < 0.05) {
      currentY = targetY
      moving = false
      Transform.getMutable(entity).position = Vector3.create(x, currentY, z)
      return
    }
    currentY += Math.sign(diff) * Math.min(Math.abs(diff), 2.0 * dt)
    Transform.getMutable(entity).position = Vector3.create(x, currentY, z)
  }, 5)

  return {
    entity,
    activate:   () => { targetY = raisedY; moving = true },
    deactivate: () => { targetY = loweredY; moving = true }
  }
}

// ─── Station: SW1 — Pressure Plate ───────────────────────────────────────────

export function setupSWPressurePlate(): void {
  const { x, z } = { x: 16, z: 22 }
  createStation('sw1_plate', 'SW1 — PRESSURE PLATE\nMomentary + Latch modes', STATUS_COLOR.FULLY_CODED)

  // Linked platform (the demo "effect")
  const linkedPlatform = createLinkedPlatform(x + 3.0, 0.52, z, 2.0, 0.52, Color4.create(0.3, 0.9, 0.5, 1))

  const lbl = engine.addEntity()
  Transform.create(lbl, { position: Vector3.create(x + 3.0, 2.8, z) })
  Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '← activated\n   by plate', fontSize: 1.1, textColor: Color4.create(0.5, 1, 0.5, 1) })

  // Pressure plate entity (slightly recessed)
  const plate = engine.addEntity()
  Transform.create(plate, {
    position: Vector3.create(x - 1.0, 0.56, z),
    scale: Vector3.create(1.6, 0.14, 1.6)
  })
  MeshRenderer.setBox(plate)
  MeshCollider.setBox(plate, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(plate, { albedoColor: Color4.create(0.6, 0.6, 0.6, 1) })

  // Plate label
  const plateLbl = engine.addEntity()
  Transform.create(plateLbl, { position: Vector3.create(x - 1.0, 0.75, z - 1.1) })
  Billboard.create(plateLbl, {})
  TextShape.create(plateLbl, { text: '⬇ PLATE', fontSize: 1.0, textColor: Color4.White() })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x - 1.0, 2.2, z) })
  Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '○ IDLE', fontSize: 1.3, textColor: Color4.create(0.6, 0.6, 0.6, 1) })

  // Driver state
  const driver: DriverEntry = {
    mode: 'momentary', activated: false,
    onActivate: () => {
      Material.setPbrMaterial(plate, { albedoColor: Color4.create(0.2, 0.9, 0.3, 1) })
      Transform.getMutable(plate).scale = Vector3.create(1.6, 0.06, 1.6)
      TextShape.getMutable(statusLbl).text = '● ACTIVE'
      TextShape.getMutable(statusLbl).textColor = Color4.create(0.2, 1, 0.3, 1)
      linkedPlatform.activate()
      console.log('[SW1] ACTIVATED')
    },
    onDeactivate: () => {
      if (driver.mode === 'latch') return  // latch: don't deactivate on exit
      Material.setPbrMaterial(plate, { albedoColor: Color4.create(0.6, 0.6, 0.6, 1) })
      Transform.getMutable(plate).scale = Vector3.create(1.6, 0.14, 1.6)
      TextShape.getMutable(statusLbl).text = '○ IDLE'
      TextShape.getMutable(statusLbl).textColor = Color4.create(0.6, 0.6, 0.6, 1)
      linkedPlatform.deactivate()
      driver.activated = false
      console.log('[SW1] DEACTIVATED')
    }
  }

  // Trigger area on the plate
  const trigger = engine.addEntity()
  Transform.create(trigger, {
    position: Vector3.create(x - 1.0, 0.8, z),
    scale: Vector3.create(1.6, 0.6, 1.6)
  })
  TriggerArea.setBox(trigger)
  triggerAreaEventsSystem.onTriggerEnter(trigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    if (!driver.activated) { driver.activated = true; driver.onActivate() }
  })
  triggerAreaEventsSystem.onTriggerExit(trigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    driver.onDeactivate()
  })

  // Mode toggle button
  const modeBtn = createButton(x - 2.5, 0.8, z - 3.0, '◉ Latch Mode', Color4.create(0.3, 0.3, 0.7, 1))
  pointerEventsSystem.onPointerDown({ entity: modeBtn, opts: { button: 1, hoverText: '[E] Toggle mode' } }, () => {
    driver.mode = driver.mode === 'momentary' ? 'latch' : 'momentary'
    console.log(`[SW1] Mode: ${driver.mode.toUpperCase()}`)
  })

  // Reset button
  const resetBtn = createButton(x + 0.5, 0.8, z - 3.0, '↺ Reset', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset' } }, () => {
    driver.activated = false; driver.mode = 'momentary'
    Material.setPbrMaterial(plate, { albedoColor: Color4.create(0.6, 0.6, 0.6, 1) })
    Transform.getMutable(plate).scale = Vector3.create(1.6, 0.14, 1.6)
    TextShape.getMutable(statusLbl).text = '○ IDLE'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.6, 0.6, 0.6, 1)
    linkedPlatform.deactivate()
    console.log('[SW1] RESET')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Driver → callback → Listener\nOne plate can drive N effects\nMomentary: on while stepped\nLatch: stays on until reset',
    fontSize: 1.1, textColor: Color4.create(0.7, 1, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[SW1] PressurePlate initialized — momentary, linked platform demo')
}

// ─── Station: SW2 — Toggle Lever ─────────────────────────────────────────────

export function setupSWToggleLever(): void {
  const { x, z } = { x: 28, z: 22 }
  createStation('sw2_lever', 'SW2 — TOGGLE LEVER\nClick to flip state', STATUS_COLOR.FULLY_CODED)

  // Linked platform (effect of lever)
  const linkedPlatform = createLinkedPlatform(x + 3.0, 0.52, z, 2.0, 0.52, Color4.create(0.9, 0.7, 0.2, 1))

  const lbl = engine.addEntity()
  Transform.create(lbl, { position: Vector3.create(x + 3.0, 2.8, z) })
  Billboard.create(lbl, {})
  TextShape.create(lbl, { text: '← lever-\n   linked', fontSize: 1.1, textColor: Color4.create(1, 0.8, 0.3, 1) })

  // Lever base (vertical post)
  const leverBase = engine.addEntity()
  Transform.create(leverBase, {
    position: Vector3.create(x - 1.0, 1.1, z),
    scale: Vector3.create(0.2, 1.0, 0.2)
  })
  MeshRenderer.setBox(leverBase)
  MeshCollider.setBox(leverBase, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(leverBase, { albedoColor: Color4.create(0.5, 0.4, 0.3, 1) })

  // Lever handle (rotates)
  const leverHandle = engine.addEntity()
  Transform.create(leverHandle, {
    position: Vector3.create(x - 1.0, 1.7, z),
    scale: Vector3.create(0.12, 0.6, 0.12),
    rotation: Quaternion.fromEulerDegrees(-35, 0, 0)  // tilted forward = OFF
  })
  MeshRenderer.setBox(leverHandle)
  Material.setPbrMaterial(leverHandle, {
    albedoColor: Color4.create(0.9, 0.3, 0.1, 1),
    emissiveColor: { r: 0.3, g: 0.05, b: 0 }, emissiveIntensity: 0.4
  })

  // Status indicator (glowing ball at top of lever)
  const indicator = engine.addEntity()
  Transform.create(indicator, {
    position: Vector3.create(x - 1.0, 2.1, z),
    scale: Vector3.create(0.22, 0.22, 0.22)
  })
  MeshRenderer.setCylinder(indicator)
  Material.setPbrMaterial(indicator, { albedoColor: Color4.create(0.9, 0.2, 0.1, 1), emissiveColor: { r: 0.5, g: 0, b: 0 }, emissiveIntensity: 1 })

  const stateLbl = engine.addEntity()
  Transform.create(stateLbl, { position: Vector3.create(x - 1.0, 2.6, z) })
  Billboard.create(stateLbl, {})
  TextShape.create(stateLbl, { text: 'OFF', fontSize: 1.4, textColor: Color4.create(0.9, 0.3, 0.1, 1) })

  let leverOn = false

  pointerEventsSystem.onPointerDown({ entity: leverBase, opts: { button: 1, hoverText: '[E] Pull lever', maxDistance: 4 } }, () => {
    leverOn = !leverOn
    // Rotate handle
    Transform.getMutable(leverHandle).rotation = Quaternion.fromEulerDegrees(leverOn ? 35 : -35, 0, 0)
    // Update visuals
    if (leverOn) {
      Material.setPbrMaterial(indicator, { albedoColor: Color4.create(0.2, 0.9, 0.3, 1), emissiveColor: { r: 0, g: 0.6, b: 0 }, emissiveIntensity: 1.5 })
      TextShape.getMutable(stateLbl).text = 'ON'
      TextShape.getMutable(stateLbl).textColor = Color4.create(0.2, 1, 0.3, 1)
      linkedPlatform.activate()
    } else {
      Material.setPbrMaterial(indicator, { albedoColor: Color4.create(0.9, 0.2, 0.1, 1), emissiveColor: { r: 0.5, g: 0, b: 0 }, emissiveIntensity: 1 })
      TextShape.getMutable(stateLbl).text = 'OFF'
      TextShape.getMutable(stateLbl).textColor = Color4.create(0.9, 0.3, 0.1, 1)
      linkedPlatform.deactivate()
    }
    console.log(`[SW2] Lever toggled: ${leverOn ? 'ON' : 'OFF'}`)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.8, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Click lever → flip state → drive effect\nSame driver callbacks as plate (SW1)\nOne lever can drive N listeners',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[SW2] ToggleLever initialized')
}
