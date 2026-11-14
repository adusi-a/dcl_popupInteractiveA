# Feature Test Zone — Pre-Testing TODO

All 10 feature stations are coded. Items below are needed before the testing sprint.

---

## ✅ Ready to test immediately (no assets needed)

| Test | Station | What to check |
|---|---|---|
| T1 Physics | X=96, Z=22 | Launch pad, knockback, wind zone, speed buttons |
| T2 Particles | X=108, Z=22 | Campfire, ore sparkle, rain (Unity Desktop only) |
| T3 Camera | X=120, Z=22 | First-person arch, cutscene VirtualCamera |
| T4 Skybox (colors) | X=132, Z=22 | 5 color presets; custom texture = YELLOW below |
| T5 Input | X=144, Z=22 | Freeze zone, pointer lock HUD, WASD display |
| T8 TextShape | X=120, Z=50 | Billboard, fonts, distance label, live counter |
| T10 NFT wallet check | X=144, Z=50 | Wallet detect + gate (NftShape = YELLOW below) |

---

## 🟨 ASSETS NEEDED (from you, before testing push)

### 1. `npm install dcl-npc-toolkit`
Run this in the dcl_popupInteractiveA folder.
Required for T6 NPC station.

### 2. Sky Panorama — `assets/skybox/night_mine.jpg`
**Spec:** 2048×1024 px equirectangular (2:1 lat-long), JPG format
**For:** T4 Skybox — Custom Texture button
**Source options:**
- Polyhaven.com → search "night sky" → download as equirectangular JPG
- AI image tool (prompt: "equirectangular night sky panorama, dark atmosphere, 2:1 ratio, seamless 360 degrees, no text")
- Any HDRI sky image converted to equirectangular

### 3. NPC GLB — `assets/models/npc_guard.glb`
**Spec:** Humanoid GLB with animation clips named `idle` (required) and `walk` (preferred)
**For:** T6 NPC Toolkit — all 3 NPC types
**Source options:**
- Creator Hub catalog: search "guard", "npc", or "humanoid" (8,800+ free models)
- OpenGameArt.org → search "humanoid walk idle glb"
- Use `npx @dcl/sdk-commands asset-pack` to browse DCL's built-in catalog

### 4. Emote GLB — `assets/emotes/carry_emote.glb`
**Spec:** DCL-compatible `*_emote.glb` file (name MUST end in `_emote.glb`)
**For:** T7 Emotes — custom emote buttons
**Source:** Creator Hub → search catalog for "Avatar Animations" pack
  - Clips available: carry, pickup, drink, craft, water-plants, fishing, chess, sword, magic, fly, dance variants
  - In Creator Hub: drag the clip card to the scene OR download via API
  - Rename the downloaded file to `carry_emote.glb` before placing

### 5. Font Files — `assets/fonts/`
**For:** T9 Fonts — custom typography per game
**All are OFL licensed (safe to redistribute)**
Download from fonts.google.com → "Get Font" → "Download all" → extract .ttf

| File | Google Font | Game |
|---|---|---|
| `Cinzel-Regular.ttf` | [Cinzel](https://fonts.google.com/specimen/Cinzel) | MonsterLibrary |
| `Oswald-Bold.ttf` | [Oswald](https://fonts.google.com/specimen/Oswald) | OreMonger |
| `Creepster-Regular.ttf` | [Creepster](https://fonts.google.com/specimen/Creepster) | GhostTown |

### 6. NFT Contract Address — edit `src/featureTests/t10_nft.ts`
**Find:** `NFT_DISPLAY_SRC` constant (line ~32)
**Format:** `"ethereum://0xCONTRACT_ADDRESS/TOKEN_ID"`
**Find a real address:** decentraland.org/marketplace → any wearable → "Contract" tab

---

## 🔘 NOT NEEDED for this sprint (separate projects)

- Smart Wearable GLBs → separate `dcl-smart-wearable` project type
- Custom emote Blender authoring → needs `Avatar_File.blend` and Blender workflow

---

## Deployment

Scene deploys to: `thereisnospoon.dcl.eth`
Test zone location: **walk from spawn (80,1,70) toward the bottom-right corner**
  - Row 1 (Z=22): T1–T5
  - Row 2 (Z=50): T6–T10
  - Entrance arch at: X=120, Z=6

After placing assets:
1. `npm install` (for dcl-npc-toolkit)
2. `npm run start` (assets auto-bundle; custom fonts appear after first bundle pass)
3. Walk to Feature Test Zone and step through each station
4. Check console for `[T1]`, `[T2]`, etc. log messages confirming triggers fire
