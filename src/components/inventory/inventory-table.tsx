"use client";

/**
 * InventoryTable — the main inventory table showing all items.
 * Supports assigning items to characters, marking invested/worn, editing quantity, and deleting.
 */

import { Fragment, useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
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
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Shield, Sparkles, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/pf2e/currency";
import type { BulkCarrierData } from "./bulk-carrier-manager";

interface Character {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  strModifier: number;
  isCompanion: boolean;
  status: "ACTIVE" | "FALLEN";
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
  bulkCarrierId: string | null;
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
  carriers,
  onUpdate,
}: {
  initialItems: InventoryItemData[];
  characters: Character[];
  carriers: BulkCarrierData[];
  onUpdate?: () => void;
}) {
  const [items, setItems] = useState<InventoryItemData[]>(initialItems);
  useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");

  const filteredItems = items.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "shared") return !inv.characterId && !inv.bulkCarrierId;
    if (filter.startsWith("carrier:")) return inv.bulkCarrierId === filter.slice(8);
    return inv.characterId === filter;
  });

  const updateItem = useCallback(
    (id: string, data: Record<string, unknown>) => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/inventory/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            const updated = await res.json();
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
            onUpdate?.();
          } else {
            toast.error("Couldn't save that change. Try again.");
          }
        } catch {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        }
      });
    },
    [onUpdate]
  );

  const deleteItem = useCallback(
    (id: string) => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
          if (res.ok) {
            setItems((prev) => prev.filter((i) => i.id !== id));
            onUpdate?.();
          } else {
            toast.error("Couldn't delete that item. Try again.");
          }
        } catch {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        }
      });
    },
    [onUpdate]
  );

  // Group items by carrier
  const carrierMap = new Map<string | null, InventoryItemData[]>();
  for (const inv of filteredItems) {
    const key = inv.bulkCarrierId ?? null;
    const group = carrierMap.get(key);
    if (group) group.push(inv);
    else carrierMap.set(key, [inv]);
  }

  // Build ordered groups: unassigned first, then carriers in order
  const groups: { key: string | null; label: string; items: InventoryItemData[] }[] = [];
  const unassigned = carrierMap.get(null);
  if (unassigned) groups.push({ key: null, label: "Carried / Unassigned", items: unassigned });
  for (const c of carriers) {
    const group = carrierMap.get(c.id);
    if (group) groups.push({ key: c.id, label: c.name, items: group });
  }

  const showGroupHeaders = groups.length > 1 || (groups.length === 1 && groups[0].key !== null);

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
            {characters.filter((c) => !c.isCompanion).length > 0 && (
              <SelectGroup>
                <SelectLabel>Characters</SelectLabel>
                {characters.filter((c) => !c.isCompanion).map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {characters.filter((c) => c.isCompanion).length > 0 && (
              <SelectGroup>
                <SelectLabel>Companions</SelectLabel>
                {characters.filter((c) => c.isCompanion).map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {carriers.length > 0 && (
              <SelectGroup>
                <SelectLabel>Carriers</SelectLabel>
                {carriers.map((c) => (
                  <SelectItem key={c.id} value={`carrier:${c.id}`} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
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
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground sm:hidden">
            Scroll the table sideways to reach quantity, owner, carrier, and delete →
          </p>
          <div className="rounded-md border overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Item</TableHead>
                <TableHead className="w-[60px] text-center">Bulk</TableHead>
                <TableHead className="w-[60px] text-center">Qty</TableHead>
                <TableHead className="w-[100px]">Value</TableHead>
                <TableHead className="w-[140px]">Owner</TableHead>
                <TableHead className="w-[140px]">Carrier</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.key ?? "none"}>
                  {showGroupHeaders && (
                    <TableRow key={`header-${group.key ?? "none"}`} className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={8} className="py-1.5">
                        <div className="flex items-center gap-2">
                          {group.key ? (
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({group.items.length})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {group.items.map((inv) => (
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
                    <NumberInput
                      min={1}
                      fallback={1}
                      value={inv.quantity}
                      onValueChange={(qty) => updateItem(inv.id, { quantity: qty })}
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
                      onValueChange={(val) => {
                        updateItem(inv.id, { characterId: !val || val === "shared" ? null : val });
                      }}
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
                        {/* Fallen characters can still be shown as an item's current
                            owner (via the `items` map above), but aren't offered when
                            reassigning going forward — gone until revived. */}
                        {characters.filter((c) => !c.isCompanion && c.status !== "FALLEN").length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Characters</SelectLabel>
                            {characters.filter((c) => !c.isCompanion && c.status !== "FALLEN").map((c) => (
                              <SelectItem key={c.id} value={c.id} label={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {characters.filter((c) => c.isCompanion && c.status !== "FALLEN").length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Companions</SelectLabel>
                            {characters.filter((c) => c.isCompanion && c.status !== "FALLEN").map((c) => (
                              <SelectItem key={c.id} value={c.id} label={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {carriers.length > 0 ? (
                      <Select
                        value={inv.bulkCarrierId ?? "none"}
                        onValueChange={(val) => {
                          updateItem(inv.id, { bulkCarrierId: !val || val === "none" ? null : val });
                        }}
                        items={{
                          none: "None",
                          ...Object.fromEntries(carriers.map((c) => [c.id, c.name])),
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" label="None">None</SelectItem>
                          {carriers.map((c) => (
                            <SelectItem key={c.id} value={c.id} label={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
                </Fragment>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}
    </div>
  );
}
