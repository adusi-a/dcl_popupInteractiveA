/**
 * @file interactiveEntity.ts
 * @module DN DCL Framework / entities
 * @version 0.0001
 * @status PARTIALLY_CONFIRMED
 *
 * InteractiveEntity base class for Decentraland SDK7.
 *
 * CONFIRMED (from ghosttown — production hackathon build):
 *   - GltfContainer model loading
 *   - Transform creation with euler-degree → quaternion conversion
 *   - Animator multi-state setup + playAnimation()
 *   - AudioSource.createOrReplace() for sound triggers
 *   - Collision entity as child
 *   - enable/disable state
 *   - Waypoint movement system
 *   - Chase system
 *   - ReactiveEntity subclass (animate-on/off + trigger zone)
 *
 * NEEDS_TEST (framework refactor from ghosttown original):
 *   - SHARED SYSTEM: ghosttown used engine.addSystem() per instance (one system per entity).
 *     This is a DOP anti-pattern. Framework version uses a single shared static system
 *     that iterates all registered instances. NEEDS_TEST: verify movement/chase still works.
 *   - Euler degree config input (InteractiveEntityConfig accepts {x,y,z} degrees
 *     and converts internally via Quaternion.fromEulerDegrees). NEEDS_TEST.
 *   - pointerEventsSystem.onPointerDown for click interaction (not yet in ghosttown version)
 *     NEEDS_TEST: add as optional config param.
 *
 * @changelog
 *   0.0001 - Extracted from ghosttown src/components/interactiveEntity.ts.
 *            Added euler-degree config wrapper, shared system pattern (NEEDS_TEST),
 *            hoverText click interaction (NEEDS_TEST).
 */

import {
  engine, Entity, Transform, GltfContainer,
  MeshCollider, Animator, AudioSource,
  PointerEvents, PointerEventType, InputAction,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

// ─── Config Interfaces ─────────────────────────────────────────────────────

export interface EulerRotation { x: number; y: number; z: number }
export interface SoundConfig { clip: string; volume?: number; loop?: boolean }
export interface AnimationConfig { name: string; loop: boolean; speed: number }

export interface WaypointData {
  position: Vector3
  rotation: EulerRotation
  waitTime?: number
}

export interface WaypointSet {
  id: string
  waypoints: WaypointData[]
  loopWaypoints?: boolean
  moveSpeed?: number
  onComplete?: () => void
}

/**
 * InteractiveEntityConfig — human-friendly config.
 * Rotation fields accept euler degrees (x/y/z numbers), converted internally.
 */
export interface InteractiveEntityConfig {
  id: string
  modelPath: string
  position: Vector3
  /** Rotation in euler degrees — converted to Quaternion internally */
  rotationEuler?: EulerRotation
  scale?: Vector3
  enabled?: boolean

  // Animation
  animations?: AnimationConfig[]
  defaultAnimation?: string
  animationNames?: { idle?: string; walk?: string; run?: string; [key: string]: string | undefined }

  // Waypoints
  waypointSets?: { [key: string]: WaypointSet }
  autoStartWaypointSet?: string

  // Chase
  chaseSpeed?: number
  chaseAnimation?: string
  onChaseStart?: () => void
  onChaseReached?: () => void

  // Collision
  hasCollision?: boolean
  collisionScale?: Vector3
  collisionOffset?: Vector3
  collisionShape?: 'box' | 'sphere'

  // Click interaction — NEEDS_TEST
  hoverText?: string
  onClick?: () => void

  // Sounds
  soundOnCustom?: SoundConfig
  soundOnChaseStart?: SoundConfig
  soundOnWaypointComplete?: SoundConfig
}

// ─── Shared System (NEEDS_TEST refactor) ──────────────────────────────────

/** All active InteractiveEntity instances — iterated by the shared system */
const _allInstances: InteractiveEntity[] = []
let _systemRegistered = false

function _ensureSharedSystem(): void {
  if (_systemRegistered) return
  _systemRegistered = true
  // NEEDS_TEST: single shared system vs per-instance system (ghosttown pattern)
  engine.addSystem((dt: number) => {
    for (const inst of _allInstances) {
      inst._update(dt)
    }
  })
}

// ─── InteractiveEntity ─────────────────────────────────────────────────────

export class InteractiveEntity {

  entity: Entity
  collisionEntity?: Entity
  config: InteractiveEntityConfig
  gameMgr: any

  // State
  isEnabled: boolean = true
  state: 'idle' | 'moving' | 'chasing' | 'waiting' | 'disabled' = 'idle'
  previousState: 'idle' | 'moving' | 'chasing' | 'waiting' | 'disabled' = 'idle'

  // Animation
  currentAnimation: string = ''
  animationConfigs: Map<string, AnimationConfig> = new Map()

  // Movement
  currentWaypointSet?: WaypointSet
  currentWaypointIndex: number = -1
  movementProgress: number = 0
  startMovePosition: Vector3 = Vector3.Zero()
  targetMovePosition: Vector3 = Vector3.Zero()
  waitTimeRemaining: number = 0

  // Chase
  chaseTarget?: Entity
  chaseSpeed: number = 3.0

  constructor(_gameMgr: any, _config: InteractiveEntityConfig) {
    this.gameMgr = _gameMgr
    this.config = _config
    this.isEnabled = _config.enabled !== false
    this.chaseSpeed = _config.chaseSpeed || 3.0

    // Create entity
    this.entity = engine.addEntity()

    // Load model
    GltfContainer.create(this.entity, { src: _config.modelPath })

    // Set transform — NEEDS_TEST: euler degree conversion
    const rot = _config.rotationEuler
      ? Quaternion.fromEulerDegrees(_config.rotationEuler.x, _config.rotationEuler.y, _config.rotationEuler.z)
      : Quaternion.Identity()

    Transform.create(this.entity, {
      position: _config.position,
      rotation: rot,
      scale: _config.scale || Vector3.One()
    })

    // Setup animations
    if (_config.animations?.length) {
      _config.animations.forEach(a => this.animationConfigs.set(a.name, a))
      Animator.create(this.entity, {
        states: _config.animations.map(a => ({
          clip: a.name, loop: a.loop, playing: false, weight: 0, speed: a.speed
        }))
      })
      const defaultAnim = _config.defaultAnimation || _config.animations[0].name
      if (this.animationConfigs.has(defaultAnim)) this.playAnimation(defaultAnim)
    }

    // Setup collision
    if (_config.hasCollision) {
      this.collisionEntity = engine.addEntity()
      Transform.create(this.collisionEntity, {
        parent: this.entity,
        position: _config.collisionOffset || Vector3.Zero(),
        scale: _config.collisionScale || Vector3.create(1, 2, 1)
      })
      if (_config.collisionShape === 'sphere') MeshCollider.setSphere(this.collisionEntity)
      else MeshCollider.setBox(this.collisionEntity)
    }

    // Click interaction — NEEDS_TEST
    if (_config.onClick && _config.hoverText) {
      pointerEventsSystem.onPointerDown(
        { entity: this.entity, opts: { button: InputAction.IA_POINTER, hoverText: _config.hoverText } },
        () => { if (this.isEnabled && _config.onClick) _config.onClick() }
      )
    }

    // Auto-start waypoint set
    if (_config.autoStartWaypointSet) this.startWaypointSet(_config.autoStartWaypointSet)

    // Register with shared system — NEEDS_TEST
    _allInstances.push(this)
    _ensureSharedSystem()
  }

  /** @internal Called by shared system each frame */
  _update(dt: number): void {
    if (!this.isEnabled) return

    if (this.state === 'waiting') {
      this.waitTimeRemaining -= dt
      if (this.waitTimeRemaining <= 0) {
        this.state = 'idle'
        this._moveToNextWaypoint()
      }
    }

    if (this.state === 'moving' && this.currentWaypointSet) {
      const moveSpeed = this.currentWaypointSet.moveSpeed || 2.0
      this.movementProgress += dt * moveSpeed
      const distance = Vector3.distance(this.startMovePosition, this.targetMovePosition)
      if (this.movementProgress >= distance) {
        this._arriveAtWaypoint()
      } else {
        const t = this.movementProgress / Math.max(distance, 0.001)
        Transform.getMutable(this.entity).position = Vector3.lerp(this.startMovePosition, this.targetMovePosition, t)
      }
    }

    if (this.state === 'chasing' && this.chaseTarget) this._updateChase(dt)
  }

  private _updateChase(dt: number): void {
    if (!this.chaseTarget || !Transform.has(this.chaseTarget)) { this.stopChase(); return }
    const targetPos = Transform.get(this.chaseTarget).position
    const curPos = Transform.get(this.entity).position
    const dir = Vector3.subtract(targetPos, curPos)
    const dist = Vector3.length(dir)
    if (dist < 0.5) {
      if (this.config.onChaseReached) this.config.onChaseReached()
      this.stopChase()
      return
    }
    const norm = Vector3.normalize(dir)
    Transform.getMutable(this.entity).position = Vector3.add(curPos, Vector3.scale(norm, this.chaseSpeed * dt))
    const lookDir = Vector3.create(norm.x, 0, norm.z)
    if (Vector3.length(lookDir) > 0) Transform.getMutable(this.entity).rotation = Quaternion.lookRotation(lookDir)
  }

  startWaypointSet(setId: string): void {
    if (!this.config.waypointSets?.[setId]) return
    this.currentWaypointSet = this.config.waypointSets[setId]
    this.currentWaypointIndex = -1
    this._moveToNextWaypoint()
  }

  private _moveToNextWaypoint(): void {
    if (!this.currentWaypointSet) return
    this.currentWaypointIndex++
    if (this.currentWaypointIndex >= this.currentWaypointSet.waypoints.length) {
      if (this.currentWaypointSet.loopWaypoints) {
        this.currentWaypointIndex = 0
      } else {
        this.state = 'idle'
        if (this.config.soundOnWaypointComplete) this.playSound(this.config.soundOnWaypointComplete)
        if (this.currentWaypointSet.onComplete) this.currentWaypointSet.onComplete()
        return
      }
    }
    const wp = this.currentWaypointSet.waypoints[this.currentWaypointIndex]
    this.startMovePosition = Transform.get(this.entity).position
    this.targetMovePosition = wp.position
    this.movementProgress = 0
    this.state = 'moving'
    const walkAnim = this.config.animationNames?.walk
    if (walkAnim) this.playAnimation(walkAnim)
  }

  private _arriveAtWaypoint(): void {
    const wp = this.currentWaypointSet!.waypoints[this.currentWaypointIndex]
    const t = Transform.getMutable(this.entity)
    t.position = wp.position
    t.rotation = Quaternion.fromEulerDegrees(wp.rotation.x, wp.rotation.y, wp.rotation.z)
    if (wp.waitTime && wp.waitTime > 0) {
      this.state = 'waiting'
      this.waitTimeRemaining = wp.waitTime
    } else {
      this.state = 'idle'
      this._moveToNextWaypoint()
    }
    const idleAnim = this.config.animationNames?.idle
    if (idleAnim) this.playAnimation(idleAnim)
  }

  startChase(targetEntity: Entity, speed?: number): void {
    this.chaseTarget = targetEntity
    this.chaseSpeed = speed || this.config.chaseSpeed || 3.0
    this.state = 'chasing'
    if (this.config.chaseAnimation) this.playAnimation(this.config.chaseAnimation)
    if (this.config.soundOnChaseStart) this.playSound(this.config.soundOnChaseStart)
    if (this.config.onChaseStart) this.config.onChaseStart()
  }

  stopChase(): void {
    this.chaseTarget = undefined
    this.state = 'idle'
    const idleAnim = this.config.animationNames?.idle
    if (idleAnim) this.playAnimation(idleAnim)
  }

  playAnimation(name: string, resetIfSame: boolean = false): void {
    if (!this.animationConfigs.has(name)) return
    if (this.currentAnimation === name && !resetIfSame) return
    const cfg = this.animationConfigs.get(name)!
    Animator.stopAllAnimations(this.entity)
    const animator = Animator.getMutable(this.entity)
    const idx = animator.states.findIndex(s => s.clip === name)
    if (idx >= 0) {
      animator.states[idx].speed = cfg.speed
      animator.states[idx].playing = true
      animator.states[idx].weight = 1.0
      animator.states[idx].loop = cfg.loop
      animator.states.forEach((s, i) => { if (i !== idx) { s.playing = false; s.weight = 0 } })
    }
    this.currentAnimation = name
  }

  playSound(soundConfig: SoundConfig): void {
    AudioSource.createOrReplace(this.entity, {
      audioClipUrl: soundConfig.clip,
      loop: soundConfig.loop || false,
      playing: true,
      volume: soundConfig.volume || 1.0
    })
  }

  triggerSound(): void {
    if (this.config.soundOnCustom) this.playSound(this.config.soundOnCustom)
  }

  enable(): void {
    if (!this.isEnabled) { this.isEnabled = true; this.state = this.previousState }
  }

  disable(): void {
    if (this.isEnabled) { this.previousState = this.state; this.isEnabled = false; this.state = 'disabled' }
  }

  destroy(): void {
    const idx = _allInstances.indexOf(this)
    if (idx >= 0) _allInstances.splice(idx, 1)
    engine.removeEntity(this.entity)
    if (this.collisionEntity) engine.removeEntity(this.collisionEntity)
  }
}
