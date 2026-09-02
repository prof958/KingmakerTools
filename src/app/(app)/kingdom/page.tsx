/**
 * Kingdom Page — Server Component
 *
 * Loads the campaign's kingdom, creating it on first visit. An unfounded
 * kingdom gets the founding wizard instead of the dashboard; the dashboard has
 * nothing meaningful to show until the founding choices exist.
 */
export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { FoundingWizard, KingdomShell } from "@/components/kingdom";

export default async function KingdomPage() {
  const kingdom = await getOrCreateKingdom();
  const [characters, hexes, settlements, turns] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId: kingdom.campaignId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, emoji: true, isCompanion: true, status: true },
    }),
    prisma.hex.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: [{ sheet: "asc" }, { r: "asc" }, { q: "asc" }],
    }),
    prisma.settlement.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.kingdomTurn.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: { turnNumber: "desc" },
    }),
  ]);

  const kingdomData = JSON.parse(JSON.stringify(kingdom));
  const characterData = JSON.parse(JSON.stringify(characters));
  const hexData = JSON.parse(JSON.stringify(hexes));
  const settlementData = JSON.parse(JSON.stringify(settlements));
  const turnData = JSON.parse(JSON.stringify(turns));

  if (!kingdom.founded) {
    return <FoundingWizard kingdom={kingdomData} characters={characterData} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Kingdom</h1>
          <p className="text-muted-foreground">Stats, skills, leadership, and founding choices</p>
        </div>
      </div>

      <KingdomShell
        kingdom={kingdomData}
        characters={characterData}
        hexes={hexData}
        settlements={settlementData}
        turns={turnData}
      />
    </div>
  );
}
