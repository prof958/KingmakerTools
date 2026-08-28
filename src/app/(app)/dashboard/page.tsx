/**
 * Dashboard Page — Server Component
 * Fetches objectives, quick links, and wallet data, then renders the dashboard.
 */
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import {
  ObjectiveTracker,
  QuickLinksManager,
  WealthSummary,
  GolarionCalendar,
} from "@/components/dashboard";
import { CharacterManager } from "@/components/inventory/character-manager";

export default async function DashboardPage() {
  const campaign = await getOrCreateCampaign();

  const [objectives, quickLinks, wallets, characters] = await Promise.all([
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
