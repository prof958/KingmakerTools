import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PHASE_LABELS,
  KINGDOM_ACTIVITIES,
  activitiesForPhase,
  activitiesForSkill,
  getKingdomActivity,
} from "./kingdom-activities";
import { KINGDOM_SKILLS } from "./kingdom";

const SKILL_IDS = new Set(KINGDOM_SKILLS.map((s) => s.id));

describe("the generated catalog", () => {
  it("has unique ids", () => {
    const ids = KINGDOM_ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only real kingdom skills and ranks", () => {
    for (const activity of KINGDOM_ACTIVITIES) {
      for (const option of activity.skills) {
        expect(SKILL_IDS, `${activity.id} → ${option.skill}`).toContain(option.skill);
        expect(option.minRank).toBeGreaterThanOrEqual(0);
        expect(option.minRank).toBeLessThanOrEqual(4);
      }
    }
  });

  it("uses only known phases", () => {
    for (const activity of KINGDOM_ACTIVITIES) {
      expect(ACTIVITY_PHASE_LABELS).toHaveProperty(activity.phase);
    }
  });

  it("gives every activity a description", () => {
    for (const activity of KINGDOM_ACTIVITIES) {
      expect(activity.description.length, activity.id).toBeGreaterThan(20);
    }
  });

  it("gives every activity its degree outcomes, bar the ones with no check", () => {
    // Focused Attention resolves on a plain DC 20 check described inline, and
    // Disband Army takes no check at all, so neither is written with degrees.
    const NO_DEGREES = ["disband-army", "focused-attention"];
    const withoutOutcomes = KINGDOM_ACTIVITIES.filter(
      (a) => Object.keys(a.outcomes).length === 0,
    );
    expect(withoutOutcomes.map((a) => a.id).sort()).toEqual(NO_DEGREES);

    for (const activity of KINGDOM_ACTIVITIES) {
      if (NO_DEGREES.includes(activity.id)) continue;
      expect(Object.keys(activity.outcomes), activity.id).toContain("success");
      expect(Object.keys(activity.outcomes), activity.id).toContain("failure");
    }
  });

  it("resolves a skill for every activity that is not structure-driven", () => {
    const unresolved = KINGDOM_ACTIVITIES.filter(
      (a) => a.skills.length === 0 && a.skillChoice === undefined,
    );
    expect(unresolved.map((a) => a.id)).toEqual([]);
  });

  it("kept every extracted field whole", () => {
    // The guide's prose reuses its own section labels mid-sentence, and its
    // sidebars interrupt the columns. Both used to cut entries off partway, so
    // a field that stops without end punctuation means the extraction slipped.
    const truncated: string[] = [];
    for (const activity of KINGDOM_ACTIVITIES) {
      const fields: [string, string | null][] = [
        ["description", activity.description],
        ["requirements", activity.requirements],
        ...Object.entries(activity.outcomes),
      ];
      for (const [field, value] of fields) {
        if (value && !/[.!:)]$/.test(value.trimEnd())) {
          truncated.push(`${activity.id}/${field}`);
        }
      }
    }
    expect(truncated).toEqual([]);
  });

  it("kept no section headings in the prose", () => {
    // Skill-section headings ("MAGIC (CULTURE)") and rules boxes are the other
    // things that used to bleed into whatever entry preceded them.
    const bleeding: string[] = [];
    for (const activity of KINGDOM_ACTIVITIES) {
      const prose = [activity.description, ...Object.values(activity.outcomes)].join(" ");
      if (/\b[A-Z]{4,}(?: [A-Z]{2,})+\b/.test(prose)) bleeding.push(activity.id);
    }
    expect(bleeding).toEqual([]);
  });

  it("kept no page furniture in the prose", () => {
    for (const activity of KINGDOM_ACTIVITIES) {
      const prose = [activity.description, ...Object.values(activity.outcomes)].join(" ");
      expect(prose, activity.id).not.toMatch(/PLAYER.S GUIDE/i);
    }
  });
});

describe("V&K coverage", () => {
  it("adds Take Charge as a trained any-skill leadership activity", () => {
    const a = getKingdomActivity("take-charge");
    expect(a?.source).toBe("VK");
    expect(a?.phase).toBe("leadership");
    expect(a?.skillChoice).toBe("any");
    expect(a?.anyMinRank).toBe(1);
  });

  it("adds Reconnoiter Hex as a region activity", () => {
    const a = getKingdomActivity("reconnoiter-hex");
    expect(a?.source).toBe("VK");
    expect(a?.phase).toBe("region");
    expect(a?.skills.map((s) => s.skill)).toEqual(["exploration", "wilderness"]);
  });

  it("amends Capital Investment to allow the capital itself", () => {
    expect(getKingdomActivity("capital-investment")?.requirements).toContain("Capital");
  });

  it("records the escalating DC on Request Foreign Aid", () => {
    expect(getKingdomActivity("request-foreign-aid")?.vkNote).toContain("rises by 2");
  });
});

describe("lookups", () => {
  it("groups activities by turn phase", () => {
    expect(activitiesForPhase("region").map((a) => a.id)).toContain("claim-hex");
    expect(activitiesForPhase("civic").map((a) => a.id)).toContain("build-structure");
    expect(activitiesForPhase("commerce").map((a) => a.id)).toContain("collect-taxes");
  });

  it("finds activities a skill unlocks at a given rank", () => {
    const untrained = activitiesForSkill("agriculture", 0).map((a) => a.id);
    expect(untrained).toContain("establish-farmland");
    // Take Charge needs training; Collect Taxes is a trained Trade activity.
    expect(untrained).not.toContain("take-charge");
    expect(activitiesForSkill("trade", 0).map((a) => a.id)).not.toContain("collect-taxes");
    expect(activitiesForSkill("trade", 1).map((a) => a.id)).toContain("collect-taxes");
  });

  it("never offers Build Structure through a skill", () => {
    for (const skill of SKILL_IDS) {
      expect(activitiesForSkill(skill, 4).map((a) => a.id)).not.toContain("build-structure");
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getKingdomActivity("nope")).toBeUndefined();
  });
});
