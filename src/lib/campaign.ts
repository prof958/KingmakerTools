/**
 * Campaign bootstrap — ensures a single campaign exists.
 * KingdomTools is designed for a single group, so we auto-create
 * the campaign on first access and reuse it everywhere.
 */

import { prisma } from "@/lib/db";

const CAMPAIGN_NAME = "Kingmaker";

/**
 * Get the active campaign, creating it (with a treasury wallet) if none exists.
 */
export async function getOrCreateCampaign() {
  const existing = await prisma.campaign.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  // Create campaign + party treasury in a single transaction
  const campaign = await prisma.campaign.create({
    data: {
      name: CAMPAIGN_NAME,
      wallets: {
        create: {
          // characterId is null → party treasury
          cp: 0,
          sp: 0,
          gp: 0,
          pp: 0,
        },
      },
    },
  });

  return campaign;
}
