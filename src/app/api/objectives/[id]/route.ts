/**
 * Single Objective API — update / delete
 *
 * PATCH  /api/objectives/[id]  — update title, description, status, priority
 * DELETE /api/objectives/[id]  — remove objective
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }

    if ("description" in body) {
      data.description = body.description?.trim() || null;
    }

    if (
      typeof body.status === "string" &&
      ["ACTIVE", "COMPLETED", "FAILED"].includes(body.status)
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
    await prisma.objective.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete objective:", error);
    return NextResponse.json(
      { error: "Failed to delete objective" },
      { status: 500 },
    );
  }
}
