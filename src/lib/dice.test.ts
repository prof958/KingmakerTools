import { describe, expect, it } from "vitest";
import {
  degreeOfSuccess,
  rollCheck,
  rollDice,
  rollDie,
  rollFlatCheck,
  type Rng,
} from "./dice";

/** An rng that walks a fixed list of [0,1) values, then repeats the last. */
function scripted(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** rng value that produces exactly `face` on a die of `faces` sides. */
const face = (n: number, faces: number) => (n - 1) / faces;

describe("rollDie", () => {
  it("spans 1..faces inclusive", () => {
    expect(rollDie(20, () => 0)).toBe(1);
    expect(rollDie(20, () => 0.999999)).toBe(20);
    expect(rollDie(6, () => 0.5)).toBe(4);
  });
});

describe("rollDice", () => {
  it("sums the dice and applies the modifier", () => {
    const r = rollDice(3, 6, 2, scripted(face(4, 6), face(2, 6), face(6, 6)));
    expect(r.dice).toEqual([4, 2, 6]);
    expect(r.subtotal).toBe(12);
    expect(r.total).toBe(14);
    expect(r.notation).toBe("3d6+2");
  });

  it("renders a bare notation with no modifier and handles zero dice", () => {
    expect(rollDice(2, 8).notation).toBe("2d8");
    const none = rollDice(0, 6, 3);
    expect(none.dice).toEqual([]);
    expect(none.total).toBe(3);
  });
});

describe("degreeOfSuccess", () => {
  it("uses the DC and the 10-point margins", () => {
    expect(degreeOfSuccess(25, 15)).toBe("criticalSuccess");
    expect(degreeOfSuccess(15, 15)).toBe("success");
    expect(degreeOfSuccess(14, 15)).toBe("failure");
    expect(degreeOfSuccess(6, 15)).toBe("failure");
    expect(degreeOfSuccess(5, 15)).toBe("criticalFailure");
  });

  it("shifts one degree on a natural 20 or 1", () => {
    expect(degreeOfSuccess(15, 15, 20)).toBe("criticalSuccess");
    expect(degreeOfSuccess(14, 15, 20)).toBe("success");
    expect(degreeOfSuccess(15, 15, 1)).toBe("failure");
    expect(degreeOfSuccess(25, 15, 1)).toBe("success");
  });

  it("clamps rather than running off either end", () => {
    // A natural 20 that already crit succeeded stays a critical success.
    expect(degreeOfSuccess(30, 15, 20)).toBe("criticalSuccess");
    // A natural 1 that already crit failed stays a critical failure.
    expect(degreeOfSuccess(1, 30, 1)).toBe("criticalFailure");
  });
});

describe("rollCheck", () => {
  it("reports the natural die, margin, and degree together", () => {
    const r = rollCheck(7, 20, scripted(face(15, 20)));
    expect(r.natural).toBe(15);
    expect(r.total).toBe(22);
    expect(r.margin).toBe(2);
    expect(r.degree).toBe("success");
  });

  it("applies the natural 1 downgrade to an otherwise successful check", () => {
    const r = rollCheck(30, 20, scripted(face(1, 20)));
    expect(r.total).toBe(31);
    expect(r.degree).toBe("success"); // would be a crit without the natural 1
  });
});

describe("rollFlatCheck", () => {
  it("passes on meeting the DC", () => {
    expect(rollFlatCheck(16, scripted(face(16, 20))).success).toBe(true);
    expect(rollFlatCheck(16, scripted(face(15, 20))).success).toBe(false);
  });
});
