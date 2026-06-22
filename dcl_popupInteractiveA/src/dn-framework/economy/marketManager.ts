/**
 * @file marketManager.ts
 * @module DN DCL Framework / economy
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Holds currency definitions and exchange rates.
 * All currency conversions go through MarketManager — even static rates — so
 * swapping to dynamic market logic later requires no changes at call sites.
 *
 * Static mode (default):  rates are fixed at construction, never change.
 * Dynamic mode (subclass): override updateRates(dt) to vary rates over time
 *   based on in-game market conditions (supply/demand, events, etc.).
 *   A MarketManager subclass would be managed by a dedicated MarketSystem ECS
 *   system. For now, all rates are static.
 *
 * Rate model: each currency has a value relative to a base unit.
 * Example with gold as base (rate=1):
 *   gold:   1.0    (base unit)
 *   silver: 0.01   (100 silver = 1 gold)
 *   gems:   10.0   (1 gem = 10 gold)
 *
 * Usage:
 *   const market = new MarketManager({ gold: 1, silver: 0.01, gems: 10 })
 *   market.convert(5, 'gems', 'gold')   // → 50
 *   market.convert(200, 'silver', 'gold') // → 2
 *   market.getRate('gold')               // → 1
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA behavior-system sprint.
 */

export interface CurrencyDefinition {
  key: string
  displayName: string
  /** Rate relative to the base unit (where base = 1.0). */
  rate: number
  /** Symbol shown in UI, e.g. 'g', '💎', 'sp'. */
  symbol?: string
}

export class MarketManager {

  protected _currencies: Map<string, CurrencyDefinition> = new Map()

  /**
   * @param currencies  Array of currency definitions, OR a simple rate map
   *   { gold: 1, silver: 0.01 }. Keys become currency keys.
   */
  constructor(currencies: CurrencyDefinition[] | Record<string, number>) {
    if (Array.isArray(currencies)) {
      for (const def of currencies) {
        this._currencies.set(def.key, { ...def })
      }
    } else {
      // Simple rate-map shorthand
      for (const [key, rate] of Object.entries(currencies)) {
        this._currencies.set(key, { key, displayName: key, rate, symbol: key[0] })
      }
    }
  }

  /** Get rate for a currency relative to the base unit. Returns 1 if unknown. */
  getRate(currencyKey: string): number {
    return this._currencies.get(currencyKey)?.rate ?? 1
  }

  /** Convert an amount from one currency to another. */
  convert(amount: number, from: string, to: string): number {
    if (from === to) return amount
    const fromRate = this.getRate(from)
    const toRate   = this.getRate(to)
    return Math.round((amount * fromRate) / toRate)
  }

  /** Get display symbol for a currency (e.g. 'g' for gold). */
  getSymbol(currencyKey: string): string {
    return this._currencies.get(currencyKey)?.symbol ?? currencyKey
  }

  /** Get all registered currency definitions. */
  getAllCurrencies(): CurrencyDefinition[] {
    return Array.from(this._currencies.values())
  }

  /**
   * Override in a subclass to implement dynamic market rates.
   * Called by a MarketSystem ECS system each frame/interval.
   * @param _dt  Delta time in seconds (from engine.addSystem)
   */
  updateRates(_dt: number): void {
    // Static mode: no-op. Dynamic subclass overrides this.
  }
}

/**
 * Default market for dcl_popupInteractiveA.
 * Gold as the single currency (rate=1), static.
 * Add silver, gems, etc. here when needed.
 */
export const DEFAULT_MARKET = new MarketManager({
  gold: 1,
})
