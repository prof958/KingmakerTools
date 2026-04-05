/**
 * Inventory API — manage campaign inventory items
 *
 * GET  /api/inventory          — list all inventory items (with item + character data)
 * POST /api/inventory          — add item(s) to inventory
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { campaignId: campaign.id },
      include: {
        item: true,
        character: true,
        container: {
          include: { item: true },
        },
        containedItems: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(inventoryItems);
  } catch (error) {
    console.error("Failed to list inventory:", error);
    return NextResponse.json(
      { error: "Failed to list inventory" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { itemId, characterId, bulkCarrierId, quantity, notes } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    // Verify item exists
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        campaignId: campaign.id,
        itemId,
        characterId: characterId || null,
        bulkCarrierId: bulkCarrierId || null,
        quantity: quantity ?? 1,
        notes: notes || null,
      },
      include: {
        item: true,
        character: true,
      },
    });

    return NextResponse.json(inventoryItem, { status: 201 });
  } catch (error) {
    console.error("Failed to add inventory item:", error);
    return NextResponse.json(
      { error: "Failed to add inventory item" },
      { status: 500 }
    );
  }
}
