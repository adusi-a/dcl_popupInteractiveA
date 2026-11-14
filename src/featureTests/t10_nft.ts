/**
 * T10 — NFT Blockchain
 * STATUS: 🟩 MOSTLY CODED — wallet check is code-only; NftShape needs a contract address
 *
 * Tests:
 *   A) Wallet detection — getPlayer().isGuest / userId
 *   B) NftShape — display an NFT artwork frame in-world
 *   C) Basic token gate — different response for guest vs wallet holder
 *
 * ASSET NEEDED (soft):
 *   A known public NFT contract address + token ID for the display frame.
 *   Any DCL wearable NFT works. Example format:
 *     ethereum://0x12345.../1
 *   Find one at: decentraland.org/marketplace → any wearable → "contract" info
 *   The scene will display whatever NFT at that address.
 *   PLACEHOLDER used below — replace with a real address before testing.
 *
 * VERIFY:
 *   - Wallet detection HUD shows userId or "(guest)" correctly
 *   - NftShape frame renders the NFT image (replace placeholder address)
 *   - Gated door shows different text for wallet vs guest players
 *
 * GAME APPLICATIONS:
 *   LAND Hub       — NFT gallery wall, token-gated premium section
 *   OreMonger      — NFT ore display for legendary finds
 *   GhostTown V2   — wearable NFT display on ghost character showcase
 *
 * SDK NOTES:
 *   • NftShape src format: "ethereum://0xCONTRACT/TOKEN_ID"
 *   • getPlayer() from '@dcl/sdk/src/players' — synchronous, no async
 *   • isGuest: true if no wallet connected; false if wallet holder
 *   • userId is the Ethereum address (or guest temp ID)
 *   • For token ownership verification (real gate), use signedFetch to a
 *     Cloudflare Worker that calls the chain — not covered here
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  NftShape, NftFrameType, ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/src/players'
import { createStation, STATUS_COLOR } from './testUtils'

// 🟨 Replace with a real NFT contract address + token ID for the display test
// Format: "ethereum://0xCONTRACTADDRESS/TOKEN_ID"
// Example: a DCL classic hat from the marketplace
const NFT_DISPLAY_SRC = 'ethereum://0xc04528c14c8ffd84c7c1fb6719b4a89853035cdd/0'
// ↑ This is a DCL wearable collection contract — replace token 0 with a real token ID

export function setupNFTTest(): void {
  const { x, z } = { x: 144, z: 50 }
  createStation('t10_nft', 'T10 — NFT BLOCKCHAIN\nWallet + NftShape', STATUS_COLOR.FULLY_CODED)

  // ─── A) Wallet detection HUD ──────────────────────────────────────────────
  const walletLabel = engine.addEntity()
  Transform.create(walletLabel, { position: Vector3.create(x, 4.8, z) })
  Billboard.create(walletLabel)
  TextShape.create(walletLabel, {
    text: 'Wallet: checking...', fontSize: 1.3,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  const statusLabel = engine.addEntity()
  Transform.create(statusLabel, { position: Vector3.create(x, 4.0, z) })
  Billboard.create(statusLabel)
  TextShape.create(statusLabel, {
    text: '', fontSize: 1.0,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.08
  })

  // Read wallet state once (getPlayer is synchronous)
  // Note: may return null on the very first frame — wait for PlayerManager
  let walletChecked = false
  engine.addSystem(() => {
    if (walletChecked) return
    const player = getPlayer()
    if (!player) return
    walletChecked = true

    const isGuest = player.isGuest
    const userId = player.userId || '(no ID)'
    const displayId = userId.length > 16 ? `${userId.slice(0, 8)}...${userId.slice(-6)}` : userId

    TextShape.getMutable(walletLabel).text =
      isGuest
        ? '👤 GUEST (no wallet)\n(connect wallet in DCL settings)'
        : `🔗 WALLET CONNECTED\n${displayId}`

    TextShape.getMutable(statusLabel).text =
      `isGuest: ${isGuest}\nuserId: ${displayId}`

    console.log(`[T10] Wallet check — isGuest: ${isGuest}, userId: ${userId}`)
  })

  // ─── B) NftShape display frame ────────────────────────────────────────────
  // The classic gold frame with an NFT artwork inside
  const nftFrame = engine.addEntity()
  Transform.create(nftFrame, {
    position: Vector3.create(x - 2.5, 2, z - 2.5),
    scale: Vector3.create(1.5, 1.5, 0.1)
  })
  NftShape.create(nftFrame, {
    urn: NFT_DISPLAY_SRC,     // 🟨 Replace with real contract+token
    frame: NftFrameType.NFT_CLASSIC,
    color: Color3.create(0.8, 0.6, 0.1)   // gold tint
  })
  MeshCollider.setBox(nftFrame, ColliderLayer.CL_POINTER)

  const nftLabel = engine.addEntity()
  Transform.create(nftLabel, { position: Vector3.create(x - 2.5, 3.8, z - 2.5) })
  Billboard.create(nftLabel)
  TextShape.create(nftLabel, {
    text: 'NFT Display\n(replace placeholder\ncontract address)',
    fontSize: 1.1,
    textColor: Color4.Yellow(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  // Multiple frame styles
  const frameTypes = [
    { type: NftFrameType.NFT_CLASSIC,       label: 'Classic',    offsetX: -2.5, offsetZ: 0 },
    { type: NftFrameType.NFT_BAROQUE_ORNAMENT, label: 'Baroque', offsetX: 0,    offsetZ: -2.5 },
    { type: NftFrameType.NFT_MINIMAL_WIDE,  label: 'Minimal',    offsetX: 2.5,  offsetZ: 0 },
  ]

  frameTypes.forEach(({ type, label, offsetX, offsetZ }) => {
    const frame = engine.addEntity()
    Transform.create(frame, {
      position: Vector3.create(x + offsetX, 1.5, z + offsetZ),
      scale: Vector3.create(1.2, 1.2, 0.08)
    })
    NftShape.create(frame, {
      urn: NFT_DISPLAY_SRC,
      frame: type,
      color: Color3.create(0.7, 0.5, 0.1)
    })

    const lbl = engine.addEntity()
    Transform.create(lbl, { position: Vector3.create(x + offsetX, 2.8, z + offsetZ) })
    Billboard.create(lbl)
    TextShape.create(lbl, {
      text: label, fontSize: 1.0,
      textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
    })
  })

  // ─── C) Token-gated area ──────────────────────────────────────────────────
  // Door that shows different message for guest vs wallet holder
  // (Real token ownership check would need signedFetch to a backend)
  const gateViz = engine.addEntity()
  Transform.create(gateViz, {
    position: Vector3.create(x + 2, 1.5, z + 2),
    scale: Vector3.create(2, 3, 0.2)
  })
  MeshRenderer.setBox(gateViz)
  MeshCollider.setBox(gateViz, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(gateViz, {
    albedoColor: Color4.create(0.3, 0.2, 0.6, 1),
    metallic: 0.8, roughness: 0.2,
    emissiveColor: Color3.create(0.1, 0.05, 0.3),
    emissiveIntensity: 1
  })

  const gateLabel = engine.addEntity()
  Transform.create(gateLabel, { position: Vector3.create(x + 2, 3.5, z + 2) })
  Billboard.create(gateLabel)
  TextShape.create(gateLabel, {
    text: 'TOKEN GATE\n[E] to interact',
    fontSize: 1.2,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  const gateResponseLabel = engine.addEntity()
  Transform.create(gateResponseLabel, { position: Vector3.create(x + 2, 4.5, z + 2) })
  Billboard.create(gateResponseLabel)
  TextShape.create(gateResponseLabel, {
    text: '', fontSize: 1.1,
    textColor: Color4.White(), outlineColor: Color4.Black(), outlineWidth: 0.1
  })

  const { pointerEventsSystem } = require('@dcl/sdk/ecs') as any
  const { InputAction } = require('@dcl/sdk/ecs') as any
  pointerEventsSystem.onPointerDown(
    { entity: gateViz, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Enter Gated Area' } },
    () => {
      const player = getPlayer()
      const isGuest = player?.isGuest ?? true
      const response = isGuest
        ? '🔒 Connect your wallet\nto access this area'
        : '✅ Wallet verified!\n(Real gate needs on-chain check)'
      TextShape.getMutable(gateResponseLabel).text = response
      console.log(`[T10] Gate interaction — isGuest: ${isGuest}`)
      setTimeout(() => {
        TextShape.getMutable(gateResponseLabel).text = ''
      }, 4000)
    }
  )

  console.log('[T10] NFT Blockchain test station initialized')
  console.log('[T10] 🟨 Replace NFT_DISPLAY_SRC with a real contract+token before testing')
  console.log('[T10]    Format: ethereum://0xCONTRACT/TOKEN_ID')
  console.log('[T10]    Find at: decentraland.org/marketplace → any wearable → contract info')
}
