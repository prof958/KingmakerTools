"use client";

/**
 * InventoryShell — client wrapper that coordinates all inventory sub-components.
 * Receives server-fetched data as props and manages client-side refreshes.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterManager } from "./character-manager";
import { InventoryTable, type InventoryItemData } from "./inventory-table";
import { AddItemDialog } from "./add-item-dialog";
import { WalletManager } from "./wallet-manager";
import { BulkTracker } from "./bulk-tracker";
import { BulkCarrierManager, type BulkCarrierData } from "./bulk-carrier-manager";
import { WishList, type WishListItemData } from "./wish-list";

interface Character {
  id: string;
  name: string;
  strModifier: number;
  isCompanion: boolean;
  miscBulk: number;
}

interface WalletData {
  id: string;
  characterId: string | null;
  cp: number;
  sp: number;
  gp: number;
  pp: number;
  character: Character | null;
}

export function InventoryShell({
  initialCharacters,
  initialInventory,
  initialWallets,
  initialWishList,
  initialCarriers,
}: {
  initialCharacters: Character[];
  initialInventory: InventoryItemData[];
  initialWallets: WalletData[];
  initialWishList: WishListItemData[];
  initialCarriers: BulkCarrierData[];
}) {
  const router = useRouter();

  // Re-run server component to deliver fresh props to all children
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <BulkTracker
          inventoryItems={initialInventory}
          characters={initialCharacters}
          wallets={initialWallets}
          carriers={initialCarriers}
        />
        <CharacterManager initialCharacters={initialCharacters} onUpdate={refresh} />
      </div>

      {/* Carriers row */}
      <BulkCarrierManager
        initialCarriers={initialCarriers}
        characters={initialCharacters}
        onUpdate={refresh}
      />

      <Tabs defaultValue="items" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="items">Inventory</TabsTrigger>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="wishlist">Wish List</TabsTrigger>
          </TabsList>
          <AddItemDialog characters={initialCharacters} carriers={initialCarriers} onAdd={refresh} />
        </div>

        <TabsContent value="items">
          <InventoryTable
            initialItems={initialInventory}
            characters={initialCharacters}
            carriers={initialCarriers}
            onUpdate={refresh}
          />
        </TabsContent>

        <TabsContent value="wallets">
          <WalletManager
            initialWallets={initialWallets}
            characters={initialCharacters}
          />
        </TabsContent>

        <TabsContent value="wishlist">
          <WishList
            initialItems={initialWishList}
            characters={initialCharacters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
