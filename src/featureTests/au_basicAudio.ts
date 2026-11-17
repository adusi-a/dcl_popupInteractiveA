/**
 * au_basicAudio.ts — AU1: Basic AudioSource + AU2: Spatial 3D + AU3: Ambient Zone
 * STATUS: 🟩 FULLY CODED — WAV files in assets/sounds/
 *
 * AU1 — BASIC AUDIOSOURCE
 * Proves the core AudioSource API: play/stop/loop, volume, pitch.
 * Critical finding: set playing = false THEN playing = true to restart.
 * AudioSource.getMutable(entity).playing = true starts from current position
 * if already playing; stops and restarts if was stopped. Loop + playing = true
 * creates a continuously looping sound until playing = false.
 *
 * AU2 — SPATIAL / POSITIONAL AUDIO
 * AudioSource entities are 3D positional by default (global: false).
 * DCL's audio engine automatically fades sound by distance from entity.
 * No manual volume calculation needed — just place entity in world space.
 * This confirms: sound entities placed at key world positions (fireplace,
 * machinery, NPCs) automatically provide natural 3D sound falloff.
 *
 * AU3 — AMBIENT ZONE
 * Music/ambiance plays when player enters area, stops when they leave.
 * Uses TriggerArea + AudioSource entity with loop: true.
 * Key for MonsterLibrary: library ambiance starts when entering, stops at exit.
 * Key for GhostTown: haunted music plays in specific rooms.
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  TriggerArea, triggerAreaEventsSystem, ColliderLayer, pointerEventsSystem,
  AudioSource
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: AU1 — Basic AudioSource ─────────────────────────────────────────

export function setupAUBasic(): void {
  const { x, z } = { x: 96, z: 144 }
  createStation('au1_basic', 'AU1 — AUDIOSOURCE\nPlay / stop / loop / volume', STATUS_COLOR.FULLY_CODED)

  // Create the audio entity
  const audioEntity = engine.addEntity()
  Transform.create(audioEntity, { position: Vector3.create(x, 1.5, z) })
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/sounds/beep_ui.wav',
    loop: false,
    volume: 0.8,
    playing: false,
    global: true  // global = same volume anywhere (not positional)
  })

  // Visual speaker
  const speaker = engine.addEntity()
  Transform.create(speaker, { position: Vector3.create(x, 1.5, z - 0.8), scale: Vector3.create(0.8, 0.8, 0.8) })
  MeshRenderer.setCylinder(speaker)
  Material.setPbrMaterial(speaker, { albedoColor: Color4.create(0.3, 0.3, 0.3, 1) })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '🔇 STOPPED', fontSize: 1.4, textColor: Color4.create(0.5, 0.5, 0.5, 1) })

  // Play button
  const playBtn = createButton(x - 2, 0.8, z - 3.6, '▶ Play', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: playBtn, opts: { button: 1, hoverText: '[E] Play beep' } }, () => {
    AudioSource.getMutable(audioEntity).playing = false  // reset position
    AudioSource.getMutable(audioEntity).playing = true
    AudioSource.getMutable(audioEntity).audioClipUrl = 'assets/sounds/beep_ui.wav'
    TextShape.getMutable(statusLbl).text = '🔊 PLAYING'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.3, 1, 0.5, 1)
    console.log('[AU1] Playing beep_ui.wav')
  })

  // Loop success sound
  const loopBtn = createButton(x, 0.8, z - 3.6, '🔁 Loop Hum', Color4.create(0.3, 0.3, 0.6, 1))
  pointerEventsSystem.onPointerDown({ entity: loopBtn, opts: { button: 1, hoverText: '[E] Loop ambient hum' } }, () => {
    const a = AudioSource.getMutable(audioEntity)
    a.audioClipUrl = 'assets/sounds/ambient_hum.wav'
    a.loop = true; a.playing = true
    TextShape.getMutable(statusLbl).text = '🔁 LOOPING HUM'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 0.7, 1, 1)
    console.log('[AU1] Looping ambient_hum.wav')
  })

  // Stop button
  const stopBtn = createButton(x + 2, 0.8, z - 3.6, '⏹ Stop', Color4.create(0.5, 0.2, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: stopBtn, opts: { button: 1, hoverText: '[E] Stop' } }, () => {
    const a = AudioSource.getMutable(audioEntity)
    a.playing = false; a.loop = false
    TextShape.getMutable(statusLbl).text = '🔇 STOPPED'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.5, 0.5, 0.5, 1)
    console.log('[AU1] Stopped')
  })

  // Volume buttons
  const vol50 = createButton(x - 1, 0.8, z + 3.6, 'Vol 50%', Color4.create(0.3, 0.3, 0.4, 1))
  const vol100 = createButton(x + 1, 0.8, z + 3.6, 'Vol 100%', Color4.create(0.5, 0.4, 0.2, 1))
  pointerEventsSystem.onPointerDown({ entity: vol50,  opts: { button: 1, hoverText: '[E] 50% volume' } }, () => { AudioSource.getMutable(audioEntity).volume = 0.5 })
  pointerEventsSystem.onPointerDown({ entity: vol100, opts: { button: 1, hoverText: '[E] 100% volume' } }, () => { AudioSource.getMutable(audioEntity).volume = 1.0 })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'playing=false then true → restart\nloop=true → plays until false\nglobal=true → no distance falloff',
    fontSize: 1.1, textColor: Color4.create(0.9, 1, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU1] Basic AudioSource initialized — beep_ui.wav + ambient_hum.wav')
}

// ─── Station: AU2 — Spatial / Positional Audio ────────────────────────────────

export function setupAUSpatial(): void {
  const { x, z } = { x: 108, z: 144 }
  createStation('au2_spatial', 'AU2 — SPATIAL AUDIO\n3D positional falloff', STATUS_COLOR.FULLY_CODED)

  // Three sound sources at different distances
  const sources: Array<{ pos: Vector3; clip: string; label: string; color: Color4 }> = [
    { pos: Vector3.create(x - 3.5, 1.0, z - 2), clip: 'assets/sounds/alarm.wav',        label: '🔴 ALARM\n(close, left)',  color: Color4.create(1, 0.3, 0.3, 1) },
    { pos: Vector3.create(x,       1.0, z + 3), clip: 'assets/sounds/success.wav',       label: '🟡 SUCCESS\n(far, back)',  color: Color4.create(1, 0.9, 0.2, 1) },
    { pos: Vector3.create(x + 3.5, 1.0, z - 2), clip: 'assets/sounds/ambient_hum.wav',  label: '🔵 HUM\n(close, right)', color: Color4.create(0.3, 0.6, 1, 1) },
  ]

  for (const src of sources) {
    // Visual emitter
    const emitter = engine.addEntity()
    Transform.create(emitter, { position: src.pos, scale: Vector3.create(0.6, 0.6, 0.6) })
    MeshRenderer.setCylinder(emitter)
    MeshCollider.setCylinder(emitter, ColliderLayer.CL_POINTER)
    Material.setPbrMaterial(emitter, {
      albedoColor: src.color,
      emissiveColor: { r: src.color.r * 0.4, g: src.color.g * 0.4, b: src.color.b * 0.4 }, emissiveIntensity: 0.6
    })

    // AudioSource on the emitter entity — global: false = 3D positional (default)
    AudioSource.create(emitter, {
      audioClipUrl: src.clip,
      loop: true,
      volume: 0.9,
      playing: false,
      global: false  // ← THIS MAKES IT 3D POSITIONAL
    })

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(src.pos.x, src.pos.y + 1.2, src.pos.z) }); Billboard.create(lbl, {})
    TextShape.create(lbl, { text: src.label, fontSize: 1.0, textColor: src.color })

    pointerEventsSystem.onPointerDown({ entity: emitter, opts: { button: 1, hoverText: '[E] Toggle sound' } }, () => {
      const a = AudioSource.getMutable(emitter)
      a.playing = !a.playing
      console.log(`[AU2] ${src.label.split('\n')[0]} ${a.playing ? 'ON' : 'OFF'}`)
    })
  }

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'global: false → DCL handles 3D falloff\nClick emitters to toggle them\nWalk away → gets quieter automatically',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU2] Spatial audio initialized — 3 positional sources')
}

// ─── Station: AU3 — Ambient Zone ─────────────────────────────────────────────

export function setupAUAmbientZone(): void {
  const { x, z } = { x: 120, z: 144 }
  createStation('au3_ambient', 'AU3 — AMBIENT ZONE\nEnter area → music plays', STATUS_COLOR.FULLY_CODED)

  // The ambient audio entity (global — same volume anywhere in scene)
  const ambientAudio = engine.addEntity()
  Transform.create(ambientAudio, { position: Vector3.create(x, 1, z) })
  AudioSource.create(ambientAudio, {
    audioClipUrl: 'assets/sounds/ambient_hum.wav',
    loop: true, volume: 0, playing: false, global: true
  })

  // Zone visual
  const zonePad = engine.addEntity()
  Transform.create(zonePad, { position: Vector3.create(x, 0.52, z), scale: Vector3.create(6.0, 0.08, 6.0) })
  MeshRenderer.setBox(zonePad)
  Material.setPbrMaterial(zonePad, { albedoColor: Color4.create(0.3, 0.1, 0.5, 0.4) })

  const statusLbl = engine.addEntity()
  Transform.create(statusLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '🎵 Enter zone\nto hear music', fontSize: 1.3, textColor: Color4.create(0.6, 0.4, 0.9, 1) })

  let playerInZone = false; let targetVolume = 0
  let currentVolume = 0

  // Smooth volume fade system
  engine.addSystem((dt: number) => {
    if (Math.abs(currentVolume - targetVolume) < 0.01) return
    currentVolume += Math.sign(targetVolume - currentVolume) * Math.min(Math.abs(targetVolume - currentVolume), dt * 1.5)
    AudioSource.getMutable(ambientAudio).volume = Math.max(0, currentVolume)
    if (currentVolume <= 0 && !playerInZone) {
      AudioSource.getMutable(ambientAudio).playing = false
    }
  }, 5)

  // Zone trigger
  const trigger = engine.addEntity()
  Transform.create(trigger, { position: Vector3.create(x, 1.0, z), scale: Vector3.create(6.0, 2.0, 6.0) })
  TriggerArea.setBox(trigger)

  triggerAreaEventsSystem.onTriggerEnter(trigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    playerInZone = true; targetVolume = 0.75
    AudioSource.getMutable(ambientAudio).playing = true
    Material.setPbrMaterial(zonePad, { albedoColor: Color4.create(0.5, 0.2, 0.9, 0.5), emissiveColor: { r: 0.2, g: 0, b: 0.4 }, emissiveIntensity: 0.3 })
    TextShape.getMutable(statusLbl).text = '🎵 PLAYING\n(fade in...)'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.8, 0.5, 1, 1)
    console.log('[AU3] Player entered zone — ambient music fade in')
  })
  triggerAreaEventsSystem.onTriggerExit(trigger, (r) => {
    if (r.trigger?.entity !== engine.PlayerEntity) return
    playerInZone = false; targetVolume = 0
    Material.setPbrMaterial(zonePad, { albedoColor: Color4.create(0.3, 0.1, 0.5, 0.4) })
    TextShape.getMutable(statusLbl).text = '🎵 Enter zone\nto hear music'
    TextShape.getMutable(statusLbl).textColor = Color4.create(0.6, 0.4, 0.9, 1)
    console.log('[AU3] Player left zone — ambient music fade out')
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Enter zone → volume fades in (1.5/s)\nLeave zone → volume fades out\nMonsterLib: library ambiance by floor',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU3] Ambient zone initialized — smooth fade in/out')
}
