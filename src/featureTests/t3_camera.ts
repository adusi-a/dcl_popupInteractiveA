/**
 * T3 — Camera Control
 * STATUS: 🟩 FULLY CODED — no assets needed
 *
 * Tests:
 *   A) CameraModeArea — force first-person inside a "dungeon entrance"
 *   B) VirtualCamera — cinematic pan to a "chest reveal" on trigger
 *   C) CameraMode detection — HUD shows current mode (first vs third person)
 *
 * VERIFY:
 *   - Entering the arch doorway switches to first-person; exiting restores third-person
 *   - Stepping on the cutscene trigger pans camera to the chest, then releases control
 *   - HUD text updates showing 'FIRST_PERSON' or 'THIRD_PERSON' as you move
 *
 * GAME APPLICATIONS:
 *   GhostTown V2    — ghost jump-scare cutscene (VirtualCamera pan to ghost)
 *   MonsterLibrary  — forced first-person during ghost chase, cutscene on new floor
 *   OreMonger       — cinematic reveal of hidden ore chamber
 *
 * SDK NOTES:
 *   • CameraMode.CM_FIRST_PERSON / CM_THIRD_PERSON for detection.
 *   • VirtualCamera replaces player control for its duration.
 *   • Combine with InputModifier (T5) to freeze player during cutscenes.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, TriggerArea, triggerAreaEventsSystem,
  CameraMode, CameraModeArea, VirtualCamera, MainCamera,
  ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { InputAction } from '@dcl/sdk/ecs'
import { createStation, STATUS_COLOR } from './testUtils'

// Camera mode detection label — updated each frame
let cameraModeLabel: ReturnType<typeof engine.addEntity> | null = null
let currentCameraMode: string = 'UNKNOWN'

export function setupCameraTest(): void {
  const { x, z } = { x: 120, z: 22 }
  createStation('t3_camera', 'T3 — CAMERA CONTROL\nCutscene + Force Mode', STATUS_COLOR.FULLY_CODED)

  // ─── A) First-person Force Zone ────────────────────────────────────────────
  // Arch doorframe visual
  for (const [dx, dz] of [[-1.3, 0], [1.3, 0]] as [number, number][]) {
    const pillar = engine.addEntity()
    Transform.create(pillar, {
      position: Vector3.create(x + dx, 1.5, z - 2.5),
      scale: Vector3.create(0.4, 3, 0.4)
    })
    MeshRenderer.setBox(pillar)
    Material.setPbrMaterial(pillar, { albedoColor: Color4.create(0.5, 0.4, 0.3, 1) })
  }
  const archTop = engine.addEntity()
  Transform.create(archTop, {
    position: Vector3.create(x, 3.1, z - 2.5),
    scale: Vector3.create(3, 0.4, 0.4)
  })
  MeshRenderer.setBox(archTop)
  Material.setPbrMaterial(archTop, { albedoColor: Color4.create(0.5, 0.4, 0.3, 1) })

  const archLabel = engine.addEntity()
  Transform.create(archLabel, { position: Vector3.create(x, 4, z - 2.5) })
  Billboard.create(archLabel)
  TextShape.create(archLabel, {
    text: 'Enter → FIRST PERSON\nExit → THIRD PERSON', fontSize: 1.3,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // CameraModeArea entity — the zone inside the arch
  const fpZone = engine.addEntity()
  Transform.create(fpZone, {
    position: Vector3.create(x, 1.5, z),
    scale: Vector3.create(4, 4, 7)   // extends from behind arch inward
  })
  CameraModeArea.create(fpZone, {
    area: Vector3.create(4, 4, 7),
    cameraMode: CameraMode.CM_FIRST_PERSON
  })

  // ─── B) VirtualCamera Cutscene ────────────────────────────────────────────
  // "Chest" reveal target
  const chestViz = engine.addEntity()
  Transform.create(chestViz, {
    position: Vector3.create(x, 1.0, z + 3),
    scale: Vector3.create(0.8, 0.6, 0.6)
  })
  MeshRenderer.setBox(chestViz)
  Material.setPbrMaterial(chestViz, {
    albedoColor: Color4.create(0.6, 0.4, 0.1, 1),
    metallic: 0.6, roughness: 0.3,
    emissiveColor: { r: 0.3, g: 0.2, b: 0 },
    emissiveIntensity: 1
  })

  const chestLabel = engine.addEntity()
  Transform.create(chestLabel, { position: Vector3.create(x, 1.9, z + 3) })
  Billboard.create(chestLabel)
  TextShape.create(chestLabel, {
    text: '(cutscene target)', fontSize: 1.1,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // VirtualCamera entity — aimed at the chest
  const vcam = engine.addEntity()
  Transform.create(vcam, {
    position: Vector3.create(x - 3, 2.5, z + 1.5),
    rotation: Quaternion.fromLookAt(
      Vector3.create(x - 3, 2.5, z + 1.5),
      Vector3.create(x, 1.0, z + 3)
    )
  })
  VirtualCamera.create(vcam, {
    defaultTransition: { transitionMode: { $case: 'time', time: 1.5 } }
  })

  // Trigger pad on the floor
  const cutscenePad = engine.addEntity()
  Transform.create(cutscenePad, {
    position: Vector3.create(x - 1.5, 0.52, z + 1),
    scale: Vector3.create(2, 0.1, 2)
  })
  MeshRenderer.setBox(cutscenePad)
  MeshCollider.setBox(cutscenePad, ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(cutscenePad, {
    albedoColor: Color4.create(1, 0.8, 0, 1),
    emissiveColor: { r: 0.3, g: 0.2, b: 0 },
    emissiveIntensity: 1
  })

  const padLabel = engine.addEntity()
  Transform.create(padLabel, { position: Vector3.create(x - 1.5, 1.3, z + 1) })
  Billboard.create(padLabel)
  TextShape.create(padLabel, {
    text: '[E] CUTSCENE\nstep here or press', fontSize: 1.1,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  pointerEventsSystem.onPointerDown(
    { entity: cutscenePad, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Trigger Cutscene' } },
    () => {
      console.log('[T3] Cutscene triggered — activating VirtualCamera')
      VirtualCamera.createOrReplace(vcam, {
        defaultTransition: { transitionMode: { $case: 'time', time: 1.5 } }
      })
      // Auto-release camera after 4 seconds (replace with original player camera)
      let elapsed = 0
      const releaseSys = engine.addSystem((dt) => {
        elapsed += dt
        if (elapsed > 4) {
          engine.removeSystem(releaseSys)
          VirtualCamera.deleteFrom(vcam)
          console.log('[T3] Cutscene ended — camera control returned')
        }
      })
    }
  )

  // Also trigger on zone entry
  const cutsceneTrigger = engine.addEntity()
  Transform.create(cutsceneTrigger, {
    position: Vector3.create(x - 1.5, 1, z + 1),
    scale: Vector3.create(2, 2.5, 2)
  })
  TriggerArea.setBox(cutsceneTrigger)
  let cutscenePlayed = false
  triggerAreaEventsSystem.onTriggerEnter(cutsceneTrigger, (e) => {
    if (e.trigger?.entity !== engine.PlayerEntity || cutscenePlayed) return
    cutscenePlayed = true
    console.log('[T3] Walk trigger — cutscene starting')
    VirtualCamera.createOrReplace(vcam, {
      defaultTransition: { transitionMode: { $case: 'time', time: 1.5 } }
    })
    setTimeout(() => {
      VirtualCamera.deleteFrom(vcam)
      cutscenePlayed = false
      console.log('[T3] Cutscene ended')
    }, 4000)
  })

  // ─── C) Camera Mode HUD ───────────────────────────────────────────────────
  cameraModeLabel = engine.addEntity()
  Transform.create(cameraModeLabel, { position: Vector3.create(x, 5.5, z) })
  Billboard.create(cameraModeLabel)
  TextShape.create(cameraModeLabel, {
    text: 'Camera: detecting...', fontSize: 1.4,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // System to read CameraMode each frame
  engine.addSystem(() => {
    if (!cameraModeLabel) return
    const camera = MainCamera.getOrNull(engine.CameraEntity)
    if (!camera) return
    const modeText = camera.cameraMode === CameraMode.CM_FIRST_PERSON
      ? '🎥 FIRST PERSON'
      : '🎥 THIRD PERSON'
    if (modeText !== currentCameraMode) {
      currentCameraMode = modeText
      TextShape.getMutable(cameraModeLabel!).text = `Camera: ${modeText}`
      console.log(`[T3] Camera mode: ${modeText}`)
    }
  })

  console.log('[T3] Camera Control test station initialized')
}
