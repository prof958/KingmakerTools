/**
 * Kingdom Skills API
 *
 * PATCH /api/kingdom/skills  — set a skill's proficiency rank
 *   body: { skill, rank }   rank: 0 untrained · 1 trained · 2 expert · 3 master · 4 legendary
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { KINGDOM_SKILLS } from "@/lib/pf2e/kingdom";

const SKILL_IDS = new Set(KINGDOM_SKILLS.map((s) => s.id));

export async function PATCH(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();

    if (typeof body.skill !== "string" || !SKILL_IDS.has(body.skill)) {
      return NextResponse.json({ error: "Unknown kingdom skill" }, { status: 400 });
    }

    if (typeof body.rank !== "number" || ![0, 1, 2, 3, 4].includes(body.rank)) {
      return NextResponse.json({ error: "rank must be 0–4" }, { status: 400 });
    }

    const skill = await prisma.kingdomSkill.update({
      where: { kingdomId_skill: { kingdomId: kingdom.id, skill: body.skill } },
      data: { rank: body.rank },
    });

    return NextResponse.json(skill);
  } catch (error) {
    console.error("Failed to update kingdom skill:", error);
    return NextResponse.json({ error: "Failed to update kingdom skill" }, { status: 500 });
  }
}
