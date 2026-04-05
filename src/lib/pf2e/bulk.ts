/**
 * PF2e Bulk Calculation Engine
 *
 * Rules:
 * - Each item has a bulk value (numeric) or is "Light" (L)
 * - 10 Light items = 1 Bulk
 * - Negligible items (bulk 0, not light) don't count
 * - Encumbered at: 5 + STR modifier + 1
 * - Max carry: 10 + STR modifier
 * - Coins: 1,000 coins = 1 Bulk
 */

export interface BulkItem {
  bulkValue: number;
  isBulkLight: boolean;
  quantity: number;
}

export interface BulkCalculation {
  /** Total bulk as a decimal (light items contribute as fractions) */
  totalBulk: number;
  /** Total bulk rounded down for display (PF2e floors bulk) */
  totalBulkDisplay: number;
  /** Light items remainder after converting groups of 10 */
  lightItemsRemainder: number;
  /** Threshold at which you become encumbered */
  encumberedAt: number;
  /** Maximum you can carry */
  maxCarry: number;
  /** Whether the character is encumbered */
  isEncumbered: boolean;
  /** Whether the character is over max carry */
  isOverloaded: boolean;
}

/**
 * Calculate total bulk from a list of items.
 * Returns raw numeric bulk (light items as 0.1 each).
 */
export function sumBulk(items: BulkItem[]): { numericBulk: number; lightItems: number } {
  let numericBulk = 0;
  let lightItems = 0;

  for (const item of items) {
    if (item.isBulkLight) {
      lightItems += item.quantity;
    } else {
      numericBulk += item.bulkValue * item.quantity;
    }
  }

  return { numericBulk, lightItems };
}

/**
 * Get the encumbrance threshold for a character.
 * Encumbered when bulk > 5 + STR modifier.
 */
export function getEncumbranceThreshold(strModifier: number): number {
  return 5 + strModifier;
}

/**
 * Get the maximum carry capacity for a character.
 * Cannot move when bulk > 10 + STR modifier.
 */
export function getMaxCarry(strModifier: number): number {
  return 10 + strModifier;
}

/**
 * Apply container bulk reduction.
 * A worn container (e.g., backpack) reduces the bulk of its contents.
 * Returns the effective bulk of the contained items after reduction.
 */
export function applyContainerReduction(
  containedItemsBulk: number,
  containerBulkReduction: number,
  containerCapacity: number
): number {
  // Container contents cannot exceed capacity
  const effectiveBulk = Math.min(containedItemsBulk, containerCapacity);
  // Reduce bulk by the container's reduction value (minimum 0)
  return Math.max(0, effectiveBulk - containerBulkReduction);
}

/**
 * Full bulk calculation for a character's carried items.
 */
export function calculateBulk(
  items: BulkItem[],
  coinCount: number,
  strModifier: number,
  miscBulk: number = 0
): BulkCalculation {
  const { numericBulk, lightItems } = sumBulk(items);

  // Convert light items: 10 L = 1 Bulk
  const bulkFromLight = Math.floor(lightItems / 10);
  const lightRemainder = lightItems % 10;

  // Coin bulk: 1,000 coins = 1 Bulk
  const coinBulk = Math.floor(coinCount / 1000);

  const totalBulk = numericBulk + bulkFromLight + coinBulk + miscBulk;
  const encumberedAt = getEncumbranceThreshold(strModifier);
  const maxCarry = getMaxCarry(strModifier);

  return {
    totalBulk,
    totalBulkDisplay: totalBulk,
    lightItemsRemainder: lightRemainder,
    encumberedAt,
    maxCarry,
    isEncumbered: totalBulk > encumberedAt,
    isOverloaded: totalBulk > maxCarry,
  };
}
