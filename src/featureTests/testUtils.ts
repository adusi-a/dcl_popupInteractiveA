/**
 * testUtils.ts — Shared helpers for Feature Test Zone stations
 * 
 * Station grid layout (X=88-155, Z=8-70):
 *   Row 1 (Z=22): T1@96, T2@108, T3@120, T4@132, T5@144
 *   Row 2 (Z=50): T6@96, T7@108, T8@120, T9@132, T10@144
 * 
 * Each station: 8×8m colored platform + Billboard label sign
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'

export const STATION_POSITIONS: Record<string, { x: number; z: number }> = {
  t1_physics:   { x: 96,  z: 22 },
  t2_particles: { x: 108, z: 22 },
  t3_camera:    { x: 120, z: 22 },
  t4_skybox:    { x: 132, z: 22 },
  t5_input:     { x: 144, z: 22 },
  t6_npcs:      { x: 96,  z: 50 },
  t7_emotes:    { x: 108, z: 50 },
  t8_textshape: { x: 120, z: 50 },
  t9_fonts:     { x: 132, z: 50 },
  t10_nft:      { x: 144, z: 50 },
  // MonsterLibrary Prototype Zone — Row 3 (Z=78) and Row 4 (Z=98)
  ml1_nodewalker:   { x: 96,  z: 78 },
  ml2_shelfghost:   { x: 108, z: 78 },
  ml3_wanderenemy:  { x: 120, z: 78 },
  ml4_holdinteract: { x: 132, z: 78 },
  ml5_pathdistance: { x: 144, z: 78 },
  ml6_minimap:      { x: 120, z: 98 },
  // Hazard Zone — Row 5 (Z=118) + Row 6 (Z=138)
  hz1_spikewall:    { x: 96,  z: 118 },
  hz2_spikebox:     { x: 108, z: 118 },
  hz3_dartwall:     { x: 120, z: 118 },
  hz4_dartbox:      { x: 132, z: 118 },
  hz5_disappear:    { x: 144, z: 118 },
  hz6_bombthrow:    { x: 96,  z: 138 },
  hz7_turret:       { x: 108, z: 138 },
  hz8_laser:        { x: 120, z: 138 },
  hz9_thwomp:       { x: 132, z: 138 },
  // Switch Zone (WEST side: X=8-72, Z=22-50)
  sw1_plate:    { x: 16, z: 22 },
  sw2_lever:    { x: 28, z: 22 },
  sw3_door:     { x: 40, z: 22 },
  sw4_keylock:  { x: 52, z: 22 },
  sw5_checkpoint: { x: 64, z: 22 },
  sw6_collect:  { x: 16, z: 44 },
  sw7_teleport: { x: 28, z: 44 },
  sw8_bridge:   { x: 40, z: 44 },
  sw9_weight:   { x: 52, z: 44 },
  // Platform Movement Zone (WEST side: X=8-72, Z=66-88)
  pm1_pingpong:  { x: 16, z: 66 },
  pm2_elevator:  { x: 28, z: 66 },
  pm3_rotating:  { x: 40, z: 66 },
  pm4_crumble:   { x: 52, z: 66 },
  pm5_saw:       { x: 64, z: 66 },
  pm6_pendulum:  { x: 16, z: 88 },
  pm7_squeeze:   { x: 28, z: 88 },
  pm8_risingfloor: { x: 40, z: 88 },
  pm9_fan:       { x: 52, z: 88 },
}

/** Status colors for platform tops */
export const STATUS_COLOR = {
  FULLY_CODED:   Color4.create(0.1, 0.9, 0.3, 1),   // green  — no assets needed
  NEEDS_ASSET:   Color4.create(1.0, 0.8, 0.0, 1),   // yellow — needs an asset file
  NEEDS_INSTALL: Color4.create(0.9, 0.5, 0.0, 1),   // orange — needs npm install
}

/**
 * Creates a labeled platform for a test station.
 * Returns the platform entity so tests can parent elements to it.
 */
export function createStation(
  key: keyof typeof STATION_POSITIONS,
  label: string,
  statusColor: Color4
): ReturnType<typeof engine.addEntity> {
  const pos = STATION_POSITIONS[key]

  // --- platform ---
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(pos.x, 0.25, pos.z),
    scale: Vector3.create(8, 0.5, 8)
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform)
  Material.setPbrMaterial(platform, { albedoColor: statusColor })

  // --- station number badge (small cube) ---
  const badge = engine.addEntity()
  Transform.create(badge, {
    position: Vector3.create(pos.x - 3.5, 1.5, pos.z - 3.5),
    scale: Vector3.create(0.8, 0.8, 0.1)
  })
  MeshRenderer.setBox(badge)

  // --- billboard sign above the platform ---
  const sign = engine.addEntity()
  Transform.create(sign, {
    position: Vector3.create(pos.x, 4.5, pos.z)
  })
  Billboard.create(sign, {})
  TextShape.create(sign, {
    text: label,
    fontSize: 2.5,
    textColor: Color4.White(),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15,
    textWrapping: false
  })

  return platform
}

/**
 * Creates a small clickable button with a label.
 * Returns the entity so callers can attach pointer events.
 */
export function createButton(
  x: number, y: number, z: number,
  label: string,
  color: Color4 = Color4.create(0.2, 0.5, 1, 1)
): ReturnType<typeof engine.addEntity> {
  const btn = engine.addEntity()
  Transform.create(btn, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(2.5, 0.8, 0.4)
  })
  MeshRenderer.setBox(btn)
  MeshCollider.setBox(btn, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(btn, { albedoColor: color })

  const lbl = engine.addEntity()
  Transform.create(lbl, {
    position: Vector3.create(x, y + 0.6, z)
  })
  Billboard.create(lbl, {})
  TextShape.create(lbl, {
    text: label,
    fontSize: 1.5,
    textColor: Color4.White(),
    outlineColor: Color4.Black(),
    outlineWidth: 0.1
  })

  return btn
}

/**
 * Creates an entrance arch for the Platform Movement Zone.
 */
export function createPMZoneEntrance(): void {
  const arch = engine.addEntity()
  Transform.create(arch, { position: Vector3.create(40, 5, 58) })
  Billboard.create(arch, {})
  TextShape.create(arch, {
    text: '🚀 PLATFORM MOVEMENT ZONE\nRide  Rotate  Crumble  Saw\nPendulum  Squeeze  Fan',
    fontSize: 2.5,
    textColor: Color4.create(1, 0.6, 0.2, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })
}

/**
 * Creates an entrance arch for the Switch/Door/Pickup Zone.
 */
export function createSWZoneEntrance(): void {
  const arch = engine.addEntity()
  Transform.create(arch, {
    position: Vector3.create(40, 5, 10)
  })
  Billboard.create(arch, {})
  TextShape.create(arch, {
    text: '🔑 SWITCH • DOOR • PICKUP ZONE\nPlates  Levers  Doors  Keys\nCheckpoints  Pickups  Teleporters',
    fontSize: 2.5,
    textColor: Color4.create(0.3, 0.9, 1, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })
}

/**
 * Creates an entrance arch for the Hazard Zone.
 */
export function createHazardZoneEntrance(): void {
  const arch = engine.addEntity()
  Transform.create(arch, {
    position: Vector3.create(120, 5, 110)
  })
  Billboard.create(arch, {})
  TextShape.create(arch, {
    text: '⚡ HAZARD ZONE
🟩 Spikes  🟩 Darts  🟩 Disappear Floor
🟩 Bomb Throw  🟩 Turrets  🟩 Thwomp',
    fontSize: 2.5,
    textColor: Color4.create(1, 0.3, 0.3, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })
}

/**
 * Creates an entrance arch for the MonsterLibrary Prototype Zone.
 */
export function createMLZoneEntrance(): void {
  const arch = engine.addEntity()
  Transform.create(arch, {
    position: Vector3.create(120, 5, 70)
  })
  Billboard.create(arch, {})
  TextShape.create(arch, {
    text: '👻 MONSTER LIBRARY PROTOTYPES\n🟩 NodeWalk  🟩 ShelfGhost  🟩 WanderEnemy\n🟩 HoldInteract  🟩 PathDistance  🟩 Minimap',
    fontSize: 2.5,
    textColor: Color4.create(1, 0.6, 0.1, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })
}

/**
 * Creates an entrance arch sign for the whole Feature Test Zone.
 */
export function createZoneEntrance(): void {
  const arch = engine.addEntity()
  Transform.create(arch, {
    position: Vector3.create(120, 5, 6)
  })
  Billboard.create(arch, {})
  TextShape.create(arch, {
    text: '🧪 FEATURE TEST ZONE\n🟩 Coded  🟨 Needs Asset  🟧 Needs Install\n[E] on buttons to trigger tests',
    fontSize: 2.8,
    textColor: Color4.White(),
    outlineColor: Color4.Black(),
    outlineWidth: 0.15
  })
}
