/**
 * Pure helpers for the campaign log.
 *
 * Given a before/after pair, each `describe*` returns the one-line summary to
 * record, or `null` when nothing changed worth logging. Kept dependency-free so
 * it is trivially unit-testable (see `log.test.ts`).
 */

import type { LogCategory } from "@/generated/prisma/client";

export interface DescribedChange {
  category: LogCategory;
  summary: string;
}

interface CharacterShape {
  name: string;
  isCompanion: boolean;
}

/**
 * Rename / companion-toggle changes for a character. KIA and revival are
 * handled directly by the route (they carry a note and their own category).
 */
export function describeCharacterChange(
  before: CharacterShape,
  after: CharacterShape,
): DescribedChange | null {
  const clauses: string[] = [];

  if (before.name !== after.name) {
    clauses.push(`renamed "${before.name}" to "${after.name}"`);
  }
  if (before.isCompanion !== after.isCompanion) {
    const who = after.name;
    clauses.push(
      after.isCompanion
        ? `marked ${who} as a companion`
        : `marked ${who} as a full party member`,
    );
  }

  if (clauses.length === 0) return null;
  return { category: "PARTY", summary: capitalise(clauses.join("; ")) };
}

interface InventoryShape {
  itemName: string;
  quantity: number;
  characterName: string | null;
  inContainer: boolean;
}

/** Assignment / container / quantity changes for an inventory item. */
export function describeInventoryChange(
  before: InventoryShape,
  after: InventoryShape,
): DescribedChange | null {
  const clauses: string[] = [];
  const item = after.itemName;

  if (before.characterName !== after.characterName) {
    if (before.characterName && after.characterName) {
      clauses.push(
        `reassigned ${item} from ${before.characterName} to ${after.characterName}`,
      );
    } else if (after.characterName) {
      clauses.push(`assigned ${item} to ${after.characterName}`);
    } else {
      clauses.push(`unassigned ${item} from ${before.characterName}`);
    }
  }

  if (before.inContainer !== after.inContainer) {
    clauses.push(
      after.inContainer
        ? `stowed ${item} in a container`
        : `removed ${item} from its container`,
    );
  }

  if (before.quantity !== after.quantity) {
    clauses.push(
      `changed ${item} quantity from ${before.quantity} to ${after.quantity}`,
    );
  }

  if (clauses.length === 0) return null;
  return { category: "INVENTORY", summary: capitalise(clauses.join("; ")) };
}

interface CampsiteShape {
  name: string;
  isActive: boolean;
}

export function describeCampsiteChange(
  before: CampsiteShape,
  after: CampsiteShape,
  opts: { watchOrderReplaced?: boolean; activitiesReplaced?: boolean } = {},
): DescribedChange | null {
  const clauses: string[] = [];
  const name = after.name;

  if (before.name !== after.name) {
    clauses.push(`renamed camp layout "${before.name}" to "${after.name}"`);
  }
  if (!before.isActive && after.isActive) {
    clauses.push(`made "${name}" the active camp layout`);
  }
  if (opts.watchOrderReplaced) {
    clauses.push(`updated the watch order for "${name}"`);
  }
  if (opts.activitiesReplaced) {
    clauses.push(`updated camp activities for "${name}"`);
  }

  if (clauses.length === 0) return null;
  return { category: "CAMPSITE", summary: capitalise(clauses.join("; ")) };
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
