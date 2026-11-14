/**
 * au_advancedAudio.ts — AU4: State Machine Audio + AU5: Layered + AU6: Crossfade
 * STATUS: 🟩 FULLY CODED
 *
 * AU4 — SOUND STATE MACHINE
 * Entity plays a different sound based on its current state.
 * idle: soft hum | alert: beep | alarm: alarm klaxon
 * The state machine pattern combines the EV state machine with AudioSource.
 * Each state transition stops the old sound and starts the new one.
 *
 * AU5 — LAYERED AUDIO (STACKED SOURCES)
 * Multiple AudioSource entities playing simultaneously on a single conceptual
 * "sound event". Useful for: rain + thunder + wind, engine + exhaust + vibration,
 * ghost moan + creak + footsteps — rich layered atmospheres.
 *
 * AU6 — CROSSFADE / MUSIC TRANSITION
 * Smoothly fade one track out while fading another in.
 * The source track goes volume 1→0 over N seconds.
 * The target track starts at volume 0 and goes 0→1 over N seconds.
 * Result: seamless music transition. Used for: area transitions, day/night,
 * tension escalation, boss fight music swap.
 */

import {
  engine, Transform, MeshRenderer, Material, TextShape, Billboard,
  pointerEventsSystem, AudioSource
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// ─── Station: AU4 — Sound State Machine ───────────────────────────────────────

type SoundState = 'idle' | 'alert' | 'alarm'

interface SoundStateMachine {
  entity:   ReturnType<typeof engine.addEntity>
  state:    SoundState
  clips:    Record<SoundState, string>
  volumes:  Record<SoundState, number>
  loops:    Record<SoundState, boolean>
}

export function setupAUSoundState(): void {
  const { x, z } = { x: 132, z: 144 }
  createStation('au4_state', 'AU4 — SOUND STATE MACHINE\nidle / alert / alarm sounds', STATUS_COLOR.FULLY_CODED)

  const audioEntity = engine.addEntity()
  Transform.create(audioEntity, { position: Vector3.create(x, 1, z) })
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/sounds/ambient_hum.wav',
    loop: true, volume: 0.4, playing: true, global: true
  })

  const ssm: SoundStateMachine = {
    entity: audioEntity,
    state: 'idle',
    clips:   { idle: 'assets/sounds/ambient_hum.wav', alert: 'assets/sounds/beep_ui.wav', alarm: 'assets/sounds/alarm.wav' },
    volumes: { idle: 0.4, alert: 0.7, alarm: 0.9 },
    loops:   { idle: true, alert: true, alarm: true }
  }

  // State indicator
  const stateIndicator = engine.addEntity()
  Transform.create(stateIndicator, { position: Vector3.create(x, 1.5, z - 0.8), scale: Vector3.create(0.8, 0.8, 0.8) })
  MeshRenderer.setCylinder(stateIndicator)
  Material.setPbrMaterial(stateIndicator, { albedoColor: Color4.create(0.3, 0.9, 0.3, 1), emissiveColor: { r: 0, g: 0.4, b: 0 }, emissiveIntensity: 0.8 })

  const stateLbl = engine.addEntity()
  Transform.create(stateLbl, { position: Vector3.create(x, 2.8, z) }); Billboard.create(stateLbl, {})
  TextShape.create(stateLbl, { text: '😴 IDLE\n(hum playing)', fontSize: 1.4, textColor: Color4.create(0.3, 1, 0.5, 1) })

  function transitionTo(newState: SoundState): void {
    ssm.state = newState
    const a = AudioSource.getMutable(ssm.entity)
    a.playing = false
    a.audioClipUrl = ssm.clips[newState]
    a.volume = ssm.volumes[newState]
    a.loop   = ssm.loops[newState]
    a.playing = true

    const colors: Record<SoundState, Color4> = {
      idle:  Color4.create(0.3, 0.9, 0.3, 1),
      alert: Color4.create(1, 0.9, 0.2, 1),
      alarm: Color4.create(1, 0.2, 0.2, 1)
    }
    const labels: Record<SoundState, string> = {
      idle:  '😴 IDLE\n(hum playing)',
      alert: '⚠ ALERT\n(beeping)',
      alarm: '🚨 ALARM\n(alarm!)'
    }
    const emissives: Record<SoundState, {r:number,g:number,b:number}> = {
      idle:  {r:0,g:0.4,b:0},
      alert: {r:0.5,g:0.4,b:0},
      alarm: {r:0.8,g:0,b:0}
    }
    Material.setPbrMaterial(stateIndicator, { albedoColor: colors[newState], emissiveColor: emissives[newState], emissiveIntensity: 1.2 })
    TextShape.getMutable(stateLbl).text = labels[newState]
    TextShape.getMutable(stateLbl).textColor = colors[newState]
    console.log(`[AU4] State → ${newState}`)
  }

  const idleBtn  = createButton(x - 2, 0.8, z - 3.6, '😴 IDLE',  Color4.create(0.3, 0.5, 0.3, 1))
  const alertBtn = createButton(x,     0.8, z - 3.6, '⚠ ALERT', Color4.create(0.5, 0.4, 0.1, 1))
  const alarmBtn = createButton(x + 2, 0.8, z - 3.6, '🚨 ALARM', Color4.create(0.6, 0.1, 0.1, 1))
  pointerEventsSystem.onPointerDown({ entity: idleBtn,  opts: { button: 1, hoverText: '[E] Idle state' } },  () => transitionTo('idle'))
  pointerEventsSystem.onPointerDown({ entity: alertBtn, opts: { button: 1, hoverText: '[E] Alert state' } }, () => transitionTo('alert'))
  pointerEventsSystem.onPointerDown({ entity: alarmBtn, opts: { button: 1, hoverText: '[E] Alarm state' } }, () => transitionTo('alarm'))

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'playing=false → swap clip → playing=true\nEach state: different clip/volume/loop\nML: library calm / ghost alert / chaos',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.8, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU4] Sound state machine initialized — idle/alert/alarm')
}

// ─── Station: AU5 — Layered Audio ─────────────────────────────────────────────

export function setupAULayered(): void {
  const { x, z } = { x: 144, z: 144 }
  createStation('au5_layered', 'AU5 — LAYERED AUDIO\nMultiple simultaneous sources', STATUS_COLOR.FULLY_CODED)

  // Three audio layers
  const layers = [
    { clip: 'assets/sounds/ambient_hum.wav', label: 'Layer 1\nDrone (60Hz)', volume: 0.5, color: Color4.create(0.3, 0.6, 1, 1) },
    { clip: 'assets/sounds/beep_ui.wav',     label: 'Layer 2\nBeep tone',    volume: 0.4, color: Color4.create(1, 0.9, 0.2, 1) },
    { clip: 'assets/sounds/alarm.wav',       label: 'Layer 3\nAlarm',        volume: 0.3, color: Color4.create(1, 0.3, 0.3, 1) },
  ]
  const layerEntities: ReturnType<typeof engine.addEntity>[] = []
  const layerActive: boolean[] = [false, false, false]

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const lx = x - 2.0 + i * 2.0

    const entity = engine.addEntity()
    Transform.create(entity, { position: Vector3.create(lx, 1, z) })
    AudioSource.create(entity, {
      audioClipUrl: layer.clip,
      loop: true, volume: 0, playing: false, global: true
    })
    layerEntities.push(entity)

    // Visual toggle button (box that shows active state)
    const toggle = engine.addEntity()
    Transform.create(toggle, { position: Vector3.create(lx, 1.2, z - 0.8), scale: Vector3.create(1.5, 1.5, 0.5) })
    MeshRenderer.setBox(toggle)
    Material.setPbrMaterial(toggle, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

    const tLbl = engine.addEntity()
    Transform.create(tLbl, { position: Vector3.create(lx, 2.5, z - 0.8) }); Billboard.create(tLbl, {})
    TextShape.create(tLbl, { text: layer.label + '\n○ OFF', fontSize: 0.9, textColor: layer.color })

    const idx = i; const vol = layer.volume; const c = layer.color; const tl = tLbl; const te = toggle
    pointerEventsSystem.onPointerDown({ entity: toggle, opts: { button: 1, hoverText: `[E] Toggle Layer ${i + 1}` } }, () => {
      layerActive[idx] = !layerActive[idx]
      const a = AudioSource.getMutable(layerEntities[idx])
      a.volume  = layerActive[idx] ? vol : 0
      a.playing = layerActive[idx]
      Material.setPbrMaterial(te, {
        albedoColor: layerActive[idx] ? c : Color4.create(0.2, 0.2, 0.2, 1),
        emissiveColor: layerActive[idx] ? { r: c.r * 0.4, g: c.g * 0.4, b: c.b * 0.4 } : { r: 0, g: 0, b: 0 },
        emissiveIntensity: layerActive[idx] ? 0.8 : 0
      })
      TextShape.getMutable(tl).text = layers[idx].label + `\n${layerActive[idx] ? '● ON' : '○ OFF'}`
      console.log(`[AU5] Layer ${idx + 1}: ${layerActive[idx] ? 'ON' : 'OFF'}`)
    })
  }

  const allBtn = createButton(x, 0.8, z - 3.6, '▶ All Layers', Color4.create(0.4, 0.4, 0.4, 1))
  pointerEventsSystem.onPointerDown({ entity: allBtn, opts: { button: 1, hoverText: '[E] Enable all layers' } }, () => {
    for (let i = 0; i < 3; i++) {
      layerActive[i] = true
      AudioSource.getMutable(layerEntities[i]).volume  = layers[i].volume
      AudioSource.getMutable(layerEntities[i]).playing = true
      console.log(`[AU5] Layer ${i + 1} ON`)
    }
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'N AudioSource entities = N simultaneous sounds\nToggle layers independently\nML: ghost moan + creak + footsteps',
    fontSize: 1.1, textColor: Color4.create(0.8, 1, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU5] Layered audio initialized — 3 independent layers')
}

// ─── Station: AU6 — Crossfade / Music Transition ──────────────────────────────

export function setupAUCrossfade(): void {
  const { x, z } = { x: 96, z: 156 }
  createStation('au6_crossfade', 'AU6 — CROSSFADE\nSmooth track transition', STATUS_COLOR.FULLY_CODED)

  // Track A (currently playing)
  const trackA = engine.addEntity()
  Transform.create(trackA, { position: Vector3.create(x, 1, z) })
  AudioSource.create(trackA, {
    audioClipUrl: 'assets/sounds/ambient_hum.wav',
    loop: true, volume: 0.7, playing: true, global: true
  })

  // Track B (starts silent)
  const trackB = engine.addEntity()
  Transform.create(trackB, { position: Vector3.create(x, 1, z) })
  AudioSource.create(trackB, {
    audioClipUrl: 'assets/sounds/tension_rise.wav',
    loop: true, volume: 0, playing: false, global: true
  })

  let currentlyA = true
  let fadeActive  = false
  let fadeTimer   = 0
  const FADE_TIME = 2.5

  const displayLbl = engine.addEntity()
  Transform.create(displayLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(displayLbl, {})
  TextShape.create(displayLbl, { text: '🎵 Track A\n(ambient hum)', fontSize: 1.4, textColor: Color4.create(0.3, 0.6, 1, 1) })

  const fadeBar = engine.addEntity()
  Transform.create(fadeBar, { position: Vector3.create(x, 1.0, z - 0.1), scale: Vector3.create(0, 0.25, 0.1) })
  MeshRenderer.setBox(fadeBar)
  Material.setPbrMaterial(fadeBar, { albedoColor: Color4.create(0.5, 0.3, 0.9, 1) })

  const fadeBg = engine.addEntity()
  Transform.create(fadeBg, { position: Vector3.create(x, 1.0, z - 0.05), scale: Vector3.create(3.5, 0.2, 0.08) })
  MeshRenderer.setBox(fadeBg)
  Material.setPbrMaterial(fadeBg, { albedoColor: Color4.create(0.2, 0.2, 0.2, 1) })

  engine.addSystem((dt: number) => {
    if (!fadeActive) return
    fadeTimer += dt
    const frac = Math.min(fadeTimer / FADE_TIME, 1)
    Transform.getMutable(fadeBar).scale = Vector3.create(3.5 * frac, 0.2, 0.08)

    if (currentlyA) {
      // Fading A out, B in
      AudioSource.getMutable(trackA).volume = 0.7 * (1 - frac)
      const bA = AudioSource.getMutable(trackB)
      if (!bA.playing) { bA.playing = true }
      bA.volume = 0.7 * frac
    } else {
      AudioSource.getMutable(trackB).volume = 0.7 * (1 - frac)
      const aA = AudioSource.getMutable(trackA)
      if (!aA.playing) { aA.playing = true }
      aA.volume = 0.7 * frac
    }

    if (frac >= 1) {
      fadeActive = false; fadeTimer = 0
      currentlyA = !currentlyA
      // Stop the faded-out track
      if (currentlyA) { AudioSource.getMutable(trackB).playing = false; AudioSource.getMutable(trackB).volume = 0 }
      else             { AudioSource.getMutable(trackA).playing = false; AudioSource.getMutable(trackA).volume = 0 }

      TextShape.getMutable(displayLbl).text = currentlyA ? '🎵 Track A\n(ambient hum)' : '🎵 Track B\n(tension rise)'
      TextShape.getMutable(displayLbl).textColor = currentlyA ? Color4.create(0.3, 0.6, 1, 1) : Color4.create(0.9, 0.5, 1, 1)
      Transform.getMutable(fadeBar).scale = Vector3.create(0, 0.2, 0.08)
      console.log(`[AU6] Crossfade complete → Track ${currentlyA ? 'A' : 'B'}`)
    }
  }, 5)

  const crossBtn = createButton(x, 0.8, z - 3.6, '⟷ CROSSFADE', Color4.create(0.5, 0.3, 0.7, 1))
  pointerEventsSystem.onPointerDown({ entity: crossBtn, opts: { button: 1, hoverText: '[E] Crossfade to other track' } }, () => {
    if (fadeActive) return
    fadeActive = true; fadeTimer = 0
    TextShape.getMutable(displayLbl).text = '⟷ Fading...'
    TextShape.getMutable(displayLbl).textColor = Color4.create(0.7, 0.5, 1, 1)
    console.log(`[AU6] Starting crossfade A→B over ${FADE_TIME}s`)
  })

  const info = engine.addEntity()
  Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'trackA.volume 1→0, trackB.volume 0→1\nSmooth over 2.5s\nML: tension music when ghost appears',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[AU6] Crossfade initialized — Track A⟷B over 2.5s')
}
