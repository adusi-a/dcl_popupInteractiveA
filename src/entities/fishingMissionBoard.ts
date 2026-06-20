/**
 * fishingMissionBoard.ts — Fishing Mission Board entity
 *
 * Placed near the fishing pond (X=28, Z=145 — just south of the pond at Z=152).
 * Uses MissionGiverBehavior + the new NpcComposite/NpcPopupModule system.
 * Demonstrates the behavior-driven NPC pattern.
 *
 * Quest: FISHING_BASIC — "First Catch"
 *   Phase 1: "Catch a fish at the pond to the west."
 *   Phase 2: "Sell the fish at the Fishmonger."
 *   Phase 3: "Return to this Mission Board for your reward."
 *   Reward: 25g + 50 fishing_xp
 *
 * The fishingMechanic advances phase 1→2 on collect.
 * The Fishmonger craftItem advances phase 2→3 on fish sell.
 * Turning in here completes the quest.
 */

import { Vector3, Color4 } from '@dcl/sdk/math'
import { QuestDefinition } from '../dn-framework/quests/questState'
import { MissionGiverBehavior } from '../dn-framework/npcs/npcBehaviors'
import { createNpcEntity } from '../dn-framework/npcs/npcComposite'

// ─── Quest Definition ─────────────────────────────────────────────────────────

export const FISHING_BASIC_QUEST: QuestDefinition = {
  id: 'fishing_basic',
  title: 'First Catch',
  description:
    'Catch your first fish at the pond!\n\n' +
    'You\'ll need a rod and some bait.\n' +
    'Dig worms from the soil patches near the ore vein (free),\n' +
    'or buy Basic Bait from the Fishmonger to the north.',
  phases: [
    { description: 'Catch a fish at the pond to the south.' },
    { description: 'Sell the fish at the Fishmonger.' },
    { description: 'Return to this Mission Board for your reward.' },
  ],
  reward: {
    gold:  25,
    stats: { fishing_xp: 50 },
  },
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupFishingMissionBoard(gameMgr: any): void {
  // Register the quest with the game's QuestManager
  gameMgr.questMgr.register(FISHING_BASIC_QUEST, 'available')

  const missionGiver = new MissionGiverBehavior([FISHING_BASIC_QUEST])

  createNpcEntity({
    pos:       Vector3.create(28, 1.0, 145),
    scale:     Vector3.create(2.0, 1.6, 0.2),
    color:     Color4.create(0.28, 0.20, 0.08, 1),  // dark wood board
    label:     'Fishing\nMission Board',
    hoverText: 'Read Board [E]',
    npc: {
      displayName: 'Fishing Mission Board',
      missionGiver,
    },
    gameMgr,
  })
}
