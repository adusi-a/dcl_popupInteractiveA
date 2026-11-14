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

import { createZoneEntrance, createMLZoneEntrance, createHazardZoneEntrance, createSWZoneEntrance, createPMZoneEntrance, createFBZoneEntrance, createCBZoneEntrance, createEVZoneEntrance, createAUZoneEntrance, createPZZoneEntrance, createPSZoneEntrance, createTAZoneEntrance } from './testUtils'
import { setupMLNodeWalker }     from './ml_nodeWalker'
import { setupMLShelfGhost }     from './ml_shelfGhost'
import { setupMLWanderingEnemy } from './ml_wanderingEnemy'
import { setupMLHoldInteract }   from './ml_holdInteract'
import { setupMLPathDistance }   from './ml_pathDistance'
import { setupMLMinimap }        from './ml_minimap'
// Hazard Zone
import { setupHZSpikeWall, setupHZSpikeBox } from './hz_spikes'
import { setupHZDartWall, setupHZDartBox }   from './hz_darts'
import { setupHZDisappearFloor }             from './hz_disappearFloor'
import { setupHZBombThrower }                from './hz_bombThrower'
import { setupHZTurret, setupHZLaserTurret } from './hz_turret'
import { setupHZThwomp }                     from './hz_thwomp'
// Switch / Door / Pickup Zone
import { setupSWPressurePlate, setupSWToggleLever }   from './sw_pressurePlate'
import { setupSWDoor, setupSWKeyLock }               from './sw_doors'
import { setupSWCheckpoint, setupSWCollectibles }     from './sw_checkpoint'
import { setupSWTeleporter, setupSWMovingBridge, setupSWWeightPlatform } from './sw_teleporter'
// Platform Movement Zone
import { setupPMPingPong, setupPMElevator }                     from './pm_ridePlatforms'
import { setupPMRotating, setupPMCrumble }                     from './pm_rotatingCrumble'
import { setupPMSaw, setupPMPendulum }                         from './pm_spinners'
import { setupPMSqueezeWalls, setupPMRisingFloor, setupPMFan } from './pm_wallsFloor'
// Feedback / HUD Zone (C)
import { setupFBScreenShake, setupFBDamageNumbers, setupFBHitFlash } from './fb_screenFeedback'
import { setupFBScore, setupFBTimer, setupFBObjectiveTracker, setupFBAlert } from './fb_hudSystems'
import { setupFBDeathSequence, setupFBMinimapBlips }                      from './fb_deathMinimap'
// Combat Extensions (D)
import { setupCBHpEntity, setupCBProximityMine }                          from './cb_hpMine'
import { setupCBHoming, setupCBMeleeSwing, setupCBRespawning }            from './cb_projectileEnemy'
import { setupCBBeamGate, setupCBStunZone, setupCBLootDrop, setupCBShield } from './cb_gateStunLoot'
// Event Chain Zone (E)
import { setupEVEventBus, setupEVChain }                        from './ev_eventBus'
import { setupEVAndGate, setupEVOrNot, setupEVFlipFlop }        from './ev_logicGates'
import { setupEVRateLimiter, setupEVPulse, setupEVOneShot }     from './ev_timing'
// Audio Systems Zone (F)
import { setupAUBasic, setupAUSpatial, setupAUAmbientZone }     from './au_basicAudio'
import { setupAUSoundState, setupAULayered, setupAUCrossfade }  from './au_advancedAudio'
import { setupAUZoneAudio, setupAUReactive, setupAUPool }       from './au_reactiveAudio'
// Player Power Zones (G)
import { setupPZTrampoline, setupPZAntiGrav, setupPZRepulsor, setupPZAttractor, setupPZSpeedPad } from './pz_powerZones'
// Persistence & Multiplayer (H)
import { setupPSStorageWrite, setupPSStorageRead, setupPSCrossSessionCounter, setupPSMessageBus, setupPSPlayerEvents } from './ps_persistence'
import { setupTALerpMove, setupTARotLoop, setupTAPulse, setupTAWaypoint, setupTAOrbit } from './ta_animations'
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

  // ─── Hazard Zone (Z=118-138) ────────────────────────────────
  createHazardZoneEntrance()
  console.log('=== HAZARD ZONE initializing (Z=118-138) ===')
  try { setupHZSpikeWall() }     catch (e) { console.error('[HZ1] SpikeWall failed:', e) }
  try { setupHZSpikeBox() }      catch (e) { console.error('[HZ2] SpikeBox failed:', e) }
  try { setupHZDartWall() }      catch (e) { console.error('[HZ3] DartWall failed:', e) }
  try { setupHZDartBox() }       catch (e) { console.error('[HZ4] DartBox failed:', e) }
  try { setupHZDisappearFloor() } catch (e) { console.error('[HZ5] DisappearFloor failed:', e) }
  try { setupHZBombThrower() }   catch (e) { console.error('[HZ6] BombThrower failed:', e) }
  try { setupHZTurret() }        catch (e) { console.error('[HZ7] Turret failed:', e) }
  try { setupHZLaserTurret() }   catch (e) { console.error('[HZ8] LaserTurret failed:', e) }
  try { setupHZThwomp() }        catch (e) { console.error('[HZ9] Thwomp failed:', e) }

  console.log('=== HAZARD ZONE ready — Z=118-138 ===')

  // ─── Switch / Door / Pickup Zone (WEST SIDE: X=8-72, Z=22-50) ──────────────
  createSWZoneEntrance()
  console.log('=== SWITCH ZONE initializing (X=8-72, Z=22-50) ===')
  try { setupSWPressurePlate() }   catch (e) { console.error('[SW1] PressurePlate failed:', e) }
  try { setupSWToggleLever() }     catch (e) { console.error('[SW2] ToggleLever failed:', e) }
  try { setupSWDoor() }            catch (e) { console.error('[SW3] Door failed:', e) }
  try { setupSWKeyLock() }         catch (e) { console.error('[SW4] KeyLock failed:', e) }
  try { setupSWCheckpoint() }      catch (e) { console.error('[SW5] Checkpoint failed:', e) }
  try { setupSWCollectibles() }    catch (e) { console.error('[SW6] Collectibles failed:', e) }
  try { setupSWTeleporter() }      catch (e) { console.error('[SW7] Teleporter failed:', e) }
  try { setupSWMovingBridge() }    catch (e) { console.error('[SW8] MovingBridge failed:', e) }
  try { setupSWWeightPlatform() }  catch (e) { console.error('[SW9] WeightPlatform failed:', e) }

  console.log('=== SWITCH ZONE ready — X=8-72, Z=22-50 ===')

  // ─── Platform Movement Zone (WEST: X=8-72, Z=66-88) ──────────────────────
  createPMZoneEntrance()
  console.log('=== PLATFORM ZONE initializing (X=8-72, Z=66-88) ===')
  try { setupPMPingPong() }     catch (e) { console.error('[PM1] PingPong failed:', e) }
  try { setupPMElevator() }     catch (e) { console.error('[PM2] Elevator failed:', e) }
  try { setupPMRotating() }     catch (e) { console.error('[PM3] Rotating failed:', e) }
  try { setupPMCrumble() }      catch (e) { console.error('[PM4] Crumble failed:', e) }
  try { setupPMSaw() }          catch (e) { console.error('[PM5] Saw failed:', e) }
  try { setupPMPendulum() }     catch (e) { console.error('[PM6] Pendulum failed:', e) }
  try { setupPMSqueezeWalls() } catch (e) { console.error('[PM7] Squeeze failed:', e) }
  try { setupPMRisingFloor() }  catch (e) { console.error('[PM8] RisingFloor failed:', e) }
  try { setupPMFan() }          catch (e) { console.error('[PM9] Fan failed:', e) }

  console.log('=== PLATFORM ZONE ready — X=8-72, Z=66-88 ===')

  // ─── Feedback / HUD Zone (Z=110-130) ──────────────────────────────
  createFBZoneEntrance()
  console.log('=== FEEDBACK ZONE initializing (Z=110-130) ===')
  try { setupFBScreenShake() }        catch (e) { console.error('[FB1] failed:', e) }
  try { setupFBDamageNumbers() }       catch (e) { console.error('[FB2] failed:', e) }
  try { setupFBHitFlash() }            catch (e) { console.error('[FB3] failed:', e) }
  try { setupFBScore() }               catch (e) { console.error('[FB4] failed:', e) }
  try { setupFBTimer() }               catch (e) { console.error('[FB5] failed:', e) }
  try { setupFBObjectiveTracker() }    catch (e) { console.error('[FB6] failed:', e) }
  try { setupFBAlert() }               catch (e) { console.error('[FB7] failed:', e) }
  try { setupFBDeathSequence() }       catch (e) { console.error('[FB8] failed:', e) }
  try { setupFBMinimapBlips() }        catch (e) { console.error('[FB9] failed:', e) }
  console.log('=== FEEDBACK ZONE ready ===')

  // ─── Combat Extensions (Z=146-154) ──────────────────────────────
  createCBZoneEntrance()
  console.log('=== COMBAT ZONE initializing (Z=146-154) ===')
  try { setupCBHpEntity() }     catch (e) { console.error('[CB1] failed:', e) }
  try { setupCBProximityMine() } catch (e) { console.error('[CB2] failed:', e) }
  try { setupCBHoming() }       catch (e) { console.error('[CB3] failed:', e) }
  try { setupCBMeleeSwing() }   catch (e) { console.error('[CB4] failed:', e) }
  try { setupCBRespawning() }   catch (e) { console.error('[CB5] failed:', e) }
  try { setupCBBeamGate() }     catch (e) { console.error('[CB6] failed:', e) }
  try { setupCBStunZone() }     catch (e) { console.error('[CB7] failed:', e) }
  try { setupCBLootDrop() }     catch (e) { console.error('[CB8] failed:', e) }
  try { setupCBShield() }       catch (e) { console.error('[CB9] failed:', e) }
  console.log('=== COMBAT ZONE ready ===')

  // ─── Event Chain Zone (Z=58-70, east side) ───────────────────────
  createEVZoneEntrance()
  console.log('=== EVENT ZONE initializing (Z=58-70) ===')
  try { setupEVEventBus() }     catch (e) { console.error('[EV1] failed:', e) }
  try { setupEVChain() }         catch (e) { console.error('[EV2] failed:', e) }
  try { setupEVAndGate() }       catch (e) { console.error('[EV3] failed:', e) }
  try { setupEVOrNot() }         catch (e) { console.error('[EV4] failed:', e) }
  try { setupEVFlipFlop() }      catch (e) { console.error('[EV5] failed:', e) }
  try { setupEVRateLimiter() }   catch (e) { console.error('[EV6] failed:', e) }
  try { setupEVPulse() }         catch (e) { console.error('[EV7] failed:', e) }
  try { setupEVOneShot() }       catch (e) { console.error('[EV8] failed:', e) }
  console.log('=== EVENT ZONE ready ===')

  // ─── Audio Systems Zone (Z=144-156, east side) ─────────────────
  createAUZoneEntrance()
  console.log('=== AUDIO ZONE initializing (Z=144-156) ===')
  try { setupAUBasic() }         catch (e) { console.error('[AU1] failed:', e) }
  try { setupAUSpatial() }       catch (e) { console.error('[AU2] failed:', e) }
  try { setupAUAmbientZone() }   catch (e) { console.error('[AU3] failed:', e) }
  try { setupAUSoundState() }    catch (e) { console.error('[AU4] failed:', e) }
  try { setupAULayered() }       catch (e) { console.error('[AU5] failed:', e) }
  try { setupAUCrossfade() }     catch (e) { console.error('[AU6] failed:', e) }
  try { setupAUZoneAudio() }     catch (e) { console.error('[AU7] failed:', e) }
  try { setupAUReactive() }      catch (e) { console.error('[AU8] failed:', e) }
  try { setupAUPool() }          catch (e) { console.error('[AU9] failed:', e) }
  console.log('=== AUDIO ZONE ready ===')

  // ─── Player Power Zones (Z=100, west side) ────────────────────────────
  createPZZoneEntrance()
  try { setupPZTrampoline() }  catch (e) { console.error('[PZ1] failed:', e) }
  try { setupPZAntiGrav() }    catch (e) { console.error('[PZ2] failed:', e) }
  try { setupPZRepulsor() }    catch (e) { console.error('[PZ3] failed:', e) }
  try { setupPZAttractor() }   catch (e) { console.error('[PZ4] failed:', e) }
  try { setupPZSpeedPad() }    catch (e) { console.error('[PZ5] failed:', e) }

  // ─── Persistence & Multiplayer (Z=10, south strip) ──────────────────
  createPSZoneEntrance()
  try { setupPSStorageWrite() }         catch (e) { console.error('[PS1] failed:', e) }
  try { setupPSStorageRead() }          catch (e) { console.error('[PS2] failed:', e) }
  try { setupPSCrossSessionCounter() }  catch (e) { console.error('[PS3] failed:', e) }
  try { setupPSMessageBus() }           catch (e) { console.error('[PS4] failed:', e) }
  try { setupPSPlayerEvents() }         catch (e) { console.error('[PS5] failed:', e) }
  createTAZoneEntrance()
  try { setupTALerpMove() } catch (e) { console.error('[TA1] failed:', e) }
  try { setupTARotLoop() }  catch (e) { console.error('[TA2] failed:', e) }
  try { setupTAPulse() }    catch (e) { console.error('[TA3] failed:', e) }
  try { setupTAWaypoint() } catch (e) { console.error('[TA4] failed:', e) }
  try { setupTAOrbit() }    catch (e) { console.error('[TA5] failed:', e) }
  console.log('=== ALL 86 ZONES COMPLETE ===')
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
