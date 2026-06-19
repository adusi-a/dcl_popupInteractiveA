/**
 * @file audioAnalysis.ts
 * @module DN DCL Framework / utils
 * @version 0.0002
 * @status CONFIRMED ✅ (tested June 2026, thereisnospoon.dcl.eth local preview)
 *
 * AudioAnalysis helper for music-reactive DCL scenes.
 *
 * CONFIRMED (June 2026 live test):
 *   - AudioAnalysis component reads real-time amplitude + 8 frequency bands ✅
 *   - bands[] update every frame with non-zero values when audio is playing ✅
 *   - Unity Explorer only — Bevy/Godot ignore AudioAnalysis silently ✅ (known)
 *   - AudioSource on engine.RootEntity = global (non-positional) audio ✅
 *   - AudioSource on a positioned entity = spatial (distance falloff) audio ✅
 *   - Both AudioSource and AudioAnalysis must be on the SAME entity ✅
 *
 * REAL-WORLD TUNING VALUES (confirmed from test track):
 *   - Typical amplitude range: 0.008–0.015 (quiet music), 0.1–0.3 (punchy)
 *   - Typical bass range: 0.05–0.10 for average music tracks
 *   - Bass threshold 0.5 is too high for most tracks — use 0.05–0.10
 *   - For visible scale pulse: multiply amplitude × 80 (not × 8)
 *   - MODE_LOGARITHMIC recommended — better perceptual spread across bands
 *
 * TWO PATTERNS — choose based on use case:
 *
 *   Pattern A — Global music (same volume everywhere, for music-sync scenes):
 *     Use createGlobalMusicAnalyzer(). AudioSource + AudioAnalysis on engine.RootEntity.
 *     No distance falloff. Volume is consistent regardless of player position.
 *
 *   Pattern B — Positional audio (volume falls off with distance, for sound effects):
 *     Use createPositionalMusicAnalyzer(entity). AudioSource + AudioAnalysis on a
 *     positioned entity. Player proximity changes perceived volume AND analysis amplitude.
 *     Useful for: proximity-reactive objects, interactive sound installations.
 *
 * UNITY EXPLORER ONLY:
 *   AudioAnalysis is silently ignored in Bevy/Godot clients.
 *   Always design a fallback (base scale / static color) for non-Unity users.
 *
 * SOURCE: OpenDCL audio-analysis skill + confirmed DusNufus studio test (June 2026)
 *
 * Band layout (MODE_LOGARITHMIC):
 *   bands[0] = sub-bass     (kick drum, bass guitar fundamentals)
 *   bands[1] = bass         (bass guitar, low synths)
 *   bands[2] = low-mid      (guitar body, lower vocals)
 *   bands[3] = mid          (vocals, snare, guitar lead)
 *   bands[4] = upper-mid    (presence, attack transients)
 *   bands[5] = presence     (hi-hat, sibilance)
 *   bands[6] = brilliance   (cymbals, air, shimmer)
 *   bands[7] = treble/air   (very high freq sparkle)
 *
 * @changelog
 *   0.0001 - Initial implementation based on OpenDCL audio-analysis skill.
 *   0.0002 - CONFIRMED working. Added createGlobalMusicAnalyzer() + createPositionalMusicAnalyzer()
 *            helpers. Added real-world tuning values. Promoted to CONFIRMED.
 *            Entity type fix (number → Entity). June 2026.
 */

import {
  engine, AudioAnalysis, AudioAnalysisView, PBAudioAnalysisMode,
  AudioSource, Transform, Entity
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AudioReactiveConfig {
  /** Entity with AudioSource/AudioStream/VideoPlayer to analyze */
  audioEntity: Entity
  /** Analysis mode (default: MODE_LOGARITHMIC — recommended for visualizers) */
  mode?: PBAudioAnalysisMode
  /** Amplitude gain multiplier (default 5.0 per SDK) */
  amplitudeGain?: number
  /** Bands gain multiplier (default 0.05 per SDK) */
  bandsGain?: number
}

// ─── Convenience Factories ─────────────────────────────────────────────────

/**
 * Pattern A — Global (non-positional) music analyzer. ✅ CONFIRMED
 *
 * Creates AudioSource + AudioAnalysis both on engine.RootEntity.
 * Audio plays at consistent volume everywhere in the scene (no distance falloff).
 * Use for: background music, music-synced lights/effects, ambient sound.
 *
 * @param audioClipUrl  Scene-bundled audio path (e.g. 'assets/sounds/music.mp3')
 * @param volume        Volume 0–1 (default 0.8)
 * @param loop          Loop the track (default true)
 *
 * @example
 *   const analyzer = createGlobalMusicAnalyzer('assets/sounds/music.mp3')
 *   engine.addSystem(() => {
 *     analyzer.update()
 *     const s = 1 + analyzer.getAmplitude() * 80  // sensitivity 80 for typical music
 *     Transform.getMutable(pulseCube).scale = Vector3.create(s, s, s)
 *   })
 */
export function createGlobalMusicAnalyzer(
  audioClipUrl: string,
  volume: number = 0.8,
  loop: boolean = true
): AudioAnalysisManager {
  AudioSource.create(engine.RootEntity, { audioClipUrl, loop, playing: true, volume })
  return new AudioAnalysisManager({ audioEntity: engine.RootEntity })
}

/**
 * Pattern B — Positional (distance-based) music/sound analyzer. ✅ CONFIRMED
 *
 * Creates AudioSource + AudioAnalysis on a caller-provided entity that has a Transform.
 * Volume AND analysis amplitude both fall off with player distance.
 * Use for: proximity-reactive objects, sound installations, interactive speakers.
 *
 * NOTE: The amplitude values will be lower when the player is far from the entity.
 * This can be used intentionally to create proximity-based reactive effects.
 *
 * @param entity        Entity with a Transform at the sound's world position
 * @param audioClipUrl  Scene-bundled audio path
 * @param volume        Volume 0–1 (default 0.8)
 * @param loop          Loop the track (default true)
 *
 * @example
 *   const speaker = engine.addEntity()
 *   Transform.create(speaker, { position: Vector3.create(8, 1, 8) })
 *   const analyzer = createPositionalMusicAnalyzer(speaker, 'assets/sounds/loop.mp3')
 */
export function createPositionalMusicAnalyzer(
  entity: Entity,
  audioClipUrl: string,
  volume: number = 0.8,
  loop: boolean = true
): AudioAnalysisManager {
  AudioSource.create(entity, { audioClipUrl, loop, playing: true, volume })
  return new AudioAnalysisManager({ audioEntity: entity })
}

// ─── AudioAnalysisManager ──────────────────────────────────────────────────

/**
 * AudioAnalysisManager — reads per-frame band/amplitude data from an audio entity.
 * Works with any entity that has AudioSource/AudioStream/VideoPlayer.
 * Use the factory functions above for the two common patterns.
 *
 * ✅ CONFIRMED working (June 2026 test).
 */
export class AudioAnalysisManager {

  audioEntity: Entity
  view: AudioAnalysisView
  amplitude: number = 0

  constructor(config: AudioReactiveConfig) {
    this.audioEntity = config.audioEntity
    this.view = { amplitude: 0, bands: new Array<number>(8).fill(0) }
    AudioAnalysis.createAudioAnalysis(
      this.audioEntity,
      config.mode ?? PBAudioAnalysisMode.MODE_LOGARITHMIC,
      config.amplitudeGain,
      config.bandsGain
    )
  }

  /** Read latest frame data. Call once per system tick. */
  update(): void {
    if (!AudioAnalysis.tryReadIntoView(this.audioEntity, this.view)) return
    this.amplitude = this.view.amplitude
  }

  /** Overall loudness (0..~1, may exceed 1 with high gains) */
  getAmplitude(): number { return this.amplitude }

  /** Sub-bass + bass combined (bands[0]+[1]) — good for kick/beat detection */
  getBass(): number { return (this.view.bands[0] ?? 0) + (this.view.bands[1] ?? 0) }

  /** Mid range (bands[3]+[4]) — vocals, snare */
  getMid(): number { return (this.view.bands[3] ?? 0) + (this.view.bands[4] ?? 0) }

  /** High frequency (bands[6]+[7]) — cymbals, shimmer */
  getTreble(): number { return (this.view.bands[6] ?? 0) + (this.view.bands[7] ?? 0) }

  /** Raw band value by index (0–7) */
  getBand(index: number): number { return this.view.bands[index] ?? 0 }

  /**
   * Simple beat/bass detection.
   * TUNING: For typical music, threshold 0.05–0.10 works well.
   * 0.5 is too high for most tracks (real bass peaks ~0.06–0.10).
   */
  isBassHit(threshold: number = 0.07): boolean {
    return this.getBass() > threshold
  }
}

// ─── Standalone Helpers ────────────────────────────────────────────────────

/**
 * Drive an entity's uniform scale from audio amplitude.
 * Sensitivity 80 recommended for typical music (amplitude ~0.01).
 * Higher sensitivity = more dramatic pulse effect.
 */
export function driveScaleFromAmplitude(
  entity: Entity,
  analyzer: AudioAnalysisManager,
  baseScale: number = 1.0,
  sensitivity: number = 80
): void {
  const s = Math.max(0.1, baseScale + analyzer.getAmplitude() * sensitivity)
  Transform.getMutable(entity).scale = Vector3.create(s, s, s)
}
