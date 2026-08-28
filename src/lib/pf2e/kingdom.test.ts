import { describe, expect, it } from "vitest";
import {
  ANARCHY_UNREST,
  abilityModifier,
  advancementTable,
  applyBoost,
  CHARTERS,
  computeAbilityScores,
  controlDC,
  CONTROL_DC_BY_LEVEL,
  finalizeBoostCount,
  GOVERNMENTS,
  investedStatusBonus,
  KINGDOM_ABILITIES,
  KINGDOM_SKILLS,
  LEADERSHIP_ROLES,
  proficiencyBonus,
  resolveRuin,
  resourceDiceCount,
  RUINS,
  sizeBracket,
  skillModifier,
  untrainedImprovisation,
  xpToNextLevel,
} from "./kingdom";

describe("abilityModifier", () => {
  it("matches the PF2e ability table", () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(12)).toBe(1);
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(18)).toBe(4);
    expect(abilityModifier(7)).toBe(-2);
  });
});

describe("applyBoost", () => {
  it("adds 2 below 18 and 1 at or above 18", () => {
    expect(applyBoost(10)).toBe(12);
    expect(applyBoost(16)).toBe(18);
    expect(applyBoost(18)).toBe(19);
    expect(applyBoost(19)).toBe(20);
  });
});

describe("static rules data", () => {
  it("has 16 kingdom skills, 4 per ability", () => {
    expect(KINGDOM_SKILLS).toHaveLength(16);
    for (const ability of KINGDOM_ABILITIES) {
      const count = KINGDOM_SKILLS.filter((s) => s.keyAbility === ability).length;
      expect(count, `${ability} skills`).toBe(4);
    }
  });

  it("has 8 leadership roles with unique ids", () => {
    expect(LEADERSHIP_ROLES).toHaveLength(8);
    expect(new Set(LEADERSHIP_ROLES.map((r) => r.id)).size).toBe(8);
  });

  it("has 5 charters and 6 governments", () => {
    expect(CHARTERS).toHaveLength(5);
    expect(GOVERNMENTS).toHaveLength(6);
  });

  it("pairs each Ruin with a distinct ability", () => {
    expect(RUINS).toHaveLength(4);
    expect(new Set(RUINS.map((r) => r.ability)).size).toBe(4);
  });
});

describe("proficiencyBonus", () => {
  it("is +0 untrained without Untrained Improvisation", () => {
    expect(proficiencyBonus(0, 5)).toBe(0);
  });

  it("is level + 2×rank when trained or better", () => {
    expect(proficiencyBonus(1, 1)).toBe(3); // trained, level 1
    expect(proficiencyBonus(1, 5)).toBe(7); // trained, level 5
    expect(proficiencyBonus(2, 5)).toBe(9); // expert
    expect(proficiencyBonus(3, 10)).toBe(16); // master
    expect(proficiencyBonus(4, 20)).toBe(28); // legendary
  });

  it("applies Untrained Improvisation half then full", () => {
    expect(proficiencyBonus(0, 6, "half")).toBe(3);
    expect(proficiencyBonus(0, 7, "half")).toBe(3);
    expect(proficiencyBonus(0, 7, "full")).toBe(7);
  });
});

describe("untrainedImprovisation", () => {
  it("never applies under RAW", () => {
    expect(untrainedImprovisation("RAW", 2)).toBe("none");
    expect(untrainedImprovisation("RAW", 20)).toBe("none");
  });

  it("is half at VK level 2 and full at VK level 7", () => {
    expect(untrainedImprovisation("VK", 1)).toBe("none");
    expect(untrainedImprovisation("VK", 2)).toBe("half");
    expect(untrainedImprovisation("VK", 6)).toBe("half");
    expect(untrainedImprovisation("VK", 7)).toBe("full");
  });
});

describe("skillModifier", () => {
  it("adds ability mod, proficiency, and status bonus", () => {
    // Player's Guide worked example: 1st-level kingdom, Loyalty +1, trained in
    // Agriculture, an invested Loyalty role → 1 + 3 + 1 = 5.
    const result = skillModifier({
      keyAbilityScore: 12,
      rank: 1,
      level: 1,
      statusBonus: 1,
    });
    expect(result.abilityMod).toBe(1);
    expect(result.proficiencyBonus).toBe(3);
    expect(result.total).toBe(5);
  });

  it("subtracts ruin and vacancy penalties", () => {
    const result = skillModifier({
      keyAbilityScore: 14,
      rank: 2,
      level: 8,
      itemBonus: 2,
      ruinPenalty: 4,
      vacancyPenalty: 1,
    });
    // 2 (mod) + 12 (expert @ L8) + 2 (item) - 4 (ruin) - 1 (vacancy)
    expect(result.total).toBe(11);
  });
});

describe("investedStatusBonus", () => {
  it("grants +1 when a role keyed to the skill's ability is invested", () => {
    // Ruler and Emissary are Loyalty; Treasurer is Economy.
    expect(investedStatusBonus("loyalty", ["ruler"])).toBe(1);
    expect(investedStatusBonus("economy", ["ruler"])).toBe(0);
    expect(investedStatusBonus("economy", ["ruler", "treasurer"])).toBe(1);
  });

  it("does not stack across multiple invested roles of the same ability", () => {
    expect(investedStatusBonus("loyalty", ["ruler", "emissary"])).toBe(1);
  });
});

describe("sizeBracket", () => {
  it("returns the correct bracket and resource die", () => {
    expect(sizeBracket(1).resourceDie).toBe(4);
    expect(sizeBracket(9).resourceDie).toBe(4);
    expect(sizeBracket(10).resourceDie).toBe(6);
    expect(sizeBracket(24).controlDCModifier).toBe(1);
    expect(sizeBracket(25).nation).toBe("State");
    expect(sizeBracket(50).resourceDie).toBe(10);
    expect(sizeBracket(100).resourceDie).toBe(12);
    expect(sizeBracket(999).commodityStorage).toBe(20);
  });

  it("clamps sizes below 1", () => {
    expect(sizeBracket(0).minSize).toBe(1);
  });
});

describe("controlDC", () => {
  it("uses the base table at Size 1", () => {
    expect(controlDC(1)).toBe(14);
    expect(controlDC(5)).toBe(20);
    expect(controlDC(20)).toBe(40);
  });

  it("adds the Size modifier", () => {
    expect(controlDC(5, 10)).toBe(21); // +1 for Province
    expect(controlDC(5, 100)).toBe(24); // +4 for Dominion
  });

  it("clamps out-of-range levels", () => {
    expect(controlDC(0)).toBe(CONTROL_DC_BY_LEVEL[1]);
    expect(controlDC(99)).toBe(CONTROL_DC_BY_LEVEL[20]);
  });
});

describe("xpToNextLevel", () => {
  it("counts down within the 1000 XP band", () => {
    expect(xpToNextLevel(0)).toBe(1000);
    expect(xpToNextLevel(250)).toBe(750);
    expect(xpToNextLevel(999)).toBe(1);
    expect(xpToNextLevel(1000)).toBe(1000);
    expect(xpToNextLevel(1500)).toBe(500);
  });
});

describe("resourceDiceCount", () => {
  it("is level + 4 plus carryover, floored at 0", () => {
    expect(resourceDiceCount(1)).toBe(5);
    expect(resourceDiceCount(10)).toBe(14);
    expect(resourceDiceCount(1, 2)).toBe(7);
    expect(resourceDiceCount(1, -10)).toBe(0);
  });
});

describe("resolveRuin", () => {
  it("leaves points below the threshold untouched", () => {
    expect(resolveRuin(7, 10, 0)).toEqual({ points: 7, penalty: 0 });
  });

  it("subtracts the threshold and raises the penalty on each crossing", () => {
    expect(resolveRuin(10, 10, 0)).toEqual({ points: 0, penalty: 1 });
    expect(resolveRuin(13, 10, 2)).toEqual({ points: 3, penalty: 3 });
    expect(resolveRuin(25, 10, 0)).toEqual({ points: 5, penalty: 2 });
  });
});

describe("advancementTable", () => {
  it("covers levels 1 through 20", () => {
    const table = advancementTable("VK");
    expect(table).toHaveLength(20);
    expect(table[0].level).toBe(1);
    expect(table[19].level).toBe(20);
  });

  it("RAW grants skill increases every other level from 3", () => {
    const raw = advancementTable("RAW");
    expect(raw[1].skillIncrease).toBe(false); // level 2
    expect(raw[2].skillIncrease).toBe(true); // level 3
    expect(raw[3].skillIncrease).toBe(false); // level 4
    expect(raw.filter((l) => l.skillIncrease)).toHaveLength(9);
  });

  it("VK grants a skill increase every level from 2", () => {
    const vk = advancementTable("VK");
    expect(vk[1].skillIncrease).toBe(true); // level 2
    expect(vk.filter((l) => l.skillIncrease)).toHaveLength(19);
  });

  it("ability boosts land at 5/10/15/20 with ruleset-specific counts", () => {
    const raw = advancementTable("RAW");
    const vk = advancementTable("VK");
    for (const level of [5, 10, 15, 20]) {
      expect(raw[level - 1].abilityBoosts).toBe(2);
      expect(vk[level - 1].abilityBoosts).toBe(3);
    }
    expect(raw[3].abilityBoosts).toBe(0);
  });

  it("both rulesets grant Kingdom feats on even levels from 2", () => {
    for (const table of [advancementTable("RAW"), advancementTable("VK")]) {
      expect(table.filter((l) => l.kingdomFeat)).toHaveLength(10);
      expect(table[1].kingdomFeat).toBe(true);
      expect(table[2].kingdomFeat).toBe(false);
    }
  });
});

describe("finalizeBoostCount", () => {
  it("is 2 under RAW and 3 under VK", () => {
    expect(finalizeBoostCount("RAW")).toBe(2);
    expect(finalizeBoostCount("VK")).toBe(3);
  });
});

describe("computeAbilityScores", () => {
  it("starts every ability at 10 with no choices", () => {
    const { scores } = computeAbilityScores({});
    expect(scores).toEqual({ culture: 10, economy: 10, loyalty: 10, stability: 10 });
  });

  it("applies charter boost, flaw, and free boost", () => {
    // Conquest: +Loyalty, −Culture, free boost → Stability
    const { scores } = computeAbilityScores({
      charter: "conquest",
      charterFreeBoost: "stability",
    });
    expect(scores.loyalty).toBe(12);
    expect(scores.culture).toBe(8);
    expect(scores.stability).toBe(12);
    expect(scores.economy).toBe(10);
  });

  it("stacks charter, heartland, government, and finalize boosts", () => {
    // Charter expansion: +Culture, −Stability, free → Economy
    // Heartland lake/river: +Economy
    // Government republic: +Stability, +Loyalty, free → Culture
    // Finalize (VK, 3): Culture, Economy, Loyalty
    const { scores, modifiers } = computeAbilityScores({
      charter: "expansion",
      charterFreeBoost: "economy",
      heartland: "lake_river",
      government: "republic",
      governmentFreeBoost: "culture",
      finalizeBoosts: ["culture", "economy", "loyalty"],
    });
    expect(scores.culture).toBe(16); // 10 +2 charter +2 govt-free +2 finalize
    expect(scores.economy).toBe(16); // 10 +2 charter-free +2 heartland +2 finalize
    expect(scores.loyalty).toBe(14); // 10 +2 govt +2 finalize
    expect(scores.stability).toBe(10); // 10 +2 govt −2 charter flaw
    expect(modifiers.culture).toBe(3);
    expect(modifiers.stability).toBe(0);
  });

  it("is safe on a partially chosen kingdom", () => {
    const { scores } = computeAbilityScores({ government: "despotism" });
    expect(scores.stability).toBe(12);
    expect(scores.economy).toBe(12);
  });
});

describe("anarchy threshold constant", () => {
  it("is 20 per the Player's Guide", () => {
    expect(ANARCHY_UNREST).toBe(20);
  });
});
