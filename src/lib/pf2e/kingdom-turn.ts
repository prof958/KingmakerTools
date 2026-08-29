/**
 * Kingdom turn math — the Upkeep phase's four steps (KPG 42-43): Adjust
 * Unrest, Resource Collection, and Pay Consumption. Assign Leadership Roles
 * has no computation of its own (it's a reminder to use New Leadership and
 * let vacancy penalties apply, both already handled elsewhere).
 *
 * Pure and stateless, like the rest of `lib/pf2e/` — these take a snapshot of
 * the kingdom's relevant fields and return what changed, they never touch the
 * DB. The turn tracker UI rolls dice client-side (via `lib/dice.ts`) and lets
 * the player edit the result before anything is applied, so these functions
 * only compute the deterministic parts: how many dice to roll, what a
 * Commodity haul or a Consumption bill comes to.
 */

import type { Commodity } from "./kingdom";

// ──────────────────────────────────────────────
// Step 2: Adjust Unrest (KPG 42)
// ──────────────────────────────────────────────

/**
 * Unrest change before any Ruin/anarchy threshold is checked. Skipped
 * entirely on turn 1, per RAW ("your kingdom's Unrest score is 0; skip to the
 * next step") — the caller passes `isFirstTurn` rather than this function
 * inferring it from a turn number, since "first turn" is a fact about the
 * kingdom's history, not something derivable from the inputs to this step.
 */
export function unrestAdjustment({
  isFirstTurn,
  overcrowdedSettlements,
  atWar,
  otherAdjustment = 0,
}: {
  isFirstTurn: boolean;
  overcrowdedSettlements: number;
  atWar: boolean;
  /** Ongoing-event Unrest adjustments the table is tracking by hand. */
  otherAdjustment?: number;
}): number {
  if (isFirstTurn) return 0;
  return overcrowdedSettlements + (atWar ? 1 : 0) + otherAdjustment;
}

// ──────────────────────────────────────────────
// Step 3: Resource Collection (KPG 43)
// ──────────────────────────────────────────────

export interface WorkSiteHex {
  workSite: string | null;
  /** Terrain features on the hex, e.g. "resource" doubles that Work Site's yield. */
  features: string[];
}

const WORK_SITE_COMMODITY: Record<string, Commodity> = {
  farmland: "food",
  lumber: "lumber",
  mine: "ore",
  quarry: "stone",
};

/**
 * Commodities gathered from Work Sites this turn, before the kingdom's
 * storage cap is applied: 1 per Work Site, doubled if its hex has the
 * Resource terrain feature (KPG 43). Storage is capped by the caller, since
 * it also depends on whatever is already stockpiled.
 */
export function commodityGains(hexes: WorkSiteHex[]): Record<Commodity, number> {
  const gains: Record<Commodity, number> = { food: 0, lumber: 0, luxuries: 0, ore: 0, stone: 0 };
  for (const hex of hexes) {
    if (!hex.workSite) continue;
    const commodity = WORK_SITE_COMMODITY[hex.workSite];
    if (!commodity) continue;
    gains[commodity] += hex.features.includes("resource") ? 2 : 1;
  }
  return gains;
}

/** A gathered amount, capped so a kingdom's stockpile never exceeds its storage. */
export function applyStorageCap(current: number, gained: number, storage: number): number {
  return Math.max(0, Math.min(storage, current + gained));
}

// ──────────────────────────────────────────────
// Step 4: Pay Consumption (KPG 43, 47)
// ──────────────────────────────────────────────

/**
 * Kingdom Consumption = settlement Consumption total − Farmland hexes
 * influenced by settlements. Army Consumption is omitted: this app doesn't
 * track armies yet. Skipped on turn 1, same as Adjust Unrest.
 */
export function kingdomConsumption({
  isFirstTurn,
  settlementConsumption,
  farmlandHexes,
}: {
  isFirstTurn: boolean;
  /** Each settlement's base Consumption (`SettlementTypeDef.baseConsumption`), summed by the caller or passed as a list. */
  settlementConsumption: number[];
  farmlandHexes: number;
}): number {
  if (isFirstTurn) return 0;
  const total = settlementConsumption.reduce((sum, c) => sum + c, 0) - farmlandHexes;
  return Math.max(0, total);
}

/** RP cost of paying off Consumption with funds instead of Food (KPG 43): 5 RP per unpaid point. */
export function consumptionRpCost(unpaidPoints: number): number {
  return Math.max(0, unpaidPoints) * 5;
}
