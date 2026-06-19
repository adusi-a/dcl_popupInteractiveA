/**
 * @file playerInventory.ts
 * @module DN DCL Framework / player
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Simple client-side player inventory for DCL SDK7 scenes.
 * Supports adding, removing, and querying items by itemId.
 * No server sync — local state only. Extend for server-backed inventory later.
 *
 * Usage:
 *   const inv = new PlayerInventory()
 *   inv.addItem('gold', 'Gold', 50)
 *   inv.addItem('gold', 'Gold', 25)    // stacks → quantity 75
 *   inv.getCount('gold')               // 75
 *   inv.removeItem('gold', 10)         // true → quantity 65
 *   inv.getAllItems()                  // [{ itemId, name, quantity }]
 *
 * @changelog
 *   0.0001 - Initial. Built for dnWorld_chestTestA popup sprint.
 */

export interface InventoryItem {
  itemId: string
  name: string
  quantity: number
  icon?: string  // optional texture path
}

export class PlayerInventory {

  private items: Map<string, InventoryItem> = new Map()

  /**
   * Add items to the inventory. Stacks if the itemId already exists.
   * @param itemId   Unique item identifier (e.g. 'gold', 'iron_sword')
   * @param name     Display name (used when stacking — keeps first name given)
   * @param quantity Amount to add
   * @param icon     Optional texture path for UI display
   */
  addItem(itemId: string, name: string, quantity: number, icon?: string): void {
    const existing = this.items.get(itemId)
    if (existing) {
      existing.quantity += quantity
    } else {
      this.items.set(itemId, { itemId, name, quantity, icon })
    }
  }

  /**
   * Remove items from inventory.
   * @returns true if the removal succeeded (had enough), false otherwise.
   */
  removeItem(itemId: string, quantity: number): boolean {
    const item = this.items.get(itemId)
    if (!item || item.quantity < quantity) return false
    item.quantity -= quantity
    if (item.quantity === 0) this.items.delete(itemId)
    return true
  }

  /** Get the quantity of a specific item (0 if not present). */
  getCount(itemId: string): number {
    return this.items.get(itemId)?.quantity ?? 0
  }

  /** Get the full InventoryItem record, or undefined if not in inventory. */
  getItem(itemId: string): InventoryItem | undefined {
    return this.items.get(itemId)
  }

  /** Get all items as an array (sorted by itemId for consistent display). */
  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values()).sort((a, b) => a.itemId.localeCompare(b.itemId))
  }

  /** Returns true if the player has at least `quantity` of `itemId`. */
  hasEnough(itemId: string, quantity: number): boolean {
    return this.getCount(itemId) >= quantity
  }

  /** Clear all items (reset inventory). */
  clear(): void {
    this.items.clear()
  }
}
