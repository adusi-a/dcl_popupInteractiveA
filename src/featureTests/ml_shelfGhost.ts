/**
 * ml_shelfGhost.ts — T12: Shelf Ghost + Book Throw
 * STATUS: 🟩 FULLY CODED — no assets needed (box placeholders)
 *
 * WHAT THIS PROVES
 * ────────────────
 * Ghost that "sleeps" at a shelf position, pops out when the player gets
 * close, and throws a "book" (a moving box entity) down the aisle.
 *
 * Key design points:
 *   • Ghost position and projectile origin are SEPARATE DATA  (per design spec)
 *   • Book throw direction is defined per ghost (which aisle, which way)
 *   • State machine: sleeping → alert → throwing → cooldown → sleeping
 *   • Fully self-contained — no dependency on other ML files
 *
 * When a GLB is placed at assets/models/ghost_library.glb, replace the
 * box ghost entity with GltfContainer + Animator for idle/pop animations.
 *
 * FRAMEWORK NOTE
 * ──────────────
 * The throw mechanic (ProjectileState: dormant → launched → travelling →
 * hit/expired) is reusable for:
 *   MonsterLibrary  — book throws down aisles
 *   GhostTown V2    — objects thrown by ghosts
 *   OreMonger       — flying ore chunks from mine collapses
 * Extract to a framework Projectile component once variants are known.
 *
 * DEMO (run and verify):
 *   [ ] Blue ghost-box is visible at the shelf position (sleeping)
 *   [ ] Walk within 4m of the ghost → ghost turns red (alert)
 *   [ ] Walk within 2.5m → ghost pops forward (Z offset) and throws
 *   [ ] Book (yellow box) travels along the aisle for ~8m then vanishes
 *   [ ] Ghost returns to shelf after throw, waits 4s, resets
 *   [ ] Console logs [ML2] state transitions
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { createStation, STATUS_COLOR } from './testUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

type GhostState = 'sleeping' | 'alert' | 'throwing' | 'cooldown'

interface ShelfGhostEntry {
  ghostEntity:   ReturnType<typeof engine.addEntity>
  bookEntity:    ReturnType<typeof engine.addEntity>
  shelfPos:      Vector3        // rest position inside the shelf
  popPos:        Vector3        // position when "popped out"
  throwDir:      {x:number; y:number; z:number}  // unit vector along the aisle
  triggerRadius: number         // metres — alert distance
  throwRadius:   number         // metres — throw distance
  state:         GhostState
  cooldownTimer: number         // seconds remaining in cooldown
  bookActive:    boolean
  bookPos:       {x:number; y:number; z:number}  // current book world position (for system)
  bookSpeed:     number         // m/s
  bookMaxRange:  number         // metres before book disappears
  bookTravelled: number         // accumulated distance
}

const ghosts: ShelfGhostEntry[] = []
let ghostSystemRegistered = false

// ─── Ghost system ─────────────────────────────────────────────────────────────

function ensureGhostSystem(): void {
  if (ghostSystemRegistered) return
  ghostSystemRegistered = true

  engine.addSystem((dt: number) => {
    // Get player position from PlayerEntity Transform
    const playerTransform = Transform.getOrNull(engine.PlayerEntity)
    if (!playerTransform) return
    const pp = playerTransform.position

    for (const g of ghosts) {
      const ghostT = Transform.getMutableOrNull(g.ghostEntity)
      const bookT  = Transform.getMutableOrNull(g.bookEntity)
      if (!ghostT || !bookT) continue

      // Distance to player (XZ plane)
      const dx = pp.x - ghostT.position.x
      const dz = pp.z - ghostT.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      switch (g.state) {
        case 'sleeping':
          // Face the player so ghost "notices" direction
          if (dist < g.triggerRadius) {
            g.state = 'alert'
            // Turn red
            Material.setPbrMaterial(g.ghostEntity, {
              albedoColor: Color4.create(0.8, 0.1, 0.1, 1),
              emissiveColor: { r: 0.4, g: 0, b: 0 }, emissiveIntensity: 0.5
            })
            console.log('[ML2] Ghost ALERT — player in trigger range')
          }
          break

        case 'alert':
          if (dist > g.triggerRadius * 1.3) {
            // Player backed away — go back to sleep
            g.state = 'sleeping'
            Material.setPbrMaterial(g.ghostEntity, {
              albedoColor: Color4.create(0.3, 0.3, 0.9, 0.7),
              emissiveColor: { r: 0.1, g: 0.1, b: 0.4 }, emissiveIntensity: 0.3
            })
          } else if (dist < g.throwRadius) {
            // Player close — pop out and throw!
            g.state = 'throwing'
            // Pop out of shelf
            ghostT.position = Vector3.create(g.popPos.x, g.popPos.y, g.popPos.z)
            // Activate book
            g.bookActive = true
            g.bookPos    = {x: g.popPos.x, y: g.popPos.y, z: g.popPos.z}
            g.bookTravelled = 0
            bookT.position  = Vector3.create(g.bookPos.x, g.bookPos.y, g.bookPos.z)
            Material.setPbrMaterial(g.bookEntity, {
              albedoColor: Color4.create(0.9, 0.7, 0.1, 1),
              emissiveColor: { r: 0.3, g: 0.2, b: 0 }, emissiveIntensity: 0.4
            })
            console.log('[ML2] Ghost THROWING book!')
          }
          break

        case 'throwing':
          if (g.bookActive) {
            // Move book along throw direction
            const step = g.bookSpeed * dt
            g.bookPos.x += g.throwDir.x * step
            g.bookPos.z += g.throwDir.z * step
            g.bookTravelled += step
            bookT.position = Vector3.create(g.bookPos.x, g.bookPos.y, g.bookPos.z)

            // Check if hit player (proximity to player)
            const bpDx = pp.x - g.bookPos.x
            const bpDz = pp.z - g.bookPos.z
            const bpDist = Math.sqrt(bpDx * bpDx + bpDz * bpDz)
            if (bpDist < 0.6) {
              console.log('[ML2] BOOK HIT PLAYER!')
              g.bookActive = false
            }

            // Book expired — max range or hit wall
            if (g.bookTravelled >= g.bookMaxRange) {
              g.bookActive = false
            }

            if (!g.bookActive) {
              // Hide book
              bookT.position = Vector3.create(g.popPos.x, -5, g.popPos.z) // below floor
              // Ghost retreats to shelf
              ghostT.position = Vector3.create(g.shelfPos.x, g.shelfPos.y, g.shelfPos.z)
              Material.setPbrMaterial(g.ghostEntity, {
                albedoColor: Color4.create(0.5, 0.5, 0.9, 0.5),
                emissiveColor: { r: 0.2, g: 0.2, b: 0.4 }, emissiveIntensity: 0.2
              })
              g.state = 'cooldown'
              g.cooldownTimer = 4.0
              console.log('[ML2] Ghost retreating — cooldown 4s')
            }
          }
          break

        case 'cooldown':
          g.cooldownTimer -= dt
          if (g.cooldownTimer <= 0) {
            g.state = 'sleeping'
            Material.setPbrMaterial(g.ghostEntity, {
              albedoColor: Color4.create(0.3, 0.3, 0.9, 0.7),
              emissiveColor: { r: 0.1, g: 0.1, b: 0.4 }, emissiveIntensity: 0.3
            })
            console.log('[ML2] Ghost reset — sleeping')
          }
          break
      }
    }
  }, 20)
}

// ─── Station setup ───────────────────────────────────────────────────────────

export function setupMLShelfGhost(): void {
  const { x, z } = { x: 108, z: 78 }
  createStation('ml2_shelfghost', 'ML2 — SHELF GHOST\nBook throw mechanic', STATUS_COLOR.FULLY_CODED)
  ensureGhostSystem()

  // Fake shelf (dark box — represents the bookshelf the ghost hides inside)
  const shelf = engine.addEntity()
  Transform.create(shelf, {
    position: Vector3.create(x - 2.5, 1.0, z),
    scale: Vector3.create(0.4, 2.0, 1.4)
  })
  MeshRenderer.setBox(shelf)
  Material.setPbrMaterial(shelf, {
    albedoColor: Color4.create(0.3, 0.2, 0.1, 1) // dark brown bookshelf
  })

  // Shelf label
  const shelfLbl = engine.addEntity()
  Transform.create(shelfLbl, { position: Vector3.create(x - 2.5, 2.4, z) })
  Billboard.create(shelfLbl, {})
  TextShape.create(shelfLbl, {
    text: '📚 HORROR', fontSize: 1.3,
    textColor: Color4.create(0.9, 0.5, 0.1, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Ghost entity (inside shelf — will pop out toward player zone)
  const shelfPos = Vector3.create(x - 2.3, 1.0, z)   // resting inside shelf
  const popPos   = Vector3.create(x - 1.4, 1.0, z)   // popped out into aisle
  const throwDir = Vector3.create(1, 0, 0)             // throws along +X (across aisle)

  const ghostEntity = engine.addEntity()
  Transform.create(ghostEntity, {
    position: Vector3.create(shelfPos.x, shelfPos.y, shelfPos.z),
    scale: Vector3.create(0.3, 0.5, 0.2)
  })
  MeshRenderer.setBox(ghostEntity)
  Material.setPbrMaterial(ghostEntity, {
    albedoColor: Color4.create(0.3, 0.3, 0.9, 0.7),
    emissiveColor: { r: 0.1, g: 0.1, b: 0.4 }, emissiveIntensity: 0.3
  })

  // Book entity (projectile — hidden below floor until thrown)
  const bookEntity = engine.addEntity()
  Transform.create(bookEntity, {
    position: Vector3.create(shelfPos.x, -5, shelfPos.z), // hidden
    scale: Vector3.create(0.25, 0.35, 0.05)              // thin book shape
  })
  MeshRenderer.setBox(bookEntity)
  Material.setPbrMaterial(bookEntity, {
    albedoColor: Color4.create(0.1, 0.1, 0.1, 0) // transparent until thrown
  })

  ghosts.push({
    ghostEntity, bookEntity,
    shelfPos: Vector3.create(shelfPos.x, shelfPos.y, shelfPos.z),
    popPos:   Vector3.create(popPos.x,   popPos.y,   popPos.z),
    throwDir: {x: throwDir.x, y: throwDir.y, z: throwDir.z},
    triggerRadius: 4.0,
    throwRadius:   2.5,
    state: 'sleeping',
    cooldownTimer: 0,
    bookActive: false,
    bookPos: {x: shelfPos.x, y: shelfPos.y, z: shelfPos.z},
    bookSpeed: 6.0,     // m/s — fast enough to feel dangerous
    bookMaxRange: 7.0,  // metres before despawn
    bookTravelled: 0
  })

  // Visual guide: "aisle" floor strip showing where books travel
  const aisle = engine.addEntity()
  Transform.create(aisle, {
    position: Vector3.create(x + 0.5, 0.52, z),
    scale: Vector3.create(7, 0.04, 1.2)
  })
  MeshRenderer.setBox(aisle)
  Material.setPbrMaterial(aisle, {
    albedoColor: Color4.create(0.5, 0.4, 0.3, 0.6)
  })

  // "AISLE" label
  const aisleLbl = engine.addEntity()
  Transform.create(aisleLbl, { position: Vector3.create(x + 0.5, 0.65, z + 0.9) })
  Billboard.create(aisleLbl, {})
  TextShape.create(aisleLbl, {
    text: '← aisle / book travel path →',
    fontSize: 1.0, textColor: Color4.create(0.7, 0.7, 0.5, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  // Info sign
  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 3.2, z - 3.6) })
  Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Ghost: sleeping → alert → throw → cooldown\nGhost pos ≠ projectile origin (separate data)\nWalk into the aisle to trigger the ghost!',
    fontSize: 1.2, textColor: Color4.create(1, 0.7, 0.7, 1),
    outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  console.log('[ML2] ShelfGhost station initialized — walk to X=108 Z=78 to test')
}
