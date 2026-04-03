/**
 * Single Inventory Item API — update / delete
 *
 * PATCH  /api/inventory/[id]  — update assignment, quantity, invested, container, notes
 * DELETE /api/inventory/[id]  — remove from inventory
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    // Assign/unassign to character (null = shared)
    if ("characterId" in body) {
      data.characterId = body.characterId || null;
    }

    // Move into or out of a container
    if ("containerInventoryItemId" in body) {
      data.containerInventoryItemId = body.containerInventoryItemId || null;
    }

    if (typeof body.quantity === "number" && body.quantity >= 0) {
      data.quantity = body.quantity;
    }

    if (typeof body.isInvested === "boolean") {
      data.isInvested = body.isInvested;
    }

    if (typeof body.isWorn === "boolean") {
      data.isWorn = body.isWorn;
    }

    if ("notes" in body) {
      data.notes = body.notes || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const inventoryItem = await prisma.inventoryItem.update({
      where: { id },
      data,
      include: {
        item: true,
        character: true,
      },
    });

    return NextResponse.json(inventoryItem);
  } catch (error) {
    console.error("Failed to update inventory item:", error);
    return NextResponse.json(
      { error: "Failed to update inventory item" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    return NextResponse.json(
      { error: "Failed to delete inventory item" },
      { status: 500 }
    );
  }
}
