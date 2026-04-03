/**
 * Wallets API — party treasury and character wallets
 *
 * GET  /api/wallets            — list all wallets (treasury + character wallets)
 * POST /api/wallets/loot-split — split a loot value among characters
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();
    const wallets = await prisma.wallet.findMany({
      where: { campaignId: campaign.id },
      include: { character: true },
      orderBy: [{ characterId: "asc" }],
    });
    return NextResponse.json(wallets);
  } catch (error) {
    console.error("Failed to list wallets:", error);
    return NextResponse.json(
      { error: "Failed to list wallets" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Support bulk-updating multiple wallets at once
    // body = { wallets: [{ id, cp, sp, gp, pp }] }
    if (!body.wallets || !Array.isArray(body.wallets)) {
      return NextResponse.json(
        { error: "wallets array is required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const w of body.wallets) {
      if (!w.id) continue;
      const data: Record<string, number> = {};
      if (typeof w.cp === "number") data.cp = w.cp;
      if (typeof w.sp === "number") data.sp = w.sp;
      if (typeof w.gp === "number") data.gp = w.gp;
      if (typeof w.pp === "number") data.pp = w.pp;

      if (Object.keys(data).length > 0) {
        const updated = await prisma.wallet.update({
          where: { id: w.id },
          data,
          include: { character: true },
        });
        results.push(updated);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to update wallets:", error);
    return NextResponse.json(
      { error: "Failed to update wallets" },
      { status: 500 }
    );
  }
}
