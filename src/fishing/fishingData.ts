/**
 * fishingData.ts — Fish, pole, and bait definitions for dcl_popupInteractiveA
 *
 * Fish are STACKABLE in inventory (perch/bass/trout as plain items).
 * Weight is calculated at catch time for popup display only — does NOT affect
 * inventory name or sell price. Sell prices are flat per type at the Fishmonger.
 *
 * Poles: 3 tiers — Basic Rod (15s), Good Rod (10s), Master's Rod (6s).
 * Bait:  Worm (free from soil patches) | Basic Bait (bought at Fishmonger).
 */

// ─── Fish ──────────────────────────────────────────────────────────────────────

export interface FishDef {
  id: string           // inventory itemId
  displayName: string
  weightMinLbs: number
  weightMaxLbs: number
  sellPrice: number    // flat gold per fish at Fishmonger
  catchWeight: number  // relative spawn probability
}

export const FISH_DEFS: FishDef[] = [
  { id: 'perch',  displayName: 'Perch',  weightMinLbs: 0.3, weightMaxLbs: 1.2, sellPrice: 3,  catchWeight: 50 },
  { id: 'bass',   displayName: 'Bass',   weightMinLbs: 1.0, weightMaxLbs: 4.5, sellPrice: 8,  catchWeight: 35 },
  { id: 'trout',  displayName: 'Trout',  weightMinLbs: 0.8, weightMaxLbs: 3.0, sellPrice: 6,  catchWeight: 15 },
]

export function getFishDef(id: string): FishDef | undefined {
  return FISH_DEFS.find(f => f.id === id)
}

// ─── Poles ─────────────────────────────────────────────────────────────────────

export interface PoleDef {
  id: string
  displayName: string
  castTimeSeconds: number
  catchQualityBonus: number  // [0-1] biases weight toward max
}

export const POLE_DEFS: PoleDef[] = [
  { id: 'rod_t1', displayName: 'Basic Rod',     castTimeSeconds: 15, catchQualityBonus: 0    },
  { id: 'rod_t2', displayName: 'Good Rod',       castTimeSeconds: 10, catchQualityBonus: 0.15 },
  { id: 'rod_t3', displayName: "Master's Rod",   castTimeSeconds: 6,  catchQualityBonus: 0.30 },
]

export function getPoleDef(id: string): PoleDef | undefined {
  return POLE_DEFS.find(p => p.id === id)
}

export const VALID_POLE_IDS: string[] = POLE_DEFS.map(p => p.id)

// ─── Bait ──────────────────────────────────────────────────────────────────────

export interface BaitDef {
  id: string
  displayName: string
}

export const BAIT_DEFS: BaitDef[] = [
  { id: 'worm',       displayName: 'Worm'        },
  { id: 'bait_basic', displayName: 'Basic Bait'  },
]

export function getBaitDef(id: string): BaitDef | undefined {
  return BAIT_DEFS.find(b => b.id === id)
}

export const VALID_BAIT_IDS: string[] = BAIT_DEFS.map(b => b.id)

// ─── Catch Resolution ──────────────────────────────────────────────────────────

export interface CatchResult {
  fishId: string        // inventory itemId to add ('bass', 'perch', 'trout')
  displayName: string   // 'Bass'
  weightLbs: number     // for popup display only
  catchLabel: string    // "Bass (2.2lb)" — shown in fishing popup caught phase
  sellPrice: number     // approx gold at Fishmonger — shown in popup info
}

/**
 * Resolve a random catch.
 * Fish are stackable — weight is for popup display only.
 */
export function resolveCatch(poleId: string): CatchResult {
  const pole = getPoleDef(poleId) ?? POLE_DEFS[0]

  // Weighted random fish
  const total = FISH_DEFS.reduce((s, f) => s + f.catchWeight, 0)
  let rand = Math.random() * total
  let fish = FISH_DEFS[FISH_DEFS.length - 1]
  for (const f of FISH_DEFS) {
    rand -= f.catchWeight
    if (rand <= 0) { fish = f; break }
  }

  // Weight (biased by pole quality)
  const rawW    = fish.weightMinLbs + Math.random() * (fish.weightMaxLbs - fish.weightMinLbs)
  const bonusW  = rawW + (fish.weightMaxLbs - rawW) * pole.catchQualityBonus
  const weightLbs = Math.round(bonusW * 10) / 10

  return {
    fishId:      fish.id,
    displayName: fish.displayName,
    weightLbs,
    catchLabel:  `${fish.displayName} (${weightLbs}lb)`,
    sellPrice:   fish.sellPrice,
  }
}
