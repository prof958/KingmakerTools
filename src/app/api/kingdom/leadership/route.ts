/**
 * Kingdom Leadership API
 *
 * PATCH /api/kingdom/leadership  — assign / clear a leadership role
 *   body: { role, characterId?: string | null, npcName?: string | null, invested?: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { LEADERSHIP_ROLES } from "@/lib/pf2e/kingdom";

const ROLE_IDS = new Set(LEADERSHIP_ROLES.map((r) => r.id));

export async function PATCH(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();

    if (typeof body.role !== "string" || !ROLE_IDS.has(body.role)) {
      return NextResponse.json({ error: "Unknown leadership role" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if ("characterId" in body) {
      data.characterId =
        typeof body.characterId === "string" && body.characterId ? body.characterId : null;
      // Assigning a party character clears any NPC placeholder.
      if (data.characterId) data.npcName = null;
    }

    if ("npcName" in body) {
      const npc = typeof body.npcName === "string" && body.npcName.trim() ? body.npcName.trim() : null;
      data.npcName = npc;
      if (npc) data.characterId = null;
    }

    if (typeof body.invested === "boolean") {
      data.invested = body.invested;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const role = await prisma.leadershipRole.update({
      where: { kingdomId_role: { kingdomId: kingdom.id, role: body.role } },
      data,
      include: { character: true },
    });

    return NextResponse.json(role);
  } catch (error) {
    console.error("Failed to update leadership role:", error);
    return NextResponse.json({ error: "Failed to update leadership role" }, { status: 500 });
  }
}
