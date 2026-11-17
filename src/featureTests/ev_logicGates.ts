/**
 * ev_logicGates.ts — EV3: AND Gate + EV4: OR/NOT + EV5: Flip-Flop
 * STATUS: 🟩 FULLY CODED
 *
 * EV3 — AND GATE: All N conditions must be TRUE → fire event.
 *   Classic: 3 pressure plates must all be held simultaneously → door opens.
 *   MonsterLibrary: Player near desk AND has correct book → trigger order completion.
 *
 * EV4 — OR GATE + NOT GATE:
 *   OR: ANY of the conditions → fires event.
 *   NOT: Fires when condition is FALSE (inverse of trigger).
 *   MonsterLibrary NOT use: "ghost NOT seen by player" → ghost can move freely.
 *
 * EV5 — FLIP-FLOP TOGGLE:
 *   Each trigger alternates: OFF → ON → OFF → ON...
 *   Same button/plate drives two alternating effects.
 *   Use for: light switches, alternate path routing, difficulty toggle.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'
import { emit, on } from './ev_eventBus'

// ─── Generic gate helpers ─────────────────────────────────────────────────────

interface AndGate {
  conditions: Map<string, boolean>
  onAllTrue:  () => void
  onAnyFalse?: () => void
}

function andGateSet(gate: AndGate, name: string, value: boolean): void {
  gate.conditions.set(name, value)
  const allTrue = [...gate.conditions.values()].every(v => v)
  if (allTrue) gate.onAllTrue()
  else if (!value && gate.onAnyFalse) gate.onAnyFalse()
}

// ─── Station: EV3 — AND Gate ──────────────────────────────────────────────────

export function setupEVAndGate(): void {
  const { x, z } = { x: 120, z: 58 }
  createStation('ev3_and', 'EV3 — AND GATE\nAll 3 plates → door opens', STATUS_COLOR.FULLY_CODED)

  // Three pressure plates
  const platePositions = [
    Vector3.create(x - 2.5, 0.52, z - 0.5),
    Vector3.create(x,       0.52, z + 1.5),
    Vector3.create(x + 2.5, 0.52, z - 0.5),
  ]
  const plates: ReturnType<typeof engine.addEntity>[] = []
  const gate: AndGate = {
    conditions: new Map([['plate_A', false], ['plate_B', false], ['plate_C', false]]),
    onAllTrue: () => {
      Material.setPbrMaterial(door, { albedoColor: Color4.create(0.3, 1, 0.3, 0.3) })
      TextShape.getMutable(gateLbl).text = '🟢 ALL ON → OPEN!'
      TextShape.getMutable(gateLbl).textColor = Color4.create(0.3, 1, 0.3, 1)
      console.log('[EV3] AND gate satisfied — event fired')
      emit('and_gate_open')
    },
    onAnyFalse: () => {
      Material.setPbrMaterial(door, { albedoColor: Color4.create(0.5, 0.2, 0.1, 1) })
      TextShape.getMutable(gateLbl).text = '🔴 WAITING...'
      TextShape.getMutable(gateLbl).textColor = Color4.create(1, 0.5, 0.3, 1)
    }
  }
  const plateKeys = ['plate_A', 'plate_B', 'plate_C']

  for (let i = 0; i < 3; i++) {
    const pp = platePositions[i]; const pk = plateKeys[i]
    const plate = engine.addEntity()
    Transform.create(plate, { position: pp, scale: Vector3.create(1.6, 0.1, 1.6) })
    MeshRenderer.setBox(plate)
    MeshCollider.setBox(plate, ColliderLayer.CL_PHYSICS)
    Material.setPbrMaterial(plate, { albedoColor: Color4.create(0.6, 0.3, 0.3, 1) })
    plates.push(plate)

    const plateLbl = engine.addEntity()
    Transform.create(plateLbl, { position: Vector3.create(pp.x, pp.y + 0.3, pp.z) }); Billboard.create(plateLbl, {})
    TextShape.create(plateLbl, { text: ['A', 'B', 'C'][i], fontSize: 1.4, textColor: Color4.White() })

    const trigger = engine.addEntity()
    Transform.create(trigger, { position: Vector3.create(pp.x, pp.y + 0.5, pp.z), scale: Vector3.create(1.6, 1.0, 1.6) })
    TriggerArea.setBox(trigger)

    const pi = i; const pkk = pk
    triggerAreaEventsSystem.onTriggerEnter(trigger, (r) => {
      if (r.trigger?.entity !== engine.PlayerEntity) return
      Material.setPbrMaterial(plates[pi], { albedoColor: Color4.create(0.2, 0.9, 0.3, 1), emissiveColor: { r: 0, g: 0.4, b: 0 }, emissiveIntensity: 0.5 })
      andGateSet(gate, pkk, true)
    })
    triggerAreaEventsSystem.onTriggerExit(trigger, (r) => {
      if (r.trigger?.entity !== engine.PlayerEntity) return
      Material.setPbrMaterial(plates[pi], { albedoColor: Color4.create(0.6, 0.3, 0.3, 1) })
      andGateSet(gate, pkk, false)
    })
  }

  // "Door" entity that opens when AND gate fires
  const door = engine.addEntity()
  Transform.create(door, { position: Vector3.create(x, 1.2, z - 2.5), scale: Vector3.create(2.0, 2.4, 0.3) })
  MeshRenderer.setBox(door)
  MeshCollider.setBox(door, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(door, { albedoColor: Color4.create(0.5, 0.2, 0.1, 1) })

  const gateLbl = engine.addEntity()
  Transform.create(gateLbl, { position: Vector3.create(x, 3.2, z - 2.5) }); Billboard.create(gateLbl, {})
  TextShape.create(gateLbl, { text: '🔴 WAITING...', fontSize: 1.3, textColor: Color4.create(1, 0.5, 0.3, 1) })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'andGateSet(gate, name, bool)\nAll conditions.values().every(v => v)\nStand on ALL 3 plates simultaneously',
    fontSize: 1.1, textColor: Color4.create(0.6, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV3] AND gate initialized — 3 plates must all be active')
}

// ─── Station: EV4 — OR + NOT Gates ───────────────────────────────────────────

export function setupEVOrNot(): void {
  const { x, z } = { x: 132, z: 58 }
  createStation('ev4_orNot', 'EV4 — OR + NOT GATES\nAny-of / inverse conditions', STATUS_COLOR.FULLY_CODED)

  const resultLbl = engine.addEntity()
  Transform.create(resultLbl, { position: Vector3.create(x, 2.8, z) }); Billboard.create(resultLbl, {})
  TextShape.create(resultLbl, { text: 'No events yet', fontSize: 1.3, textColor: Color4.White() })

  // OR gate: any of 3 buttons fires the target
  const orInputs = new Set<string>()
  const orButtons = ['X', 'Y', 'Z']
  for (let i = 0; i < 3; i++) {
    const btn = createButton(x - 2.0 + i * 2.0, 0.8, z - 2.5, `OR: ${orButtons[i]}`, Color4.create(0.3, 0.3, 0.6, 1))
    const name = orButtons[i]
    pointerEventsSystem.onPointerDown({ entity: btn, opts: { button: 1, hoverText: `[E] Set ${name}` } }, () => {
      orInputs.add(name)
      // OR gate: any input → fire
      TextShape.getMutable(resultLbl).text = `OR GATE: ${name} pressed → FIRED!`
      TextShape.getMutable(resultLbl).textColor = Color4.create(0.3, 0.9, 0.5, 1)
      emit('or_gate_fired', { source: name })
      console.log(`[EV4] OR gate fired by ${name}`)
    // @ts-ignore — removeSystem(void) TypeScript warning; SDK 7.33 returns void from addSystem
      let t = 1.5; const sys = engine.addSystem((dt: number) => { t -= dt; if (t <= 0) { engine.removeSystem(sys); TextShape.getMutable(resultLbl).text = 'Waiting...'; TextShape.getMutable(resultLbl).textColor = Color4.White() } }, 5)
    })
  }

  // NOT gate: a toggle condition. When OFF, NOT fires. When ON, NOT suppresses.
  let notCondition = false  // the base condition
  const notIndicator = engine.addEntity()
  Transform.create(notIndicator, { position: Vector3.create(x + 1.5, 1.2, z + 2.0), scale: Vector3.create(1.0, 1.0, 1.0) })
  MeshRenderer.setCylinder(notIndicator)
  Material.setPbrMaterial(notIndicator, { albedoColor: Color4.create(0.9, 0.2, 0.2, 1), emissiveColor: { r: 0.5, g: 0, b: 0 }, emissiveIntensity: 1 })

  const notLbl = engine.addEntity()
  Transform.create(notLbl, { position: Vector3.create(x + 1.5, 2.3, z + 2.0) }); Billboard.create(notLbl, {})
  TextShape.create(notLbl, { text: 'Condition: OFF\n→ NOT fires', fontSize: 1.0, textColor: Color4.create(1, 0.5, 0.5, 1) })

  const notToggleBtn = createButton(x + 1.5, 0.8, z - 2.5, 'Toggle NOT', Color4.create(0.6, 0.2, 0.5, 1))
  pointerEventsSystem.onPointerDown({ entity: notToggleBtn, opts: { button: 1, hoverText: '[E] Toggle condition' } }, () => {
    notCondition = !notCondition
    Material.setPbrMaterial(notIndicator, {
      albedoColor: notCondition ? Color4.create(0.2, 0.9, 0.3, 1) : Color4.create(0.9, 0.2, 0.2, 1),
      emissiveColor: notCondition ? { r: 0, g: 0.4, b: 0 } : { r: 0.5, g: 0, b: 0 }, emissiveIntensity: 1
    })
    TextShape.getMutable(notLbl).text = notCondition ? 'Condition: ON\n→ NOT blocked' : 'Condition: OFF\n→ NOT fires'
    TextShape.getMutable(notLbl).textColor = notCondition ? Color4.create(0.3, 1, 0.5, 1) : Color4.create(1, 0.5, 0.5, 1)
    // NOT gate: fires when condition is FALSE
    if (!notCondition) { emit('not_gate_fired'); console.log('[EV4] NOT gate fired (condition=false)') }
    console.log(`[EV4] Condition toggled: ${notCondition}`)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'OR: any input → fire (3 buttons demo)\nNOT: fires when condition is FALSE\nML: ghost NOT seen → can throw freely',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV4] OR+NOT gates initialized')
}

// ─── Station: EV5 — Flip-Flop Toggle ──────────────────────────────────────────

export function setupEVFlipFlop(): void {
  const { x, z } = { x: 144, z: 58 }
  createStation('ev5_flipflop', 'EV5 — FLIP-FLOP\nSame trigger → alternates states', STATUS_COLOR.FULLY_CODED)

  let flipState = false  // false = A, true = B

  // Two "effect" entities that alternate
  const sideA = engine.addEntity()
  Transform.create(sideA, { position: Vector3.create(x - 2.0, 1.5, z - 1.0), scale: Vector3.create(2.5, 2.5, 0.5) })
  MeshRenderer.setBox(sideA)
  Material.setPbrMaterial(sideA, { albedoColor: Color4.create(0.3, 0.6, 1, 1), emissiveColor: { r: 0.1, g: 0.2, b: 0.6 }, emissiveIntensity: 0.8 })

  const sideB = engine.addEntity()
  Transform.create(sideB, { position: Vector3.create(x + 2.0, 1.5, z - 1.0), scale: Vector3.create(2.5, 2.5, 0.5) })
  MeshRenderer.setBox(sideB)
  Material.setPbrMaterial(sideB, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) }) // starts dim

  const stateDisplay = engine.addEntity()
  Transform.create(stateDisplay, { position: Vector3.create(x, 2.5, z) }); Billboard.create(stateDisplay, {})
  TextShape.create(stateDisplay, { text: '◀ PATH A ◀', fontSize: 1.5, textColor: Color4.create(0.3, 0.6, 1, 1) })

  const countDisplay = engine.addEntity()
  Transform.create(countDisplay, { position: Vector3.create(x, 1.0, z) }); Billboard.create(countDisplay, {})
  TextShape.create(countDisplay, { text: 'Flips: 0', fontSize: 1.1, textColor: Color4.White() })

  let flipCount = 0

  function doFlip(): void {
    flipState = !flipState; flipCount++
    TextShape.getMutable(countDisplay).text = `Flips: ${flipCount}`

    if (!flipState) {
      // State A: left side active
      Material.setPbrMaterial(sideA, { albedoColor: Color4.create(0.3, 0.6, 1, 1), emissiveColor: { r: 0.1, g: 0.2, b: 0.6 }, emissiveIntensity: 0.8 })
      Material.setPbrMaterial(sideB, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
      TextShape.getMutable(stateDisplay).text = '◀ PATH A ◀'
      TextShape.getMutable(stateDisplay).textColor = Color4.create(0.3, 0.6, 1, 1)
    } else {
      // State B: right side active
      Material.setPbrMaterial(sideB, { albedoColor: Color4.create(1, 0.5, 0.2, 1), emissiveColor: { r: 0.5, g: 0.2, b: 0 }, emissiveIntensity: 0.8 })
      Material.setPbrMaterial(sideA, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
      TextShape.getMutable(stateDisplay).text = '▶ PATH B ▶'
      TextShape.getMutable(stateDisplay).textColor = Color4.create(1, 0.5, 0.2, 1)
    }
    emit(`flipflop_${flipState ? 'B' : 'A'}`)
    console.log(`[EV5] Flip-flop → State ${flipState ? 'B' : 'A'} (flip #${flipCount})`)
  }

  // Single flip button — same button, two effects
  const flipBtn = createButton(x, 0.8, z - 3.6, '⟳ FLIP', Color4.create(0.5, 0.4, 0.5, 1))
  pointerEventsSystem.onPointerDown({ entity: flipBtn, opts: { button: 1, hoverText: '[E] Flip state' } }, doFlip)

  // Also flip on emit from event bus
  on('flip_trigger', doFlip)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.5, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'state = !state each trigger\nSame button/plate, two alternating effects\nUse for: light switch, alternate paths',
    fontSize: 1.1, textColor: Color4.create(1, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[EV5] FlipFlop initialized — alternates A/B on each press')
}
