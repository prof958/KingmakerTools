/**
 * Campaign API — GET the active campaign / PATCH to update date
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { daysInMonth } from "@/lib/pf2e/calendar";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();
    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Failed to get campaign:", error);
    return NextResponse.json(
      { error: "Failed to get campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const data: { golarionDay?: number; golarionMonth?: number; golarionYear?: number } = {};

    if (typeof body.golarionYear === "number" && body.golarionYear > 0) {
      data.golarionYear = body.golarionYear;
    }
    if (typeof body.golarionMonth === "number" && body.golarionMonth >= 1 && body.golarionMonth <= 12) {
      data.golarionMonth = body.golarionMonth;
    }

    // Resolve the target month/year to validate day bounds
    const targetMonth = data.golarionMonth ?? campaign.golarionMonth;
    const targetYear = data.golarionYear ?? campaign.golarionYear;
    const maxDay = daysInMonth(targetMonth, targetYear);

    if (typeof body.golarionDay === "number" && body.golarionDay >= 1 && body.golarionDay <= maxDay) {
      data.golarionDay = body.golarionDay;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update campaign:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
