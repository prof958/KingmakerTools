/**
 * Single Kingdom Turn API — record a step and, eventually, complete the turn.
 *
 * PATCH /api/kingdom/turns/[id]
 *   { stepKey, done?, appendLog?, removeLogAt? }  — mark a step done, append a
 *     log entry (a roll, an activity attempt) to its history, or drop one that
 *     was logged by mistake
 *   { status: "complete", summary? } — close out the turn and advance the
 *     kingdom's `currentTurn` to it, in one transaction
 *
 * Numeric consequences (RP, Unrest, Commodities, ...) are applied by the
 * client through the existing `PATCH /api/kingdom`, the same endpoint every
 * other tab already uses to edit those fields — this route only owns the
 * turn's own bookkeeping, so there is exactly one place that knows how to
 * write kingdom stats rather than two routes that could disagree.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";

type RouteParams = { params: Promise<{ id: string }> };

interface StepRecord {
  done: boolean;
  log: { at: string; label: string; detail?: string }[];
}

interface TurnPhaseData {
  steps: Record<string, StepRecord>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const kingdom = await getOrCreateKingdom();
    const turn = await prisma.kingdomTurn.findUnique({ where: { id } });
    if (!turn || turn.kingdomId !== kingdom.id) {
      return NextResponse.json({ error: "Unknown turn" }, { status: 404 });
    }
    if (turn.status === "complete") {
      return NextResponse.json({ error: "This turn is already complete" }, { status: 400 });
    }

    const body = await req.json();

    if (body.status === "complete") {
      const summary = typeof body.summary === "string" ? body.summary.trim() || null : turn.summary;
      const [, updatedTurn] = await prisma.$transaction([
        prisma.kingdom.update({
          where: { id: kingdom.id },
          data: { currentTurn: turn.turnNumber },
        }),
        prisma.kingdomTurn.update({
          where: { id },
          data: { status: "complete", summary },
        }),
      ]);
      return NextResponse.json(updatedTurn);
    }

    if (typeof body.stepKey !== "string" || !body.stepKey) {
      return NextResponse.json({ error: "stepKey is required" }, { status: 400 });
    }

    const phaseData = (turn.phaseData as unknown as TurnPhaseData) ?? { steps: {} };
    const existing: StepRecord = phaseData.steps[body.stepKey] ?? { done: false, log: [] };

    if (typeof body.done === "boolean") {
      existing.done = body.done;
    }
    if (body.appendLog && typeof body.appendLog.label === "string") {
      existing.log = [
        ...existing.log,
        {
          at: new Date().toISOString(),
          label: body.appendLog.label,
          detail: typeof body.appendLog.detail === "string" ? body.appendLog.detail : undefined,
        },
      ];
    }
    // Undo a mis-logged entry. Indexed rather than id'd because a step's log is
    // a plain append-only array in JSON — the index is what the client is
    // already rendering from, so there's nothing else to key on.
    if (typeof body.removeLogAt === "number") {
      if (body.removeLogAt < 0 || body.removeLogAt >= existing.log.length) {
        return NextResponse.json({ error: "No log entry at that index" }, { status: 400 });
      }
      existing.log = existing.log.filter((_, i) => i !== body.removeLogAt);
    }

    phaseData.steps[body.stepKey] = existing;

    const updated = await prisma.kingdomTurn.update({
      where: { id },
      data: { phaseData: phaseData as object },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update kingdom turn:", error);
    return NextResponse.json({ error: "Failed to update kingdom turn" }, { status: 500 });
  }
}
