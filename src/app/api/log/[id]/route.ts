/**
 * Single Log Entry API
 *
 * PATCH  /api/log/[id]  — edit summary / details / category (manual entries only)
 * DELETE /api/log/[id]  — remove an entry
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

const CATEGORIES = [
  "PARTY",
  "INVENTORY",
  "CAMPSITE",
  "KINGDOM",
  "OBJECTIVE",
  "SESSION",
  "NOTE",
  "DEATH",
] as const;

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.logEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.source !== "MANUAL") {
      return NextResponse.json(
        { error: "Auto-recorded entries can't be edited" },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = {};

    if (typeof body.summary === "string" && body.summary.trim()) {
      data.summary = body.summary.trim();
    }
    if ("details" in body) {
      data.details =
        typeof body.details === "string" && body.details.trim()
          ? body.details.trim()
          : null;
    }
    if (
      typeof body.category === "string" &&
      (CATEGORIES as readonly string[]).includes(body.category)
    ) {
      data.category = body.category;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const entry = await prisma.logEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to update log entry:", error);
    return NextResponse.json(
      { error: "Failed to update log entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.logEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete log entry:", error);
    return NextResponse.json(
      { error: "Failed to delete log entry" },
      { status: 500 },
    );
  }
}
