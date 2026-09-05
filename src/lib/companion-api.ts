/**
 * Shared server-side helpers for the companion assignment routes — the Prisma
 * shape both routes select, and the validation both of them apply.
 *
 * Kept out of `companions.ts` on purpose: that module is pure and gets imported
 * by client components, this one touches Prisma types.
 */

import { prisma } from "@/lib/db";
import { isValidGolarionDate } from "@/lib/pf2e/calendar";
import {
  ASSIGNMENT_KINDS,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_KIND_META,
  type AssignmentKind,
  type AssignmentStatus,
} from "@/lib/companions";

/**
 * Every assignment response carries its members with enough of each character
 * to render a card without a second round trip.
 */
export const assignmentInclude = {
  members: {
    include: {
      character: {
        select: {
          id: true,
          name: true,
          emoji: true,
          imageUrl: true,
          isCompanion: true,
          status: true,
        },
      },
    },
  },
} as const;

export function isAssignmentKind(value: unknown): value is AssignmentKind {
  return typeof value === "string" && (ASSIGNMENT_KINDS as string[]).includes(value);
}

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as string[]).includes(value);
}

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

/**
 * Read a `{prefix}Day/Month/Year` triple out of a request body.
 *
 * Returns `undefined` when the caller did not mention the date at all (a PATCH
 * that leaves it alone), `null` when they explicitly cleared it, and an error
 * string when they sent something that is not a real Golarion date. A partial
 * triple is an error rather than a silent null — it almost always means a bug
 * in the caller, and quietly dropping it would lose a return date.
 */
export function readDate(
  body: Record<string, unknown>,
  prefix: "depart" | "return" | "resolved",
): DateParts | null | { error: string } | undefined {
  const dayKey = `${prefix}Day`;
  const monthKey = `${prefix}Month`;
  const yearKey = `${prefix}Year`;

  const mentioned = dayKey in body || monthKey in body || yearKey in body;
  if (!mentioned) return undefined;

  const day = body[dayKey];
  const month = body[monthKey];
  const year = body[yearKey];

  const allNull = day === null && month === null && year === null;
  if (allNull) return null;

  if (
    typeof day !== "number" ||
    typeof month !== "number" ||
    typeof year !== "number"
  ) {
    return { error: `${prefix} date must be a complete day/month/year, or all null` };
  }

  if (!isValidGolarionDate(day, month, year)) {
    return { error: `${day}/${month}/${year} is not a date on the Golarion calendar` };
  }

  return { day, month, year };
}

export function isDateError(
  value: DateParts | null | { error: string } | undefined,
): value is { error: string } {
  return value !== null && value !== undefined && "error" in value;
}

/**
 * A companion can only be in one place at a time, so refuse to start an
 * assignment for anyone already on an active one. Returns the blocking names,
 * empty when the roster is free. `ignoreAssignmentId` lets a PATCH re-save its
 * own members without tripping over itself.
 */
export async function findAlreadyDeployed(
  characterIds: string[],
  ignoreAssignmentId?: string,
): Promise<string[]> {
  if (characterIds.length === 0) return [];

  const clashes = await prisma.companionAssignmentMember.findMany({
    where: {
      characterId: { in: characterIds },
      assignment: {
        status: "ACTIVE",
        ...(ignoreAssignmentId ? { id: { not: ignoreAssignmentId } } : {}),
      },
    },
    include: { character: { select: { name: true } } },
  });

  return clashes.map((m) => m.character.name);
}

/**
 * Validate the member id list on a create/update: it must be a non-empty array
 * of ids that all belong to this campaign.
 */
export async function validateMemberIds(
  campaignId: string,
  value: unknown,
): Promise<{ ids: string[] } | { error: string }> {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Pick at least one companion" };
  }
  if (!value.every((id) => typeof id === "string" && id.length > 0)) {
    return { error: "characterIds must be a list of character ids" };
  }

  const ids = [...new Set(value as string[])];
  const found = await prisma.character.count({
    where: { id: { in: ids }, campaignId },
  });

  if (found !== ids.length) {
    return { error: "One of those characters is not in this campaign" };
  }

  return { ids };
}

/** One-line summary for the campaign log, e.g. "Amiri and Jubilost left for ...". */
export function describeDeparture(
  kind: AssignmentKind,
  names: string[],
  title: string,
  locationName: string | null,
): string {
  const who = joinNames(names);
  const where = locationName ? ` at ${locationName}` : "";

  switch (kind) {
    case "QUEST":
      return `${who} set out on "${title}"${where}`;
    case "STATION":
      return `${who} took up a post${where || ` — ${title}`}`;
    case "RECOVERING":
      return `${who} went out of action — ${title}`;
    case "MISSING":
      return `${who} went missing — ${title}`;
  }
}

/** One-line summary for the campaign log when an assignment is resolved. */
export function describeResolution(
  status: AssignmentStatus,
  kind: AssignmentKind,
  names: string[],
  title: string,
): string {
  const who = joinNames(names);
  const what = ASSIGNMENT_KIND_META[kind].label.toLowerCase();

  switch (status) {
    case "COMPLETED":
      return kind === "RECOVERING"
        ? `${who} recovered and rejoined the party`
        : `${who} returned successfully from "${title}"`;
    case "FAILED":
      return `${who} failed "${title}"`;
    case "RECALLED":
      return `${who} were called back from "${title}" (${what})`;
    case "ACTIVE":
      return `${who} are back out on "${title}"`;
  }
}

/** "Amiri", "Amiri and Jubilost", "Amiri, Jubilost and Ekundayo". */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "Nobody";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
