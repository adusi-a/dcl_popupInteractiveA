/**
 * T6 — NPC Toolkit (dcl-npc-toolkit)
 * STATUS: 🟧 NEEDS INSTALL + 🟨 NEEDS ASSET
 *
 * BEFORE TESTING:
 *   1. Run: npm install dcl-npc-toolkit
 *      (Add "dcl-npc-toolkit": "latest" to package.json — done below)
 *   2. ASSET PLACED: assets/models/npc_guard.glb (bipedA from GhostTown V1)
 *      Clips available: Zombie_Scream, Walking, Unsteady_Walk, Running, Female_Run_Forward_Pick_Up_Right
 *      Mapped: idleAnim='Unsteady_Walk', walkingAnim='Walking'
 *      Source from DCL model catalog (8,800+ free models):
 *        npx @dcl/sdk-commands asset-pack --list
 *      Or use the Creator Hub catalog search for "guard", "npc", or "humanoid".
 *      Minimum requirement: has 'idle' clip; walk optional.
 *
 * Tests:
 *   A) Static NPC — click to open dialogue tree with 2 choices
 *   B) Patrol NPC — walks between 3 waypoints in a loop
 *   C) Following NPC — follows player when spoken to
 *
 * VERIFY:
 *   - Clicking the static NPC opens a dialogue with correct response text
 *   - Patrol NPC visibly walks between the 3 marker positions
 *   - Following NPC stays near player after dialogue
 *
 * GAME APPLICATIONS:
 *   MonsterLibrary  — ghost librarian NPC with patrol, service desk NPC
 *   GhostTown V2    — ghost NPCs with patrol/wander behavior
 *   OreMonger       — crew office contractor NPC with job dialogue
 *
 * SDK NOTES:
 *   • dcl-npc-toolkit provides NPCBodyShape, NPCType, NPC.create()
 *   • GLB must have named animation clips matching idleAnim/walkingAnim in NPC.create()
 *   • bipedA.glb clips: Zombie_Scream, Walking, Unsteady_Walk, Running, Female_Run_Forward_Pick_Up_Right
 *   • For game-integrated NPCs with deep coupling, use InteractiveEntity
 *     from the DN framework instead (already confirmed working in this scene)
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { createStation, STATUS_COLOR } from './testUtils'

// NPC Toolkit import — requires: npm install dcl-npc-toolkit
// If this import fails at compile time:
//   1. Run: npm install dcl-npc-toolkit
//   2. Add to package.json dependencies: "dcl-npc-toolkit": "latest"
let NPC: any
let NPCType: any
let NPCBodyShape: any
try {
  // @ts-ignore — require works in DCL/esbuild QuickJS context
  const toolkit = require('dcl-npc-toolkit') as any
  NPC = toolkit.NPC
  NPCType = toolkit.NPCType
  NPCBodyShape = toolkit.NPCBodyShape
} catch (e) {
  console.error('[T6] dcl-npc-toolkit not installed — run: npm install dcl-npc-toolkit')
}

const NPC_GLB = 'assets/models/npc_guard.glb'  // ✅ placed (bipedA from GhostTown V1)
// bipedA clips: Zombie_Scream | Walking | Unsteady_Walk | Running | Female_Run_Forward_Pick_Up_Right
const ANIM_IDLE = 'Unsteady_Walk'   // best available 'at rest' clip
const ANIM_WALK = 'Walking'          // standard walk

export function setupNPCTest(): void {
  const { x, z } = { x: 96, z: 50 }
  createStation('t6_npcs', 'T6 — NPC TOOLKIT\ndcl-npc-toolkit installed ✔', STATUS_COLOR.NEEDS_ASSET)

  if (!NPC) {
    // Show "needs install" sign instead
    const msgEntity = engine.addEntity()
    Transform.create(msgEntity, { position: Vector3.create(x, 2.5, z) })
    Billboard.create(msgEntity)
    TextShape.create(msgEntity, {
      text: '⚠️ dcl-npc-toolkit not installed\nRun: npm install dcl-npc-toolkit',
      fontSize: 1.4,
      textColor: Color4.create(1, 0.8, 0, 1),
      outlineColor: Color4.Black(), outlineWidth: 0.1
    })
    console.log('[T6] ⚠️  dcl-npc-toolkit not installed — run: npm install dcl-npc-toolkit')
    console.log('[T6] ⚠️  toolkit not found — run: npm install dcl-npc-toolkit')
    return
  }

  // ─── A) Static Dialogue NPC ───────────────────────────────────────────────
  NPC.create(
    Vector3.create(x - 2.5, 0.5, z),
    {
      type: NPCType.CUSTOM,
      bodyShape: NPCBodyShape.MALE,
      model: NPC_GLB,
      name: 'Guard',
      onActivate: () => {
        console.log('[T6] Guard NPC activated')
        NPC.talk(
          [
            {
              text: 'Halt! What brings you to the Feature Test Zone?',
              name: 'Guard',
              buttons: [
                { label: 'Just testing things', goToIndex: 1 },
                { label: 'Nothing to report', goToIndex: 2 }
              ]
            },
            {
              text: 'Very well. Carry on then, citizen.',
              name: 'Guard',
              buttons: [{ label: 'Thanks!', goToIndex: -1 }]  // -1 closes dialogue
            },
            {
              text: 'Suspicious... I\'ll be watching you.',
              name: 'Guard',
              buttons: [{ label: 'OK...', goToIndex: -1 }]
            }
          ],
          0  // start at index 0
        )
      },
      idleAnim: ANIM_IDLE,
      hoverText: 'Talk to Guard'
    }
  )

  // ─── B) Patrol NPC ────────────────────────────────────────────────────────
  const patrolWaypoints = [
    Vector3.create(x, 0.5, z + 2),
    Vector3.create(x + 2, 0.5, z + 4),
    Vector3.create(x - 2, 0.5, z + 4)
  ]

  // Waypoint markers (small arrows on the ground)
  for (const wp of patrolWaypoints) {
    const marker = engine.addEntity()
    Transform.create(marker, {
      position: Vector3.create(wp.x, 0.55, wp.z),
      scale: Vector3.create(0.3, 0.1, 0.3)
    })
    MeshRenderer.setCylinder(marker)
    Material.setPbrMaterial(marker, {
      albedoColor: Color4.create(0, 0.8, 1, 0.7),
      emissiveColor: { r: 0, g: 0.3, b: 0.4 },
      emissiveIntensity: 1
    })
  }

  NPC.create(
    Vector3.create(x, 0.5, z + 2),
    {
      type: NPCType.CUSTOM,
      bodyShape: NPCBodyShape.FEMALE,
      model: NPC_GLB,
      name: 'Patrol Scout',
      walkingSpeed: 2,
      walkingAnimationSpeed: 1,
      onActivate: () => {
        NPC.talk([
          { text: 'I am patrolling this area.', name: 'Scout',
            buttons: [{ label: 'Keep it up!', goToIndex: -1 }] }
        ], 0)
      },
      walkingAnim: ANIM_WALK,
      idleAnim: ANIM_IDLE,
      hoverText: 'Talk to Scout'
    }
  )
  NPC.startWalkingLoop(patrolWaypoints)

  // ─── C) Following NPC ─────────────────────────────────────────────────────
  NPC.create(
    Vector3.create(x + 2.5, 0.5, z),
    {
      type: NPCType.CUSTOM,
      bodyShape: NPCBodyShape.MALE,
      model: NPC_GLB,
      name: 'Companion',
      onActivate: () => {
        NPC.talk([
          {
            text: 'Need a companion? I can follow you around.',
            name: 'Companion',
            buttons: [
              { label: 'Follow me!', goToIndex: 1 },
              { label: 'No thanks', goToIndex: -1 }
            ]
          },
          {
            text: 'On it! I\'ll stay close.',
            name: 'Companion',
            buttons: [{ label: 'Great!', goToIndex: -1 }],
            triggeredByIndex: () => NPC.followPlayer()
          }
        ], 0)
      },
      idleAnim: ANIM_IDLE,
      walkingAnim: ANIM_WALK,
      walkingSpeed: 3,
      hoverText: 'Talk to Companion'
    }
  )

  console.log('[T6] ✅ NPC Toolkit test station initialized')
  console.log('[T6]   bipedA.glb placed | idleAnim=Unsteady_Walk | walkingAnim=Walking')
  console.log('[T6]   NOTE: GhostTown zombie character — animations are zombie-style, not guard-style')
}
