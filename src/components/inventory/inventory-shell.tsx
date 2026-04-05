"use client";

/**
 * InventoryShell — client wrapper that coordinates all inventory sub-components.
 * Receives server-fetched data as props and manages client-side refreshes.
 */

import { useState, useCallback } from "react";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [characters] = useState(initialCharacters);

  // Force a page refresh to reload server data
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    // Full reload to get fresh server data
    window.location.reload();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <BulkTracker
          key={`bulk-${refreshKey}`}
          inventoryItems={initialInventory}
          characters={characters}
          wallets={initialWallets}
          carriers={initialCarriers}
        />
        <CharacterManager initialCharacters={characters} />
      </div>

      {/* Carriers row */}
      <BulkCarrierManager
        key={`carriers-${refreshKey}`}
        initialCarriers={initialCarriers}
        characters={characters}
      />

      <Tabs defaultValue="items" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="items">Inventory</TabsTrigger>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="wishlist">Wish List</TabsTrigger>
          </TabsList>
          <AddItemDialog characters={characters} onAdd={refresh} />
        </div>

        <TabsContent value="items">
          <InventoryTable
            key={`inv-${refreshKey}`}
            initialItems={initialInventory}
            characters={characters}
            carriers={initialCarriers}
            onUpdate={refresh}
          />
        </TabsContent>

        <TabsContent value="wallets">
          <WalletManager
            key={`wal-${refreshKey}`}
            initialWallets={initialWallets}
            characters={characters}
          />
        </TabsContent>

        <TabsContent value="wishlist">
          <WishList
            key={`wl-${refreshKey}`}
            initialItems={initialWishList}
            characters={characters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
