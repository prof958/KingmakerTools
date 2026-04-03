"use client";

/**
 * InventoryTable — the main inventory table showing all items.
 * Supports assigning items to characters, marking invested/worn, editing quantity, and deleting.
 */

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Shield, Sparkles, Package } from "lucide-react";
import { formatCurrency } from "@/lib/pf2e/currency";

interface Character {
  id: string;
  name: string;
  strModifier: number;
}

interface Item {
  id: string;
  name: string;
  bulkValue: number;
  isBulkLight: boolean;
  level: number;
  rarity: string;
  traits: string[];
  category: string;
  valueCp: number;
  isInvestable: boolean;
  containerCapacity: number | null;
  containerBulkReduction: number | null;
  description: string | null;
}

export interface InventoryItemData {
  id: string;
  itemId: string;
  characterId: string | null;
  containerInventoryItemId: string | null;
  quantity: number;
  isInvested: boolean;
  isWorn: boolean;
  notes: string | null;
  item: Item;
  character: Character | null;
  containedItems?: InventoryItemData[];
}

function bulkDisplay(item: Item): string {
  if (item.isBulkLight) return "L";
  if (item.bulkValue === 0) return "—";
  return String(item.bulkValue);
}

function rarityColor(rarity: string): string {
  switch (rarity) {
    case "UNCOMMON": return "text-orange-600 dark:text-orange-400";
    case "RARE": return "text-blue-600 dark:text-blue-400";
    case "UNIQUE": return "text-purple-600 dark:text-purple-400";
    default: return "";
  }
}

export function InventoryTable({
  initialItems,
  characters,
  onUpdate,
}: {
  initialItems: InventoryItemData[];
  characters: Character[];
  onUpdate?: () => void;
}) {
  const [items, setItems] = useState<InventoryItemData[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");

  const filteredItems = items.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "shared") return !inv.characterId;
    return inv.characterId === filter;
  });

  const updateItem = useCallback(
    (id: string, data: Record<string, unknown>) => {
      startTransition(async () => {
        const res = await fetch(`/api/inventory/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
          onUpdate?.();
        }
      });
    },
    [onUpdate]
  );

  const deleteItem = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          onUpdate?.();
        }
      });
    },
    [onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Filter by owner */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select
          value={filter}
          onValueChange={(val) => setFilter(val ?? "all")}
          items={{
            all: "All Items",
            shared: "Shared / Unassigned",
            ...Object.fromEntries(characters.map((c) => [c.id, c.name])),
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All Items">All Items</SelectItem>
            <SelectItem value="shared" label="Shared / Unassigned">Shared / Unassigned</SelectItem>
            {characters.map((c) => (
              <SelectItem key={c.id} value={c.id} label={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No items in inventory yet.</p>
          <p className="text-xs">Use the &quot;Add Item&quot; button to add loot.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Item</TableHead>
                <TableHead className="w-[60px] text-center">Bulk</TableHead>
                <TableHead className="w-[60px] text-center">Qty</TableHead>
                <TableHead className="w-[100px]">Value</TableHead>
                <TableHead className="w-[150px]">Owner</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((inv) => (
                <TableRow key={inv.id} className={isPending ? "opacity-60" : ""}>
                  <TableCell>
                    <div>
                      <span className={`font-medium ${rarityColor(inv.item.rarity)}`}>
                        {inv.item.name}
                      </span>
                      {inv.item.level > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          Lv {inv.item.level}
                        </span>
                      )}
                    </div>
                    {inv.item.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {inv.item.traits.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {inv.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        {inv.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {bulkDisplay(inv.item)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={1}
                      value={inv.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value);
                        if (qty > 0) updateItem(inv.id, { quantity: qty });
                      }}
                      className="w-14 h-7 text-center text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {inv.item.valueCp > 0
                      ? formatCurrency(inv.item.valueCp * inv.quantity)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inv.characterId ?? "shared"}
                      onValueChange={(val) =>
                        updateItem(inv.id, {
                          characterId: !val || val === "shared" ? null : val,
                        })
                      }
                      items={{
                        shared: "Shared",
                        ...Object.fromEntries(characters.map((c) => [c.id, c.name])),
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shared" label="Shared">Shared</SelectItem>
                        {characters.map((c) => (
                          <SelectItem key={c.id} value={c.id} label={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      {inv.item.isInvestable && (
                        <Button
                          size="icon"
                          variant={inv.isInvested ? "default" : "ghost"}
                          className="h-6 w-6"
                          title={inv.isInvested ? "Invested" : "Not invested"}
                          onClick={() =>
                            updateItem(inv.id, { isInvested: !inv.isInvested })
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                        </Button>
                      )}
                      {(inv.item.category === "ARMOR" || inv.item.category === "SHIELD" || inv.item.category === "WORN") && (
                        <Button
                          size="icon"
                          variant={inv.isWorn ? "default" : "ghost"}
                          className="h-6 w-6"
                          title={inv.isWorn ? "Worn/Equipped" : "Not equipped"}
                          onClick={() =>
                            updateItem(inv.id, { isWorn: !inv.isWorn })
                          }
                        >
                          <Shield className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => deleteItem(inv.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
