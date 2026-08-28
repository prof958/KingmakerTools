/**
 * Kingdom Founding API
 *
 * POST /api/kingdom/found — commit the founding wizard in one transaction.
 *   body: {
 *     name, ruleset,
 *     charter, charterFreeBoost, heartland, government, governmentFreeBoost,
 *     finalizeBoosts: string[], skillPicks: string[],
 *     leadership: { role, characterId?, npcName? }[]
 *   }
 *
 * The ability scores and the trained-skill set are recomputed here from the
 * choices rather than trusted from the client, so the stored kingdom always
 * matches what the rules engine derives from the same founding choices.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import {
  CHARTERS,
  GOVERNMENTS,
  HEARTLANDS,
  KINGDOM_ABILITIES,
  LEADERSHIP_ROLES,
  computeAbilityScores,
  finalizeBoostCount,
  getKingdomSkill,
  startingSkills,
  type KingdomAbility,
  type KingdomRuleset,
} from "@/lib/pf2e/kingdom";

const ROLE_IDS = new Set(LEADERSHIP_ROLES.map((r) => r.id));

function asAbility(value: unknown): KingdomAbility | null {
  return typeof value === "string" && (KINGDOM_ABILITIES as readonly string[]).includes(value)
    ? (value as KingdomAbility)
    : null;
}

function asId(value: unknown, known: { id: string }[]): string | null {
  return typeof value === "string" && known.some((k) => k.id === value) ? value : null;
}

export async function POST(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();

    const ruleset: KingdomRuleset = body.ruleset === "RAW" ? "RAW" : "VK";
    const charter = asId(body.charter, CHARTERS);
    const heartland = asId(body.heartland, HEARTLANDS);
    const government = asId(body.government, GOVERNMENTS);

    const missing = [
      !charter && "charter",
      !heartland && "heartland",
      !government && "government",
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Choose a ${missing.join(", ")} before founding` },
        { status: 400 },
      );
    }

    const finalizeBoosts = (Array.isArray(body.finalizeBoosts) ? body.finalizeBoosts : [])
      .map(asAbility)
      .filter((a: KingdomAbility | null): a is KingdomAbility => a !== null)
      .slice(0, finalizeBoostCount(ruleset));

    if (finalizeBoosts.length < finalizeBoostCount(ruleset)) {
      return NextResponse.json(
        { error: `Choose ${finalizeBoostCount(ruleset)} abilities to boost` },
        { status: 400 },
      );
    }
    if (new Set(finalizeBoosts).size !== finalizeBoosts.length) {
      return NextResponse.json(
        { error: "The finalize boosts must go to different abilities" },
        { status: 400 },
      );
    }

    const choices = {
      charter,
      charterFreeBoost: asAbility(body.charterFreeBoost),
      heartland,
      government,
      governmentFreeBoost: asAbility(body.governmentFreeBoost),
      finalizeBoosts,
    };

    const picks = (Array.isArray(body.skillPicks) ? body.skillPicks : []).filter(
      (s: unknown): s is string => typeof s === "string" && Boolean(getKingdomSkill(s)),
    );
    const skills = startingSkills({ ruleset, charter, heartland, government, picks });

    if (skills.remaining > 0) {
      return NextResponse.json(
        { error: `Choose ${skills.remaining} more trained skill(s)` },
        { status: 400 },
      );
    }

    const { scores } = computeAbilityScores(choices);
    const trained = new Set(skills.trained);

    const leadership = (Array.isArray(body.leadership) ? body.leadership : []).filter(
      (entry: { role?: unknown }) =>
        typeof entry?.role === "string" && ROLE_IDS.has(entry.role),
    );

    await prisma.$transaction([
      prisma.kingdom.update({
        where: { id: kingdom.id },
        data: {
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
          ruleset,
          ...choices,
          skillPicks: skills.picks,
          ...scores,
          founded: true,
        },
      }),
      // Founding sets the baseline: every skill the choices trained is Trained,
      // everything else returns to Untrained.
      prisma.kingdomSkill.updateMany({
        where: { kingdomId: kingdom.id, skill: { in: [...trained] } },
        data: { rank: 1 },
      }),
      prisma.kingdomSkill.updateMany({
        where: { kingdomId: kingdom.id, skill: { notIn: [...trained] } },
        data: { rank: 0 },
      }),
      ...leadership.map((entry: { role: string; characterId?: unknown; npcName?: unknown }) => {
        const characterId =
          typeof entry.characterId === "string" && entry.characterId ? entry.characterId : null;
        const npcName =
          !characterId && typeof entry.npcName === "string" && entry.npcName.trim()
            ? entry.npcName.trim()
            : null;
        return prisma.leadershipRole.update({
          where: { kingdomId_role: { kingdomId: kingdom.id, role: entry.role } },
          data: { characterId, npcName },
        });
      }),
    ]);

    const founded = await getOrCreateKingdom();
    return NextResponse.json(founded);
  } catch (error) {
    console.error("Failed to found kingdom:", error);
    return NextResponse.json({ error: "Failed to found kingdom" }, { status: 500 });
  }
}
