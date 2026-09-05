/**
 * Dashboard Page — Server Component
 * Fetches objectives, quick links, wallet and companion data, then renders the
 * dashboard.
 */
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { loadCompanionBoard } from "@/lib/companion-data";
import {
  ObjectiveTracker,
  QuickLinksManager,
  WealthSummary,
  GolarionCalendar,
} from "@/components/dashboard";
import { DeploymentBoard } from "@/components/companions";
import { CharacterManager } from "@/components/inventory/character-manager";

export default async function DashboardPage() {
  const campaign = await getOrCreateCampaign();

  const [objectives, quickLinks, wallets, characters, board] = await Promise.all([
    prisma.objective.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.quickLink.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.wallet.findMany({
      where: { campaignId: campaign.id },
      include: { character: true },
      orderBy: [{ characterId: "asc" }],
    }),
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
    }),
    // Active assignments only — a resolved one says nothing about where
    // anybody is right now, which is the only question this card answers.
    loadCompanionBoard(campaign.id, { activeOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Campaign overview at a glance</p>
      </div>

      {/* Golarion Calendar */}
      <GolarionCalendar
        initialDay={campaign.golarionDay}
        initialMonth={campaign.golarionMonth}
        initialYear={campaign.golarionYear}
      />

      {/* Top row: Wealth + Objectives */}
      <div className="grid gap-4 md:grid-cols-2">
        <WealthSummary
          wallets={JSON.parse(JSON.stringify(wallets))}
        />

        <ObjectiveTracker
          initialObjectives={JSON.parse(JSON.stringify(objectives))}
        />
      </div>

      {/* Companion deployment */}
      <DeploymentBoard
        companions={board.companions}
        assignments={board.assignments}
        today={{
          day: campaign.golarionDay,
          month: campaign.golarionMonth,
          year: campaign.golarionYear,
        }}
      />

      {/* Quick Links */}
      <QuickLinksManager
        initialLinks={JSON.parse(JSON.stringify(quickLinks))}
      />

      {/* Party Members */}
      <CharacterManager
        initialCharacters={JSON.parse(JSON.stringify(characters))}
      />
    </div>
  );
}
