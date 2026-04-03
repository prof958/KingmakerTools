/**
 * PF2e Invested Item Tracking
 *
 * Rules:
 * - A character can invest at most 10 items per day
 * - Only items with the "Invested" trait can be invested
 * - Investing occurs during daily preparations
 */

/** Maximum number of items a character can have invested */
export const MAX_INVESTED_ITEMS = 10;

/**
 * Count invested items from a list.
 */
export function countInvestedItems(
  items: { isInvested: boolean; quantity: number }[]
): number {
  return items.filter((item) => item.isInvested).length;
}

/**
 * Check if a character can invest another item.
 */
export function canInvest(currentInvestedCount: number): boolean {
  return currentInvestedCount < MAX_INVESTED_ITEMS;
}

/**
 * Get remaining investment slots.
 */
export function remainingInvestmentSlots(currentInvestedCount: number): number {
  return Math.max(0, MAX_INVESTED_ITEMS - currentInvestedCount);
}
