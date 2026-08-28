/**
 * Kingdom Page — Server Component
 *
 * Loads the campaign's kingdom, creating it on first visit. An unfounded
 * kingdom gets the founding wizard instead of the dashboard; the dashboard has
 * nothing meaningful to show until the founding choices exist. Hex map,
 * settlement Urban Grids, and the turn tracker land in later Phase 5 slices.
 */
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { FoundingWizard, KingdomShell } from "@/components/kingdom";

export default async function KingdomPage() {
  const campaign = await getOrCreateCampaign();
  const kingdom = await getOrCreateKingdom();
  const [characters, hexes] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, emoji: true, isCompanion: true },
    }),
    prisma.hex.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: [{ sheet: "asc" }, { r: "asc" }, { q: "asc" }],
    }),
  ]);

  const kingdomData = JSON.parse(JSON.stringify(kingdom));
  const characterData = JSON.parse(JSON.stringify(characters));
  const hexData = JSON.parse(JSON.stringify(hexes));

  if (!kingdom.founded) {
    return <FoundingWizard kingdom={kingdomData} characters={characterData} />;
  }

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

      <KingdomShell kingdom={kingdomData} characters={characterData} hexes={hexData} />
    </div>
  );
}
