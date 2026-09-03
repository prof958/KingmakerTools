import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

const MONTHS = [
  "Abadius", "Calistril", "Pharast", "Gozran",
  "Desnus", "Sarenith", "Erastus", "Arodus",
  "Rova", "Lamashan", "Nethys", "Kuthona"
];

/**
 * Log entries from the most recent day that has any — "day" is the UTC
 * calendar date of the newest entry, matching the same real-world-day
 * grouping the Log page shows. Empty log = empty array, not an error.
 */
async function getLatestDayLog(campaignId: string) {
  const latest = await prisma.logEntry.findFirst({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (!latest) return [];

  const dayStart = new Date(Date.UTC(
    latest.createdAt.getUTCFullYear(),
    latest.createdAt.getUTCMonth(),
    latest.createdAt.getUTCDate()
  ));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return prisma.logEntry.findMany({
    where: { campaignId, createdAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: "desc" },
    select: { category: true, source: true, summary: true, createdAt: true }
  });
}

export async function GET() {
  try {
    const campaign = await getOrCreateCampaign();
    
    // Fetch related data concurrently
    const [
      characters, 
      objectives, 
      recentVictories,
      allWallets, 
      kingdom,
      bulkCarriers,
      wishlistCount,
      activeCampsite,
      recipesCount,
      latestDayLog
    ] = await Promise.all([
      prisma.character.findMany({
        where: { campaignId: campaign.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.objective.findMany({
        where: { campaignId: campaign.id, status: "ACTIVE" },
        select: { title: true },
        orderBy: { priority: "desc" }
      }),
      prisma.objective.findMany({
        where: { campaignId: campaign.id, status: "COMPLETED" },
        select: { title: true },
        orderBy: { updatedAt: "desc" },
        take: 3
      }),
      prisma.wallet.findMany({
        where: { campaignId: campaign.id },
        orderBy: [{ characterId: "asc" }]
      }),
      prisma.kingdom.findUnique({
        where: { campaignId: campaign.id }
      }),
      prisma.bulkCarrier.findMany({
        where: { campaignId: campaign.id },
        select: { name: true, type: true, bulkCapacity: true }
      }),
      prisma.wishListItem.count({
        where: { campaignId: campaign.id, isAcquired: false }
      }),
      prisma.campsiteLayout.findFirst({
        where: { campaignId: campaign.id, isActive: true },
        include: { watchShifts: { orderBy: { shiftNumber: 'asc' } } }
      }),
      prisma.recipe.count({
        where: { campaignId: campaign.id, isDiscovered: true }
      }),
      getLatestDayLog(campaign.id)
    ]);

    // Format the in-game date
    const monthIndex = Math.max(0, Math.min(11, campaign.golarionMonth - 1));
    const monthName = MONTHS[monthIndex];
    const inGameDate = `${campaign.golarionDay} ${monthName}, ${campaign.golarionYear} AR`;

    // Map character IDs to names for watch shifts
    const characterMap = new Map(characters.map(c => [c.id, c.name]));

    const watchShifts = activeCampsite?.watchShifts.map(shift => ({
      shift: shift.shiftNumber,
      guards: shift.characterIds.map(id => characterMap.get(id) || "Unknown")
    })) || [];

    // Calculate total party cash (explicitly only coins, not item values)
    const treasuryWallet = allWallets.find(w => w.characterId === null);
    
    // Mimic the webapp: include the primary treasury and all active character wallets
    const characterIds = new Set(characters.map(c => c.id));
    const validWallets = [
      ...(treasuryWallet ? [treasuryWallet] : []),
      ...allWallets.filter(w => w.characterId !== null && characterIds.has(w.characterId))
    ];

    const totalPartyCp = validWallets.reduce((acc, w) => acc + w.cp + (w.sp * 10) + (w.gp * 100) + (w.pp * 1000), 0);
    const totalPartyGoldEquivalent = (totalPartyCp / 100).toFixed(2);

    // Construct the enriched JSON payload
    const statusPayload = {
      campaignName: campaign.name,
      inGameDate,
      availableParty: characters.map(c => c.name),
      activeQuests: objectives.map(o => o.title),
      recentVictories: recentVictories.map(o => o.title),
      recentLog: latestDayLog.map(e => ({
        category: e.category,
        source: e.source,
        summary: e.summary,
        time: e.createdAt.toISOString()
      })),
      wealth: {
        totalPartyCashInGold: totalPartyGoldEquivalent,
        sharedTreasury: {
          copper: treasuryWallet?.cp || 0,
          silver: treasuryWallet?.sp || 0,
          gold: treasuryWallet?.gp || 0,
          platinum: treasuryWallet?.pp || 0,
          goldEquivalent: (
            (treasuryWallet?.cp || 0) / 100 +
            (treasuryWallet?.sp || 0) / 10 +
            (treasuryWallet?.gp || 0) +
            (treasuryWallet?.pp || 0) * 10
          ).toFixed(2)
        }
      },
      logistics: {
        bulkCarriers: bulkCarriers.map(b => ({
          name: b.name,
          type: b.type,
          capacity: b.bulkCapacity
        })),
        pendingWishlistItems: wishlistCount
      },
      campsite: activeCampsite ? {
        activeLayout: activeCampsite.name,
        watchShifts,
        recipesDiscovered: recipesCount
      } : "No active camp set up",
      kingdomStatus: kingdom ? {
        name: kingdom.name,
        level: kingdom.level,
        unrest: kingdom.unrest
      } : "Not yet established"
    };

    return NextResponse.json(statusPayload);
  } catch (error) {
    console.error("Failed to fetch campaign status:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign status" },
      { status: 500 }
    );
  }
}
