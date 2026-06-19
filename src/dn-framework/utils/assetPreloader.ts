/**
 * @file assetPreloader.ts
 * @module DN DCL Framework / utils
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Asset preloading utility using DCL SDK7 AssetLoad component.
 *
 * NEEDS_TEST:
 *   - AssetLoad component from @dcl/sdk/ecs — found in Foundation example repos (NFT Museum)
 *     but not yet tested in a DusNufus scene. Verify it eliminates "first sound never fires".
 *   - Test: call preloadAssets() in GameManager constructor with all sounds + models
 *     that are not used immediately (on-demand audio, click-triggered video etc.)
 *   - Test: does preloading a GLB also preload its textures/animations?
 *   - Test: behavior on external URLs (Foundation notes: only works for scene-bundled files)
 *   - ONLY works for scene-bundled files — NOT external URLs
 *
 * WHY THIS MATTERS:
 *   Without preloading, triggered sounds/video have a 1-3 second download delay on first play.
 *   This is the root cause of "first sound never fires" behavior across all DCL scenes.
 *   Critical for music-synced lights/sounds builds.
 *
 * SOURCE: decentraland/sdk7-goerli-plaza NFT Museum (lazy loading pattern)
 *
 * @changelog
 *   0.0001 - Initial implementation based on Foundation example repos. NEEDS_TEST before production use.
 */

import { engine, AssetLoad, Entity } from '@dcl/sdk/ecs'

/**
 * Preload a list of scene-bundled assets at startup.
 * Call this in GameManager constructor for any asset not used immediately.
 *
 * NEEDS_TEST: Verify AssetLoad import path and behavior.
 *
 * @param assetPaths  Array of relative asset paths (e.g. 'assets/sounds/click.mp3')
 * @param ownerEntity Optional entity to attach the AssetLoad to (defaults to RootEntity)
 *
 * @example
 *   preloadAssets([
 *     'assets/sounds/music_track.mp3',
 *     'assets/sounds/pickup.mp3',
 *     'assets/models/npc.glb',
 *   ])
 */
export function preloadAssets(
  assetPaths: string[]
): void {
  if (assetPaths.length === 0) return
  // Fresh entity per call — AssetLoad.create can only be called once per entity.
  const entity = engine.addEntity()
  AssetLoad.create(entity, { assets: assetPaths })
  console.log(`[AssetPreloader] Queued ${assetPaths.length} assets for preload`)
}

/**
 * Preload assets grouped by scene region (lazy loading pattern).
 * Use for large scenes where you want to load room assets only when nearby.
 * Each region gets its own AssetLoad entity for independent load management.
 *
 * NEEDS_TEST: Multi-entity AssetLoad behavior — does each entity trigger independently?
 *
 * @param regions  Map of region name → asset path array
 *
 * @example
 *   preloadAssetsByRegion({
 *     'lobby':    ['assets/sounds/ambient_lobby.mp3'],
 *     'arena':    ['assets/sounds/battle_music.mp3', 'assets/models/arena_fx.glb'],
 *   })
 */
export function preloadAssetsByRegion(
  regions: Record<string, string[]>
): Map<string, number> {
  const entities = new Map<string, number>()
  for (const [region, paths] of Object.entries(regions)) {
    if (paths.length === 0) continue
    const e = engine.addEntity()
    // NEEDS_TEST: AssetLoad.create signature
    AssetLoad.create(e, { assets: paths })
    entities.set(region, e)
    console.log(`[AssetPreloader] Region '${region}': queued ${paths.length} assets`)
  }
  return entities
}
