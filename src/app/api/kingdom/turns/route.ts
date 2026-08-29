/**
 * Kingdom Turns API — lifecycle for the turn tracker.
 *
 * GET  /api/kingdom/turns  — every turn, most recent first (for the history strip)
 * POST /api/kingdom/turns  — start the next turn, or hand back the one already
 *   in progress so reloading the tracker resumes instead of duplicating it
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";

export async function GET() {
  try {
    const kingdom = await getOrCreateKingdom();
    const turns = await prisma.kingdomTurn.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: { turnNumber: "desc" },
    });
    return NextResponse.json(turns);
  } catch (error) {
    console.error("Failed to load kingdom turns:", error);
    return NextResponse.json({ error: "Failed to load kingdom turns" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const kingdom = await getOrCreateKingdom();

    const inProgress = await prisma.kingdomTurn.findFirst({
      where: { kingdomId: kingdom.id, status: "in_progress" },
      orderBy: { turnNumber: "desc" },
    });
    if (inProgress) return NextResponse.json(inProgress);

    // `currentTurn` is the last *completed* turn, so the next one to work on
    // is always one past it — no separate counter to keep in sync.
    const turn = await prisma.kingdomTurn.create({
      data: {
        kingdomId: kingdom.id,
        turnNumber: kingdom.currentTurn + 1,
        status: "in_progress",
        phaseData: { steps: {} },
      },
    });
    return NextResponse.json(turn, { status: 201 });
  } catch (error) {
    console.error("Failed to start kingdom turn:", error);
    return NextResponse.json({ error: "Failed to start kingdom turn" }, { status: 500 });
  }
}
