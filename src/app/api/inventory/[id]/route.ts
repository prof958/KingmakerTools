/**
 * Single Inventory Item API — update / delete
 *
 * PATCH  /api/inventory/[id]  — update assignment, quantity, invested, container, notes
 * DELETE /api/inventory/[id]  — remove from inventory
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { describeInventoryChange, logEvent } from "@/lib/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const before = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { item: true, character: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // Assign/unassign to character (null = shared)
    if ("characterId" in body) {
      data.characterId = body.characterId || null;
    }

    // Move into or out of a container
    if ("containerInventoryItemId" in body) {
      data.containerInventoryItemId = body.containerInventoryItemId || null;
    }

    // Assign/unassign to a bulk carrier
    if ("bulkCarrierId" in body) {
      data.bulkCarrierId = body.bulkCarrierId || null;
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

    const change = describeInventoryChange(
      {
        itemName: before.item.name,
        quantity: before.quantity,
        characterName: before.character?.name ?? null,
        inContainer: before.containerInventoryItemId != null,
      },
      {
        itemName: inventoryItem.item.name,
        quantity: inventoryItem.quantity,
        characterName: inventoryItem.character?.name ?? null,
        inContainer: inventoryItem.containerInventoryItemId != null,
      },
    );
    if (change) {
      await logEvent({
        campaignId: inventoryItem.campaignId,
        category: change.category,
        summary: change.summary,
        entityType: "inventory_item",
        entityId: inventoryItem.id,
        entityName: inventoryItem.item.name,
      });
    }

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
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { item: true, character: true },
    });
    await prisma.inventoryItem.delete({ where: { id } });

    if (existing) {
      await logEvent({
        campaignId: existing.campaignId,
        category: "INVENTORY",
        summary: `Removed ${existing.item.name}${
          existing.character ? ` from ${existing.character.name}` : ""
        } from inventory`,
        entityType: "inventory_item",
        entityId: existing.id,
        entityName: existing.item.name,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    return NextResponse.json(
      { error: "Failed to delete inventory item" },
      { status: 500 }
    );
  }
}
