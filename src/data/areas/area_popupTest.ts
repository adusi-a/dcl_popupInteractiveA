/**
 * @file area_popupTest.ts
 * @description Area definition for dcl_popupInteractiveA — popup & behavior system test scene.
 *
 * All entity placements, behaviors, and drops defined here as data.
 * AreaManager reads this and creates entities — no hardcoded setup functions needed.
 *
 * NOTE: Farm plots, fishing pond, fishing mission board, and chests remain handled
 * by their existing specialized setup functions until their behavior classes are ready
 * (FarmPlotBehavior, FishingSpotBehavior, LootBehavior). Those entity types are listed
 * here as stubs for completeness — AreaManager delegates them to legacy setup.
 *
 * Scene layout (spawn at 80,1,70 facing +Z toward Z=100):
 *   Gold coins:     X=48-72, Z=68-70
 *   Resource nodes: Z~38-52
 *   Worm field:     X=25-32, Z=50-56
 *   Smelter+Bench:  Z=82
 *   Chests:         Z=100       (legacy)
 *   Fishmonger:     X=28, Z=120
 *   Trader:         X=100, Z=147
 *   Farm plots:     Z=138-152   (legacy)
 *   Mission Board:  X=28, Z=145 (legacy)
 *   Fishing Pond:   X=28, Z=152 (legacy)
 */

import { AreaDefinition } from '../../dn-framework/data/areaTypes'

export const AREA_POPUP_TEST: AreaDefinition = {

  id: 'popup_test',

  spawnPoints: [
    { pos: [80, 1, 70], look: [80, 2, 100] }
  ],

  entities: [

    // ─── Town Elder (DialogueBehavior test NPC) ──────────────────────────────
    // Tests: branching dialogue, flag side effects, questStatus conditions, startQuest/turnInQuest.
    // Quest 'goblin_bounty' registered in GameManager constructor.

    {
      id: 'town_elder',
      type: 'interactive',
      pos: [55, 1.5, 65],
      entityScale: [2.0, 3.0, 2.0],
      color: [0.32, 0.60, 0.42, 1],
      label: 'ELDER\n[E]',
      hoverText: 'Speak to Elder',
      storyRole: 'townElder',
      behaviors: {
        dialogue: {
          startNodeId: 'root',
          nodes: [

            // ── Root ────────────────────────────────────────────────────────
            {
              id: 'root',
              speaker: 'Elder Bramwell',
              text: 'Greetings, traveler. Our village is beset by goblin raiders from the eastern rocks.',
              choices: [
                {
                  text: 'Tell me more about these goblins.',
                  nextNodeId: 'situation'
                },
                {
                  // Only shown when quest is not yet started
                  text: 'I will deal with the goblins.',
                  condition: { type: 'questStatus', key: 'goblin_bounty', value: 'locked' },
                  sideEffect: { type: 'startQuest', key: 'goblin_bounty' },
                  nextNodeId: 'quest_accepted'
                },
                {
                  // Shown while quest is in progress
                  text: 'I am still hunting goblins.',
                  condition: { type: 'questStatus', key: 'goblin_bounty', value: 'active' },
                  nextNodeId: 'inprogress'
                },
                {
                  // Shown when kills complete, reward pending
                  text: 'The goblin threat is ended.',
                  condition: { type: 'questStatus', key: 'goblin_bounty', value: 'complete' },
                  sideEffect: { type: 'turnInQuest', key: 'goblin_bounty' },
                  nextNodeId: 'rewarded'
                },
                {
                  text: 'Farewell, Elder.',
                  sideEffect: { type: 'setFlag', key: 'met_elder', value: true }
                  // no nextNodeId — closes popup
                }
              ]
            },

            // ── Situation explanation ────────────────────────────────────────
            {
              id: 'situation',
              speaker: 'Elder Bramwell',
              text: 'Five goblins lurk near the eastern rocks — you can see them from the ore veins. They steal our crops by night. Slay them and the village will reward you with 50 gold.',
              choices: [
                {
                  text: 'I will take that quest.',
                  condition: { type: 'questStatus', key: 'goblin_bounty', value: 'locked' },
                  sideEffect: { type: 'startQuest', key: 'goblin_bounty' },
                  nextNodeId: 'quest_accepted'
                },
                {
                  text: 'Understood. I will return.',
                  nextNodeId: 'root'
                }
              ]
            },

            // ── Quest accepted ──────────────────────────────────────────────
            {
              id: 'quest_accepted',
              speaker: 'Elder Bramwell',
              text: 'Brave soul! Slay five goblins near the eastern rocks. We will light a fire for your return.',
              choices: [
                { text: 'I will not fail.' }
                // no nextNodeId — closes
              ]
            },

            // ── Quest in progress ───────────────────────────────────────────
            {
              id: 'inprogress',
              speaker: 'Elder Bramwell',
              text: 'The village waits anxiously. Return when all five goblins are slain.',
              choices: [
                { text: 'I will return soon.' }
              ]
            },

            // ── Quest rewarded ──────────────────────────────────────────────
            {
              id: 'rewarded',
              speaker: 'Elder Bramwell',
              text: 'You have saved us! The village is in your debt. Here is your reward of 50 gold.',
              choices: [
                { text: 'Thank you, Elder.' }
              ]
            }

          ]
        }
      }
    },

    // ─── Gold Coins (auto-collect trigger zones) ─────────────────────────────

    { id: 'coin_1', type: 'gold_coin', pos: [72, 0, 68], amount: 5 },
    { id: 'coin_2', type: 'gold_coin', pos: [64, 0, 68], amount: 5 },
    { id: 'coin_3', type: 'gold_coin', pos: [56, 0, 70], amount: 5 },
    { id: 'coin_4', type: 'gold_coin', pos: [48, 0, 70], amount: 5 },

    // ─── Resource Nodes ──────────────────────────────────────────────────────

    {
      id: 'iron_ore_vein',
      type: 'resource_node',
      pos: [55, 1.2, 45],
      nodeScale: [2.2, 1.4, 2.2],
      color: [0.70, 0.38, 0.12, 1],
      label: 'Iron Ore\nVein  [E]',
      hoverText: 'Mine',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [
            { itemId: 'iron_ore', name: 'Iron Ore', quantity: 2 },
            { itemId: 'coal',     name: 'Coal',     quantity: 1 },
          ]
        }
      },
    },

    {
      id: 'woodpile',
      type: 'resource_node',
      pos: [72, 1.0, 38],
      nodeScale: [2.8, 1.2, 1.8],
      color: [0.52, 0.34, 0.14, 1],
      label: 'Woodpile\n[E]',
      hoverText: 'Chop',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [{ itemId: 'wood', name: 'Wood', quantity: 3 }]
        }
      },
    },

    {
      id: 'stone_outcrop',
      type: 'resource_node',
      pos: [88, 1.0, 52],
      nodeScale: [2.4, 1.0, 2.4],
      color: [0.58, 0.58, 0.62, 1],
      label: 'Stone\n[E]',
      hoverText: 'Mine',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [{ itemId: 'stone', name: 'Stone', quantity: 3 }]
        }
      },
    },

    {
      id: 'coal_deposit',
      type: 'resource_node',
      pos: [100, 1.0, 40],
      nodeScale: [2.0, 1.2, 2.0],
      color: [0.22, 0.22, 0.26, 1],
      label: 'Coal\n[E]',
      hoverText: 'Mine',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [{ itemId: 'coal', name: 'Coal', quantity: 2 }]
        }
      },
    },

    // ─── Worm Field Patches ──────────────────────────────────────────────────

    {
      id: 'worm_patch_1',
      type: 'resource_node',
      pos: [25, 0.075, 50],
      nodeScale: [4, 0.15, 4],
      color: [0.22, 0.14, 0.06, 1],
      label: 'Soil Patch\n[E] Dig Worms',
      hoverText: 'Dig Worms [E]',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [{ itemId: 'worm', name: 'Worm', quantity: 1 }]
        }
      },
      cooldownMs: 3000,
      cooldownLabel: 'Resting...',
    },

    {
      id: 'worm_patch_2',
      type: 'resource_node',
      pos: [32, 0.075, 56],
      nodeScale: [4, 0.15, 4],
      color: [0.22, 0.14, 0.06, 1],
      label: 'Soil Patch\n[E] Dig Worms',
      hoverText: 'Dig Worms [E]',
      drops: {
        dataMethod: 'inline',
        inlineContent: {
          type: 'set',
          drops: [{ itemId: 'worm', name: 'Worm', quantity: 1 }]
        }
      },
      cooldownMs: 3000,
      cooldownLabel: 'Resting...',
    },

    // ─── Smelter (RefinerBehavior) ───────────────────────────────────────────

    {
      id: 'smelter',
      type: 'interactive',
      pos: [60, 1.5, 82],
      entityScale: [2.8, 3.0, 2.8],
      color: [0.82, 0.28, 0.06, 1],
      label: 'SMELTER\n[E]',
      hoverText: 'Open Smelter',
      behaviors: {
        refiner: {
          dataMethod: 'inline',
          inlineContent: {
            stationName: 'Smelter',
            formulas: [
              {
                id: 'iron_bar',
                name: 'Smelt Iron Bar',
                inputItemId:    'iron_ore',
                inputName:      'Iron Ore',
                inputQuantity:  2,
                fuelItemId:     'coal',
                fuelName:       'Coal',
                fuelQuantity:   1,
                outputItemId:   'iron_bar',
                outputName:     'Iron Bar',
                outputQuantity: 1,
              },
            ]
          }
        }
      }
    },

    // ─── Workbench (CrafterBehavior) ─────────────────────────────────────────

    {
      id: 'workbench',
      type: 'interactive',
      pos: [100, 1.5, 82],
      entityScale: [3.2, 2.2, 2.0],
      color: [0.50, 0.32, 0.14, 1],
      label: 'WORKBENCH\n[E]',
      hoverText: 'Open Workbench',
      behaviors: {
        crafter: {
          dataMethod: 'inline',
          stationName: 'Workbench',
          recipeIds: ['rope', 'iron_sword', 'shield']
        }
      }
    },

    // ─── Chests A/B/C — LootBehavior (AreaManager-native) ───────────────────

    {
      id: 'chest_a', type: 'chest', pos: [50, 1.5, 100],
      chestType: 'auto',
      lootTitle: 'Supply Crate',
      drops: { dataMethod: 'inline', inlineContent: {
        type: 'set', drops: [
          { itemId: 'wood',        name: 'Wood',           quantity: 3   },
          { itemId: 'heal_potion', name: 'Healing Potion', quantity: 1   },
        ]
      }}
    },
    {
      id: 'chest_b', type: 'chest', pos: [80, 1.5, 100],
      chestType: 'loot_window',
      lootTitle: 'Old Chest',
      drops: { dataMethod: 'inline', inlineContent: {
        type: 'set', drops: [
          { itemId: 'iron_sword',  name: 'Iron Sword',     quantity: 1   },
          { itemId: 'heal_potion', name: 'Healing Potion', quantity: 2   },
          { itemId: 'gold',        name: 'Gold',           quantity: 100, isCurrency: true },
        ]
      }}
    },
    {
      id: 'chest_c', type: 'chest', pos: [110, 1.5, 100],
      chestType: 'choice',
      lootTitle: 'Ancient Relic',
      drops: { dataMethod: 'inline', inlineContent: {
        type: 'set', drops: [
          { itemId: 'enchanted_sword',      name: 'Enchanted Sword',      quantity: 1 },
          { itemId: 'shield_of_fortitude',  name: 'Shield of Fortitude',  quantity: 1 },
        ]
      }}
    },

    // ─── Fishmonger (SellerBehavior + BuyerBehavior) ─────────────────────────

    {
      id: 'fishmonger',
      type: 'interactive',
      pos: [28, 1.5, 120],
      entityScale: [2.2, 3.0, 2.2],
      color: [0.16, 0.52, 0.70, 1],
      label: 'FISHMONGER\n[E]',
      hoverText: 'Open Fishmonger',
      storyRole: 'fishmonger',
      behaviors: {
        seller: {
          dataMethod: 'inline',
          items: [
            { id: 'rod_t1',     name: 'Basic Rod',     priceMode: 'static', cost: 20,  quantity: 1, description: '15s cast time' },
            { id: 'rod_t2',     name: 'Good Rod',       priceMode: 'static', cost: 60,  quantity: 1, description: '10s cast time' },
            { id: 'rod_t3',     name: "Master's Rod",   priceMode: 'static', cost: 150, quantity: 1, description: '6s cast time'  },
            { id: 'bait_basic', name: 'Basic Bait',     priceMode: 'static', cost: 12,  quantity: 3, description: 'Worms are free from the soil patches!' },
          ]
        },
        buyer: {
          dataMethod: 'inline',
          items: [
            { itemId: 'perch', buyPriceMode: 'static', buyPrice: 3, onSellAction: 'onFishSold' },
            { itemId: 'bass',  buyPriceMode: 'static', buyPrice: 8, onSellAction: 'onFishSold' },
            { itemId: 'trout', buyPriceMode: 'static', buyPrice: 6, onSellAction: 'onFishSold' },
          ]
        }
      }
    },

    // ─── Trader (SellerBehavior + BuyerBehavior) ─────────────────────────────

    {
      id: 'trader',
      type: 'interactive',
      pos: [100, 1.5, 147],
      entityScale: [2.5, 3.2, 2.0],
      color: [0.42, 0.18, 0.72, 1],
      label: 'TRADER\n[E]',
      hoverText: 'Open Trader',
      behaviors: {
        seller: {
          dataMethod: 'inline',
          items: [
            { id: 'wheat_seeds', name: 'Wheat Seeds', priceMode: 'static', cost: 5, quantity: 1, description: 'Plant in a farm plot.' },
          ]
        },
        buyer: {
          dataMethod: 'inline',
          items: [
            { itemId: 'wheat', buyPriceMode: 'static', buyPrice: 3 },
          ]
        }
      }
    },

    // ─── Farm Plots — FarmPlotBehavior (AreaManager-native) ─────────────────

    { id: 'farm_plot_1', type: 'farm_plot', pos: [62, 0, 138], plotId: 'plot_1', growthMs: 30000 },
    { id: 'farm_plot_2', type: 'farm_plot', pos: [76, 0, 138], plotId: 'plot_2', growthMs: 30000 },
    { id: 'farm_plot_3', type: 'farm_plot', pos: [62, 0, 148], plotId: 'plot_3', growthMs: 30000 },
    { id: 'farm_plot_4', type: 'farm_plot', pos: [76, 0, 148], plotId: 'plot_4', growthMs: 30000 },

    // ─── Fishing Mission Board + Pond (legacy — FishingSpotBehavior pending) ─

    { id: 'fishing_mission_board', type: 'fishing_pond', pos: [28, 0, 145], pondId: 'mission_board' },
    { id: 'fishing_pond',          type: 'fishing_pond', pos: [28, 0, 152], pondId: 'main_pond' },

    // ─── Armorer NPC (equipItem dialogue side effect) ────────────────────────

    {
      id: 'armorer',
      type: 'interactive',
      pos: [105, 1.5, 88],
      entityScale: [2.0, 3.0, 2.0],
      color: [0.52, 0.32, 0.12, 1],
      label: 'ARMORER\n[E]',
      hoverText: 'Speak to Armorer',
      storyRole: 'armorer',
      behaviors: {
        dialogue: {
          startNodeId: 'root',
          nodes: [
            {
              id: 'root',
              speaker: 'Armorer',
              text: 'Need your gear fitted? Bring me what you have crafted and I will set it right.',
              choices: [
                {
                  text: 'Equip my Iron Sword.',
                  condition: { type: 'hasItem', key: 'iron_sword', value: 1 },
                  sideEffect: { type: 'equipItem', slot: 'weapon', key: 'iron_sword', name: 'Iron Sword', value: { attack: 8 } },
                  nextNodeId: 'equipped_sword'
                },
                {
                  text: 'Equip my Shield.',
                  condition: { type: 'hasItem', key: 'shield', value: 1 },
                  sideEffect: { type: 'equipItem', slot: 'offhand', key: 'shield', name: 'Shield', value: { defense: 5, shield: 80 } },
                  nextNodeId: 'equipped_shield'
                },
                {
                  text: 'Equip my Shield of Fortitude.',
                  condition: { type: 'hasItem', key: 'shield_of_fortitude', value: 1 },
                  sideEffect: { type: 'equipItem', slot: 'offhand', key: 'shield_of_fortitude', name: 'Shield of Fortitude', value: { defense: 8, shield: 120 } },
                  nextNodeId: 'equipped_fortitude'
                },
                { text: 'Nothing yet. Farewell.' }
              ]
            },
            {
              id: 'equipped_sword',
              speaker: 'Armorer',
              text: 'Fine blade — +8 Attack. There are goblins east of here if you want to test it.',
              choices: [{ text: 'I will find them.' }]
            },
            {
              id: 'equipped_shield',
              speaker: 'Armorer',
              text: 'Solid work — +5 Defense and 80 Shield points. Hits drain the shield first. When you stop taking damage, it recharges on its own.',
              choices: [{ text: 'Good to know.' }]
            },
            {
              id: 'equipped_fortitude',
              speaker: 'Armorer',
              text: "Ancient relic — rare craftsmanship. +8 Defense and 120 Shield points. That'll take a beating. Shield recharges when you're clear of combat.",
              choices: [{ text: 'Much appreciated.' }]
            }
          ]
        }
      }
    },

    // ─── Goblins (HealthBehavior + EnemyAIBehavior, tags goblin/enemy) ───────
    // 5 goblins = exactly the goblin_bounty kill quest requirement.
    // Each has 3g loot drop and respawns after 30s.
    // Aggro radius 10m — player needs to be within ~10m to trigger chase.

    { id: 'goblin_1', type: 'enemy', pos: [105, 1.0, 45], label: 'Goblin',
      color: [0.22, 0.52, 0.12, 1], entityScale: [1.6, 1.8, 1.6],
      health: { maxHp: 20, faction: 'enemy', tags: ['goblin','enemy'], respawnMs: 30000,
                lootDrops: [{ itemId: 'gold', name: 'Gold', quantity: 3, isCurrency: true }] },
      ai: { aggroRadius: 10, deaggroRadius: 18, attackRadius: 2, attackDamage: 5, speed: 3.0, wanderOnIdle: true } },

    { id: 'goblin_2', type: 'enemy', pos: [112, 1.0, 40], label: 'Goblin',
      color: [0.22, 0.52, 0.12, 1], entityScale: [1.6, 1.8, 1.6],
      health: { maxHp: 20, faction: 'enemy', tags: ['goblin','enemy'], respawnMs: 30000,
                lootDrops: [{ itemId: 'gold', name: 'Gold', quantity: 3, isCurrency: true }] },
      ai: { aggroRadius: 10, deaggroRadius: 18, attackRadius: 2, attackDamage: 5, speed: 3.0, wanderOnIdle: true } },

    { id: 'goblin_3', type: 'enemy', pos: [100, 1.0, 52], label: 'Goblin',
      color: [0.22, 0.52, 0.12, 1], entityScale: [1.6, 1.8, 1.6],
      health: { maxHp: 20, faction: 'enemy', tags: ['goblin','enemy'], respawnMs: 30000,
                lootDrops: [{ itemId: 'gold', name: 'Gold', quantity: 3, isCurrency: true }] },
      ai: { aggroRadius: 10, deaggroRadius: 18, attackRadius: 2, attackDamage: 5, speed: 3.0, wanderOnIdle: true } },

    { id: 'goblin_4', type: 'enemy', pos: [115, 1.0, 55], label: 'Goblin',
      color: [0.22, 0.52, 0.12, 1], entityScale: [1.6, 1.8, 1.6],
      health: { maxHp: 20, faction: 'enemy', tags: ['goblin','enemy'], respawnMs: 30000,
                lootDrops: [{ itemId: 'gold', name: 'Gold', quantity: 3, isCurrency: true }] },
      ai: { aggroRadius: 10, deaggroRadius: 18, attackRadius: 2, attackDamage: 5, speed: 3.0, wanderOnIdle: true } },

    { id: 'goblin_5', type: 'enemy', pos: [108, 1.0, 60], label: 'Goblin',
      color: [0.22, 0.52, 0.12, 1], entityScale: [1.6, 1.8, 1.6],
      health: { maxHp: 20, faction: 'enemy', tags: ['goblin','enemy'], respawnMs: 30000,
                lootDrops: [{ itemId: 'gold', name: 'Gold', quantity: 3, isCurrency: true }] },
      ai: { aggroRadius: 10, deaggroRadius: 18, attackRadius: 2, attackDamage: 5, speed: 3.0, wanderOnIdle: true } },

    // ─── Patrolling Guard (interactive + MovementBehavior patrol) ────────────
    // Tests: movement pauses when popup open, dialogue works while NPCs move.

    {
      id: 'guard_patrol',
      type: 'interactive',
      pos: [80, 1.5, 130],
      entityScale: [2.0, 3.0, 2.0],
      color: [0.22, 0.32, 0.62, 1],
      label: 'GUARD\n[E]',
      hoverText: 'Speak to Guard',
      movement: {
        type: 'patrol',
        speed: 2.5,
        waypoints: [
          [65, 1.5, 130],
          [65, 1.5, 165],
          [95, 1.5, 165],
          [95, 1.5, 130],
        ],
        waypointThreshold: 1.0,
      },
      behaviors: {
        dialogue: {
          startNodeId: 'root',
          nodes: [
            {
              id: 'root',
              speaker: 'Guard',
              text: 'Halt! This area is under the village watch. Move along.',
              choices: [
                { text: 'Understood.' },
                { text: 'Any news from the Elder?', nextNodeId: 'news' },
              ]
            },
            {
              id: 'news',
              speaker: 'Guard',
              text: 'The Elder mentioned something about goblins to the east. Best ask him directly.',
              choices: [
                { text: 'I already have.', nextNodeId: 'root' },
                { text: 'I will go speak to him.' },
              ]
            }
          ]
        }
      }
    },

    // ─── Wandering Critter (interactive box + MovementBehavior wander) ─────
    // Visible amber box wandering near the chests area.
    // Replace entityScale/color with a GLB once an animal model is available.

    {
      id: 'village_critter',
      type: 'interactive',
      pos: [80, 0.75, 78],
      entityScale: [1.0, 1.0, 1.0],
      color: [0.82, 0.52, 0.08, 1],   // amber
      label: '~',
      hoverText: 'Critter',
      behaviors: {},                    // no popup behaviors — click does nothing
      movement: {
        type: 'wander',
        speed: 1.5,
        wanderRadius: 10,
        dirChangeIntervalMs: 3500,
      }
    },

  ],

  zones: [

    // ─── Lava Pit (DamageZoneBehavior test) — Sprint 5 ──────────────────────
    // Placed in the goblin area (east of ore veins, around Z=48).
    // Player takes 8 damage every 1.5s while inside; shield absorbs first.
    // debug: true shows a visible red box — useful for testing, remove for prod.
    {
      id: 'goblin_lava_pit',
      pos: [105, 0.5, 48],
      scale: [20, 4, 20],
      debug: true,
      damage: {
        damagePerTick: 8,
        tickIntervalMs: 1500,
        label: '🔥 Lava!',
      }
    },

  ]

}
