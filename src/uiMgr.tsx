/**
 * uiMgr.tsx — React-ECS UI for dcl_popupInteractiveA
 *
 * HUD (always visible):
 *   MissionTrackerModule — top: 80px, left: 410px — active quest progress
 *   PlayerHud            — right panel: HP, shield, XP, stats, gold, inventory
 *   MenuButton           — bottom-left: opens Pause Menu
 *   AttackButton         — bottom-right: melee attack
 *   HintPanel            — bottom-center: key hints
 *
 * Full-screen overlays (rendered last = topmost):
 *   PauseMenuModule      — 5-tab modal: Missions / Inventory / Skills / Stats / Map
 *   DeathOverlay         — YOU DIED screen, blocks everything
 */

import ReactEcs, { Label, UiEntity, Button, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { engine, Transform } from '@dcl/sdk/ecs'
import { GameManager, SKILL_TREE } from './gameMgr'
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
    MenuButton({ gameMgr }),
    AttackButton({ gameMgr }),
    HintPanel(),

    // Overlays — rendered last (topmost)
    PauseMenuModule({ gameMgr }),
    DeathOverlay({ gameMgr }),
  ])
}

// ─── Shared palette ────────────────────────────────────────────────────────────

const CLR_PANEL    = Color4.create(0.04, 0.06, 0.14, 0.97)
const CLR_DIVIDER  = Color4.create(0.18, 0.22, 0.32, 1)
const CLR_GOLD     = Color4.create(1,    0.85, 0.10, 1)
const CLR_HP_OK    = Color4.create(0.3,  0.85, 0.3,  1)
const CLR_HP_WARN  = Color4.create(0.9,  0.7,  0.1,  1)
const CLR_HP_CRIT  = Color4.create(0.9,  0.2,  0.2,  1)
const CLR_SHIELD   = Color4.create(0.30, 0.55, 1.00, 1)
const CLR_XP       = Color4.create(0.65, 0.35, 1.00, 1)
const CLR_MUT      = Color4.create(0.5,  0.5,  0.55, 1)
const CLR_WHITE    = Color4.White()

// ─── Mission Tracker ───────────────────────────────────────────────────────────

function MissionTrackerModule({ gameMgr }: { gameMgr: GameManager }) {
  const activeQuests = gameMgr.questMgr.getActiveQuests()
  const completable  = gameMgr.questMgr.getCompletableQuests()
  const allShown     = [...activeQuests, ...completable]

  if (allShown.length === 0) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  const CLR_HEADER = Color4.create(0.65, 0.60, 0.50, 1)
  const CLR_TITLE  = Color4.create(1,    0.88, 0.35, 1)
  const CLR_DESC   = Color4.create(0.85, 0.85, 0.90, 1)
  const CLR_DONE   = Color4.create(0.35, 1,    0.45, 1)

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '80px', left: '410px' },
        width: 290,
        flexDirection: 'column',
        padding: { top: 10, left: 12, right: 12, bottom: 10 },
      }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.80) }}
    >
      <Label value="— Quests —" fontSize={12} color={CLR_HEADER} uiTransform={{ margin: { bottom: 7 } }} />
      {allShown.map((quest, idx) => {
        const isComplete = quest.status === 'complete'
        const desc = isComplete
          ? '✓ Return to quest giver'
          : gameMgr.questMgr.getCurrentPhaseDescription(quest.definition.id)
        return (
          <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 8 } }}>
            <Label value={quest.definition.title} fontSize={13} color={isComplete ? CLR_DONE : CLR_TITLE} />
            <Label value={desc} fontSize={11} color={isComplete ? CLR_DONE : CLR_DESC} uiTransform={{ margin: { top: 2 } }} />
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

// ─── Player HUD ───────────────────────────────────────────────────────────────

function PlayerHud({ gameMgr }: { gameMgr: GameManager }) {
  const inv    = gameMgr.playerInventory
  const items  = inv.getAllItems()
  const gold   = inv.getCurrency('gold')
  const fishXp = inv.getStat('fishing_xp')
  const hp     = gameMgr.playerHP
  const shield = gameMgr.playerShield
  const xp     = gameMgr.playerXP
  const hpPct  = Math.max(0, Math.min(1, hp.current / hp.max))
  const shPct  = shield.max > 0 ? Math.max(0, Math.min(1, shield.current / shield.max)) : 0
  const xpPct  = Math.max(0, Math.min(1, xp.current / xp.toNextLevel))
  const CLR_HP = hpPct > 0.5 ? CLR_HP_OK : hpPct > 0.25 ? CLR_HP_WARN : CLR_HP_CRIT

  const weapon   = gameMgr.equipment.get('weapon')
  const offhand  = gameMgr.equipment.get('offhand')
  const atk      = gameMgr.getEffectiveStat('attack')
  const def_stat = gameMgr.getEffectiveStat('defense')

  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', position: { top: '220px', right: '16px' }, width: 220, flexDirection: 'column', alignItems: 'flex-start', padding: { top: 10, left: 12, right: 12, bottom: 12 } }}
      uiBackground={{ color: Color4.create(0.04, 0.06, 0.12, 0.82) }}
    >
      {/* Level + XP */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 3 } }}>
        <Label value={`Lv ${xp.level}`} fontSize={12} color={CLR_XP} />
        <Label value={`${xp.current}/${xp.toNextLevel} XP`} fontSize={11} color={CLR_MUT} />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 5, margin: { bottom: 8 } }} uiBackground={{ color: Color4.create(0.15, 0.08, 0.20, 1) }}>
        <UiEntity uiTransform={{ width: `${Math.round(xpPct * 100)}%`, height: '100%' }} uiBackground={{ color: CLR_XP }} />
      </UiEntity>

      {/* Shield bar */}
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
        <Label value="HP" fontSize={12} color={Color4.create(0.8, 0.75, 0.5, 1)} />
        <Label value={`${hp.current} / ${hp.max}`} fontSize={12} color={CLR_HP} />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 8, margin: { bottom: 8 } }} uiBackground={{ color: Color4.create(0.15, 0.08, 0.08, 1) }}>
        <UiEntity uiTransform={{ width: `${Math.round(hpPct * 100)}%`, height: '100%' }} uiBackground={{ color: CLR_HP }} />
      </UiEntity>

      {/* Stats */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 2 } }}>
        <Label value={`⚔ ATK ${atk}`} fontSize={12} color={CLR_GOLD} />
        <Label value={`🛡 DEF ${def_stat}`} fontSize={12} color={Color4.create(0.6, 0.8, 1, 1)} />
      </UiEntity>
      {weapon   && <Label value={`  ${weapon.name}`}  fontSize={11} color={CLR_MUT} uiTransform={{ margin: { bottom: 2 } }} />}
      {offhand  && <Label value={`  ${offhand.name}`} fontSize={11} color={CLR_MUT} uiTransform={{ margin: { bottom: 2 } }} />}

      <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 4, bottom: 6 } }} uiBackground={{ color: CLR_DIVIDER }} />

      {/* Gold */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
        <Label value="Gold" fontSize={13} color={Color4.create(0.8, 0.75, 0.5, 1)} />
        <Label value={`${gold}g`} fontSize={13} color={CLR_GOLD} />
      </UiEntity>
      {fishXp > 0 && (
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
          <Label value="Fishing XP" fontSize={12} color={Color4.create(0.8, 0.75, 0.5, 1)} />
          <Label value={`${fishXp}`} fontSize={12} color={Color4.create(0.5, 0.88, 0.35, 1)} />
        </UiEntity>
      )}

      <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 2, bottom: 6 } }} uiBackground={{ color: CLR_DIVIDER }} />
      <Label value="-- Inventory --" fontSize={12} color={Color4.create(0.8, 0.75, 0.5, 1)} uiTransform={{ margin: { bottom: 6 } }} />
      {items.length === 0 && <Label value="(empty)" fontSize={12} color={CLR_MUT} />}
      {items.map((item, idx) => (
        <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 3 } }}>
          <Label value={item.name} fontSize={12} color={CLR_WHITE} />
          <Label value={`x${item.quantity}`} fontSize={12} color={CLR_GOLD} />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Menu Button ──────────────────────────────────────────────────────────────

function MenuButton({ gameMgr }: { gameMgr: GameManager }) {
  if (gameMgr.playerDead) return <UiEntity uiTransform={{ width: 0, height: 0 }} />
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: '60px', left: '16px' }, width: 80, height: 52 }}>
      <Button
        value="☰ MENU"
        fontSize={14}
        uiTransform={{ width: 80, height: 52 }}
        uiBackground={{ color: Color4.create(0.10, 0.15, 0.25, 0.95) }}
        onMouseDown={() => { gameMgr.pauseMenuOpen = !gameMgr.pauseMenuOpen }}
      />
    </UiEntity>
  )
}

// ─── Attack Button ────────────────────────────────────────────────────────────

function AttackButton({ gameMgr }: { gameMgr: GameManager }) {
  if (gameMgr.playerDead) return <UiEntity uiTransform={{ width: 0, height: 0 }} />
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: '60px', right: '16px' }, width: 110, height: 52, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// PAUSE MENU — Sprint 7
// ═══════════════════════════════════════════════════════════════════════════════

function PauseMenuModule({ gameMgr }: { gameMgr: GameManager }) {
  if (!gameMgr.pauseMenuOpen) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  const tab = gameMgr.pauseMenuTab
  const TABS: Array<{ id: typeof tab; label: string }> = [
    { id: 'missions',  label: 'Missions'  },
    { id: 'inventory', label: 'Inventory' },
    { id: 'skills',    label: 'Skills'    },
    { id: 'stats',     label: 'Stats'     },
    { id: 'map',       label: 'Map'       },
  ]

  return (
    // Full-screen darkened backdrop (4-corner constraint for correct Yoga centering)
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0, right: 0, bottom: 0 },
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.72) }}
    >
      {/* Modal panel */}
      <UiEntity
        uiTransform={{ width: 920, height: 680, flexDirection: 'column' }}
        uiBackground={{ color: CLR_PANEL }}
      >
        {/* Tab bar */}
        <UiEntity
          uiTransform={{ width: '100%', height: 48, flexDirection: 'row', alignItems: 'center' }}
          uiBackground={{ color: Color4.create(0.06, 0.09, 0.18, 1) }}
        >
          {TABS.map((t, i) => (
            <Button
              key={i.toString()}
              value={t.label}
              fontSize={14}
              uiTransform={{ width: 140, height: 48 }}
              uiBackground={{ color: tab === t.id
                ? Color4.create(0.14, 0.22, 0.42, 1)
                : Color4.create(0.06, 0.09, 0.18, 0) }}
              onMouseDown={() => { gameMgr.pauseMenuTab = t.id }}
            />
          ))}
          {/* Spacer */}
          <UiEntity uiTransform={{ flex: 1 }} />
          <Button
            value="✕ Close"
            fontSize={13}
            uiTransform={{ width: 90, height: 48 }}
            uiBackground={{ color: Color4.create(0.28, 0.06, 0.06, 1) }}
            onMouseDown={() => { gameMgr.pauseMenuOpen = false }}
          />
        </UiEntity>

        {/* Divider */}
        <UiEntity uiTransform={{ width: '100%', height: 1 }} uiBackground={{ color: CLR_DIVIDER }} />

        {/* Tab content */}
        <UiEntity uiTransform={{ flex: 1, width: '100%', flexDirection: 'column' }}>
          {tab === 'missions'  && <MissionsTab  gameMgr={gameMgr} />}
          {tab === 'inventory' && <InventoryTab gameMgr={gameMgr} />}
          {tab === 'skills'    && <SkillsTab    gameMgr={gameMgr} />}
          {tab === 'stats'     && <StatsTab     gameMgr={gameMgr} />}
          {tab === 'map'       && <MapTab       gameMgr={gameMgr} />}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────

function MissionsTab({ gameMgr }: { gameMgr: GameManager }) {
  const quests = gameMgr.questMgr.getAllQuests().filter(q => q.status !== 'locked')
  const STATUS_COLOR: Record<string, Color4> = {
    available: Color4.create(0.6, 0.8, 0.4, 1),
    active:    CLR_GOLD,
    complete:  Color4.create(0.35, 1, 0.45, 1),
    turned_in: CLR_MUT,
  }
  const STATUS_LABEL: Record<string, string> = {
    available: 'AVAILABLE',
    active:    'ACTIVE',
    complete:  'COMPLETE — return to giver',
    turned_in: 'TURNED IN',
  }

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: { top: 20, left: 28, right: 28, bottom: 20 } }}>
      <Label value="Active + Available Quests" fontSize={16} color={CLR_WHITE} uiTransform={{ margin: { bottom: 16 } }} />
      {quests.length === 0 && <Label value="No quests available yet. Speak to the Town Elder." fontSize={14} color={CLR_MUT} />}
      {quests.map((q, idx) => {
        const clr  = STATUS_COLOR[q.status]  ?? CLR_MUT
        const lbl  = STATUS_LABEL[q.status]  ?? q.status
        const desc = q.status === 'active'
          ? gameMgr.questMgr.getCurrentPhaseDescription(q.definition.id)
          : q.definition.description
        return (
          <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 18 } }}>
            <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
              <Label value={q.definition.title} fontSize={14} color={CLR_WHITE} />
              <Label value={lbl} fontSize={12} color={clr} />
            </UiEntity>
            <Label value={desc} fontSize={12} color={Color4.create(0.75, 0.75, 0.80, 1)} />
            {q.definition.reward && q.status !== 'turned_in' && (
              <Label
                value={`Reward: ${q.definition.reward.gold ? `${q.definition.reward.gold}g` : ''}`}
                fontSize={11}
                color={CLR_GOLD}
                uiTransform={{ margin: { top: 3 } }}
              />
            )}
            <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 10 } }} uiBackground={{ color: CLR_DIVIDER }} />
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ gameMgr }: { gameMgr: GameManager }) {
  const items   = gameMgr.playerInventory.getAllItems()
  const gold    = gameMgr.playerInventory.getCurrency('gold')
  const weapon  = gameMgr.equipment.get('weapon')
  const offhand = gameMgr.equipment.get('offhand')
  const acc     = gameMgr.equipment.get('accessory')
  const SLOT_CLR = Color4.create(0.12, 0.16, 0.28, 1)

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', padding: { top: 20, left: 28, right: 28, bottom: 20 } }}>

      {/* Left: equipped gear */}
      <UiEntity uiTransform={{ width: 260, flexDirection: 'column', margin: { right: 36 } }}>
        <Label value="Equipment" fontSize={15} color={CLR_WHITE} uiTransform={{ margin: { bottom: 14 } }} />
        {([['Weapon', weapon], ['Offhand', offhand], ['Accessory', acc]] as [string, any][]).map(([slot, item], idx) => (
          <UiEntity key={idx.toString()} uiTransform={{ width: 240, flexDirection: 'column', margin: { bottom: 12 } }}>
            <Label value={slot} fontSize={11} color={CLR_MUT} uiTransform={{ margin: { bottom: 3 } }} />
            <UiEntity
              uiTransform={{ width: 240, height: 44, flexDirection: 'row', alignItems: 'center', padding: { left: 10, right: 10, top: 6, bottom: 6 } }}
              uiBackground={{ color: SLOT_CLR }}
            >
              {item
                ? <>
                    <Label value={item.name} fontSize={13} color={CLR_GOLD} />
                    <UiEntity uiTransform={{ flex: 1 }} />
                    <Label value={Object.entries(item.stats).filter(([k]) => k !== 'shield').map(([k, v]) => `+${v} ${k}`).join('  ')} fontSize={11} color={Color4.create(0.6, 0.8, 1, 1)} />
                  </>
                : <Label value="(empty)" fontSize={12} color={CLR_MUT} />
              }
            </UiEntity>
          </UiEntity>
        ))}
        <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 8, bottom: 14 } }} uiBackground={{ color: CLR_DIVIDER }} />
        <UiEntity uiTransform={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label value="Gold" fontSize={13} color={Color4.create(0.8, 0.75, 0.5, 1)} />
          <Label value={`${gold}g`} fontSize={13} color={CLR_GOLD} />
        </UiEntity>
      </UiEntity>

      {/* Divider */}
      <UiEntity uiTransform={{ width: 1, height: '100%' }} uiBackground={{ color: CLR_DIVIDER }} />

      {/* Right: item list */}
      <UiEntity uiTransform={{ flex: 1, flexDirection: 'column', padding: { left: 28 } }}>
        <Label value="Items" fontSize={15} color={CLR_WHITE} uiTransform={{ margin: { bottom: 14 } }} />
        {items.length === 0 && <Label value="(empty)" fontSize={13} color={CLR_MUT} />}
        {items.map((item, idx) => (
          <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 8 } }}>
            <Label value={item.name} fontSize={13} color={CLR_WHITE} />
            <Label value={`× ${item.quantity}`} fontSize={13} color={CLR_GOLD} />
          </UiEntity>
        ))}
        <Label value="Equip items through the Armorer NPC." fontSize={11} color={CLR_MUT} uiTransform={{ margin: { top: 20 } }} />
      </UiEntity>

    </UiEntity>
  )
}

// ─── Skills Tab ───────────────────────────────────────────────────────────────

function SkillsTab({ gameMgr }: { gameMgr: GameManager }) {
  const branches: Array<{ id: string; label: string; clr: Color4 }> = [
    { id: 'warrior',  label: '⚔ Warrior',  clr: Color4.create(0.9, 0.35, 0.2, 1) },
    { id: 'guardian', label: '🛡 Guardian', clr: Color4.create(0.3, 0.6,  1.0, 1) },
    { id: 'sage',     label: '✦ Sage',     clr: Color4.create(0.6, 0.35, 1.0, 1) },
  ]

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', padding: { top: 16, left: 24, right: 24, bottom: 16 } }}>
      {/* Skill points header */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 16 } }}>
        <Label value="Passive Skill Tree" fontSize={15} color={CLR_WHITE} />
        <Label
          value={`Skill Points: ${gameMgr.playerSkillPoints}  (Level up to earn more)`}
          fontSize={12}
          color={gameMgr.playerSkillPoints > 0 ? CLR_XP : CLR_MUT}
        />
      </UiEntity>

      {/* Three branches side by side */}
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row' }}>
        {branches.map((branch, bi) => {
          const branchSkills = SKILL_TREE.filter(s => s.branch === branch.id)
          return (
            <UiEntity key={bi.toString()} uiTransform={{ flex: 1, flexDirection: 'column', margin: { right: bi < 2 ? 12 : 0 } }}>
              {/* Branch header */}
              <UiEntity
                uiTransform={{ width: '100%', height: 38, alignItems: 'center', justifyContent: 'center', margin: { bottom: 10 } }}
                uiBackground={{ color: Color4.create(0.10, 0.14, 0.24, 1) }}
              >
                <Label value={branch.label} fontSize={14} color={branch.clr} textAlign="middle-center" />
              </UiEntity>

              {/* Skill nodes */}
              {branchSkills.map((skill, si) => {
                const learned   = gameMgr.playerSkills.has(skill.id)
                const prereqMet = !skill.requires || gameMgr.playerSkills.has(skill.requires)
                const canLearn  = !learned && prereqMet && gameMgr.playerSkillPoints >= skill.cost
                const bgColor   = learned   ? Color4.create(0.10, 0.30, 0.14, 1)
                                : canLearn  ? Color4.create(0.12, 0.18, 0.30, 1)
                                : Color4.create(0.08, 0.09, 0.12, 1)
                const nameColor = learned   ? Color4.create(0.4, 1.0, 0.5, 1)
                                : canLearn  ? CLR_WHITE
                                : CLR_MUT

                return (
                  <UiEntity
                    key={si.toString()}
                    uiTransform={{ width: '100%', flexDirection: 'column', margin: { bottom: 8 }, padding: { top: 10, left: 12, right: 12, bottom: 10 } }}
                    uiBackground={{ color: bgColor }}
                  >
                    <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
                      <Label value={learned ? `✓ ${skill.name}` : skill.name} fontSize={13} color={nameColor} />
                      <Label value={learned ? '—' : `${skill.cost} pt`} fontSize={11} color={learned ? CLR_MUT : CLR_GOLD} />
                    </UiEntity>
                    <Label value={skill.description} fontSize={11} color={Color4.create(0.7, 0.7, 0.75, 1)} uiTransform={{ margin: { bottom: 6 } }} />
                    {skill.requires && (
                      <Label
                        value={`Requires: ${SKILL_TREE.find(s => s.id === skill.requires)?.name ?? skill.requires}`}
                        fontSize={10}
                        color={prereqMet ? Color4.create(0.5, 0.7, 0.4, 1) : Color4.create(0.6, 0.4, 0.4, 1)}
                        uiTransform={{ margin: { bottom: 4 } }}
                      />
                    )}
                    {canLearn && (
                      <Button
                        value="Learn"
                        fontSize={12}
                        uiTransform={{ width: '100%', height: 28 }}
                        uiBackground={{ color: Color4.create(0.15, 0.30, 0.50, 1) }}
                        onMouseDown={() => gameMgr.learnSkill(skill.id)}
                      />
                    )}
                  </UiEntity>
                )
              })}
            </UiEntity>
          )
        })}
      </UiEntity>
    </UiEntity>
  )
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ gameMgr }: { gameMgr: GameManager }) {
  const xp     = gameMgr.playerXP
  const xpPct  = Math.max(0, Math.min(1, xp.current / xp.toNextLevel))
  const hp     = gameMgr.playerHP
  const shield = gameMgr.playerShield

  // Count goblin kills from quest progress
  const goblinQ    = gameMgr.questMgr.getQuest('goblin_bounty')
  const goblinKills= (goblinQ?.progress?.['kills_p0'] as number) ?? 0

  // Skill summary
  const learned = SKILL_TREE.filter(s => gameMgr.playerSkills.has(s.id))

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', padding: { top: 20, left: 28, right: 28, bottom: 20 } }}>

      {/* Left column */}
      <UiEntity uiTransform={{ flex: 1, flexDirection: 'column', margin: { right: 40 } }}>
        <Label value="Character" fontSize={15} color={CLR_WHITE} uiTransform={{ margin: { bottom: 14 } }} />

        {/* Level + XP bar */}
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 4 } }}>
          <Label value={`Level ${xp.level}`} fontSize={14} color={CLR_XP} />
          <Label value={`${xp.current} / ${xp.toNextLevel} XP`} fontSize={12} color={CLR_MUT} />
        </UiEntity>
        <UiEntity uiTransform={{ width: '100%', height: 8, margin: { bottom: 14 } }} uiBackground={{ color: Color4.create(0.15, 0.08, 0.22, 1) }}>
          <UiEntity uiTransform={{ width: `${Math.round(xpPct * 100)}%`, height: '100%' }} uiBackground={{ color: CLR_XP }} />
        </UiEntity>

        {/* Skill points */}
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 8 } }}>
          <Label value="Skill Points" fontSize={13} color={Color4.create(0.8, 0.75, 0.5, 1)} />
          <Label value={`${gameMgr.playerSkillPoints}`} fontSize={13} color={gameMgr.playerSkillPoints > 0 ? CLR_XP : CLR_MUT} />
        </UiEntity>

        <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 4, bottom: 12 } }} uiBackground={{ color: CLR_DIVIDER }} />

        {/* Combat stats */}
        {[
          ['Max HP',   `${hp.current} / ${hp.max}`],
          ['Max Shield', shield.max > 0 ? `${Math.ceil(shield.current)} / ${shield.max}` : 'None'],
          ['Attack',   `${gameMgr.getEffectiveStat('attack')}`],
          ['Defense',  `${gameMgr.getEffectiveStat('defense')}`],
          ['Goblin Kills', `${goblinKills}`],
        ].map(([k, v], idx) => (
          <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 8 } }}>
            <Label value={k} fontSize={13} color={Color4.create(0.8, 0.75, 0.5, 1)} />
            <Label value={v} fontSize={13} color={CLR_WHITE} />
          </UiEntity>
        ))}
      </UiEntity>

      {/* Right column — learned skills */}
      <UiEntity uiTransform={{ flex: 1, flexDirection: 'column' }}>
        <Label value="Skills Learned" fontSize={15} color={CLR_WHITE} uiTransform={{ margin: { bottom: 14 } }} />
        {learned.length === 0
          ? <Label value="None yet. Level up to earn skill points." fontSize={13} color={CLR_MUT} />
          : learned.map((s, idx) => (
            <UiEntity key={idx.toString()} uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 8 } }}>
              <Label value={`✓ ${s.name}`} fontSize={13} color={Color4.create(0.4, 1, 0.5, 1)} />
              <Label value={s.description} fontSize={11} color={CLR_MUT} />
            </UiEntity>
          ))
        }
      </UiEntity>

    </UiEntity>
  )
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────
// 2D schematic of the popup_test scene.
// World bounds: X 20-125, Z 38-170. Scale: 4.4px/unit X, 3.8px/unit Z.

function MapTab({ gameMgr }: { gameMgr: GameManager }) {
  // Player position (updated each frame via PlayerEntity Transform)
  const playerT = Transform.getOrNull(engine.PlayerEntity)
  const px = playerT?.position?.x ?? 80
  const pz = playerT?.position?.z ?? 70

  const OX = 20  // world X origin
  const OZ = 38  // world Z origin
  const SX = 4.4 // px per world unit X
  const SZ = 3.8 // px per world unit Z

  function wx(x: number) { return Math.round((x - OX) * SX) }
  function wz(z: number) { return Math.round((z - OZ) * SZ) }

  // Notable scene locations: [worldX, worldZ, label, color]
  const LOCS: Array<{ x: number; z: number; label: string; clr: Color4; size?: number }> = [
    { x:  80, z:  70, label: '⬤ Spawn',       clr: Color4.create(0.2,  0.8,  0.2,  1) },
    { x:  55, z:  65, label: 'Elder',          clr: Color4.create(0.3,  0.6,  0.4,  1) },
    { x:  55, z:  45, label: 'Iron Ore',       clr: Color4.create(0.7,  0.4,  0.1,  1) },
    { x:  72, z:  38, label: 'Wood',           clr: Color4.create(0.5,  0.32, 0.12, 1) },
    { x:  88, z:  52, label: 'Stone',          clr: Color4.create(0.55, 0.55, 0.6,  1) },
    { x: 100, z:  40, label: 'Coal',           clr: Color4.create(0.25, 0.25, 0.28, 1) },
    { x:  28, z:  52, label: 'Worms',          clr: Color4.create(0.25, 0.15, 0.06, 1) },
    { x:  60, z:  82, label: 'Smelter',        clr: Color4.create(0.8,  0.28, 0.06, 1) },
    { x: 100, z:  82, label: 'Workbench',      clr: Color4.create(0.5,  0.32, 0.14, 1) },
    { x: 105, z:  88, label: 'Armorer',        clr: Color4.create(0.52, 0.32, 0.12, 1) },
    { x: 108, z:  48, label: '☠ Goblins',     clr: Color4.create(0.22, 0.52, 0.12, 1), size: 10 },
    { x: 105, z:  48, label: '🔥 Lava',        clr: Color4.create(0.9,  0.3,  0.05, 1) },
    { x:  28, z: 120, label: 'Fishmonger',     clr: Color4.create(0.16, 0.52, 0.70, 1) },
    { x: 100, z: 147, label: 'Trader',         clr: Color4.create(0.42, 0.18, 0.72, 1) },
    { x:  69, z: 143, label: 'Farm Plots',     clr: Color4.create(0.18, 0.55, 0.18, 1) },
    { x:  28, z: 152, label: 'Fishing Pond',   clr: Color4.create(0.16, 0.35, 0.65, 1) },
  ]

  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', padding: { top: 16, left: 24, right: 24, bottom: 16 } }}>

      {/* Map canvas */}
      <UiEntity
        uiTransform={{ width: 480, height: 510, positionType: 'relative' }}
        uiBackground={{ color: Color4.create(0.06, 0.10, 0.16, 1) }}
      >
        {/* Location dots + labels */}
        {LOCS.map((loc, idx) => {
          const dotSize = loc.size ?? 8
          return (
            <UiEntity
              key={idx.toString()}
              uiTransform={{
                positionType: 'absolute',
                position: { left: wx(loc.x) - Math.round(dotSize / 2), top: wz(loc.z) - Math.round(dotSize / 2) },
                width: dotSize, height: dotSize,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <UiEntity
                uiTransform={{ width: dotSize, height: dotSize }}
                uiBackground={{ color: loc.clr }}
              />
              <Label value={` ${loc.label}`} fontSize={8} color={Color4.create(0.85, 0.85, 0.9, 1)} />
            </UiEntity>
          )
        })}

        {/* Player dot */}
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: wx(px) - 6, top: wz(pz) - 6 },
            width: 12, height: 12,
          }}
          uiBackground={{ color: Color4.create(0.2, 0.9, 0.2, 1) }}
        />
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: wx(px) + 8, top: wz(pz) - 4 },
          }}
        >
          <Label value="YOU" fontSize={9} color={Color4.create(0.2, 0.9, 0.2, 1)} />
        </UiEntity>

        {/* North indicator */}
        <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 4, right: 4 } }}>
          <Label value="N ↑" fontSize={9} color={CLR_MUT} />
        </UiEntity>
      </UiEntity>

      {/* Legend */}
      <UiEntity uiTransform={{ flex: 1, flexDirection: 'column', padding: { left: 24, top: 4 } }}>
        <Label value="Legend" fontSize={14} color={CLR_WHITE} uiTransform={{ margin: { bottom: 12 } }} />
        {[
          { label: 'You (green)',      clr: Color4.create(0.2,  0.9,  0.2,  1) },
          { label: 'Spawn point',      clr: Color4.create(0.2,  0.8,  0.2,  1) },
          { label: 'NPCs',             clr: Color4.create(0.3,  0.6,  0.4,  1) },
          { label: 'Resources',        clr: Color4.create(0.7,  0.4,  0.1,  1) },
          { label: 'Crafting stations',clr: Color4.create(0.5,  0.32, 0.14, 1) },
          { label: 'Enemies',          clr: Color4.create(0.22, 0.52, 0.12, 1) },
          { label: 'Hazard zone',      clr: Color4.create(0.9,  0.3,  0.05, 1) },
          { label: 'Trade / Economy',  clr: Color4.create(0.42, 0.18, 0.72, 1) },
          { label: 'Fishing / Farm',   clr: Color4.create(0.16, 0.52, 0.70, 1) },
        ].map((e, idx) => (
          <UiEntity key={idx.toString()} uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 8 } }}>
            <UiEntity uiTransform={{ width: 10, height: 10, margin: { right: 8 } }} uiBackground={{ color: e.clr }} />
            <Label value={e.label} fontSize={11} color={Color4.create(0.75, 0.75, 0.8, 1)} />
          </UiEntity>
        ))}
        <UiEntity uiTransform={{ width: '100%', height: 1, margin: { top: 12, bottom: 12 } }} uiBackground={{ color: CLR_DIVIDER }} />
        <Label value="Map is schematic only." fontSize={10} color={CLR_MUT} />
        <Label value="Player dot updates in real time." fontSize={10} color={CLR_MUT} uiTransform={{ margin: { top: 4 } }} />
      </UiEntity>

    </UiEntity>
  )
}

// ─── Death Overlay ────────────────────────────────────────────────────────────

function DeathOverlay({ gameMgr }: { gameMgr: GameManager }) {
  if (!gameMgr.playerDead) return <UiEntity uiTransform={{ width: 0, height: 0 }} />

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0, right: 0, bottom: 0 },
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: Color4.create(0.30, 0, 0, 0.88) }}
    >
      <Label value="YOU DIED" fontSize={60} color={Color4.create(0.92, 0.08, 0.08, 1)} uiTransform={{ margin: { bottom: 16 } }} textAlign="middle-center" />
      <Label value="Return to spawn and recover" fontSize={16} color={Color4.create(0.80, 0.65, 0.65, 1)} uiTransform={{ margin: { bottom: 36 } }} textAlign="middle-center" />
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
