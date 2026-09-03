import { describe, expect, it } from "vitest";
import {
  describeCampsiteChange,
  describeCharacterChange,
  describeInventoryChange,
  describeObjectiveChange,
} from "./log-format";

describe("describeCharacterChange", () => {
  const base = { name: "Valerie", isCompanion: false };

  it("returns null when nothing relevant changed", () => {
    expect(describeCharacterChange(base, { ...base })).toBeNull();
  });

  it("describes a rename", () => {
    const r = describeCharacterChange(base, { ...base, name: "Val" });
    expect(r).toEqual({
      category: "PARTY",
      summary: 'Renamed "Valerie" to "Val"',
    });
  });

  it("describes a companion toggle", () => {
    expect(
      describeCharacterChange(base, { ...base, isCompanion: true })?.summary,
    ).toBe("Marked Valerie as a companion");
    expect(
      describeCharacterChange({ ...base, isCompanion: true }, base)?.summary,
    ).toBe("Marked Valerie as a full party member");
  });

  it("combines multiple clauses", () => {
    const r = describeCharacterChange(base, { name: "Val", isCompanion: true });
    expect(r?.summary).toBe(
      'Renamed "Valerie" to "Val"; marked Val as a companion',
    );
  });
});

describe("describeInventoryChange", () => {
  const base = {
    itemName: "Longsword",
    quantity: 1,
    characterName: null as string | null,
    inContainer: false,
  };

  it("returns null with no changes", () => {
    expect(describeInventoryChange(base, { ...base })).toBeNull();
  });

  it("describes assign / unassign / reassign", () => {
    expect(
      describeInventoryChange(base, { ...base, characterName: "Amiri" })?.summary,
    ).toBe("Assigned Longsword to Amiri");
    expect(
      describeInventoryChange({ ...base, characterName: "Amiri" }, base)?.summary,
    ).toBe("Unassigned Longsword from Amiri");
    expect(
      describeInventoryChange(
        { ...base, characterName: "Amiri" },
        { ...base, characterName: "Valerie" },
      )?.summary,
    ).toBe("Reassigned Longsword from Amiri to Valerie");
  });

  it("describes container and quantity moves", () => {
    expect(
      describeInventoryChange(base, { ...base, inContainer: true })?.summary,
    ).toBe("Stowed Longsword in a container");
    expect(
      describeInventoryChange(base, { ...base, quantity: 3 })?.summary,
    ).toBe("Changed Longsword quantity from 1 to 3");
  });
});

describe("describeCampsiteChange", () => {
  const base = { name: "Riverside", isActive: false };

  it("returns null with no changes", () => {
    expect(describeCampsiteChange(base, { ...base })).toBeNull();
  });

  it("describes rename and activation", () => {
    expect(
      describeCampsiteChange(base, { ...base, name: "Hilltop" })?.summary,
    ).toBe('Renamed camp layout "Riverside" to "Hilltop"');
    expect(
      describeCampsiteChange(base, { ...base, isActive: true })?.summary,
    ).toBe('Made "Riverside" the active camp layout');
  });

  it("describes watch-order and activity replacements via opts", () => {
    expect(
      describeCampsiteChange(base, base, { watchOrderReplaced: true })?.summary,
    ).toBe('Updated the watch order for "Riverside"');
    expect(
      describeCampsiteChange(base, base, { activitiesReplaced: true })?.summary,
    ).toBe('Updated camp activities for "Riverside"');
  });
});

describe("describeObjectiveChange", () => {
  const base = { title: "Clear the Stag Lord's fort", status: "ACTIVE" as const };

  it("returns null when the status didn't change", () => {
    expect(describeObjectiveChange(base, { ...base })).toBeNull();
    expect(
      describeObjectiveChange(base, { ...base, title: "Renamed" }),
    ).toBeNull();
  });

  it("describes completing, failing, archiving, and reactivating", () => {
    expect(
      describeObjectiveChange(base, { ...base, status: "COMPLETED" })?.summary,
    ).toBe('Completed objective "Clear the Stag Lord\'s fort"');
    expect(
      describeObjectiveChange(base, { ...base, status: "FAILED" })?.summary,
    ).toBe('Failed objective "Clear the Stag Lord\'s fort"');
    expect(
      describeObjectiveChange(base, { ...base, status: "ARCHIVED" })?.summary,
    ).toBe('Archived objective "Clear the Stag Lord\'s fort"');
    expect(
      describeObjectiveChange(
        { ...base, status: "ARCHIVED" },
        { ...base, status: "ACTIVE" },
      )?.summary,
    ).toBe('Reactivated objective "Clear the Stag Lord\'s fort"');
  });

  it("uses the OBJECTIVE category", () => {
    expect(
      describeObjectiveChange(base, { ...base, status: "COMPLETED" })?.category,
    ).toBe("OBJECTIVE");
  });
});
