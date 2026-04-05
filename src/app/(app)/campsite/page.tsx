/**
 * Campsite Page — Server Component
 * Fetches campsite layouts, characters, and recipes, then renders the campsite shell.
 */
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

export const dynamic = "force-dynamic";
import { CampsiteShell } from "@/components/campsite";

export default async function CampsitePage() {
  const campaign = await getOrCreateCampaign();

  const [layouts, characters, recipes, customActivities] = await Promise.all([
    prisma.campsiteLayout.findMany({
      where: { campaignId: campaign.id },
      include: {
        watchShifts: { orderBy: { shiftNumber: "asc" } },
        campingActivities: { include: { character: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { name: "asc" },
    }),
    prisma.recipe.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ isDiscovered: "desc" }, { name: "asc" }],
    }),
    prisma.customCampActivity.findMany({
      where: { campaignId: campaign.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campsite</h1>
        <p className="text-muted-foreground">
          Plan your camp, activities, and watch orders
        </p>
      </div>

      <CampsiteShell
        initialLayouts={JSON.parse(JSON.stringify(layouts))}
        characters={JSON.parse(JSON.stringify(characters))}
        recipes={JSON.parse(JSON.stringify(recipes))}
        customActivities={JSON.parse(JSON.stringify(customActivities))}
      />
    </div>
  );
}
