"use client";

/**
 * BulkTracker — show each character's bulk status at a glance.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Backpack, PawPrint, Truck } from "lucide-react";
import { calculateBulk, sumBulk, type BulkItem } from "@/lib/pf2e/bulk";
import { totalCoins } from "@/lib/pf2e/currency";
import type { InventoryItemData } from "./inventory-table";
import type { BulkCarrierData } from "./bulk-carrier-manager";

interface Character {
  id: string;
  name: string;
  strModifier: number;
  isCompanion: boolean;
  miscBulk: number;
}

interface WalletData {
  characterId: string | null;
  cp: number;
  sp: number;
  gp: number;
  pp: number;
}

export function BulkTracker({
  inventoryItems,
  characters,
  wallets,
  carriers,
}: {
  inventoryItems: InventoryItemData[];
  characters: Character[];
  wallets: WalletData[];
  carriers: BulkCarrierData[];
}) {
  // Shared items: not assigned to a character AND not on a carrier
  const sharedItems = inventoryItems.filter((i) => !i.characterId && !i.bulkCarrierId);
  const sharedBulkItems: BulkItem[] = sharedItems.map((inv) => ({
    bulkValue: inv.item.bulkValue,
    isBulkLight: inv.item.isBulkLight,
    quantity: inv.quantity,
  }));
  const sharedBulk = calculateBulk(sharedBulkItems, 0, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Backpack className="h-5 w-5" />
          Bulk Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add characters to track their carrying capacity.
          </p>
        ) : (
          <div className="space-y-3">
            {characters.filter((c) => !c.isCompanion).map((char) => (
              <BulkRow key={char.id} character={char} inventoryItems={inventoryItems} wallets={wallets} />
            ))}

            {/* Shared loot bulk */}
            <div className="flex items-center justify-between rounded-md border border-dashed p-3 opacity-75">
              <span className="text-sm text-muted-foreground">
                Shared Loot (unassigned)
              </span>
              <span className="text-sm tabular-nums">
                {sharedBulk.totalBulkDisplay}
                {sharedBulk.lightItemsRemainder > 0 && (
                  <span className="text-muted-foreground">
                    +{sharedBulk.lightItemsRemainder}L
                  </span>
                )}{" "}
                Bulk
              </span>
            </div>

            {/* Carriers */}
            {carriers.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Carriers</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                {carriers.map((carrier) => (
                  <CarrierBulkRow key={carrier.id} carrier={carrier} />
                ))}
              </>
            )}

            {characters.some((c) => c.isCompanion) && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                {characters.filter((c) => c.isCompanion).map((char) => (
                  <BulkRow key={char.id} character={char} inventoryItems={inventoryItems} wallets={wallets} />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BulkRow({
  character: char,
  inventoryItems,
  wallets,
}: {
  character: Character;
  inventoryItems: InventoryItemData[];
  wallets: WalletData[];
}) {
  // Character items: assigned to this character AND not on a bulk carrier
  const charItems = inventoryItems.filter((i) => i.characterId === char.id && !i.bulkCarrierId);
  const bulkItems: BulkItem[] = charItems.map((inv) => ({
    bulkValue: inv.item.bulkValue,
    isBulkLight: inv.item.isBulkLight,
    quantity: inv.quantity,
  }));
  const charWallet = wallets.find((w) => w.characterId === char.id);
  const coinCount = charWallet
    ? totalCoins({
        cp: charWallet.cp,
        sp: charWallet.sp,
        gp: charWallet.gp,
        pp: charWallet.pp,
      })
    : 0;
  const bulk = calculateBulk(bulkItems, coinCount, char.strModifier, char.miscBulk);
  const investedCount = charItems.filter((i) => i.isInvested).length;

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <span className="font-medium">{char.name}</span>
        <div className="flex gap-2 mt-0.5">
          {investedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ✨ {investedCount}/10 invested
            </span>
          )}
          {char.miscBulk > 0 && (
            <span className="text-xs text-muted-foreground">
              📦 +{char.miscBulk} misc
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums">
          {bulk.totalBulkDisplay}
          {bulk.lightItemsRemainder > 0 && (
            <span className="text-muted-foreground">
              +{bulk.lightItemsRemainder}L
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">
          {bulk.encumberedAt}
        </span>
        {bulk.isOverloaded ? (
          <Badge variant="destructive" className="text-xs">
            Overloaded
          </Badge>
        ) : bulk.isEncumbered ? (
          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Encumbered
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            OK
          </Badge>
        )}
      </div>
    </div>
  );
}

function CarrierBulkRow({ carrier }: { carrier: BulkCarrierData }) {
  const items: BulkItem[] = carrier.inventoryItems.map((inv) => ({
    bulkValue: inv.item.bulkValue,
    isBulkLight: inv.item.isBulkLight,
    quantity: inv.quantity,
  }));
  const { numericBulk, lightItems } = sumBulk(items);
  const bulkFromLight = Math.floor(lightItems / 10);
  const lightRemainder = lightItems % 10;
  const total = numericBulk + bulkFromLight;
  const isOver = total > carrier.bulkCapacity;

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <span className="font-medium">{carrier.name}</span>
        {carrier.assignedCharacter && (
          <span className="text-xs text-muted-foreground ml-2">
            → {carrier.assignedCharacter.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums">
          {total}
          {lightRemainder > 0 && (
            <span className="text-muted-foreground">
              +{lightRemainder}L
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">
          {carrier.bulkCapacity}
        </span>
        {isOver ? (
          <Badge variant="destructive" className="text-xs">
            Over
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            OK
          </Badge>
        )}
      </div>
    </div>
  );
}
