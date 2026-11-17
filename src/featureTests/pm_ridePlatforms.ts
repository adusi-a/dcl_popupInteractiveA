/**
 * pm_ridePlatforms.ts — PM1: Ping-Pong Platform + PM2: Elevator
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * WHAT THIS PROVES — THE KEY DCL PLATFORM RIDE PATTERN
 * ──────────────────────────────────────────────────────
 * In DCL, the player does NOT automatically parent to a moving entity.
 * When a platform moves, the player stays at their previous position.
 *
 * The fix: each frame the platform moves, calculate the DELTA (change in
 * position) and call movePlayerTo(playerCurrentPos + delta) for any player
 * standing on the platform.
 *
 *   delta = newPlatformPos - lastPlatformPos
 *   if (playerOnPlatform) {
 *     movePlayerTo({ newRelativePosition: playerPos + delta })
 *   }
 *
 * This creates the illusion of the player riding the platform.
 * The trigger area that detects "player on platform" must also move with
 * the platform each frame (update its Transform in the same system).
 *
 * LIMITATIONS (documented here for framework reference):
 *   - movePlayerTo() interrupts player jump physics. While riding, jumping
 *     works but the ride update may slightly fight the arc.
 *   - Very fast platforms (>10 m/s) may feel stuttery; test at target speed.
 *   - If two overlapping platforms both try to move the player, the last
 *     one wins. Solution: a PlatformManager that only applies one delta.
 *
 * PM1 — PING-PONG PLATFORM (horizontal):
 *   Platform slides left/right on a track. Player stands on top and rides.
 *   Configurables: speed (m/s), range (metres half-amplitude), axis (X or Z)
 *   Uses: MonsterLibrary cross-aisle walkway, any moving walkway
 *
 * PM2 — ELEVATOR PLATFORM (vertical):
 *   Platform rises and falls between floor heights. Player rides vertically.
 *   Configurables: floors[] (Y heights), speed, waitTime (how long at each floor)
 *   Uses: MonsterLibrary library floors, OreMonger mine shaft, GhostTown tower
 *
 * DEMO (run and verify):
 *   PM1 — Ping-Pong:
 *     [ ] Grey platform slides 4m left and right continuously
 *     [ ] Jump on and ride — player moves with the platform
 *     [ ] Jump off mid-ride — platform continues without player
 *     [ ] Speed 1x / 2x / 0.5x buttons work
 *   PM2 — Elevator:
 *     [ ] Platform starts at floor level (Y=0.6)
 *     [ ] After 3s: platform rises to floor 2 (Y=4.0) over ~2.5s
 *     [ ] Player riding → arrives on floor 2
 *     [ ] After 2s wait: descends back down
 *     [ ] Press 'Call' button → immediately starts moving toward nearest floor
 *   Both:
 *     [ ] Console logs PM1/PM2 platform state + player on/off
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Shared ride state ────────────────────────────────────────────────────────

interface RidePlatformState {
  entity:          ReturnType<typeof engine.addEntity>
  triggerEntity:   ReturnType<typeof engine.addEntity>
  currentPos:      Vector3
  lastPos:         Vector3
  playerOn:        boolean
}

function setupPlatformTrigger(
  state: RidePlatformState,
  triggerSize: Vector3,
  triggerYOffset: number
): void {
  TriggerArea.create(state.triggerEntity, {
    triggers: [{ type: 1, position: Vector3.create(0, 0, 0), scale: Vector3.create(triggerSize.x, triggerSize.y, triggerSize.z) }]
  })
  triggerAreaEventsSystem.onTriggerEnter(state.triggerEntity, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    state.playerOn = true
    console.log('[PM] Player ON platform')
  })
  triggerAreaEventsSystem.onTriggerExit(state.triggerEntity, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    state.playerOn = false
    console.log('[PM] Player OFF platform')
  })
}

/** Call after moving state.currentPos — applies delta to player + moves trigger. */
function applyPlatformRide(state: RidePlatformState, triggerYOffset: number): void {
  const dx = state.currentPos.x - state.lastPos.x
  const dy = state.currentPos.y - state.lastPos.y
  const dz = state.currentPos.z - state.lastPos.z

  // Move platform entity
  Transform.getMutable(state.entity).position = Vector3.create(state.currentPos.x, state.currentPos.y, state.currentPos.z)
  // Move trigger to follow platform
  Transform.getMutable(state.triggerEntity).position = Vector3.create(state.currentPos.x, state.currentPos.y + triggerYOffset, state.currentPos.z)

  // Move player with platform
  if (state.playerOn && (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) > 0.0001) {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (pT) {
      movePlayerTo({
        newRelativePosition: Vector3.create(
          pT.position.x + dx,
          pT.position.y + dy,
          pT.position.z + dz
        )
      })
    }
  }

  state.lastPos.x = state.currentPos.x
  state.lastPos.y = state.currentPos.y
  state.lastPos.z = state.currentPos.z
}

// ─── Station: PM1 — Ping-Pong Platform ───────────────────────────────────────

export function setupPMPingPong(): void {
  const { x, z } = { x: 16, z: 66 }
  createStation('pm1_pingpong', 'PM1 — PING-PONG\nPlayer rides horizontal', STATUS_COLOR.FULLY_CODED)

  const TRACK_HALF = 3.0  // platform travels ±3m = 6m total
  const PLAT_SIZE  = Vector3.create(2.0, 0.3, 2.0)
  let platformSpeed = 2.0

  // Track visual
  const track = engine.addEntity()
  Transform.create(track, {
    position: Vector3.create(x, 0.52, z),
    scale: Vector3.create(TRACK_HALF * 2 + PLAT_SIZE.x, 0.06, PLAT_SIZE.z + 0.4)
  })
  MeshRenderer.setBox(track)
  Material.setPbrMaterial(track, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  // Track end markers
  for (const ex of [-TRACK_HALF, TRACK_HALF]) {
    const marker = engine.addEntity()
    Transform.create(marker, {
      position: Vector3.create(x + ex, 0.8, z),
      scale: Vector3.create(0.15, 0.6, PLAT_SIZE.z + 0.4)
    })
    MeshRenderer.setBox(marker)
    Material.setPbrMaterial(marker, { albedoColor: Color4.create(1, 0.3, 0.1, 1) })
  }

  // Platform entity
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(x - TRACK_HALF, 0.75, z),
    scale: PLAT_SIZE
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(platform, {
    albedoColor: Color4.create(0.3, 0.6, 1, 1),
    emissiveColor: { r: 0.05, g: 0.1, b: 0.3 }, emissiveIntensity: 0.3
  })

  // Trigger entity (top of platform, moves with it)
  const triggerEntity = engine.addEntity()
  Transform.create(triggerEntity, {
    position: Vector3.create(x - TRACK_HALF, 0.75 + 0.5, z),
    scale: PLAT_SIZE
  })

  const rideState: RidePlatformState = {
    entity: platform,
    triggerEntity,
    currentPos: {x: x - TRACK_HALF, y: 0.75, z: z},
    lastPos: {x: x - TRACK_HALF, y: 0.75, z: z},
    playerOn: false
  }
  setupPlatformTrigger(rideState, PLAT_SIZE, 0.5)

  // Direction label on platform
  const platLbl = engine.addEntity()
  Transform.create(platLbl, {
    position: Vector3.create(x - TRACK_HALF, 1.2, z),
    scale: Vector3.create(0.1, 0.1, 0.1)
  })
  Billboard.create(platLbl, {})
  TextShape.create(platLbl, { text: '◀▶', fontSize: 2, textColor: Color4.White() })

  // Ping-pong system
  let pingPongDir = 1  // +1 or -1
  engine.addSystem((dt: number) => {
    // Move platform
    rideState.currentPos.x += platformSpeed * pingPongDir * dt
    // Bounce
    if (rideState.currentPos.x >= x + TRACK_HALF) {
      rideState.currentPos.x = x + TRACK_HALF; pingPongDir = -1
    } else if (rideState.currentPos.x <= x - TRACK_HALF) {
      rideState.currentPos.x = x - TRACK_HALF; pingPongDir = 1
    }
    applyPlatformRide(rideState, 0.5)
    Transform.getMutable(platLbl).position = Vector3.create(rideState.currentPos.x, 1.2, z)
  }, 10)

  // Speed buttons
  const half  = createButton(x - 2.5, 0.8, z - 3.6, '0.5× Slow',  Color4.create(0.3, 0.5, 0.3, 1))
  const norm  = createButton(x,       0.8, z - 3.6, '1× Normal',  Color4.create(0.3, 0.3, 0.6, 1))
  const fast  = createButton(x + 2.5, 0.8, z - 3.6, '2× Fast',   Color4.create(0.6, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: half,  opts: { button: 1, hoverText: '[E] Slow' } },   () => { platformSpeed = 1.0; console.log('[PM1] Speed: 1.0 m/s') })
  pointerEventsSystem.onPointerDown({ entity: norm,  opts: { button: 1, hoverText: '[E] Normal' } }, () => { platformSpeed = 2.0; console.log('[PM1] Speed: 2.0 m/s') })
  pointerEventsSystem.onPointerDown({ entity: fast,  opts: { button: 1, hoverText: '[E] Fast' } },   () => { platformSpeed = 4.0; console.log('[PM1] Speed: 4.0 m/s') })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'delta = newPos - lastPos\nmovePlayerTo(playerPos + delta) if on\nTrigger moves with platform each frame',
    fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM1] PingPong initialized — 6m track, 2 m/s, speed buttons')
}

// ─── Station: PM2 — Elevator Platform ────────────────────────────────────────

export function setupPMElevator(): void {
  const { x, z } = { x: 28, z: 66 }
  createStation('pm2_elevator', 'PM2 — ELEVATOR\nMulti-floor, player rides', STATUS_COLOR.FULLY_CODED)

  const FLOORS = [0.75, 4.0, 7.5]  // Y positions of each floor
  const FLOOR_LABELS = ['Floor 1', 'Floor 2', 'Floor 3']
  const ELEVATOR_SPEED = 2.5  // m/s
  const WAIT_TIME = 2.0       // seconds at each floor

  // Elevator shaft visual
  const shaft = engine.addEntity()
  Transform.create(shaft, {
    position: Vector3.create(x, 4.0, z),
    scale: Vector3.create(2.4, 8.5, 2.4)
  })
  MeshRenderer.setBox(shaft)
  Material.setPbrMaterial(shaft, { albedoColor: Color4.create(0.2, 0.2, 0.25, 0.3), transparencyMode: 1 })

  // Floor landing indicators
  for (let f = 0; f < FLOORS.length; f++) {
    const fy = FLOORS[f]
    // Landing pad (small strip on shaft exterior)
    const landing = engine.addEntity()
    Transform.create(landing, {
      position: Vector3.create(x + 1.3, fy, z),
      scale: Vector3.create(0.08, 0.1, 2.4)
    })
    MeshRenderer.setBox(landing)
    Material.setPbrMaterial(landing, { albedoColor: Color4.create(1, 0.9, 0.3, 1), emissiveColor: { r: 0.5, g: 0.4, b: 0 }, emissiveIntensity: 0.8 })

    const fLbl = engine.addEntity()
    Transform.create(fLbl, { position: Vector3.create(x + 2.0, fy + 0.3, z) })
    Billboard.create(fLbl, {})
    TextShape.create(fLbl, { text: FLOOR_LABELS[f], fontSize: 1.0, textColor: Color4.create(1, 0.9, 0.3, 1) })
  }

  // Elevator car
  const car = engine.addEntity()
  Transform.create(car, {
    position: Vector3.create(x, FLOORS[0], z),
    scale: Vector3.create(2.2, 0.3, 2.2)
  })
  MeshRenderer.setBox(car)
  MeshCollider.setBox(car, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(car, {
    albedoColor: Color4.create(0.8, 0.6, 0.2, 1),
    emissiveColor: { r: 0.3, g: 0.2, b: 0 }, emissiveIntensity: 0.3
  })

  const triggerEntity = engine.addEntity()
  Transform.create(triggerEntity, {
    position: Vector3.create(x, FLOORS[0] + 0.6, z),
    scale: Vector3.create(2.2, 1.0, 2.2)
  })

  const rideState: RidePlatformState = {
    entity: car, triggerEntity,
    currentPos: {x: x, y: FLOORS[0], z: z},
    lastPos: {x: x, y: FLOORS[0], z: z},
    playerOn: false
  }
  setupPlatformTrigger(rideState, Vector3.create(2.2, 1.0, 2.2), 0.6)

  // Floor indicator display on elevator
  const floorDisplay = engine.addEntity()
  Transform.create(floorDisplay, { position: Vector3.create(x, FLOORS[0] + 1.0, z) })
  Billboard.create(floorDisplay, {})
  TextShape.create(floorDisplay, { text: '1', fontSize: 2.5, textColor: Color4.create(1, 0.9, 0.3, 1) })

  // Elevator state
  let currentFloorIdx = 0
  let targetFloorIdx  = 0
  let waitTimer = 0
  let waiting = true
  let autoMode = true  // auto cycle through all floors

  // Auto-cycle: change target floor when done waiting
  function advanceFloor(): void {
    if (!autoMode) return
    currentFloorIdx = targetFloorIdx
    targetFloorIdx = (currentFloorIdx + 1) % FLOORS.length
    waiting = false
    console.log(`[PM2] Elevator heading to ${FLOOR_LABELS[targetFloorIdx]}`)
  }

  engine.addSystem((dt: number) => {
    if (waiting) {
      waitTimer -= dt
      if (waitTimer <= 0) advanceFloor()
      return
    }
    const targetY = FLOORS[targetFloorIdx]
    const diff = targetY - rideState.currentPos.y

    if (Math.abs(diff) < 0.05) {
      rideState.currentPos.y = targetY
      waiting = true
      waitTimer = WAIT_TIME
      TextShape.getMutable(floorDisplay).text = `${targetFloorIdx + 1}`
      console.log(`[PM2] Arrived at ${FLOOR_LABELS[targetFloorIdx]}`)
    } else {
      rideState.currentPos.y += Math.sign(diff) * Math.min(Math.abs(diff), ELEVATOR_SPEED * dt)
      // Update floor display
      const rawFloor = (rideState.currentPos.y - FLOORS[0]) / (FLOORS[FLOORS.length - 1] - FLOORS[0])
      TextShape.getMutable(floorDisplay).text = rawFloor > 0.6 ? '↑' : rawFloor < 0.3 ? '↓' : '~'
    }

    applyPlatformRide(rideState, 0.6)
    Transform.getMutable(floorDisplay).position = Vector3.create(x, rideState.currentPos.y + 1.0, z)
  }, 10)

  // Start cycling after a brief delay
  waitTimer = WAIT_TIME

  // Call button for each floor (on the shaft exterior)
  for (let f = 0; f < FLOORS.length; f++) {
    const callBtn = createButton(x + 1.6, FLOORS[f] + 0.1, z + 1.2, `↑ F${f + 1}`, Color4.create(0.4, 0.4, 0.4, 1))
    const fi = f
    pointerEventsSystem.onPointerDown({ entity: callBtn, opts: { button: 1, hoverText: `[E] Call to floor ${f + 1}` } }, () => {
      autoMode = false
      targetFloorIdx = fi
      waiting = false
      console.log(`[PM2] Called to ${FLOOR_LABELS[fi]}`)
    })
  }

  const autoBtn = createButton(x - 2, 0.8, z - 3.6, '▶ Auto Cycle', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: autoBtn, opts: { button: 1, hoverText: '[E] Auto mode' } }, () => {
    autoMode = true; console.log('[PM2] Auto cycle ON')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x - 2.5, 5.5, z) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: '3 floors: Y=0.75, 4.0, 7.5\nSame ride pattern as PM1\nCall buttons or auto-cycle\nPlayer rides vertically',
    fontSize: 1.1, textColor: Color4.create(1, 0.85, 0.5, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[PM2] Elevator initialized — 3 floors, auto-cycle, call buttons')
}
