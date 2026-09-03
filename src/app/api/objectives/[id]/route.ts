/**
 * Single Objective API — update / delete
 *
 * PATCH  /api/objectives/[id]  — update title, description, status, priority
 * DELETE /api/objectives/[id]  — remove objective
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { describeObjectiveChange, logEvent } from "@/lib/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const before = await prisma.objective.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }

    if ("description" in body) {
      data.description = body.description?.trim() || null;
    }

    if (
      typeof body.status === "string" &&
      ["ACTIVE", "COMPLETED", "FAILED", "ARCHIVED"].includes(body.status)
    ) {
      data.status = body.status;
    }

    if (typeof body.priority === "number") {
      data.priority = body.priority;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const objective = await prisma.objective.update({
      where: { id },
      data,
    });

    const change = describeObjectiveChange(
      { title: before.title, status: before.status },
      { title: objective.title, status: objective.status },
    );
    if (change) {
      await logEvent({
        campaignId: objective.campaignId,
        category: change.category,
        summary: change.summary,
        entityType: "objective",
        entityId: objective.id,
        entityName: objective.title,
      });
    }

    return NextResponse.json(objective);
  } catch (error) {
    console.error("Failed to update objective:", error);
    return NextResponse.json(
      { error: "Failed to update objective" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.objective.findUnique({ where: { id } });
    await prisma.objective.delete({ where: { id } });

    if (existing) {
      await logEvent({
        campaignId: existing.campaignId,
        category: "OBJECTIVE",
        summary: `Removed objective "${existing.title}"`,
        entityType: "objective",
        entityId: existing.id,
        entityName: existing.title,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete objective:", error);
    return NextResponse.json(
      { error: "Failed to delete objective" },
      { status: 500 },
    );
  }
}
