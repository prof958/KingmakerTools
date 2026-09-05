/**
 * Server-side loaders for the companion board, shared by the Dashboard and the
 * Party page so both always show the same roster and the same assignments.
 *
 * Fields are picked explicitly rather than with `include`: the result crosses
 * into client components, and there is no reason to ship `createdAt` timestamps
 * nobody renders.
 */

import { prisma } from "@/lib/db";
import type {
  Assignment,
  CompanionLite,
  LocationOption,
} from "@/components/companions/types";

const memberSelect = {
  id: true,
  characterId: true,
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
} as const;

const assignmentSelect = {
  id: true,
  kind: true,
  status: true,
  title: true,
  description: true,
  locationName: true,
  hexId: true,
  settlementId: true,
  departDay: true,
  departMonth: true,
  departYear: true,
  returnDay: true,
  returnMonth: true,
  returnYear: true,
  outcome: true,
  resolvedDay: true,
  resolvedMonth: true,
  resolvedYear: true,
  members: { select: memberSelect },
} as const;

export interface CompanionBoardData {
  companions: CompanionLite[];
  assignments: Assignment[];
}

/**
 * The roster is every companion, plus anyone else currently carrying an active
 * assignment — so a PC sent somewhere still shows up on the board instead of
 * vanishing from it.
 */
export async function loadCompanionBoard(
  campaignId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<CompanionBoardData> {
  const [companions, assignments] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId, isCompanion: true },
      select: {
        id: true,
        name: true,
        emoji: true,
        imageUrl: true,
        isCompanion: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.companionAssignment.findMany({
      where: { campaignId, ...(activeOnly ? { status: "ACTIVE" } : {}) },
      select: assignmentSelect,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roster = new Map(companions.map((c) => [c.id, c]));
  for (const a of assignments) {
    if (a.status !== "ACTIVE") continue;
    for (const m of a.members) {
      if (!roster.has(m.characterId)) roster.set(m.characterId, m.character);
    }
  }

  return { companions: [...roster.values()], assignments };
}

/**
 * Places on the kingdom map an assignment can be pinned to: every settlement,
 * and hexes that have actually been named. Unnamed hexes are left out — a list
 * of bare axial coordinates is not something anyone picks a destination from.
 */
export async function loadLocationOptions(
  campaignId: string,
): Promise<LocationOption[]> {
  const kingdom = await prisma.kingdom.findUnique({
    where: { campaignId },
    select: { id: true },
  });
  if (!kingdom) return [];

  const [settlements, hexes] = await Promise.all([
    prisma.settlement.findMany({
      where: { kingdomId: kingdom.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.hex.findMany({
      where: { kingdomId: kingdom.id, label: { not: null } },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
  ]);

  return [
    ...settlements.map((s) => ({
      value: `settlement:${s.id}`,
      label: s.name,
      group: "Settlements" as const,
    })),
    ...hexes.map((h) => ({
      value: `hex:${h.id}`,
      label: h.label as string,
      group: "Hexes" as const,
    })),
  ];
}
