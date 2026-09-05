/**
 * Party Page — Server Component
 * Fetches characters, companion assignments and the places they can be sent,
 * then renders the party roster and the companion command board.
 */
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { loadCompanionBoard, loadLocationOptions } from "@/lib/companion-data";
import { CharacterManager } from "@/components/inventory/character-manager";
import { CompanionCommand } from "@/components/companions";

export default async function PartyPage() {
  const campaign = await getOrCreateCampaign();

  const [characters, board, locations] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
    }),
    loadCompanionBoard(campaign.id),
    loadLocationOptions(campaign.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Party</h1>
        <p className="text-muted-foreground">
          Manage party members and companions
        </p>
      </div>

      <CompanionCommand
        companions={board.companions}
        assignments={board.assignments}
        locations={locations}
        today={{
          day: campaign.golarionDay,
          month: campaign.golarionMonth,
          year: campaign.golarionYear,
        }}
      />

      <CharacterManager
        initialCharacters={JSON.parse(JSON.stringify(characters))}
      />
    </div>
  );
}
