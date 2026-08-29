/**
 * Kingdom Page — Server Component
 *
 * Loads the campaign's kingdom, creating it on first visit. An unfounded
 * kingdom gets the founding wizard instead of the dashboard; the dashboard has
 * nothing meaningful to show until the founding choices exist. The turn
 * tracker lands in a later Phase 5 slice.
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
  const [characters, hexes, settlements] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, emoji: true, isCompanion: true },
    }),
    prisma.hex.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: [{ sheet: "asc" }, { r: "asc" }, { q: "asc" }],
    }),
    prisma.settlement.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const kingdomData = JSON.parse(JSON.stringify(kingdom));
  const characterData = JSON.parse(JSON.stringify(characters));
  const hexData = JSON.parse(JSON.stringify(hexes));
  const settlementData = JSON.parse(JSON.stringify(settlements));

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
      </div>

      <KingdomShell
        kingdom={kingdomData}
        characters={characterData}
        hexes={hexData}
        settlements={settlementData}
      />
    </div>
  );
}
