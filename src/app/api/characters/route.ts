/**
 * Characters API — CRUD for party members
 *
 * GET  /api/characters         — list all characters for the campaign
 * POST /api/characters         — create a new character
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();
    const characters = await prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(characters);
  } catch (error) {
    console.error("Failed to list characters:", error);
    return NextResponse.json(
      { error: "Failed to list characters" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { name, strModifier } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const character = await prisma.character.create({
      data: {
        campaignId: campaign.id,
        name: name.trim(),
        strModifier: typeof strModifier === "number" ? strModifier : 0,
      },
    });

    // Also create a personal wallet for the new character
    await prisma.wallet.create({
      data: {
        campaignId: campaign.id,
        characterId: character.id,
        cp: 0,
        sp: 0,
        gp: 0,
        pp: 0,
      },
    });

    return NextResponse.json(character, { status: 201 });
  } catch (error) {
    console.error("Failed to create character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 }
    );
  }
}
