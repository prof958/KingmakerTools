/**
 * Kingdom Page — Server Component
 * Loads the campaign's kingdom (creating it on first visit) and hands it to the
 * client shell. Hex map, settlement Urban Grids, and the turn wizard land in
 * later Phase 5 slices.
 */
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { KingdomShell } from "@/components/kingdom";

export default async function KingdomPage() {
  const campaign = await getOrCreateCampaign();
  const [kingdom, characters] = await Promise.all([
    getOrCreateKingdom(),
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, emoji: true, isCompanion: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kingdom</h1>
          <p className="text-muted-foreground">Stats, skills, leadership, and founding choices</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Phase 5
        </Badge>
      </div>

      <KingdomShell
        kingdom={JSON.parse(JSON.stringify(kingdom))}
        characters={JSON.parse(JSON.stringify(characters))}
      />
    </div>
  );
}
