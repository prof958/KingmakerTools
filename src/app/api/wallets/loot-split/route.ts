/**
 * Loot Split API — split loot among party members
 *
 * POST /api/wallets/loot-split
 * body: { totalCp: number, characterIds: string[] }
 *
 * Calculates the split and applies it to each character's wallet.
 * Any remainder goes to the party treasury.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { splitLoot, cpToWallet, addWallets, type Wallet } from "@/lib/pf2e/currency";

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { totalCp, characterIds } = body;

    if (typeof totalCp !== "number" || totalCp <= 0) {
      return NextResponse.json(
        { error: "totalCp must be a positive number" },
        { status: 400 }
      );
    }
    if (!Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json(
        { error: "characterIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Re-check status server-side rather than trusting the client's list —
    // it may have been built from a page loaded before a character was
    // marked fallen. A fallen character gets no share; the split still
    // divides evenly among whoever's left, remainder to the treasury.
    const livingIds = new Set(
      (
        await prisma.character.findMany({
          where: { id: { in: characterIds }, status: "ACTIVE" },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    const eligibleIds: string[] = characterIds.filter((id: string) => livingIds.has(id));

    if (eligibleIds.length === 0) {
      return NextResponse.json(
        { error: "None of the selected characters can currently receive loot" },
        { status: 400 }
      );
    }

    const { shares, remainderCp } = splitLoot(totalCp, eligibleIds.length);

    // Apply each share to the character's wallet
    for (let i = 0; i < eligibleIds.length; i++) {
      const characterId = eligibleIds[i];
      const share = shares[i];

      const wallet = await prisma.wallet.findFirst({
        where: { campaignId: campaign.id, characterId },
      });

      if (wallet) {
        const current: Wallet = { cp: wallet.cp, sp: wallet.sp, gp: wallet.gp, pp: wallet.pp };
        const updated = addWallets(current, share);
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { cp: updated.cp, sp: updated.sp, gp: updated.gp, pp: updated.pp },
        });
      }
    }

    // Add remainder to party treasury
    if (remainderCp > 0) {
      const treasury = await prisma.wallet.findFirst({
        where: { campaignId: campaign.id, characterId: null },
      });

      if (treasury) {
        const remainder = cpToWallet(remainderCp);
        const current: Wallet = { cp: treasury.cp, sp: treasury.sp, gp: treasury.gp, pp: treasury.pp };
        const updated = addWallets(current, remainder);
        await prisma.wallet.update({
          where: { id: treasury.id },
          data: { cp: updated.cp, sp: updated.sp, gp: updated.gp, pp: updated.pp },
        });
      }
    }

    return NextResponse.json({
      shares: eligibleIds.map((id: string, i: number) => ({ characterId: id, ...shares[i] })),
      remainderCp,
    });
  } catch (error) {
    console.error("Failed to split loot:", error);
    return NextResponse.json(
      { error: "Failed to split loot" },
      { status: 500 }
    );
  }
}
