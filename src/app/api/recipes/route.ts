/**
 * Recipes API — campsite recipe book
 *
 * GET  /api/recipes          — list all recipes for the campaign
 * POST /api/recipes          — add a new recipe
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const recipes = await prisma.recipe.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ isDiscovered: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("Failed to list recipes:", error);
    return NextResponse.json(
      { error: "Failed to list recipes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { name, ingredients, dc, effectsSuccess, effectsFail, isDiscovered } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const recipe = await prisma.recipe.create({
      data: {
        campaignId: campaign.id,
        name: name.trim(),
        ingredients: ingredients?.trim() || null,
        dc: typeof dc === "number" ? dc : null,
        effectsSuccess: effectsSuccess?.trim() || null,
        effectsFail: effectsFail?.trim() || null,
        isDiscovered: isDiscovered ?? false,
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error("Failed to create recipe:", error);
    return NextResponse.json(
      { error: "Failed to create recipe" },
      { status: 500 },
    );
  }
}
