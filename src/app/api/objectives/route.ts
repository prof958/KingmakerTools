/**
 * Objectives API — quest/goal tracker
 *
 * GET  /api/objectives   — list all objectives for the campaign
 * POST /api/objectives   — create a new objective
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const objectives = await prisma.objective.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(objectives);
  } catch (error) {
    console.error("Failed to list objectives:", error);
    return NextResponse.json(
      { error: "Failed to list objectives" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { title, description, priority } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    const objective = await prisma.objective.create({
      data: {
        campaignId: campaign.id,
        title: title.trim(),
        description: description?.trim() || null,
        priority: typeof priority === "number" ? priority : 0,
      },
    });

    return NextResponse.json(objective, { status: 201 });
  } catch (error) {
    console.error("Failed to create objective:", error);
    return NextResponse.json(
      { error: "Failed to create objective" },
      { status: 500 },
    );
  }
}
