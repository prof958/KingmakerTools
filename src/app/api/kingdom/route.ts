/**
 * Kingdom API — the campaign's single kingdom
 *
 * GET    /api/kingdom  — full kingdom with skills, feats, leadership, settlements
 * PATCH  /api/kingdom  — update scalar fields (stats, resources, founding choices)
 * DELETE /api/kingdom  — erase the kingdom (hexes, settlements, everything) and
 *                        start over from the founding wizard
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { KINGDOM_ABILITIES, getKingdomSkill } from "@/lib/pf2e/kingdom";

export async function GET() {
  try {
    const kingdom = await getOrCreateKingdom();
    return NextResponse.json(kingdom);
  } catch (error) {
    console.error("Failed to load kingdom:", error);
    return NextResponse.json({ error: "Failed to load kingdom" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json().catch(() => ({}));

    // The client is expected to make the player type the kingdom's name, but
    // that is a UI nicety, not the safeguard — this check is what actually
    // stops a stray or scripted DELETE from wiping the map, the leadership
    // roster, and every founding choice in one request.
    if (body.name !== kingdom.name) {
      return NextResponse.json(
        { error: "Type the kingdom's name exactly to confirm deletion." },
        { status: 400 },
      );
    }

    // Everything hangs off Kingdom with onDelete: Cascade (skills, feats,
    // leadership roles, hexes, settlements, turns), so removing this one row
    // takes the rest of the kingdom with it. Campaign keeps a bare, unfounded
    // Kingdom the next time getOrCreateKingdom() runs, which is what sends the
    // player back to the founding wizard.
    await prisma.kingdom.delete({ where: { id: kingdom.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete kingdom:", error);
    return NextResponse.json({ error: "Failed to delete kingdom" }, { status: 500 });
  }
}

/** Integer fields that accept a plain numeric assignment. */
const INT_FIELDS = [
  "level",
  // "size" is deliberately absent: it is counted from the claimed hexes by
  // PATCH /api/kingdom/hexes. Accepting it here would let the two disagree,
  // and Size feeds the Size table, Control DC, and the resource dice.
  "fame",
  "fameMax",
  "unrest",
  "currentTurn",
  "rp",
  "resourceDiceBonus",
  "food",
  "lumber",
  "luxuries",
  "ore",
  "stone",
  "corruptionPoints",
  "corruptionThreshold",
  "corruptionPenalty",
  "crimePoints",
  "crimeThreshold",
  "crimePenalty",
  "decayPoints",
  "decayThreshold",
  "decayPenalty",
  "strifePoints",
  "strifeThreshold",
  "strifePenalty",
  ...KINGDOM_ABILITIES, // culture, economy, loyalty, stability
] as const;

const STRING_CHOICE_FIELDS = [
  "charter",
  "charterFreeBoost",
  "heartland",
  "government",
  "governmentFreeBoost",
] as const;

export async function PATCH(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    if (body.ruleset === "RAW" || body.ruleset === "VK") {
      data.ruleset = body.ruleset;
    }

    if (body.fameType === "FAME" || body.fameType === "INFAMY") {
      data.fameType = body.fameType;
    }

    if (typeof body.atWar === "boolean") {
      data.atWar = body.atWar;
    }

    if ("notes" in body) {
      data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }

    for (const field of INT_FIELDS) {
      if (field in body && typeof body[field] === "number" && Number.isFinite(body[field])) {
        data[field] = Math.trunc(body[field]);
      }
    }

    for (const field of STRING_CHOICE_FIELDS) {
      if (field in body) {
        data[field] =
          typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
      }
    }

    if ("finalizeBoosts" in body && Array.isArray(body.finalizeBoosts)) {
      data.finalizeBoosts = body.finalizeBoosts.filter(
        (a: unknown): a is string =>
          typeof a === "string" && (KINGDOM_ABILITIES as readonly string[]).includes(a),
      );
    }

    if ("skillPicks" in body && Array.isArray(body.skillPicks)) {
      // Order matters: startingSkills() fills the free slots in this order and
      // rejects anything past the allowance.
      data.skillPicks = body.skillPicks.filter(
        (s: unknown): s is string => typeof s === "string" && Boolean(getKingdomSkill(s)),
      );
    }

    if (typeof body.founded === "boolean") {
      data.founded = body.founded;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.kingdom.update({
      where: { id: kingdom.id },
      data,
      include: {
        skills: true,
        feats: { orderBy: { createdAt: "asc" } },
        leadershipRoles: { include: { character: true } },
        settlements: { orderBy: { createdAt: "asc" } },
        turns: { orderBy: { turnNumber: "desc" }, take: 1 },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update kingdom:", error);
    return NextResponse.json({ error: "Failed to update kingdom" }, { status: 500 });
  }
}
