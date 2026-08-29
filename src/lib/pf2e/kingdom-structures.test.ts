import { describe, expect, it } from "vitest";
import {
  KINGDOM_STRUCTURES,
  getKingdomStructure,
  structuresFitting,
  structuresUpToLevel,
} from "./kingdom-structures";
import { KINGDOM_ACTIVITIES } from "./kingdom-activities";
import { KINGDOM_SKILLS, PROFICIENCY_LABELS } from "./kingdom";

const SKILL_IDS = new Set(KINGDOM_SKILLS.map((s) => s.id));
const RANKS = new Set(Object.values(PROFICIENCY_LABELS).map((r) => r.toLowerCase()));
const IDS = new Set(KINGDOM_STRUCTURES.map((s) => s.id));

const isInfrastructure = (s: { traits: string[] }) => s.traits.includes("INFRASTRUCTURE");

describe("the generated catalog", () => {
  it("covers the guide's full structure list", () => {
    // The guide labels most entries "STRUCTURE n" but a handful "BUILDING n",
    // and Rubble has an em-dash for its level. Matching only the first form
    // silently dropped six entries and merged their text into their
    // neighbours, so the count is worth asserting.
    expect(KINGDOM_STRUCTURES.length).toBe(74);
  });

  it("has unique ids", () => {
    expect(IDS.size).toBe(KINGDOM_STRUCTURES.length);
  });

  it("gives every building a tile, and infrastructure none", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      if (isInfrastructure(structure)) continue;
      expect(structure.tile, structure.id).toBeTruthy();
    }
  });

  it("agrees with the tile art about how many lots a structure takes", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      if (!structure.tileLots || structure.lots === 0) continue;
      expect(structure.tileLots, structure.id).toBe(structure.lots);
    }
  });

  it("uses lot counts that fit a block", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      // A block is four lots; infrastructure occupies none.
      expect([0, 1, 2, 4], structure.id).toContain(structure.lots);
    }
  });

  it("keeps levels and costs sane", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      expect(structure.level, structure.id).toBeGreaterThanOrEqual(0);
      expect(structure.level, structure.id).toBeLessThanOrEqual(20);
      for (const [key, value] of Object.entries(structure.cost)) {
        expect(value, `${structure.id}.${key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("costs RP for everything that is actually built", () => {
    // Rubble is the one entry that appears without being constructed.
    const free = KINGDOM_STRUCTURES.filter((s) => s.cost.rp === 0);
    expect(free.map((s) => s.id)).toEqual(["rubble"]);
  });

  it("names a real kingdom skill and rank for each construction check", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      if (!structure.construction) continue;
      expect(SKILL_IDS, structure.id).toContain(structure.construction.skill);
      expect(RANKS, structure.id).toContain(structure.construction.rank);
      expect(structure.construction.dc, structure.id).toBeGreaterThan(0);
    }
  });
});

describe("cross-references", () => {
  it("resolves every upgrade path to another structure", () => {
    // Several structure names contain a comma ("tavern, popular"), so these
    // lists cannot be split on punctuation; a stray id here means they were.
    for (const structure of KINGDOM_STRUCTURES) {
      for (const target of [...structure.upgradeFrom, ...structure.upgradeTo]) {
        expect(IDS, `${structure.id} -> ${target}`).toContain(target);
      }
    }
  });

  it("keeps the tavern upgrade chain intact", () => {
    expect(getKingdomStructure("tavern-dive")?.upgradeTo).toEqual(["tavern-popular"]);
    expect(getKingdomStructure("tavern-popular")?.upgradeFrom).toEqual(["tavern-dive"]);
    expect(getKingdomStructure("tavern-popular")?.upgradeTo).toEqual(["tavern-luxury"]);
  });

  it("targets an ability, not an activity, for the Guildhall", () => {
    // Its bonus reads "+1 item bonus to Economy skill checks" — a whole
    // ability, which does not belong in the activity list.
    const bonus = getKingdomStructure("guildhall")?.itemBonuses[0];
    expect(bonus?.ability).toBe("economy");
    expect(bonus?.activities).toEqual([]);
  });

  it("names real activities in RAW item bonuses", () => {
    // "Rest and Relax" is one activity containing "and"; splitting the bonus
    // sentence on conjunctions used to tear it in two.
    const activityNames = new Set(KINGDOM_ACTIVITIES.map((a) => a.name));
    for (const structure of KINGDOM_STRUCTURES) {
      for (const bonus of structure.itemBonuses) {
        if (bonus.source === "VK") continue;
        for (const activity of bonus.activities) {
          expect(activityNames, `${structure.id}: ${activity}`).toContain(activity);
        }
      }
    }
  });

  it("does not let effect text leak into an item bonus", () => {
    for (const structure of KINGDOM_STRUCTURES) {
      for (const bonus of structure.itemBonuses) {
        for (const activity of bonus.activities) {
          expect(activity.length, `${structure.id}: ${activity}`).toBeLessThan(40);
        }
      }
    }
  });
});

describe("V&K additions", () => {
  it("adds the house-rule item bonuses, flagged as such", () => {
    const vk = KINGDOM_STRUCTURES.filter((s) =>
      s.itemBonuses.some((b) => b.source === "VK"),
    );
    expect(vk).toHaveLength(18);
  });

  it("gives the taverns their Reconnoiter Hex bonuses", () => {
    const bonus = (id: string) =>
      getKingdomStructure(id)?.itemBonuses.find((b) => b.source === "VK");
    expect(bonus("tavern-popular")).toMatchObject({ value: 1, activities: ["Reconnoiter Hex"] });
    expect(bonus("tavern-luxury")).toMatchObject({ value: 2, activities: ["Reconnoiter Hex"] });
    expect(bonus("tavern-world-class")).toMatchObject({ value: 3, activities: ["Reconnoiter Hex"] });
  });

  it("keeps the RAW bonus alongside the house-rule one", () => {
    // Bank has a printed bonus to Tap Treasury and a V&K one on top.
    const bank = getKingdomStructure("bank");
    expect(bank?.itemBonuses).toHaveLength(2);
    expect(bank?.itemBonuses[0].activities).toEqual(["Tap Treasury"]);
    expect(bank?.effects).toContain("Capital Investment");
  });

  it("records the Granary's added construction requirement", () => {
    expect(getKingdomStructure("granary")?.vkConstruction).toContain("Agriculture");
  });
});

describe("lookups", () => {
  it("filters by kingdom level", () => {
    const low = structuresUpToLevel(1);
    expect(low.every((s) => s.level <= 1)).toBe(true);
    expect(low.map((s) => s.id)).toContain("shrine");
    expect(low.map((s) => s.id)).not.toContain("castle");
  });

  it("filters by free lots", () => {
    expect(structuresFitting(1).every((s) => s.lots <= 1)).toBe(true);
    expect(structuresFitting(4).map((s) => s.id)).toContain("castle");
    expect(structuresFitting(1).map((s) => s.id)).not.toContain("castle");
  });

  it("returns undefined for an unknown id", () => {
    expect(getKingdomStructure("nope")).toBeUndefined();
  });
});
