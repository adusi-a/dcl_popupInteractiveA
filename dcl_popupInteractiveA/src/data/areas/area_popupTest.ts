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

    // ─── Chests A/B/C (stubs — legacy setup until LootBehavior is ready) ─────

    { id: 'chest_a', type: 'chest', pos: [72, 0, 100],
      drops: { dataMethod: 'inline', inlineContent: { type: 'set', drops: [{ itemId: 'heal_potion', name: 'Healing Potion', quantity: 1 }] } } },
    { id: 'chest_b', type: 'chest', pos: [80, 0, 100],
      drops: { dataMethod: 'inline', inlineContent: { type: 'set', drops: [{ itemId: 'gold', name: 'Gold', quantity: 20, isCurrency: true }] } } },
    { id: 'chest_c', type: 'chest', pos: [88, 0, 100],
      drops: { dataMethod: 'inline', inlineContent: { type: 'set', drops: [{ itemId: 'enchanted_sword', name: 'Enchanted Sword', quantity: 1 }] } } },

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
            { itemId: 'perch', buyPriceMode: 'static', buyPrice: 3 },
            { itemId: 'bass',  buyPriceMode: 'static', buyPrice: 8 },
            { itemId: 'trout', buyPriceMode: 'static', buyPrice: 6 },
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

    // ─── Farm Plots (stubs — legacy setup until FarmPlotBehavior is ready) ───

    { id: 'farm_plot_1', type: 'farm_plot', pos: [72, 0, 138],  plotId: 'plot_1', growthMs: 30000 },
    { id: 'farm_plot_2', type: 'farm_plot', pos: [80, 0, 138],  plotId: 'plot_2', growthMs: 30000 },
    { id: 'farm_plot_3', type: 'farm_plot', pos: [72, 0, 148],  plotId: 'plot_3', growthMs: 30000 },
    { id: 'farm_plot_4', type: 'farm_plot', pos: [80, 0, 148],  plotId: 'plot_4', growthMs: 30000 },

    // ─── Fishing Mission Board (stub — legacy until MissionGiver in AreaManager) ─

    { id: 'fishing_mission_board', type: 'fishing_pond', pos: [28, 0, 145], pondId: 'mission_board' },

    // ─── Fishing Pond (stub — legacy setup) ─────────────────────────────────

    { id: 'fishing_pond', type: 'fishing_pond', pos: [28, 0, 152], pondId: 'main_pond' },

  ],

  zones: [
    // Example zone — add real zones as the scene grows
    // { id: 'spawn_area', pos: [80, 1, 70], scale: [20, 4, 20], onEnter: 'onEnterSpawnZone' }
  ]

}
