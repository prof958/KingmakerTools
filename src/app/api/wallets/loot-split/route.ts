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

    const { shares, remainderCp } = splitLoot(totalCp, characterIds.length);

    // Apply each share to the character's wallet
    for (let i = 0; i < characterIds.length; i++) {
      const characterId = characterIds[i];
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
      shares: characterIds.map((id: string, i: number) => ({ characterId: id, ...shares[i] })),
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
