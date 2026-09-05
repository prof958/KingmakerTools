/**
 * Serialized shapes the companion components receive from the server.
 * `Assignment` extends `AssignmentLike` so every pure helper in
 * `lib/companions.ts` accepts one directly.
 */

import type { AssignmentLike } from "@/lib/companions";

export interface CompanionLite {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  isCompanion: boolean;
  status: "ACTIVE" | "FALLEN";
}

export interface AssignmentMember {
  id: string;
  characterId: string;
  character: CompanionLite;
}

export interface Assignment extends AssignmentLike {
  id: string;
  title: string;
  description: string | null;
  locationName: string | null;
  hexId: string | null;
  settlementId: string | null;
  outcome: string | null;
  resolvedDay: number | null;
  resolvedMonth: number | null;
  resolvedYear: number | null;
  members: AssignmentMember[];
}

/** A place on the kingdom map an assignment can be pinned to. */
export interface LocationOption {
  /** `hex:<id>` or `settlement:<id>` — one flat value list for a single Select. */
  value: string;
  label: string;
  group: "Settlements" | "Hexes";
}

export interface GolarionToday {
  day: number;
  month: number;
  year: number;
}
