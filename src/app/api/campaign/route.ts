/**
 * Campaign API — GET the active campaign (auto-creates if none exists)
 */
import { NextResponse } from "next/server";
import { getOrCreateCampaign } from "@/lib/campaign";

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
