/**
 * uiMgr.tsx — React-ECS UI for dcl_popupInteractiveA
 *
 * Popup overlays (in Z-order):
 *   FloatNotificationModule  — drift-up item/gold pickups
 *   LootWindowModule         — chest loot windows
 *   ChoicePopupModule        — binary choice (Chest C)
 *   FarmPlotPopupModule      — farm plot plant/harvest
 *   FishingPopupModule       — fishing cast countdown + catch
 *   NoticeBoardModule        — static text/signs
 *   InteractivePopupModule   — adaptive behavior-driven (Craft/Refine/Buy/Sell/Missions/Talk)
 *
 * HUD elements:
 *   MissionTrackerModule     — top-left always-visible active quest tracker (Sprint 5)
 *   PlayerHud                — right-side panel: HP bar, shield bar, stats, gold, inventory
 *   AttackButton             — bottom-right attack trigger
 *   HintPanel                — bottom-center key hint
 *
 * Full-screen overlays:
 *   DeathOverlay             — shown when playerDead === true, blocks all input (Sprint 5)
 *
 * NOTE: CraftingPopupModule removed — Smelter/Workbench/Trader/Fishmonger
 *       now use InteractivePopupModule via their behavior tabs.
 */

import ReactEcs, { Label, UiEntity, Button, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { GameManager } from './gameMgr'
import { CoordsModule } from './dn-framework/ui/modules/coordsModule'
import { PlayerInfoModule } from './dn-framework/ui/modules/playerInfoModule'
import { FloatNotificationModule } from './dn-framework/ui/modules/floatNotificationModule'
import { LootWindowModule } from './dn-framework/ui/modules/lootWindowModule'
import { ChoicePopupModule } from './dn-framework/ui/modules/choicePopupModule'
import { FarmPlotPopupModule } from './dn-framework/ui/modules/farmPlotPopupModule'
import { FishingPopupModule } from './dn-framework/ui/modules/fishingPopupModule'
import { NoticeBoardModule } from './dn-framework/ui/modules/noticeBoardModule'
import { InteractivePopupModule } from './dn-framework/ui/modules/npcPopupModule'

export function uiSetup(gameMgr: GameManager): void {
  ReactEcsRenderer.setUiRenderer(() => [
    CoordsModule(gameMgr),
    PlayerInfoModule(gameMgr),

    FloatNotificationModule({ popupMgr: gameMgr.popupMgr }),
    LootWindowModule({ popupMgr: gameMgr.popupMgr }),
    ChoicePopupModule({ popupMgr: gameMgr.popupMgr }),
    FarmPlotPopupModule({ popupMgr: gameMgr.popupMgr }),
    FishingPopupModule({ popupMgr: gameMgr.popupMgr }),
    NoticeBoardModule({ popupMgr: gameMgr.popupMgr }),
    InteractivePopupModule({
      popupMgr:  gameMgr.popupMgr,
      questMgr:  gameMgr.questMgr,
      inventory: gameMgr.playerInventory,
      market:    gameMgr.market,
      gameMgr:   gameMgr,
    }),

    MissionTrackerModule({ gameMgr }),
    PlayerHud({ gameMgr }),
    AttackButton({ gameMgr }),
    HintPanel(),

    // Death overlay — rendered last so it sits on top of everything
    DeathOverlay({ gameMgr }),
  ])
}

// ─── Mission Tracker ───────────────────────────────────────────────────────────
// Sprint 5: always-visible top-left HUD showing active quest progress.

function MissionTrackerModule({ gameMgr }: { gameMgr: GameManager }) {
  const activeQuests    = gameMgr.questMgr.getActiveQuests()
  const completable     = gameMgr.questMgr.getCompletableQuests()
  const allShown        = [...activeQuests, ...completable]

  if (allShown.length === 0) {
    return <UiEntity uiTransform={{ width: 0, height: 0 }} />
  }

  const CLR_HEADER = Color4.create(0.65, 0.60, 0.50, 1)
  const CLR_TITLE  = Color4.create(1,    0.88, 0.35, 1)   // gold
  const CLR_DESC   = Color4.create(0.85, 0.85, 0.90, 1)
  const CLR_DONE   = Color4.create(0.35, 1,    0.45, 1)   // green when completable

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '16px', left: '16px' },
        width: 290,
        flexDirection: 'column',
        padding: { top: 10, left: 12, right: 12, bottom: 10 },
      }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.80) }}
    >
      <Label
        value="— Quests —"
        fontSize={12}
        color={CLR_HEADER}
        uiTransform={{ margin: { bottom: 7 } }}
      />
      {allShown.map((quest, idx) => {
        const isComplete = quest.status === 'complete'
        const desc = isComplete
          ? '✓ Return to quest giver'
          : gameMgr.questMgr.getCurrentPhaseDescription(quest.definition.id)
        return (
          <UiEntity
            key={idx.toString()}
            uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 8 } }}
          >
            <Label
              value={quest.definition.title}
              fontSize={13}
              color={isComplete ? CLR_DONE : CLR_TITLE}
            />
            <Label
              value={desc}
              fontSize={11}
              color={isComplete ? CLR_DONE : CLR_DESC}
              uiTransform={{ margin: { top: 2 } }}
            />
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

// ─── Player HUD ───────────────────────────────────────────────────────────────

function PlayerHud({ gameMgr }: { gameMgr: GameManager }) {
  const inv     = gameMgr.playerInventory
  const items   = inv.getAllItems()
  const gold    = inv.getCurrency('gold')
  const fishXp  = inv.getStat('fishing_xp')
  const hp      = gameMgr.playerHP
  const shield  = gameMgr.playerShield
  const hpPct   = Math.max(0, Math.min(1, hp.current / hp.max))
  const shPct   = shield.max > 0 ? Math.max(0, Math.min(1, shield.current / shield.max)) : 0

  const CLR_SEC    = Color4.create(0.8,  0.75, 0.5,  1)
  const CLR_GLD    = Color4.create(1,    0.85, 0.1,  1)
  const CLR_XP     = Color4.create(0.5,  0.88, 0.35, 1)
  const CLR_MUT    = Color4.create(0.5,  0.5,  0.55, 1)
  const CLR_SHIELD = Color4.create(0.30, 0.55, 1.00, 1)
  const CLR_HP     = hpPct > 0.5
    ? Color4.create(0.3, 0.85, 0.3, 1)
    : hpPct > 0.25
    ? Color4.create(0.9, 0.7,  0.1, 1)
    : Color4.create(0.9, 0.2,  0.2, 1)

  // Equipment display
  const weapon    = gameMgr.equipment.get('weapon')
  const offhand   = gameMgr.equipment.get('offhand')
  const atk       = gameMgr.getEffectiveStat('attack')
  const def_stat  = gameMgr.getEffectiveStat('defense')

  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: '220px', right: '16px' }, width: 220, flexDirection: 'column', alignItems: 'flex-start', padding: { top: 10, left: 12, right: 12, bottom: 12 } }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.82) }}
    >
      {/* Shield bar — only shown when max shield > 0 */}
      {shield.max > 0 && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 6 } }}>
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 3 } }}>
            <Label value="🛡 Shield" fontSize={12} color={CLR_SHIELD} />
            <Label value={`${Math.ceil(shield.current)} / ${shield.max}`} fontSize={12} color={CLR_SHIELD} />
          </UiEntity>
          <UiEntity uiTransform={{ width: '100%', height: 7, margin: { bottom: 4 } }} uiBackground={{ color: Color4.create(0.08, 0.10, 0.22, 1) }}>
            <UiEntity uiTransform={{ width: `${Math.round(shPct * 100)}%`, height: '100%' }} uiBackground={{ color: CLR_SHIELD }} />
          </UiEntity>
        </UiEntity>
      )}

      {/* HP bar */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
        <Label value="HP" fontSize={12} color={CLR_SEC} />
        <Label value={`${hp.current} / ${hp.max}`} fontSize={12} color={CLR_HP} />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 8, margin: { bottom: 8 } }} uiBackground={{ color: Color4.create(0.15, 0.08, 0.08, 1) }}>
        <UiEntity uiTransform={{ width: `${Math.round(hpPct * 100)}%`, height: '100%' }} uiBackground={{ color: CLR_HP }} />
      </UiEntity>

      {/* Stats */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 2 } }}>
        <Label value={`⚔ ATK ${atk}`} fontSize={12} color={CLR_GLD} />
        <Label value={`🛡 DEF ${def_stat}`} fontSize={12} color={Color4.create(0.6, 0.8, 1, 1)} />
      </UiEntity>
      {weapon && (
        <Label value={`  ${weapon.name}`} fontSize={11} color={CLR_MUT} uiTransform={{ margin: { bottom: 2 } }} />
      )}
      {offhand && (
        <Label value={`  ${offhand.name}`} fontSize={11} color={CLR_MUT} uiTransform={{ margin: { bottom: 2 } }} />
      )}

      <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 4, bottom: 6 } }} uiBackground={{ color: Color4.create(0.2, 0.25, 0.35, 1) }} />

      {/* Gold + XP */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
        <Label value="Gold" fontSize={13} color={CLR_SEC} />
        <Label value={`${gold}g`} fontSize={13} color={CLR_GLD} />
      </UiEntity>
      {fishXp > 0 && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
          <Label value="Fishing XP" fontSize={12} color={CLR_SEC} />
          <Label value={`${fishXp}`} fontSize={12} color={CLR_XP} />
        </UiEntity>
      )}

      <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 2, bottom: 6 } }} uiBackground={{ color: Color4.create(0.2, 0.25, 0.35, 1) }} />
      <Label value="-- Inventory --" fontSize={12} color={CLR_SEC} uiTransform={{ margin: { bottom: 6 } }} />
      {items.length === 0 && <Label value="(empty)" fontSize={12} color={CLR_MUT} />}
      {items.map((item, idx) => (
        <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 3 } }}>
          <Label value={item.name} fontSize={12} color={Color4.White()} />
          <Label value={`x${item.quantity}`} fontSize={12} color={CLR_GLD} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Attack Button ────────────────────────────────────────────────────────────

function AttackButton({ gameMgr }: { gameMgr: GameManager }) {
  // Hidden during death state
  if (gameMgr.playerDead) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '60px', right: '16px' },
        width: 110, height: 52,
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Button
        value="⚔  ATTACK"
        fontSize={16}
        uiTransform={{ width: 110, height: 52 }}
        uiBackground={{ color: Color4.create(0.55, 0.12, 0.12, 0.95) }}
        onMouseDown={() => gameMgr.playerAttack()}
      />
    </UiEntity>
  )
}

// ─── Hint Panel ───────────────────────────────────────────────────────────────

function HintPanel() {
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { bottom: '14px', left: '35%' }, width: 440, padding: { top: 8, left: 14, right: 14, bottom: 8 } }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <Label value="[E] Interact / Mine / Craft / Smelt / Fish   [X] Close" fontSize={13} color={Color4.create(0.7, 0.7, 0.75, 1)} textAlign="middle-center" />
    </UiEntity>
  )
}

// ─── Death Overlay ────────────────────────────────────────────────────────────
// Sprint 5: Full-screen overlay shown when playerDead === true.
// Covers all other UI elements — rendered last in the stack.

function DeathOverlay({ gameMgr }: { gameMgr: GameManager }) {
  if (!gameMgr.playerDead) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '0px', left: '0px' },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: Color4.create(0.30, 0, 0, 0.88) }}
    >
      <Label
        value="YOU DIED"
        fontSize={60}
        color={Color4.create(0.92, 0.08, 0.08, 1)}
        uiTransform={{ margin: { bottom: 16 } }}
        textAlign="middle-center"
      />
      <Label
        value="Return to spawn and recover"
        fontSize={16}
        color={Color4.create(0.80, 0.65, 0.65, 1)}
        uiTransform={{ margin: { bottom: 36 } }}
        textAlign="middle-center"
      />
      <Button
        value="RESPAWN"
        fontSize={20}
        uiTransform={{ width: 190, height: 60 }}
        uiBackground={{ color: Color4.create(0.22, 0.06, 0.06, 1) }}
        onMouseDown={() => gameMgr.respawnPlayer()}
      />
    </UiEntity>
  )
}
