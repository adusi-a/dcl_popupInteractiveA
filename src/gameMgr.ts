/**
 * gameMgr.ts — Scene orchestrator
 * dcl_popupInteractiveA — DN Framework interactive entity + data-driven area test
 *
 * MANAGER STACK:
 *   DataManager     — global registries (items, recipes, presets), save/load
 *   AreaManager     — data-driven entity creation + tracking from AreaDefinition
 *   PlayerManager   — player identity, position, checkpoint
 *   PlayerInventory — items, currency, stats
 *   PopupManager    — popup state machine
 *   QuestManager    — quest state
 *   MarketManager   — currency rates (static for now)
 *
 * TRANSITION NOTE:
 *   AreaManager handles: gold coins, resource nodes, worm field, smelter,
 *   workbench, fishmonger, trader, chests (LootBehavior), farm plots (FarmPlotBehavior).
 *
 *   Legacy setup functions still run for: fishing mechanic, fishing mission board,
 *   fishing pond — until FishingSpotBehavior is ready.
 *
 * Scene layout (spawn at 80,1,70 facing +Z):
 *   X~48-72, Z~68  — Gold coins (4×5g) — AreaManager
 *   Z~40-52        — Resource nodes (ore/coal/wood/stone) — AreaManager
 *   X=25-32,Z~50-56 — Worm Field patches — AreaManager
 *   Z~82           — Smelter + Workbench — AreaManager
 *   Z=100          — Chests A/B/C — legacy
 *   X=28,Z~120     — Fishmonger — AreaManager
 *   Z~147          — Trader — AreaManager
 *   Z~138-152      — Farm plots — legacy
 *   X=28,Z=145     — Fishing Mission Board — legacy
 *   X=28,Z=152     — Fishing Pond — legacy
 */

import { PlayerManager } from './dn-framework/player/playerManager'
import { PlayerInventory } from './dn-framework/player/playerInventory'
import { PopupManager } from './dn-framework/ui/popupManager'
import { QuestManager } from './dn-framework/quests/questState'
import { MarketManager, DEFAULT_MARKET } from './dn-framework/economy/marketManager'
import { DataManager } from './dn-framework/data/dataManager'
import { AreaManager } from './dn-framework/data/areaManager'
import { setupInteractionUiSystem } from './dn-framework/ui/systems/interactionUiSystem'
import { initWorldSystems, getLiveEnemies } from './dn-framework/systems/worldSystems'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { Transform, engine } from '@dcl/sdk/ecs'

// Global data registries
import { WORKBENCH_RECIPES } from './data/recipeData'
import { AREA_POPUP_TEST } from './data/areas/area_popupTest'

// Legacy setup functions (entities still using old pattern)
import { setupFishingPond } from './entities/fishingPond'
import { setupFishingMissionBoard } from './entities/fishingMissionBoard'
import { initFishingMechanic } from './fishing/fishingMechanic'

import { uiSetup } from './uiMgr'

export class GameManager {

  // ── Manager stack ──────────────────────────────────────────────────────────
  dataMgr:         DataManager
  areaMgr:         AreaManager
  playerMgr:       PlayerManager
  playerInventory: PlayerInventory
  popupMgr:        PopupManager
  questMgr:        QuestManager
  market:          MarketManager

  // ── World Flags — simple key/value story state ─────────────────────────────
  /** Set/get one-time event flags: gameMgr.flags.set('met_elder', true), .get(), .has() */
  flags: Map<string, any>

  // ── Player HP ──────────────────────────────────────────────────────────────
  playerHP: { current: number; max: number }

  // ── Player Shield (Sprint 5) ───────────────────────────────────────────────
  /**
   * Shield absorbs damage before HP. Recharges after rechargeDelayMs without taking damage.
   * max starts at 0 (no shield) — set by equipping an offhand item with { shield: N } stats.
   */
  playerShield: {
    current:           number
    max:               number
    rechargeRatePerSec: number   // shield points restored per second
    rechargeDelayMs:   number   // ms after last hit before recharge starts
    lastDamagedAt:     number   // Date.now() timestamp of last damage
  }

  // ── Death state (Sprint 5) ─────────────────────────────────────────────────
  /** True while the player is in the death screen. Clears on respawn. */
  playerDead: boolean

  // ── Equipment ─────────────────────────────────────────────────────────────
  equipment: Map<'weapon' | 'offhand' | 'accessory', { itemId: string; name: string; stats: Record<string, number> } | null>

  // ── Combat cooldown ────────────────────────────────────────────────────────
  private _lastAttackMs:    number = 0
  private _attackCooldownMs: number = 800

  // ── Story entity refs (set by AreaManager via storyRole) ──────────────────
  fishmonger?: any   // InteractiveComposite for the fishmonger (storyRole: 'fishmonger')
  townElder?:  any   // InteractiveComposite for the Town Elder (storyRole: 'townElder')
  armorer?:    any   // InteractiveComposite for the Armorer (storyRole: 'armorer')

  constructor() {

    // ── Data layer — register global content ─────────────────────────────────
    this.dataMgr = new DataManager()
    this.dataMgr.registerRecipes(WORKBENCH_RECIPES)
    // Drop presets and shop presets: inline in area def for now (dataMethod: 'inline')
    // Register presets here when data grows and sharing is needed.

    // ── Core managers ─────────────────────────────────────────────────────────
    this.flags           = new Map()
    this.playerHP        = { current: 100, max: 100 }
    this.playerShield    = { current: 0, max: 0, rechargeRatePerSec: 15, rechargeDelayMs: 4000, lastDamagedAt: 0 }
    this.playerDead      = false
    this.equipment       = new Map([['weapon', null], ['offhand', null], ['accessory', null]])
    this.playerMgr       = new PlayerManager(this)
    this.playerInventory = new PlayerInventory()
    this.popupMgr        = new PopupManager()
    this.questMgr        = new QuestManager()
    this.market          = DEFAULT_MARKET

    // ── Player base stats ─────────────────────────────────────────────────────
    this.playerInventory.addStat('attack',  5)   // base melee attack (weapon adds on top)
    this.playerInventory.addStat('defense', 0)   // base defense (shield/offhand adds on top)

    // ── Scene quests — registered here; started via DialogueBehavior/MissionGiver ──
    this.questMgr.register({
      id: 'goblin_bounty',
      title: 'The Goblin Threat',
      description: 'Help the village by slaying goblins near the eastern rocks.',
      phases: [
        {
          description: 'Slay 5 goblins near the eastern rocks. ({kills})',
          objective: { type: 'kill', tag: 'goblin', count: 5 }
        }
      ],
      reward: { gold: 50 }
    }, 'locked')

    // ── Systems ───────────────────────────────────────────────────────────────
    setupInteractionUiSystem(this.popupMgr)
    initWorldSystems(this)                // Farm tick + NPC movement + Enemy AI systems
    initFishingMechanic(this.playerInventory, this.popupMgr, this.questMgr)

    // ── Area load — data-driven entity creation ────────────────────────────────
    this.areaMgr = new AreaManager(this, this.dataMgr)
    this.areaMgr.loadArea(AREA_POPUP_TEST)

    // ── Legacy setup (fishing stays legacy until FishingSpotBehavior lands) ────
    setupFishingMissionBoard(this)
    setupFishingPond(this)

    // ── UI ────────────────────────────────────────────────────────────────────
    uiSetup(this)

    console.log('[GameManager] dcl_popupInteractiveA ready — DataManager + AreaManager active')
  }

  // ── Game-specific sell callbacks (dispatched by AreaManager via onSellAction) ──

  /** Called by AreaManager when any fish is sold at the Fishmonger. */
  onFishSold(itemId: string, _price: number): void {
    const FISH = ['perch', 'bass', 'trout']
    if (!FISH.includes(itemId)) return
    if (this.questMgr.isActive('fishing_basic') && this.questMgr.getPhase('fishing_basic') === 1) {
      this.questMgr.advancePhase('fishing_basic')
      this.popupMgr.showFloat(
        'Quest update: Return to the Mission Board!',
        Color4.create(1, 0.85, 0.2, 1),
        3500
      )
    }
  }

  // ── Equipment ───────────────────────────────────────────────────────────────

  equipItem(
    slot: 'weapon' | 'offhand' | 'accessory',
    itemId: string,
    name: string,
    stats: Record<string, number>
  ): void {
    this.equipment.set(slot, { itemId, name, stats })
    const statStr = Object.entries(stats)
      .filter(([k]) => k !== 'shield')           // shield shown separately
      .map(([k, v]) => `+${v} ${k}`).join(', ')
    const shieldGain = stats['shield'] ?? 0
    const floatMsg = shieldGain > 0
      ? `Equipped: ${name}  (${statStr}${statStr ? ', ' : ''}🛡 +${shieldGain} Shield)`
      : `Equipped: ${name}${statStr ? `  (${statStr})` : ''}`
    this.popupMgr.showFloat(floatMsg, Color4.create(0.6, 0.9, 1, 1), 2500)

    // Update shield pool if item grants shield points
    const newShieldMax = this.getEffectiveStat('shield')
    if (newShieldMax !== this.playerShield.max) {
      this.playerShield.max = newShieldMax
      // Fully restore shield on equip (feels good)
      this.playerShield.current = newShieldMax
      this.playerShield.lastDamagedAt = 0
    }
  }

  unequipItem(slot: 'weapon' | 'offhand' | 'accessory'): void {
    this.equipment.set(slot, null)
  }

  /**
   * Returns the effective value of a stat: base (from inventory stats) + all equipment bonuses.
   * Used by playerAttack() for attack damage, and enemy AI for player defense reduction.
   */
  getEffectiveStat(stat: string): number {
    const base = this.playerInventory.getStat(stat) ?? 0
    let bonus = 0
    for (const item of this.equipment.values()) {
      if (item?.stats[stat]) bonus += item.stats[stat]
    }
    return base + bonus
  }

  // ── Combat ──────────────────────────────────────────────────────────────────

  /**
   * Take damage from any source (enemy attack or damage zone).
   * Order: dead guard → defense reduction → shield absorption → HP → death check.
   */
  takeDamage(rawAmount: number): void {
    if (this.playerDead) return

    // Record hit time — used by shield recharge delay
    this.playerShield.lastDamagedAt = Date.now()

    const defense = this.getEffectiveStat('defense')
    let damage    = Math.max(1, rawAmount - defense)

    // Shield absorbs damage first
    if (this.playerShield.current > 0) {
      const absorbed = Math.min(this.playerShield.current, damage)
      this.playerShield.current -= absorbed
      damage -= absorbed
      if (damage <= 0) {
        this.popupMgr.showFloat(`🛡 absorbed`, Color4.create(0.4, 0.65, 1, 1), 1200)
        return
      }
    }

    // Remaining damage hits HP
    this.playerHP.current -= damage
    this.popupMgr.showFloat(`-${damage} HP`, Color4.create(1, 0.2, 0.2, 1), 1500)

    if (this.playerHP.current <= 0) {
      this.playerHP.current = 0
      this._onPlayerDeath()
    }
  }

  /** @private Called when HP reaches 0. Sets dead flag. */
  private _onPlayerDeath(): void {
    this.playerDead = true
    console.error('[GameManager] Player died.')
  }

  /**
   * Respawn the player — called from the death screen Respawn button.
   * Resets HP + shield, clears dead flag, teleports back to scene spawn.
   */
  respawnPlayer(): void {
    this.playerDead              = false
    this.playerHP.current        = this.playerHP.max
    if (this.playerShield.max > 0) {
      this.playerShield.current  = this.playerShield.max
    }
    this.playerShield.lastDamagedAt = 0
    // Teleport to scene spawn point
    this.playerMgr.teleportTo(
      Vector3.create(80, 1, 70),
      Vector3.create(80, 2, 100)
    )
  }

  /**
   * Player melee attack — finds nearest live enemy within 6m, deals damage.
   * Damage = getEffectiveStat('attack'), default 5 base + weapon bonus.
   * Has a short cooldown (800ms) to prevent button spam.
   */
  playerAttack(): void {
    const now = Date.now()
    if (now - this._lastAttackMs < this._attackCooldownMs) return

    const playerT = Transform.getOrNull(engine.PlayerEntity)
    if (!playerT) return

    const enemies = getLiveEnemies()
    let nearest: ReturnType<typeof getLiveEnemies>[0] | null = null
    let nearestDist = 6   // max attack range in meters

    for (const entry of enemies) {
      const t = Transform.getMutableOrNull(entry.entity)
      if (!t) continue
      const dx = t.position.x - playerT.position.x
      const dz = t.position.z - playerT.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < nearestDist) { nearestDist = dist; nearest = entry }
    }

    if (!nearest) {
      this.popupMgr.showFloat('No enemy in range.', undefined, 1200)
      return
    }

    this._lastAttackMs = now
    const damage = Math.max(1, this.getEffectiveStat('attack'))
    nearest.health.takeDamage(damage, nearest.entityId, this)
    this.popupMgr.showFloat(`⚔ ${damage}`, Color4.create(1, 0.85, 0.1, 1), 1200)
  }
}
