/**
 * Single Bulk Carrier API — update / delete
 *
 * PATCH  /api/bulk-carriers/[id]  — update carrier fields
 * DELETE /api/bulk-carriers/[id]  — remove carrier (items become unassigned)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.bulkCapacity === "number" && body.bulkCapacity >= 0) {
      data.bulkCapacity = body.bulkCapacity;
    }
    if ("notes" in body) {
      data.notes = body.notes || null;
    }
    if ("assignedCharacterId" in body) {
      data.assignedCharacterId = body.assignedCharacterId || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const carrier = await prisma.bulkCarrier.update({
      where: { id },
      data,
      include: {
        assignedCharacter: true,
        inventoryItems: { include: { item: true } },
      },
    });

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("Failed to update bulk carrier:", error);
    return NextResponse.json(
      { error: "Failed to update bulk carrier" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Items referencing this carrier will have bulkCarrierId set to null via onDelete: SetNull
    await prisma.bulkCarrier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete bulk carrier:", error);
    return NextResponse.json(
      { error: "Failed to delete bulk carrier" },
      { status: 500 }
    );
  }
}
