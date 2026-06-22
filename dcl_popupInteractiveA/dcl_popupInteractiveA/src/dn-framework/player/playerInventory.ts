/**
 * @file playerInventory.ts
 * @module DN DCL Framework / player
 * @version 0.0002
 * @status NEEDS_TEST
 *
 * Player inventory, currency, and stats for DCL SDK7 scenes.
 *
 * THREE BUCKETS:
 *   items     — stackable collectibles (ore, wood, fish, potions...)
 *   currency  — spendable numeric values (gold, silver, gems...)
 *   stats     — tracked non-spendable values (xp, fishing_xp, mp, hp...)
 *
 * COMPATIBILITY BRIDGE (v0.0002):
 *   Currencies registered via registerCurrency() are transparently accessible
 *   through the existing item API. The Trader/Fishmonger CraftingPopup keeps
 *   working with zero changes:
 *     inv.getCount('gold')         → returns currency balance
 *     inv.addItem('gold', ...)     → routes to addCurrency()
 *     inv.removeItem('gold', qty)  → routes to spendCurrency()
 *     inv.hasEnough('gold', qty)   → checks currency balance
 *   'gold' is pre-registered. Add others via registerCurrency().
 *
 * @changelog
 *   0.0001 - Initial item map (addItem/removeItem/getCount/hasEnough).
 *   0.0002 - Added currency map (gold pre-registered, compatibility bridge),
 *            stats map (xp/mp/hp etc.), onChange listener registration.
 */

export interface InventoryItem {
  itemId: string
  name: string
  quantity: number
  icon?: string
}

type ChangeListener = () => void

export class PlayerInventory {

  private _items:       Map<string, InventoryItem> = new Map()
  private _currency:    Record<string, number>     = {}
  private _stats:       Record<string, number>     = {}
  private _currencyIds: Set<string>                = new Set()
  private _listeners:   ChangeListener[]           = []

  constructor() {
    // Pre-register gold so the compatibility bridge is active from the start
    this.registerCurrency('gold', 0)
  }

  // ── Currency Registration ──────────────────────────────────────────────────

  /**
   * Register a key as a currency. Once registered, item-API calls with this
   * key (getCount/addItem/removeItem/hasEnough) transparently route to the
   * currency map. Call at GameManager init for any currency the game uses.
   */
  registerCurrency(key: string, initialAmount: number = 0): void {
    this._currencyIds.add(key)
    if (!(key in this._currency)) this._currency[key] = initialAmount
  }

  // ── Currency API ──────────────────────────────────────────────────────────

  addCurrency(amount: number, key: string = 'gold'): void {
    if (!this._currencyIds.has(key)) this.registerCurrency(key)
    this._currency[key] = (this._currency[key] ?? 0) + Math.max(0, amount)
    this._notify()
  }

  /** @returns true if deducted, false if insufficient */
  spendCurrency(amount: number, key: string = 'gold'): boolean {
    if ((this._currency[key] ?? 0) < amount) return false
    this._currency[key] -= amount
    this._notify()
    return true
  }

  getCurrency(key: string = 'gold'): number {
    return this._currency[key] ?? 0
  }

  canAfford(amount: number, key: string = 'gold'): boolean {
    return (this._currency[key] ?? 0) >= amount
  }

  /** All registered currencies as { key: amount } for HUD display. */
  getAllCurrencies(): Record<string, number> {
    return { ...this._currency }
  }

  // ── Stats API ─────────────────────────────────────────────────────────────

  /** Add to a stat. Creates at 0 if not present. */
  addStat(key: string, amount: number): void {
    this._stats[key] = (this._stats[key] ?? 0) + amount
    this._notify()
  }

  setStat(key: string, value: number): void {
    this._stats[key] = value
    this._notify()
  }

  getStat(key: string): number {
    return this._stats[key] ?? 0
  }

  /** All stats as { key: value } for HUD display. */
  getAllStats(): Record<string, number> {
    return { ...this._stats }
  }

  // ── Item API (compatibility bridge intercepts currency keys) ───────────────

  addItem(itemId: string, name: string, quantity: number, icon?: string): void {
    if (this._currencyIds.has(itemId)) { this.addCurrency(quantity, itemId); return }
    const existing = this._items.get(itemId)
    if (existing) {
      existing.quantity += quantity
    } else {
      this._items.set(itemId, { itemId, name, quantity, icon })
    }
    this._notify()
  }

  removeItem(itemId: string, quantity: number): boolean {
    if (this._currencyIds.has(itemId)) return this.spendCurrency(quantity, itemId)
    const item = this._items.get(itemId)
    if (!item || item.quantity < quantity) return false
    item.quantity -= quantity
    if (item.quantity === 0) this._items.delete(itemId)
    this._notify()
    return true
  }

  getCount(itemId: string): number {
    if (this._currencyIds.has(itemId)) return this._currency[itemId] ?? 0
    return this._items.get(itemId)?.quantity ?? 0
  }

  getItem(itemId: string): InventoryItem | undefined {
    return this._items.get(itemId)
  }

  hasEnough(itemId: string, quantity: number): boolean {
    return this.getCount(itemId) >= quantity
  }

  /** All non-currency items, sorted by itemId. */
  getAllItems(): InventoryItem[] {
    return Array.from(this._items.values()).sort((a, b) => a.itemId.localeCompare(b.itemId))
  }

  clear(): void {
    this._items.clear()
    this._notify()
  }

  // ── Change Listeners ──────────────────────────────────────────────────────

  onChange(fn: ChangeListener): () => void {
    this._listeners.push(fn)
    return () => {
      const i = this._listeners.indexOf(fn)
      if (i >= 0) this._listeners.splice(i, 1)
    }
  }

  private _notify(): void {
    for (const fn of this._listeners) fn()
  }
}
