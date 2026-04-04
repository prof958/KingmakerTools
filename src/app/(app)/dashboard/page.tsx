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
} from "@/components/dashboard";

export default async function DashboardPage() {
  const campaign = await getOrCreateCampaign();

  const [objectives, quickLinks, wallets] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Campaign overview at a glance</p>
      </div>

      {/* Top row: Wealth + Kingdom placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <WealthSummary
          wallets={JSON.parse(JSON.stringify(wallets))}
        />

        {/* Kingdom Status — Phase 5 placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              <CardTitle>Kingdom</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Coming Soon</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              Kingdom management will be available in a future update.
              Track your hex grid, settlements, and kingdom turns here.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content: Objectives + Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ObjectiveTracker
            initialObjectives={JSON.parse(JSON.stringify(objectives))}
          />
        </div>
        <div>
          <QuickLinksManager
            initialLinks={JSON.parse(JSON.stringify(quickLinks))}
          />
        </div>
      </div>
    </div>
  );
}
