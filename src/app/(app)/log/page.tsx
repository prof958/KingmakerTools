/**
 * Log Page — Server Component
 * Fetches the campaign's most recent log entries and renders the log view.
 */
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { LogView } from "@/components/log";

export default async function LogPage() {
  const campaign = await getOrCreateCampaign();

  const entries = await prisma.logEntry.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Log</h1>
        <p className="text-muted-foreground">
          Campaign log — session notes plus automatic records of party, inventory,
          and campsite changes
        </p>
      </div>

      <LogView initialEntries={JSON.parse(JSON.stringify(entries))} />
    </div>
  );
}
