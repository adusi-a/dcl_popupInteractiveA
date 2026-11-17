/**
 * au_reactiveAudio.ts — AU7: Zone Audio + AU8: Reactive + AU9: AudioSource Pool
 * STATUS: 🟩 FULLY CODED
 *
 * AU7 — ZONE AUDIO (floor type / area sound changes)
 * Different areas play different ambient sounds. As player moves between zones,
 * the active zone's sound plays and others fade. Classic for: dungeon room
 * transitions, terrain biomes, library floors (wood vs stone vs carpet sounds).
 *
 * AU8 — REACTIVE AUDIO (pitch/volume driven by game state)
 * A game value (tension/health/speed) drives AudioSource pitch and volume.
 * As tension rises: pitch increases, volume increases.
 * As health drops: volume decreases, pitch drops.
 * Classic for: heartbeat gets faster when low health, engine sound matches speed.
 *
 * AU9 — AUDIOSOURCE POOL (rapid-fire overlapping sounds)
 * Pre-create N AudioSource entities for one type of sound.
 * When sound plays, find a currently-not-playing entity and start it.
 * This allows the same sound to play multiple times simultaneously
 * (e.g., 3 UI beeps triggered in rapid succession all play).
 * Without pooling: setting playing=false+true restarts from beginning,
 * losing any previously-triggered overlapping instance.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem,
  AudioSource
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: AU7 — Zone Audio ────────────────────────────────────────────────

export function setupAUZoneAudio(): void {
  const { x, z } = { x: 108, z: 156 }
  createStation('au7_zone', 'AU7 — ZONE AUDIO\nDifferent sounds per area', STATUS_COLOR.FULLY_CODED)

  // Three floor zone areas with different ambient sounds
  const zones: Array<{
    color: Color4; label: string; clip: string; volume: number
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  }> = [
    { color: Color4.create(0.5, 0.35, 0.2, 0.7), label: '🪵 WOOD FLOOR\nCreaky hum', clip: 'assets/sounds/ambient_hum.wav', volume: 0.5,
      bounds: { minX: x - 4, maxX: x - 1.5, minZ: z - 2, maxZ: z + 2 } },
    { color: Color4.create(0.5, 0.5, 0.5, 0.7), label: '🪨 STONE FLOOR\nSilent', clip: 'assets/sounds/beep_ui.wav', volume: 0.0,
      bounds: { minX: x - 1.5, maxX: x + 1.5, minZ: z - 2, maxZ: z + 2 } },
    { color: Color4.create(0.6, 0.35, 0.6, 0.7), label: '🟣 CARPET ZONE\nTension rise', clip: 'assets/sounds/tension_rise.wav', volume: 0.4,
      bounds: { minX: x + 1.5, maxX: x + 4, minZ: z - 2, maxZ: z + 2 } },
  ]

  // Audio entities for each zone
  const zoneAudio: ReturnType<typeof engine.addEntity>[] = []
  for (const zone of zones) {
    const ae = engine.addEntity()
    Transform.create(ae, { position: Vector3.create((zone.bounds.minX + zone.bounds.maxX) / 2, 1, (zone.bounds.minZ + zone.bounds.maxZ) / 2) })
    AudioSource.create(ae, { audioClipUrl: zone.clip, loop: true, volume: 0, playing: false, global: true })
    zoneAudio.push(ae)

    // Floor visual
    const floor = engine.addEntity()
    Transform.create(floor, {
      position: Vector3.create((zone.bounds.minX + zone.bounds.maxX) / 2, 0.52, (zone.bounds.minZ + zone.bounds.maxZ) / 2),
      scale: Vector3.create(zone.bounds.maxX - zone.bounds.minX, 0.08, zone.bounds.maxZ - zone.bounds.minZ)
    })
    MeshRenderer.setBox(floor)
    Material.setPbrMaterial(floor, { albedoColor: zone.color })

    const floorLbl = engine.addEntity()
    Transform.create(floorLbl, { position: Vector3.create((zone.bounds.minX + zone.bounds.maxX) / 2, 0.75, (zone.bounds.minZ + zone.bounds.maxZ) / 2) })
    Billboard.create(floorLbl, {})
    TextShape.create(floorLbl, { text: zone.label, fontSize: 1.0, textColor: Color4.White() })
  }

  // Track which zone player is in and smoothly transition
  let activeZoneIdx = -1
  const FADE_SPEED = 2.0

  engine.addSystem((_dt: number) => {
    const pT = Transform.getOrNull(engine.PlayerEntity)
    if (!pT) return
    const px = pT.position.x; const pz = pT.position.z

    let newZone = -1
    for (let i = 0; i < zones.length; i++) {
      const b = zones[i].bounds
      if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) { newZone = i; break }
    }

    if (newZone !== activeZoneIdx) {
      activeZoneIdx = newZone
      console.log(`[AU7] Zone → ${newZone >= 0 ? zones[newZone].label.split('\n')[0] : 'none'}`)
    }
  }, 10)

  // Volume fade system
  engine.addSystem((dt: number) => {
    for (let i = 0; i < zones.length; i++) {
      const target = i === activeZoneIdx ? zones[i].volume : 0
      const a = AudioSource.getMutableOrNull(zoneAudio[i])
      if (!a) continue
      if (target > 0 && !a.playing) a.playing = true
      const curVol = a.volume ?? 0
      const diff = target - curVol
      if (Math.abs(diff) > 0.01) {
        a.volume = Math.max(0, Math.min(1, curVol + Math.sign(diff) * FADE_SPEED * dt))
      } else {
        a.volume = target
        if (target <= 0 && a.playing) a.playing = false
      }
    }
  }, 11)

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Walk between floor zones → audio changes\nSmooth fade between active zones\nML: library sections have different sounds',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU7] Zone audio initialized — 3 floor areas with different sounds')
}

// ─── Station: AU8 — Reactive Audio ────────────────────────────────────────────

export function setupAUReactive(): void {
  const { x, z } = { x: 120, z: 156 }
  createStation('au8_reactive', 'AU8 — REACTIVE AUDIO\nPitch/volume driven by value', STATUS_COLOR.FULLY_CODED)

  let tensionValue = 0  // 0 = calm, 1 = max tension

  const audioEntity = engine.addEntity()
  Transform.create(audioEntity, { position: Vector3.create(x, 1, z) })
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/sounds/tension_rise.wav',
    loop: true, volume: 0, playing: true, global: true,
    pitch: 0.5
  })

  // Visual tension meter
  const meterBg = engine.addEntity()
  Transform.create(meterBg, { position: Vector3.create(x, 1.5, z - 0.1), scale: Vector3.create(4.0, 0.3, 0.1) })
  MeshRenderer.setBox(meterBg)
  Material.setPbrMaterial(meterBg, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

  const meterFg = engine.addEntity()
  Transform.create(meterFg, { position: Vector3.create(x - 2.0, 1.5, z - 0.08), scale: Vector3.create(0, 0.25, 0.08) })
  MeshRenderer.setBox(meterFg)
  Material.setPbrMaterial(meterFg, { albedoColor: Color4.create(0.3, 0.9, 0.3, 1) })

  const valueLbl = engine.addEntity()
  Transform.create(valueLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(valueLbl, {})
  TextShape.create(valueLbl, { text: 'Tension: 0%\nPitch: 0.5\nVol: 0', fontSize: 1.3, textColor: Color4.create(0.3, 0.9, 0.5, 1) })

  function setTension(value: number): void {
    tensionValue = Math.max(0, Math.min(1, value))
    // Reactive: pitch and volume scale with tension
    const pitch  = 0.5 + tensionValue * 1.5  // 0.5 to 2.0
    const vol    = tensionValue * 0.8          // 0 to 0.8

    const a = AudioSource.getMutable(audioEntity)
    a.volume = vol; a.pitch = pitch

    // Meter update
    const mW = tensionValue * 4.0
    Transform.getMutable(meterFg).scale   = Vector3.create(mW, 0.25, 0.08)
    Transform.getMutable(meterFg).position = Vector3.create(x - 2.0 + mW / 2, 1.5, z - 0.08)

    const r = tensionValue; const g = 1 - tensionValue
    Material.setPbrMaterial(meterFg, { albedoColor: Color4.create(r, g, 0, 1) })

    TextShape.getMutable(valueLbl).text = `Tension: ${Math.round(tensionValue * 100)}%\nPitch: ${pitch.toFixed(2)}\nVol: ${vol.toFixed(2)}`
    TextShape.getMutable(valueLbl).textColor = Color4.create(0.3 + r * 0.7, 0.9 - r * 0.7, 0.3, 1)
  }

  // Tension buttons
  const btn0   = createButton(x - 3,   0.8, z - 3.6, '😴 0%',   Color4.create(0.3, 0.6, 0.3, 1))
  const btn25  = createButton(x - 1,   0.8, z - 3.6, '😐 25%',  Color4.create(0.5, 0.5, 0.2, 1))
  const btn75  = createButton(x + 1,   0.8, z - 3.6, '😨 75%',  Color4.create(0.7, 0.3, 0.1, 1))
  const btn100 = createButton(x + 3,   0.8, z - 3.6, '😱 MAX',  Color4.create(0.8, 0.1, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: btn0,   opts: { button: 1, hoverText: '[E] 0% tension' } },   () => setTension(0))
  pointerEventsSystem.onPointerDown({ entity: btn25,  opts: { button: 1, hoverText: '[E] 25% tension' } },  () => setTension(0.25))
  pointerEventsSystem.onPointerDown({ entity: btn75,  opts: { button: 1, hoverText: '[E] 75% tension' } },  () => setTension(0.75))
  pointerEventsSystem.onPointerDown({ entity: btn100, opts: { button: 1, hoverText: '[E] MAX tension' } },  () => setTension(1.0))

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'pitch = 0.5 + tension × 1.5\nvolume = tension × 0.8\nML: speed up when chase starts',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.8, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU8] Reactive audio initialized — tension drives pitch/volume')
}

// ─── Station: AU9 — AudioSource Pool ─────────────────────────────────────────

export function setupAUPool(): void {
  const { x, z } = { x: 132, z: 156 }
  createStation('au9_pool', 'AU9 — AUDIO POOL\nOverlapping rapid-fire sounds', STATUS_COLOR.FULLY_CODED)

  const POOL_SIZE = 6

  // Create pool of audio entities
  const pool: ReturnType<typeof engine.addEntity>[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(x, 1, z) })
    AudioSource.create(e, {
      audioClipUrl: 'assets/sounds/beep_ui.wav',
      loop: false, volume: 0.6, playing: false, global: true
    })
    pool.push(e)
  }

  // Pool index visualization
  const poolVisuals: ReturnType<typeof engine.addEntity>[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const pv = engine.addEntity()
    Transform.create(pv, { position: Vector3.create(x - 2.5 + i * 1.0, 1.0, z - 0.5), scale: Vector3.create(0.8, 0.8, 0.8) })
    MeshRenderer.setBox(pv)
    Material.setPbrMaterial(pv, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
    poolVisuals.push(pv)
  }

  let fireCount = 0
  // Time-based slot tracking: AudioSource.playing doesn't update after clip ends,
  // so track when each slot was last fired and release after estimated clip duration
  const CLIP_DURATION = 0.5  // conservative estimate for beep_ui.wav (~0.3s)
  const slotFiredAt = new Array(POOL_SIZE).fill(-999)  // seconds, initialized to 'never fired'
  let poolTime = 0
  engine.addSystem((dt: number) => { poolTime += dt }, 1)

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: `Pool: ${POOL_SIZE} slots\nFired: 0`, fontSize: 1.3, textColor: Color4.White() })

  function playFromPool(): void {
    // Find next available slot using time-based tracking (not AudioSource.playing which doesn't auto-reset)
    let slotIdx = -1
    for (let i = 0; i < POOL_SIZE; i++) {
      if (poolTime - slotFiredAt[i] >= CLIP_DURATION) { slotIdx = i; break }
    }

    if (slotIdx < 0) {
      console.log('[AU9] All pool slots busy — sound dropped')
      return
    }

    fireCount++
    slotFiredAt[slotIdx] = poolTime
    const a = AudioSource.getMutable(pool[slotIdx])
    a.playing = false; a.playing = true  // restart

    // Flash the visual for CLIP_DURATION to show when slot is busy
    Material.setPbrMaterial(poolVisuals[slotIdx], { albedoColor: Color4.create(0.3, 0.9, 1, 1), emissiveColor: { r: 0.1, g: 0.4, b: 0.5 }, emissiveIntensity: 1 })
    let flashT = CLIP_DURATION
    let flashDone = false
    engine.addSystem((dt: number) => {
      if (flashDone) return
      flashT -= dt
      if (flashT <= 0) {
        flashDone = true
        Material.setPbrMaterial(poolVisuals[slotIdx], { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })
      }
    }, 5)

    TextShape.getMutable(statusLbl).text = `Pool: ${POOL_SIZE} slots\nFired: ${fireCount}\nUsed slot: ${slotIdx + 1}`
    console.log(`[AU9] Pool fire #${fireCount} → slot ${slotIdx + 1}`)
  }

  // Single play button
  const playBtn = createButton(x - 1, 0.8, z - 3.6, '▶ Play 1', Color4.create(0.3, 0.5, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: playBtn, opts: { button: 1, hoverText: '[E] Play once' } }, playFromPool)

  // Rapid burst button (plays 3 in quick succession)
  // Note: engine.addSystem() returns void in SDK 7.33, so removeSystem can't use the return value.
  // Use a fired-once flag instead to prevent the system from repeating indefinitely.
  const burstBtn = createButton(x + 1, 0.8, z - 3.6, '⚡ Burst ×3', Color4.create(0.5, 0.3, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: burstBtn, opts: { button: 1, hoverText: '[E] Burst 3 sounds' } }, () => {
    playFromPool()
    let t = 0.1; let f1 = false
    engine.addSystem((dt: number) => { if (f1) return; t -= dt; if (t <= 0) { f1 = true; playFromPool() } }, 5)
    let t2 = 0.2; let f2 = false
    engine.addSystem((dt: number) => { if (f2) return; t2 -= dt; if (t2 <= 0) { f2 = true; playFromPool() } }, 5)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: `Pool of ${POOL_SIZE} AudioSource entities\nFind unused slot → play on it\nAllows overlapping identical sounds`,
    fontSize: 1.1, textColor: Color4.create(0.7, 1, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log(`[AU9] AudioSource pool initialized — ${POOL_SIZE} slots, rapid-fire overlapping`)
}
