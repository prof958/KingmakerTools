/**
 * Single Quick Link API — update / delete
 *
 * PATCH  /api/quick-links/[id]  — update label, url, category, sortOrder
 * DELETE /api/quick-links/[id]  — remove link
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.label === "string" && body.label.trim()) {
      data.label = body.label.trim();
    }

    if (typeof body.url === "string" && body.url.trim()) {
      data.url = body.url.trim();
    }

    if ("category" in body) {
      data.category = body.category?.trim() || null;
    }

    if (typeof body.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const link = await prisma.quickLink.update({
      where: { id },
      data,
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error("Failed to update quick link:", error);
    return NextResponse.json(
      { error: "Failed to update quick link" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.quickLink.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete quick link:", error);
    return NextResponse.json(
      { error: "Failed to delete quick link" },
      { status: 500 },
    );
  }
}
