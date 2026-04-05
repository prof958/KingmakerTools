/**
 * Custom Camp Activities API
 *
 * GET  /api/camp-activities  — list custom camp activities for the campaign
 * POST /api/camp-activities  — create a new custom camp activity
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const activities = await prisma.customCampActivity.findMany({
      where: { campaignId: campaign.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Failed to list custom camp activities:", error);
    return NextResponse.json(
      { error: "Failed to list custom camp activities" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { name, description, skill } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const activity = await prisma.customCampActivity.create({
      data: {
        campaignId: campaign.id,
        name: name.trim(),
        description: description?.trim() || null,
        skill: skill?.trim() || null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Failed to create custom camp activity:", error);
    return NextResponse.json(
      { error: "Failed to create custom camp activity" },
      { status: 500 },
    );
  }
}
