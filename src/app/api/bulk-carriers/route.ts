/**
 * Bulk Carriers API — manage mounts, vehicles, and magical storage
 *
 * GET  /api/bulk-carriers      — list all carriers for the campaign
 * POST /api/bulk-carriers      — create a carrier
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

const VALID_TYPES = ["MOUNT", "PACK_ANIMAL", "VEHICLE", "MAGICAL_STORAGE", "CUSTOM"] as const;

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const carriers = await prisma.bulkCarrier.findMany({
      where: { campaignId: campaign.id },
      include: {
        assignedCharacter: true,
        inventoryItems: { include: { item: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(carriers);
  } catch (error) {
    console.error("Failed to list bulk carriers:", error);
    return NextResponse.json(
      { error: "Failed to list bulk carriers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { name, type, bulkCapacity, notes, assignedCharacterId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "type must be one of: " + VALID_TYPES.join(", ") },
        { status: 400 }
      );
    }

    if (typeof bulkCapacity !== "number" || bulkCapacity < 0) {
      return NextResponse.json(
        { error: "bulkCapacity must be a non-negative number" },
        { status: 400 }
      );
    }

    const carrier = await prisma.bulkCarrier.create({
      data: {
        campaignId: campaign.id,
        name: name.trim(),
        type,
        bulkCapacity,
        notes: notes || null,
        assignedCharacterId: assignedCharacterId || null,
      },
      include: {
        assignedCharacter: true,
        inventoryItems: { include: { item: true } },
      },
    });

    return NextResponse.json(carrier, { status: 201 });
  } catch (error) {
    console.error("Failed to create bulk carrier:", error);
    return NextResponse.json(
      { error: "Failed to create bulk carrier" },
      { status: 500 }
    );
  }
}
