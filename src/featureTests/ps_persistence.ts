/**
 * ps_persistence.ts — PS1-PS5: DCL Storage + Multiplayer Patterns
 * STATUS: 🟩 FULLY CODED
 *
 * PS1 — STORAGE WRITE: Save arbitrary data to DCL Storage API (persists across sessions).
 * PS2 — STORAGE READ:  Load saved data back and apply it to scene state.
 * PS3 — CROSS-SESSION COUNTER: A counter that survives page refresh, disconnect, return.
 * PS4 — MESSAGEBUS: Broadcast values to ALL players in scene simultaneously.
 * PS5 — PLAYER EVENTS: Handle player join (onEnterScene) and leave (onLeaveScene).
 *
 * DCL STORAGE KEY FACTS:
 *   - storage.set/get are ASYNC — must use executeTask(async () => {...})
 *   - Values are strings — JSON.stringify/parse for objects
 *   - Storage is per-player per-scene — not shared between players
 *   - Works in deployed scenes; local preview may use a mock
 *
 * MESSAGEBUS KEY FACTS:
 *   - new MessageBus() — global bus for the scene
 *   - bus.emit(type, data) → fires to ALL connected players including yourself
 *   - bus.on(type, (message, sender) => ...) — receives from everyone including self
 *   - Use for: shared score, vote tallies, enemy kills, cooperative triggers
 *
 * PLAYER EVENTS KEY FACTS:
 *   - onEnterScene fires when any player (or the local player on load) enters
 *   - onLeaveScene fires when a player disconnects or teleports away
 *   - Each callback receives { userId, name, position, ... }
 *   - Critical for: welcome messages, keeping a player count, initializing per-player state
 */

import {
  engine, Transform, MeshRenderer, MeshCollider, Material, TextShape, Billboard,
  pointerEventsSystem, ColliderLayer, executeTask
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { createStation, createButton, STATUS_COLOR } from './testUtils'

// DCL Storage — async via ~system/Storage
// MessageBus — from @dcl/sdk/message-bus
// Player events — from @dcl/sdk/src/players

// ─── PS1 — Storage Write ─────────────────────────────────────────────────────

export function setupPSStorageWrite(): void {
  const { x, z } = { x: 16, z: 10 }
  createStation('ps1_save', 'PS1 — STORAGE WRITE\nPersist data across sessions', STATUS_COLOR.FULLY_CODED)

  let saveCount = 0
  const statusLbl = engine.addEntity(); Transform.create(statusLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(statusLbl, {})
  TextShape.create(statusLbl, { text: '💾 Ready to save', fontSize: 1.3, textColor: Color4.White() })

  const saveBtn = createButton(x, 0.8, z - 3.6, '💾 SAVE DATA', Color4.create(0.3, 0.5, 0.8, 1))
  pointerEventsSystem.onPointerDown({ entity: saveBtn, opts: { button: 1, hoverText: '[E] Save to Storage' } }, () => {
    saveCount++
    const payload = JSON.stringify({ saveCount, timestamp: Date.now(), version: '1.0' })
    TextShape.getMutable(statusLbl).text = '⌛ Saving...'
    TextShape.getMutable(statusLbl).textColor = Color4.create(1, 0.9, 0.3, 1)
    executeTask(async () => {
      try {
        const { storage } = await import('~system/Storage' as any)
        await storage.set({ key: 'dn_workshop_save', value: payload })
        TextShape.getMutable(statusLbl).text = `✓ SAVED\nsaveCount: ${saveCount}\n(key: dn_workshop_save)`
        TextShape.getMutable(statusLbl).textColor = Color4.create(0.3, 1, 0.5, 1)
        console.log(`[PS1] Storage.set saved: saveCount=${saveCount}`)
      } catch (e) {
        TextShape.getMutable(statusLbl).text = `⚠ Save failed\n(normal in preview)`
        console.error('[PS1] Storage.set error:', e)
      }
    })
  })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'executeTask(async()=>storage.set({key,value}))\nValue = JSON.stringify(yourObject)\nPersists across sessions — per player',
    fontSize: 1.1, textColor: Color4.create(0.7, 0.9, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PS1] StorageWrite initialized')
}

// ─── PS2 — Storage Read ───────────────────────────────────────────────────────

export function setupPSStorageRead(): void {
  const { x, z } = { x: 28, z: 10 }
  createStation('ps2_load', 'PS2 — STORAGE READ\nLoad saved data on demand', STATUS_COLOR.FULLY_CODED)

  const dataLbl = engine.addEntity(); Transform.create(dataLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(dataLbl, {})
  TextShape.create(dataLbl, { text: '📂 Press LOAD\nto read Storage', fontSize: 1.3, textColor: Color4.White() })

  const loadBtn = createButton(x, 0.8, z - 3.6, '📂 LOAD DATA', Color4.create(0.5, 0.3, 0.7, 1))
  pointerEventsSystem.onPointerDown({ entity: loadBtn, opts: { button: 1, hoverText: '[E] Load from Storage' } }, () => {
    TextShape.getMutable(dataLbl).text = '⌛ Loading...'
    executeTask(async () => {
      try {
        const { storage } = await import('~system/Storage' as any)
        const result = await storage.get({ key: 'dn_workshop_save' })
        if (result?.value) {
          const data = JSON.parse(result.value)
          const ago = Math.round((Date.now() - data.timestamp) / 1000)
          TextShape.getMutable(dataLbl).text = `✓ LOADED\nsaveCount: ${data.saveCount}\n${ago}s ago\nv${data.version}`
          TextShape.getMutable(dataLbl).textColor = Color4.create(0.3, 1, 0.5, 1)
          console.log('[PS2] Loaded:', data)
        } else {
          TextShape.getMutable(dataLbl).text = '⚠ No saved data\n(save first at PS1)'
          TextShape.getMutable(dataLbl).textColor = Color4.create(1, 0.7, 0.3, 1)
          console.log('[PS2] No data found for key dn_workshop_save')
        }
      } catch (e) {
        TextShape.getMutable(dataLbl).text = '⚠ Load failed\n(normal in preview)'
        console.error('[PS2] Storage.get error:', e)
      }
    })
  })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'storage.get({key}) → {value: string|null}\nJSON.parse(result.value) for objects\nLoad on main() init for persistent state',
    fontSize: 1.1, textColor: Color4.create(0.9, 0.7, 1, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PS2] StorageRead initialized')
}

// ─── PS3 — Cross-Session Persistent Counter ───────────────────────────────────

export function setupPSCrossSessionCounter(): void {
  const { x, z } = { x: 40, z: 10 }
  createStation('ps3_counter', 'PS3 — PERSISTENT COUNTER\nSurvives disconnect + return', STATUS_COLOR.FULLY_CODED)

  let visits = 0; let totalClicks = 0
  const counterLbl = engine.addEntity(); Transform.create(counterLbl, { position: Vector3.create(x, 2.5, z) }); Billboard.create(counterLbl, {})
  TextShape.create(counterLbl, { text: 'Loading...', fontSize: 1.4, textColor: Color4.White() })

  function saveState(): void {
    executeTask(async () => {
      try {
        const { storage } = await import('~system/Storage' as any)
        await storage.set({ key: 'dn_counter', value: JSON.stringify({ visits, totalClicks }) })
        console.log(`[PS3] Saved: visits=${visits}, clicks=${totalClicks}`)
      } catch {}
    })
  }

  function updateDisplay(): void {
    TextShape.getMutable(counterLbl).text = `Visits: ${visits}\nTotal clicks: ${totalClicks}\n(persists across sessions)`
    TextShape.getMutable(counterLbl).textColor = Color4.create(1, 0.9, 0.3, 1)
  }

  // Load on init
  executeTask(async () => {
    try {
      const { storage } = await import('~system/Storage' as any)
      const result = await storage.get({ key: 'dn_counter' })
      if (result?.value) {
        const data = JSON.parse(result.value)
        visits = (data.visits ?? 0) + 1  // increment visit count
        totalClicks = data.totalClicks ?? 0
      } else {
        visits = 1; totalClicks = 0
      }
      updateDisplay()
      saveState()  // save incremented visit count
      console.log(`[PS3] Session start: visit #${visits}, total clicks: ${totalClicks}`)
    } catch {
      visits = 1; totalClicks = 0
      updateDisplay()
    }
  })

  const clickBtn = createButton(x, 0.8, z - 3.6, '+ Add Click', Color4.create(0.3, 0.6, 0.3, 1))
  pointerEventsSystem.onPointerDown({ entity: clickBtn, opts: { button: 1, hoverText: '[E] Add click' } }, () => {
    totalClicks++; updateDisplay(); saveState()
  })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.0, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'Load on init → increment visits → save\nClicks accumulate across all sessions\nRefresh page → counter continues from saved',
    fontSize: 1.1, textColor: Color4.create(1, 0.95, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PS3] CrossSessionCounter initialized — load on startup, save on click')
}

// ─── PS4 — MessageBus (Multiplayer Sync) ──────────────────────────────────────

export function setupPSMessageBus(): void {
  const { x, z } = { x: 52, z: 10 }
  createStation('ps4_msgbus', 'PS4 — MESSAGEBUS\nSync to all players in scene', STATUS_COLOR.FULLY_CODED)

  let sharedScore = 0; let msgCount = 0
  const busLbl = engine.addEntity(); Transform.create(busLbl, { position: Vector3.create(x, 2.8, z) }); Billboard.create(busLbl, {})
  TextShape.create(busLbl, { text: 'Shared: 0\nMessages: 0', fontSize: 1.5, textColor: Color4.White() })

  const senderLbl = engine.addEntity(); Transform.create(senderLbl, { position: Vector3.create(x, 1.8, z) }); Billboard.create(senderLbl, {})
  TextShape.create(senderLbl, { text: '', fontSize: 1.0, textColor: Color4.create(0.7, 0.9, 1, 1) })

  // Set up MessageBus
  executeTask(async () => {
    try {
      const { MessageBus } = await import('@dcl/sdk/message-bus' as any)
      const bus = new MessageBus()

      // Listen for score updates from ANY player (including self)
      bus.on('score_sync', (message: { score: number; playerName: string }, sender: string) => {
        sharedScore = message.score; msgCount++
        TextShape.getMutable(busLbl).text = `Shared: ${sharedScore}\nMessages: ${msgCount}`
        TextShape.getMutable(busLbl).textColor = Color4.create(0.3, 1, 0.5, 1)
        TextShape.getMutable(senderLbl).text = `Last from: ${message.playerName}\n(${sender.slice(0, 8)}...)`
        console.log(`[PS4] Received score_sync: score=${message.score} from ${sender}`)
      })

      // Add score button (emits to ALL players)
      const addBtn = createButton(x - 1.5, 0.8, z - 3.6, '+ Score +10', Color4.create(0.3, 0.6, 0.3, 1))
      pointerEventsSystem.onPointerDown({ entity: addBtn, opts: { button: 1, hoverText: '[E] +10 score (broadcast)' } }, () => {
        sharedScore += 10
        bus.emit('score_sync', { score: sharedScore, playerName: 'You' })
        console.log(`[PS4] Emitting score_sync: ${sharedScore}`)
      })

      const resetBtn = createButton(x + 1.5, 0.8, z - 3.6, '↺ Reset', Color4.create(0.5, 0.2, 0.1, 1))
      pointerEventsSystem.onPointerDown({ entity: resetBtn, opts: { button: 1, hoverText: '[E] Reset shared score' } }, () => {
        sharedScore = 0; bus.emit('score_sync', { score: 0, playerName: 'You' })
      })

      console.log('[PS4] MessageBus ready — awaiting other players')
    } catch (e) {
      TextShape.getMutable(busLbl).text = '⚠ MessageBus\nunavailable in preview'
      console.error('[PS4] MessageBus setup failed:', e)
    }
  })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.5, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'bus.emit(type, data) → ALL players receive\nbus.on(type, (msg, sender)=>) to handle\nFires to self too — not just others',
    fontSize: 1.1, textColor: Color4.create(0.7, 1, 0.9, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PS4] MessageBus station initialized')
}

// ─── PS5 — Player Join / Leave Events ────────────────────────────────────────

export function setupPSPlayerEvents(): void {
  const { x, z } = { x: 64, z: 10 }
  createStation('ps5_players', 'PS5 — PLAYER EVENTS\nJoin / leave tracking', STATUS_COLOR.FULLY_CODED)

  let playerCount = 0
  const countLbl = engine.addEntity(); Transform.create(countLbl, { position: Vector3.create(x, 2.8, z) }); Billboard.create(countLbl, {})
  TextShape.create(countLbl, { text: 'Players: 1\n(local only)', fontSize: 1.5, textColor: Color4.White() })

  const logLbl = engine.addEntity(); Transform.create(logLbl, { position: Vector3.create(x, 1.8, z) }); Billboard.create(logLbl, {})
  TextShape.create(logLbl, { text: 'Waiting for events...', fontSize: 1.0, textColor: Color4.create(0.7, 0.9, 1, 1) })

  const eventHistory: string[] = []
  function addEvent(msg: string): void {
    eventHistory.unshift(msg)
    if (eventHistory.length > 3) eventHistory.pop()
    TextShape.getMutable(logLbl).text = eventHistory.join('\n')
  }

  executeTask(async () => {
    try {
      const { onEnterScene, onLeaveScene, getPlayers } = await import('@dcl/sdk/src/players' as any)

      // Count existing players on start
      const existing = getPlayers ? getPlayers() : []
      playerCount = Math.max(1, (existing?.length ?? 0))
      TextShape.getMutable(countLbl).text = `Players: ${playerCount}\n(in scene)`

      onEnterScene(({ userId, name }: { userId: string; name: string }) => {
        playerCount++
        TextShape.getMutable(countLbl).text = `Players: ${playerCount}\n(in scene)`
        TextShape.getMutable(countLbl).textColor = Color4.create(0.3, 1, 0.5, 1)
        addEvent(`→ ${name ?? userId.slice(0, 8)} joined`)
        console.log(`[PS5] ENTER: ${name} (${userId}) — total: ${playerCount}`)
      })

      onLeaveScene(({ userId }: { userId: string }) => {
        playerCount = Math.max(1, playerCount - 1)
        TextShape.getMutable(countLbl).text = `Players: ${playerCount}\n(in scene)`
        TextShape.getMutable(countLbl).textColor = Color4.create(1, 0.6, 0.3, 1)
        addEvent(`← ${userId.slice(0, 8)} left`)
        console.log(`[PS5] LEAVE: ${userId} — total: ${playerCount}`)
      })

      addEvent('Watching for players...')
      console.log('[PS5] Player event handlers registered')
    } catch (e) {
      TextShape.getMutable(logLbl).text = '⚠ Player events\nunavailable in preview'
      console.error('[PS5] Player events setup failed:', e)
    }
  })

  const info = engine.addEntity(); Transform.create(info, { position: Vector3.create(x, 4.5, z) }); Billboard.create(info, {})
  TextShape.create(info, {
    text: 'onEnterScene(({userId,name})=>...)\nonLeaveScene(({userId})=>...)\nUse for: welcome msg, player count, init state',
    fontSize: 1.1, textColor: Color4.create(1, 0.9, 0.7, 1), outlineColor: Color4.Black(), outlineWidth: 0.08
  })
  console.log('[PS5] PlayerEvents station initialized')
}
