/**
 * Wish List API — track items the party wants to acquire
 *
 * GET  /api/wishlist          — list all wish list items
 * POST /api/wishlist          — add an item to the wish list
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();
    const items = await prisma.wishListItem.findMany({
      where: { campaignId: campaign.id },
      include: {
        item: true,
        character: true,
      },
      orderBy: [{ isAcquired: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to list wish list:", error);
    return NextResponse.json(
      { error: "Failed to list wish list" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const {
      itemId,
      characterId,
      customName,
      customPriceCp,
      notes,
    } = body;

    // Must have either an itemId or a customName
    if (!itemId && !customName) {
      return NextResponse.json(
        { error: "Either itemId or customName is required" },
        { status: 400 }
      );
    }

    const wishListItem = await prisma.wishListItem.create({
      data: {
        campaignId: campaign.id,
        itemId: itemId || null,
        characterId: characterId || null,
        customName: customName || null,
        customPriceCp: customPriceCp ?? null,
        notes: notes || null,
      },
      include: {
        item: true,
        character: true,
      },
    });

    return NextResponse.json(wishListItem, { status: 201 });
  } catch (error) {
    console.error("Failed to add wish list item:", error);
    return NextResponse.json(
      { error: "Failed to add wish list item" },
      { status: 500 }
    );
  }
}
