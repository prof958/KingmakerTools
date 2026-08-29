import { describe, expect, it } from "vitest";
import {
  applyStorageCap,
  commodityGains,
  consumptionRpCost,
  kingdomConsumption,
  unrestAdjustment,
} from "./kingdom-turn";

describe("unrestAdjustment", () => {
  it("is always zero on the first turn, regardless of other inputs", () => {
    expect(
      unrestAdjustment({
        isFirstTurn: true,
        overcrowdedSettlements: 3,
        atWar: true,
        otherAdjustment: 5,
      }),
    ).toBe(0);
  });

  it("adds one per overcrowded settlement", () => {
    expect(unrestAdjustment({ isFirstTurn: false, overcrowdedSettlements: 3, atWar: false })).toBe(3);
  });

  it("adds one flat for being at war, on top of overcrowding", () => {
    expect(unrestAdjustment({ isFirstTurn: false, overcrowdedSettlements: 1, atWar: true })).toBe(2);
  });

  it("folds in manually-tracked ongoing-event adjustments", () => {
    expect(
      unrestAdjustment({
        isFirstTurn: false,
        overcrowdedSettlements: 0,
        atWar: false,
        otherAdjustment: -2,
      }),
    ).toBe(-2);
  });

  it("is zero for a calm, uncrowded, not-at-war kingdom", () => {
    expect(unrestAdjustment({ isFirstTurn: false, overcrowdedSettlements: 0, atWar: false })).toBe(0);
  });
});

describe("commodityGains", () => {
  it("gives one commodity per work site, mapped to the right type", () => {
    const gains = commodityGains([
      { workSite: "farmland", features: [] },
      { workSite: "lumber", features: [] },
      { workSite: "mine", features: [] },
      { workSite: "quarry", features: [] },
    ]);
    expect(gains).toEqual({ food: 1, lumber: 1, luxuries: 0, ore: 1, stone: 1 });
  });

  it("doubles the yield on a Resource-feature hex", () => {
    const gains = commodityGains([{ workSite: "mine", features: ["resource"] }]);
    expect(gains.ore).toBe(2);
  });

  it("ignores hexes with no work site", () => {
    const gains = commodityGains([{ workSite: null, features: ["resource"] }]);
    expect(Object.values(gains).every((v) => v === 0)).toBe(true);
  });

  it("sums multiple work sites of the same type", () => {
    const gains = commodityGains([
      { workSite: "farmland", features: [] },
      { workSite: "farmland", features: ["resource"] },
    ]);
    expect(gains.food).toBe(3);
  });
});

describe("applyStorageCap", () => {
  it("adds the gain when there's room", () => {
    expect(applyStorageCap(2, 3, 10)).toBe(5);
  });

  it("caps at storage even when the gain would overflow it", () => {
    expect(applyStorageCap(8, 5, 10)).toBe(10);
  });

  it("never goes negative", () => {
    expect(applyStorageCap(0, -5, 10)).toBe(0);
  });
});

describe("kingdomConsumption", () => {
  it("is zero on the first turn", () => {
    expect(
      kingdomConsumption({ isFirstTurn: true, settlementConsumption: [2, 4], farmlandHexes: 0 }),
    ).toBe(0);
  });

  it("sums settlement consumption and subtracts farmland hexes", () => {
    expect(
      kingdomConsumption({ isFirstTurn: false, settlementConsumption: [1, 2, 4], farmlandHexes: 3 }),
    ).toBe(4);
  });

  it("floors at zero rather than going negative", () => {
    expect(
      kingdomConsumption({ isFirstTurn: false, settlementConsumption: [1], farmlandHexes: 5 }),
    ).toBe(0);
  });
});

describe("consumptionRpCost", () => {
  it("is 5 RP per unpaid point", () => {
    expect(consumptionRpCost(3)).toBe(15);
  });

  it("is zero for nothing unpaid, and never negative", () => {
    expect(consumptionRpCost(0)).toBe(0);
    expect(consumptionRpCost(-2)).toBe(0);
  });
});
