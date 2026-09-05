/**
 * Companion assignments — pure derivation of "who is where and doing what".
 *
 * A companion's whereabouts is entirely a function of their one ACTIVE
 * assignment plus today's in-world date. Nothing is written when the Golarion
 * calendar moves: advancing the date on the dashboard re-derives every board
 * on the next render, so the roster can never drift out of sync with the
 * calendar the way a stored status column would. Resolving an assignment —
 * recording how it actually went — stays a deliberate manual act.
 *
 * No DB access and no React here — see `src/app/api/companions/` for the
 * write path and `src/components/companions/` for the UI.
 */

import {
  daysBetween,
  formatGolarionDate,
  type GolarionDate,
} from "./pf2e/calendar";

/** Mirrors the Prisma `AssignmentKind` enum. */
export type AssignmentKind = "QUEST" | "STATION" | "RECOVERING" | "MISSING";

/** Mirrors the Prisma `AssignmentStatus` enum. */
export type AssignmentStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "RECALLED";

export const ASSIGNMENT_KINDS: AssignmentKind[] = [
  "QUEST",
  "STATION",
  "RECOVERING",
  "MISSING",
];

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "ACTIVE",
  "COMPLETED",
  "FAILED",
  "RECALLED",
];

export interface AssignmentKindMeta {
  label: string;
  /** Imperative phrasing for the control that starts this kind of assignment. */
  verb: string;
  /** Does this kind normally name a place? */
  hasLocation: boolean;
  /** Does this kind normally have an expected return date? */
  hasReturnDate: boolean;
  blurb: string;
}

export const ASSIGNMENT_KIND_META: Record<AssignmentKind, AssignmentKindMeta> = {
  QUEST: {
    label: "Quest",
    verb: "Send on a quest",
    hasLocation: true,
    hasReturnDate: true,
    blurb: "Away on a task, expected back on a set day.",
  },
  STATION: {
    label: "Stationed",
    verb: "Station somewhere",
    hasLocation: true,
    hasReturnDate: false,
    blurb: "Posted somewhere indefinitely — no return date.",
  },
  RECOVERING: {
    label: "Recovering",
    verb: "Mark as injured",
    hasLocation: false,
    hasReturnDate: true,
    blurb: "Out of action until they are back on their feet.",
  },
  MISSING: {
    label: "Missing",
    verb: "Report missing",
    hasLocation: false,
    hasReturnDate: false,
    blurb: "Whereabouts unknown until someone finds them.",
  },
};

/**
 * The state shown on a companion's card. `WITH_PARTY` is the *absence* of an
 * active assignment; every other value is derived from one.
 */
export type CompanionState =
  | "WITH_PARTY"
  | "AWAY"
  | "DUE_BACK"
  | "OVERDUE"
  | "STATIONED"
  | "RECOVERING"
  | "READY"
  | "MISSING"
  | "FALLEN";

/**
 * Colour role, resolved to real classes by the UI. Deliberately semantic
 * rather than a colour name so the party board and the dashboard card cannot
 * drift apart.
 */
export type StateTone = "neutral" | "active" | "ready" | "warning" | "danger";

export interface CompanionStateMeta {
  label: string;
  tone: StateTone;
  /** True when the row is something the player has to act on. */
  needsAttention: boolean;
}

export const COMPANION_STATE_META: Record<CompanionState, CompanionStateMeta> = {
  WITH_PARTY: { label: "With the party", tone: "neutral", needsAttention: false },
  AWAY: { label: "On a quest", tone: "active", needsAttention: false },
  DUE_BACK: { label: "Due back today", tone: "ready", needsAttention: true },
  OVERDUE: { label: "Overdue", tone: "warning", needsAttention: true },
  STATIONED: { label: "Stationed", tone: "active", needsAttention: false },
  RECOVERING: { label: "Recovering", tone: "warning", needsAttention: false },
  READY: { label: "Ready to return", tone: "ready", needsAttention: true },
  MISSING: { label: "Missing", tone: "danger", needsAttention: true },
  FALLEN: { label: "Fallen", tone: "danger", needsAttention: false },
};

/** The subset of an assignment row this module needs. */
export interface AssignmentLike {
  kind: AssignmentKind;
  status: AssignmentStatus;
  departDay: number;
  departMonth: number;
  departYear: number;
  returnDay: number | null;
  returnMonth: number | null;
  returnYear: number | null;
}

/** The expected return date, or null when the assignment is open-ended. */
export function returnDate(a: AssignmentLike): GolarionDate | null {
  if (a.returnDay === null || a.returnMonth === null || a.returnYear === null) {
    return null;
  }
  return { day: a.returnDay, month: a.returnMonth, year: a.returnYear };
}

export function departDate(a: AssignmentLike): GolarionDate {
  return { day: a.departDay, month: a.departMonth, year: a.departYear };
}

/**
 * Days from `today` until the expected return: negative once the date has
 * passed, 0 on the day itself, null when the assignment is open-ended.
 */
export function daysUntilReturn(
  a: AssignmentLike,
  today: GolarionDate,
): number | null {
  const due = returnDate(a);
  return due ? daysBetween(today, due) : null;
}

/** Days elapsed since departure. Negative if the assignment starts in the future. */
export function daysAway(a: AssignmentLike, today: GolarionDate): number {
  return daysBetween(departDate(a), today);
}

/**
 * What a companion's card should say, given their one active assignment (or
 * none) and today's date. `fallen` short-circuits everything — a K.I.A.
 * character keeps their assignment history, but the board must not claim they
 * are still off running errands.
 */
export function deriveCompanionState(
  assignment: AssignmentLike | null | undefined,
  today: GolarionDate,
  fallen = false,
): CompanionState {
  if (fallen) return "FALLEN";
  if (!assignment || assignment.status !== "ACTIVE") return "WITH_PARTY";

  const remaining = daysUntilReturn(assignment, today);

  switch (assignment.kind) {
    case "MISSING":
      return "MISSING";
    case "STATION":
      return "STATIONED";
    case "RECOVERING":
      return remaining !== null && remaining <= 0 ? "READY" : "RECOVERING";
    case "QUEST":
      if (remaining === null || remaining > 0) return "AWAY";
      return remaining === 0 ? "DUE_BACK" : "OVERDUE";
  }
}

/**
 * The countdown line under a companion's name — "Back in 3 days", "2 days
 * overdue". Null when there is nothing to count down.
 */
export function describeTiming(
  assignment: AssignmentLike | null | undefined,
  today: GolarionDate,
): string | null {
  if (!assignment || assignment.status !== "ACTIVE") return null;

  const remaining = daysUntilReturn(assignment, today);

  // Open-ended: there is no return to count towards, so count up instead.
  if (remaining === null) {
    const away = daysAway(assignment, today);
    if (away < 0) return `Leaves in ${plural(-away, "day")}`;
    if (away === 0) return "Departed today";
    return `Away ${plural(away, "day")}`;
  }

  const recovering = assignment.kind === "RECOVERING";

  if (remaining > 0) {
    return recovering
      ? `On their feet in ${plural(remaining, "day")}`
      : `Back in ${plural(remaining, "day")}`;
  }
  if (remaining === 0) return recovering ? "Ready today" : "Due back today";
  return recovering
    ? `Recovered ${plural(-remaining, "day")} ago`
    : `${plural(-remaining, "day")} overdue`;
}

/** Trimmed location name, or null when the assignment does not name a place. */
export function describeLocation(
  locationName: string | null | undefined,
): string | null {
  const trimmed = locationName?.trim();
  return trimmed ? trimmed : null;
}

/** "1 Pharast 4710 AR → 12 Pharast 4710 AR" for an assignment's detail line. */
export function describeDateRange(a: AssignmentLike): string {
  const from = formatGolarionDate(a.departDay, a.departMonth, a.departYear);
  const due = returnDate(a);
  if (!due) return `From ${from}`;
  return `${from} → ${formatGolarionDate(due.day, due.month, due.year)}`;
}

/**
 * How far through an assignment we are, 0–1, for the progress bar. Null when
 * there is no return date to measure against; clamped so an overdue bar sits
 * full rather than overflowing.
 */
export function progressFraction(
  a: AssignmentLike,
  today: GolarionDate,
): number | null {
  const due = returnDate(a);
  if (!due) return null;

  const total = daysBetween(departDate(a), due);
  if (total <= 0) return 1;

  return Math.min(1, Math.max(0, daysAway(a, today) / total));
}

/**
 * Board ordering: whatever needs attention first, then the soonest return,
 * then everyone simply present. Names break ties so the list does not
 * reshuffle between renders.
 */
const STATE_RANK: Record<CompanionState, number> = {
  MISSING: 0,
  OVERDUE: 1,
  DUE_BACK: 2,
  READY: 3,
  AWAY: 4,
  STATIONED: 5,
  RECOVERING: 6,
  WITH_PARTY: 7,
  FALLEN: 8,
};

export interface BoardEntry {
  name: string;
  state: CompanionState;
  assignment: AssignmentLike | null;
}

export function compareBoardEntries(
  a: BoardEntry,
  b: BoardEntry,
  today: GolarionDate,
): number {
  const rank = STATE_RANK[a.state] - STATE_RANK[b.state];
  if (rank !== 0) return rank;

  const aDays = a.assignment ? daysUntilReturn(a.assignment, today) : null;
  const bDays = b.assignment ? daysUntilReturn(b.assignment, today) : null;
  if (aDays !== null && bDays !== null && aDays !== bDays) return aDays - bDays;
  if (aDays !== null && bDays === null) return -1;
  if (aDays === null && bDays !== null) return 1;

  return a.name.localeCompare(b.name);
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
