/**
 * Single Custom Camp Activity API
 *
 * DELETE /api/camp-activities/[id]  — remove a custom camp activity
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.customCampActivity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete custom camp activity:", error);
    return NextResponse.json(
      { error: "Failed to delete custom camp activity" },
      { status: 500 },
    );
  }
}
