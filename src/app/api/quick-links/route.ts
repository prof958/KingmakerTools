/**
 * Quick Links API — customizable reference links
 *
 * GET  /api/quick-links   — list all links for the campaign
 * POST /api/quick-links   — create a new link
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();

    const links = await prisma.quickLink.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("Failed to list quick links:", error);
    return NextResponse.json(
      { error: "Failed to list quick links" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { label, url, category, sortOrder } = body;

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json(
        { error: "label is required" },
        { status: 400 },
      );
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 },
      );
    }

    const link = await prisma.quickLink.create({
      data: {
        campaignId: campaign.id,
        label: label.trim(),
        url: url.trim(),
        category: category?.trim() || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Failed to create quick link:", error);
    return NextResponse.json(
      { error: "Failed to create quick link" },
      { status: 500 },
    );
  }
}
