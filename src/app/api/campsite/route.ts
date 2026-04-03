/**
 * Campsite Layouts API
 *
 * GET  /api/campsite          — list all layouts for the campaign
 * POST /api/campsite          — create a new layout (and optionally set it active)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const layouts = await prisma.campsiteLayout.findMany({
      where: { campaignId: campaign.id },
      include: {
        watchShifts: { orderBy: { shiftNumber: "asc" } },
        campingActivities: {
          include: { character: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(layouts);
  } catch (error) {
    console.error("Failed to list campsite layouts:", error);
    return NextResponse.json(
      { error: "Failed to list campsite layouts" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { name, elements, isActive } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    // If setting active, deactivate all other layouts first
    if (isActive) {
      await prisma.campsiteLayout.updateMany({
        where: { campaignId: campaign.id },
        data: { isActive: false },
      });
    }

    const layout = await prisma.campsiteLayout.create({
      data: {
        campaignId: campaign.id,
        name: name.trim(),
        elements: elements ?? [],
        isActive: isActive ?? true, // first layout defaults to active
      },
      include: {
        watchShifts: { orderBy: { shiftNumber: "asc" } },
        campingActivities: {
          include: { character: true },
        },
      },
    });

    return NextResponse.json(layout, { status: 201 });
  } catch (error) {
    console.error("Failed to create campsite layout:", error);
    return NextResponse.json(
      { error: "Failed to create campsite layout" },
      { status: 500 },
    );
  }
}
