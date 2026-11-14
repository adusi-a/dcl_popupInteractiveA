/**
 * featureTests/index.ts — Feature Test Zone entry point
 *
 * Calls all 10 test station setup functions in the Feature Test Zone.
 * Position: X=88-155, Z=8-70 (bottom-right of the 160×160m scene)
 *
 * STATUS LEGEND (see platform colors in-world):
 *   🟩 Green   — fully coded, no assets needed
 *   🟨 Yellow  — coded but needs an asset file (see ASSET NEEDED comments)
 *   🟧 Orange  — needs npm install before first use
 *
 * BEFORE RUNNING:
 *   1. npm install dcl-npc-toolkit      (for T6)
 *   2. Place asset files (see todo list at bottom of this file)
 *   3. npm run start  (assets auto-bundle in local preview)
 *
 * See /FEATURE_TEST_TODO.md for complete asset + control checklist.
 */

import { createZoneEntrance, createMLZoneEntrance } from './testUtils'
import { setupMLNodeWalker }     from './ml_nodeWalker'
import { setupMLShelfGhost }     from './ml_shelfGhost'
import { setupMLWanderingEnemy } from './ml_wanderingEnemy'
import { setupMLHoldInteract }   from './ml_holdInteract'
import { setupMLPathDistance }   from './ml_pathDistance'
import { setupMLMinimap }        from './ml_minimap'
import { setupPhysicsTest }   from './t1_physics'
import { setupParticlesTest } from './t2_particles'
import { setupCameraTest }    from './t3_camera'
import { setupSkyboxTest }    from './t4_skybox'
import { setupInputTest }     from './t5_input'
import { setupNPCTest }       from './t6_npcs'
import { setupEmotesTest }    from './t7_emotes'
import { setupTextShapeTest } from './t8_textshape'
import { setupFontsTest }     from './t9_fonts'
import { setupNFTTest }       from './t10_nft'

export function setupFeatureTests(): void {
  console.log('=== FEATURE TEST ZONE initializing ===')
  console.log('=== Location: X=88-155, Z=8-70 ===')

  createZoneEntrance()

  try { setupPhysicsTest() }   catch (e) { console.error('[FTZ] T1 Physics failed:', e) }
  try { setupParticlesTest() } catch (e) { console.error('[FTZ] T2 Particles failed:', e) }
  try { setupCameraTest() }    catch (e) { console.error('[FTZ] T3 Camera failed:', e) }
  try { setupSkyboxTest() }    catch (e) { console.error('[FTZ] T4 Skybox failed:', e) }
  try { setupInputTest() }     catch (e) { console.error('[FTZ] T5 Input failed:', e) }
  try { setupNPCTest() }       catch (e) { console.error('[FTZ] T6 NPCs failed:', e) }
  try { setupEmotesTest() }    catch (e) { console.error('[FTZ] T7 Emotes failed:', e) }
  try { setupTextShapeTest() } catch (e) { console.error('[FTZ] T8 TextShape failed:', e) }
  try { setupFontsTest() }     catch (e) { console.error('[FTZ] T9 Fonts failed:', e) }
  try { setupNFTTest() }       catch (e) { console.error('[FTZ] T10 NFT failed:', e) }

  // ─── MonsterLibrary Prototype Zone (Z=78-104) ─────────────────────────────
  createMLZoneEntrance()
  console.log('=== MONSTER LIBRARY PROTOTYPES initializing (Z=78-104) ===')
  try { setupMLNodeWalker() }     catch (e) { console.error('[ML1] NodeWalker failed:', e) }
  try { setupMLShelfGhost() }     catch (e) { console.error('[ML2] ShelfGhost failed:', e) }
  try { setupMLWanderingEnemy() } catch (e) { console.error('[ML3] WanderingEnemy failed:', e) }
  try { setupMLHoldInteract() }   catch (e) { console.error('[ML4] HoldInteract failed:', e) }
  try { setupMLPathDistance() }   catch (e) { console.error('[ML5] PathDistance failed:', e) }
  try { setupMLMinimap() }        catch (e) { console.error('[ML6] Minimap failed:', e) }

  console.log('=== FEATURE TEST ZONE ready — walk to X=88-155, Z=8-104 ===')
  console.log('=== MONSTER LIBRARY PROTOTYPES — Z=78-104 ===')
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ASSET TODO LIST (before testing push)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. INSTALL (run once, then npm run start):
 *    npm install dcl-npc-toolkit
 *
 * 2. SKY PANORAMA (for T4 custom texture):
 *    File: assets/skybox/night_mine.jpg
 *    Spec: 2048×1024 px equirectangular (2:1 lat-long), JPG for filesize
 *    Source: Polyhaven.com (search "night sky"), HDR → equirectangular JPG
 *    OR: generate via AI image tool (prompt: "equirectangular night sky panorama
 *        dark mine entrance, 2:1 ratio, no text, seamless 360°")
 *
 * 3. NPC GLB (for T6):
 *    File: assets/models/npc_guard.glb
 *    Spec: Humanoid with animation clips named 'idle' (and optionally 'walk')
 *    Source options:
 *      a. Creator Hub catalog (search "guard", "npc", "humanoid")
 *      b. DCL model catalog CLI: search at models.dcl.eth
 *      c. Any CC0 humanoid GLB with named animation clips
 *
 * 4. EMOTE GLB (for T7):
 *    File: assets/emotes/carry_emote.glb
 *    Spec: DCL-compatible _emote.glb file (MUST end in _emote.glb)
 *    Source: Creator Hub → Avatar Animations asset pack → "carry" or "craft" clip
 *      OR: download from builder API (see DCL Avatar Animations skill)
 *
 * 5. FONT FILES (for T9 — choose by game):
 *    File: assets/fonts/Cinzel-Regular.ttf     (MonsterLibrary)
 *    File: assets/fonts/Oswald-Bold.ttf        (OreMonger)
 *    File: assets/fonts/Creepster-Regular.ttf  (GhostTown)
 *    Source: fonts.google.com — all OFL licensed (safe to redistribute)
 *    Download: click "Get Font" → "Download all" → extract .ttf
 *
 * 6. NFT CONTRACT ADDRESS (for T10):
 *    Edit t10_nft.ts → NFT_DISPLAY_SRC constant
 *    Format: "ethereum://0xCONTRACT_ADDRESS/TOKEN_ID"
 *    Find: decentraland.org/marketplace → any wearable → "Contract"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFY CHECKLIST (testing push session):
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * T1 Player Physics + Double Jump/Glide:
 *   [ ] Launch pad fires upward correctly
 *   [ ] Knockback button pushes player backward
 *   [ ] Wind zone applies continuous force while inside, removes on exit
 *   [ ] No-DoubleJump zone (yellow): can't double-jump inside it
 *   [ ] No-Glide zone (green): can't glide inside it
 *   [ ] Speed Fast 2× button changes walk/run speed noticeably
 *   [ ] Speed Normal button restores default speed
 *   [ ] AvatarLocomotionSettings: no compile error (SDK 7.24.3+)
 *
 * T2 Particle System:
 *   [ ] Campfire: orange/red particles visible rising upward (Unity Desktop)
 *   [ ] Campfire fallback: emissive pulsing sphere visible on Bevy
 *   [ ] Ore sparkle: gold burst fires when ore node is [E] pressed
 *   [ ] Rain: downward stream of particles
 *   [ ] Bevy: NO particles visible (expected behavior)
 *
 * T3 Camera Control:
 *   [ ] Walking through the arch: switches to first-person inside
 *   [ ] Exiting arch: switches back to third-person
 *   [ ] Walking on yellow pad (or [E]): VirtualCamera pans to chest
 *   [ ] Camera returns to player after ~4 seconds
 *   [ ] Camera mode HUD updates showing FIRST/THIRD correctly
 *
 * T4 Skybox / Sun / Fog:
 *   [ ] Default button: removes all overrides, sky returns to DCL default
 *   [ ] Mine Night: very dark sky + heavy fog visible
 *   [ ] Ghost Moon: purple tint visible
 *   [ ] Sunrise: warm orange/blue gradient visible
 *   [ ] Full Dark: near-pitch-black + stars visible
 *   [ ] Custom Texture: (after adding night_mine.jpg) custom panorama shows
 *   [ ] Bevy: default sky shows regardless of button pressed (expected)
 *
 * T5 Advanced Input:
 *   [ ] Entering red zone: cannot walk, turn, or jump
 *   [ ] [E] Release button: movement restored
 *   [ ] PointerLock HUD: shows Locked/Released correctly
 *   [ ] PrimaryPointerInfo: shows hit position as you look around
 *   [ ] WASD HUD: shows which keys are held
 *
 * T6 NPC Toolkit (after npm install + npc_guard.glb):
 *   [ ] Guard NPC: click opens dialogue with 2 choices
 *   [ ] Guard dialogue: branching response based on choice
 *   [ ] Patrol Scout: walks between 3 cyan markers
 *   [ ] Companion: dialogue offers follow option; actually follows
 *
 * T7 Avatar Animations:
 *   [ ] Built-in wave: plays correctly
 *   [ ] Built-in robot/clap/dance: each plays correctly
 *   [ ] Custom emote (after carry_emote.glb placed): triggerSceneEmote fires
 *   [ ] Masked emote: upper body animates while legs walk (walk around)
 *   [ ] Dance loop: starts and [E] again stops it via stopEmote
 *
 * T8 TextShape + Billboard:
 *   [ ] All 3 built-in font styles render correctly
 *   [ ] World-space sign (non-billboard) stays fixed in world
 *   [ ] Billboard signs rotate to face camera as you walk around them
 *   [ ] Distance label: disappears when you back up beyond 15m
 *   [ ] Counter: increments each second, text updates live
 *   [ ] Emoji: renders correctly in TextShape
 *
 * T9 Fonts (after font .ttf files placed):
 *   [ ] Built-in baselines: all 3 render clearly without custom font files
 *   [ ] After placing .ttf: custom font renders in local preview
 *   [ ] FontSrc fallback: shows built-in font if .ttf missing (not an error)
 *   [ ] Mobile/Bevy: shows built-in font only (expected)
 *
 * T10 NFT Blockchain:
 *   [ ] Wallet HUD: shows wallet address (or "guest") correctly on join
 *   [ ] NftShape: frame renders NFT artwork (after replacing contract address)
 *   [ ] Multiple frame types: Classic / Baroque / Minimal all render
 *   [ ] Gate: different message for guest vs wallet holder
 */
