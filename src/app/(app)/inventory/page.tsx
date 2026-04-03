/**
 * Inventory Page — Server Component
 * Fetches all inventory data and passes it to the client shell.
 */
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { InventoryShell } from "@/components/inventory/inventory-shell";

export default async function InventoryPage() {
  const campaign = await getOrCreateCampaign();

  const [characters, inventoryItems, wallets, wishListItems] = await Promise.all([
    prisma.character.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { campaignId: campaign.id },
      include: {
        item: true,
        character: true,
        container: { include: { item: true } },
        containedItems: { include: { item: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.wallet.findMany({
      where: { campaignId: campaign.id },
      include: { character: true },
      orderBy: [{ characterId: "asc" }],
    }),
    prisma.wishListItem.findMany({
      where: { campaignId: campaign.id },
      include: { item: true, character: true },
      orderBy: [{ isAcquired: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Party loot and player gear</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {inventoryItems.length} item{inventoryItems.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <InventoryShell
        initialCharacters={JSON.parse(JSON.stringify(characters))}
        initialInventory={JSON.parse(JSON.stringify(inventoryItems))}
        initialWallets={JSON.parse(JSON.stringify(wallets))}
        initialWishList={JSON.parse(JSON.stringify(wishListItems))}
      />
    </div>
  );
}
