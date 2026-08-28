/**
 * Dice and PF2e degree-of-success resolution.
 *
 * Pure and injectable: every roller takes an optional `rng` so callers (and
 * tests) can supply a deterministic source instead of Math.random.
 */

/** Returns a float in [0, 1). */
export type Rng = () => number;

const defaultRng: Rng = Math.random;

/** A single die roll, faces-sided, in [1, faces]. */
export function rollDie(faces: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * faces) + 1;
}

export interface DiceRoll {
  /** Every die face rolled, in order. */
  dice: number[];
  /** Flat modifier applied to the sum. */
  modifier: number;
  /** Sum of the dice, before the modifier. */
  subtotal: number;
  /** subtotal + modifier. */
  total: number;
  /** Conventional notation for display, e.g. "5d6+2". */
  notation: string;
}

/** Roll `count` dice of `faces` sides, plus a flat modifier. */
export function rollDice(
  count: number,
  faces: number,
  modifier = 0,
  rng: Rng = defaultRng,
): DiceRoll {
  const dice = Array.from({ length: Math.max(0, Math.floor(count)) }, () =>
    rollDie(faces, rng),
  );
  const subtotal = dice.reduce((sum, d) => sum + d, 0);
  const sign = modifier < 0 ? "−" : "+";
  return {
    dice,
    modifier,
    subtotal,
    total: subtotal + modifier,
    notation:
      `${dice.length}d${faces}` +
      (modifier === 0 ? "" : `${sign}${Math.abs(modifier)}`),
  };
}

// ──────────────────────────────────────────────
// Degree of success
// ──────────────────────────────────────────────

export const DEGREES = [
  "criticalFailure",
  "failure",
  "success",
  "criticalSuccess",
] as const;

export type Degree = (typeof DEGREES)[number];

export const DEGREE_LABELS: Record<Degree, string> = {
  criticalFailure: "Critical Failure",
  failure: "Failure",
  success: "Success",
  criticalSuccess: "Critical Success",
};

/**
 * PF2e degree of success: beat the DC by 10 to crit, miss it by 10 to crit
 * fail. A natural 20 shifts the result one degree better and a natural 1 one
 * degree worse — applied after the margin, never as a result on their own.
 */
export function degreeOfSuccess(
  total: number,
  dc: number,
  natural?: number,
): Degree {
  let index: number;
  if (total >= dc + 10) index = 3;
  else if (total >= dc) index = 2;
  else if (total > dc - 10) index = 1;
  else index = 0;

  if (natural === 20) index += 1;
  else if (natural === 1) index -= 1;

  return DEGREES[Math.max(0, Math.min(3, index))];
}

export interface CheckResult extends DiceRoll {
  dc: number;
  /** The d20 face, kept for the natural 20 / natural 1 rule. */
  natural: number;
  degree: Degree;
  /** total − dc; negative means the check fell short. */
  margin: number;
}

/** Roll a d20 check against a DC. */
export function rollCheck(
  modifier: number,
  dc: number,
  rng: Rng = defaultRng,
): CheckResult {
  const roll = rollDice(1, 20, modifier, rng);
  const natural = roll.dice[0];
  return {
    ...roll,
    dc,
    natural,
    degree: degreeOfSuccess(roll.total, dc, natural),
    margin: roll.total - dc,
  };
}

/** Roll a flat check — no modifier, no crit degrees, just pass or fail. */
export function rollFlatCheck(dc: number, rng: Rng = defaultRng): {
  roll: number;
  dc: number;
  success: boolean;
} {
  const roll = rollDie(20, rng);
  return { roll, dc, success: roll >= dc };
}
