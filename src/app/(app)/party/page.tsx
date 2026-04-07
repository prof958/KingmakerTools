/**
 * Party Page — Server Component
 * Fetches characters and renders the party member manager.
 */
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { CharacterManager } from "@/components/inventory/character-manager";

export default async function PartyPage() {
  const campaign = await getOrCreateCampaign();

  const characters = await prisma.character.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Party</h1>
        <p className="text-muted-foreground">
          Manage party members and companions
        </p>
      </div>

      <CharacterManager
        initialCharacters={JSON.parse(JSON.stringify(characters))}
      />
    </div>
  );
}
