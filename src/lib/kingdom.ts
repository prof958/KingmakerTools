/**
 * Kingdom bootstrap — ensures the campaign's single Kingdom exists.
 *
 * Like the campaign itself, KingdomTools tracks exactly one kingdom. It is
 * created lazily on first access to the Kingdom tab, pre-seeded with the 16
 * Kingdom skills (all untrained) and the 8 leadership roles (all unassigned).
 */

import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { KINGDOM_SKILLS, LEADERSHIP_ROLES, DEFAULT_RULESET } from "@/lib/pf2e/kingdom";

export type KingdomWithRelations = Awaited<ReturnType<typeof getOrCreateKingdom>>;

/**
 * Deliberately doesn't include `settlements` or `turns` — every caller that
 * needs them already fetches its own (the Kingdom page wants all turns and
 * settlements, `PATCH /api/kingdom/turns/[id]` wants one turn by id, etc.),
 * so including them here would just be a second, unused copy on every call.
 */
export async function getOrCreateKingdom() {
  const campaign = await getOrCreateCampaign();

  const existing = await prisma.kingdom.findUnique({
    where: { campaignId: campaign.id },
    include: {
      skills: true,
      feats: { orderBy: { createdAt: "asc" } },
      leadershipRoles: { include: { character: true } },
    },
  });

  if (existing) return existing;

  await prisma.kingdom.create({
    data: {
      campaignId: campaign.id,
      ruleset: DEFAULT_RULESET,
      skills: {
        create: KINGDOM_SKILLS.map((s) => ({ skill: s.id, rank: 0 })),
      },
      leadershipRoles: {
        create: LEADERSHIP_ROLES.map((r) => ({ role: r.id, invested: false })),
      },
    },
  });

  // Re-fetch with the same shape as the `existing` branch.
  return prisma.kingdom.findUniqueOrThrow({
    where: { campaignId: campaign.id },
    include: {
      skills: true,
      feats: { orderBy: { createdAt: "asc" } },
      leadershipRoles: { include: { character: true } },
    },
  });
}
