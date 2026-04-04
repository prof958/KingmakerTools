"use client";

/**
 * WishList — track items the party wants to acquire.
 * Supports linking to catalog items or custom entries, assigning to characters,
 * marking acquired, and showing prices.
 */

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Star,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Search,
  ShoppingCart,
  Globe,
} from "lucide-react";
import { formatCurrency } from "@/lib/pf2e/currency";
import {
  AonItemSearch,
  aonToItemPayload,
  type AonItem,
} from "@/components/inventory/aon-item-search";

// ─── Types ───

interface Character {
  id: string;
  name: string;
}

interface CatalogItem {
  id: string;
  name: string;
  valueCp: number;
  level: number;
  rarity: string;
  category: string;
}

export interface WishListItemData {
  id: string;
  characterId: string | null;
  itemId: string | null;
  customName: string | null;
  customPriceCp: number | null;
  notes: string | null;
  isAcquired: boolean;
  item: CatalogItem | null;
  character: Character | null;
}

// ─── Component ───

export function WishList({
  initialItems,
  characters,
}: {
  initialItems: WishListItemData[];
  characters: Character[];
}) {
  const [items, setItems] = useState<WishListItemData[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [showAcquired, setShowAcquired] = useState(false);

  // Add form state
  const [mode, setMode] = useState<"catalog" | "custom" | "aon">("custom");
  const [search, setSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [assignTo, setAssignTo] = useState("party");
  const [notes, setNotes] = useState("");

  // Search catalog
  useEffect(() => {
    if (!addOpen || mode !== "catalog") return;
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const res = await fetch(`/api/items?${params}`);
        if (res.ok) setCatalogResults(await res.json());
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, addOpen, mode]);

  function resetForm() {
    setMode("custom");
    setSearch("");
    setCatalogResults([]);
    setSelectedItem(null);
    setCustomName("");
    setCustomPrice("");
    setAssignTo("party");
    setNotes("");
  }

  function addFromAon(aonItem: AonItem) {
    startTransition(async () => {
      // Persist the AoN item to local catalog first
      const payload = aonToItemPayload(aonItem);
      const itemRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!itemRes.ok) return;
      const newItem = await itemRes.json();

      // Add to wish list
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: newItem.id,
          characterId: assignTo === "party" ? null : assignTo,
          notes: notes.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
        resetForm();
        setAddOpen(false);
      }
    });
  }

  function addItem() {
    const payload: Record<string, unknown> = {
      characterId: assignTo === "party" ? null : assignTo,
      notes: notes.trim() || null,
    };

    if (mode === "catalog" && selectedItem) {
      payload.itemId = selectedItem.id;
    } else if (mode === "custom" && customName.trim()) {
      payload.customName = customName.trim();
      payload.customPriceCp = customPrice
        ? Math.round(parseFloat(customPrice) * 100)
        : null;
    } else {
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
        resetForm();
        setAddOpen(false);
      }
    });
  }

  function toggleAcquired(item: WishListItemData) {
    startTransition(async () => {
      const res = await fetch(`/api/wishlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAcquired: !item.isAcquired }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? updated : i)),
        );
      }
    });
  }

  function deleteItem(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    });
  }

  // Derived
  const pending = items.filter((i) => !i.isAcquired);
  const acquired = items.filter((i) => i.isAcquired);
  const displayItems = showAcquired ? items : pending;

  function getItemName(item: WishListItemData): string {
    return item.item?.name ?? item.customName ?? "Unknown";
  }

  function getPrice(item: WishListItemData): number | null {
    if (item.item) return item.item.valueCp;
    return item.customPriceCp;
  }

  // Total cost of pending items
  const totalCostCp = pending.reduce((sum, i) => sum + (getPrice(i) ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <CardTitle>Wish List</CardTitle>
            <Badge variant="secondary">
              {pending.length} pending
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {acquired.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAcquired((s) => !s)}
              >
                {showAcquired ? "Hide Acquired" : `Show Acquired (${acquired.length})`}
              </Button>
            )}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                <Plus className="mr-1 h-4 w-4" />
                Add
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add to Wish List</DialogTitle>
                </DialogHeader>

                {/* Toggle catalog / custom / aon */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={mode === "aon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode("aon")}
                  >
                    <Globe className="mr-1 h-4 w-4" />
                    AoN
                  </Button>
                  <Button
                    variant={mode === "custom" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode("custom")}
                  >
                    Custom
                  </Button>
                  <Button
                    variant={mode === "catalog" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode("catalog")}
                  >
                    <Search className="mr-1 h-4 w-4" />
                    Catalog
                  </Button>
                </div>

                {/* AoN search */}
                {mode === "aon" && (
                  <div className="mb-4">
                    <AonItemSearch
                      disabled={isPending}
                      onSelect={addFromAon}
                    />
                  </div>
                )}

                {/* Catalog search */}
                {mode === "catalog" && (
                  <div className="space-y-3 mb-4">
                    <Input
                      placeholder="Search items…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setSelectedItem(null);
                      }}
                    />
                    {catalogResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                        {catalogResults.map((ci) => (
                          <button
                            key={ci.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between ${
                              selectedItem?.id === ci.id ? "bg-accent" : ""
                            }`}
                            onClick={() => setSelectedItem(ci)}
                          >
                            <span>
                              {ci.name}
                              <span className="ml-2 text-xs text-muted-foreground">
                                Lv {ci.level}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(ci.valueCp)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedItem && (
                      <Badge variant="secondary">
                        <Star className="mr-1 h-3 w-3" />
                        {selectedItem.name} — {formatCurrency(selectedItem.valueCp)}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Custom item */}
                {mode === "custom" && (
                  <div className="space-y-3 mb-4">
                    <div className="space-y-1">
                      <Label>Item Name</Label>
                      <Input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="+1 Striking Longsword"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Price (gp)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={customPrice}
                        onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setCustomPrice(e.target.value); }}
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}

                {/* Assign to */}
                <div className="space-y-1 mb-4">
                  <Label>For</Label>
                  <Select
                    value={assignTo}
                    onValueChange={(val) => setAssignTo(val ?? "party")}
                    items={{
                      party: "Party / Shared",
                      ...Object.fromEntries(characters.map((c) => [c.id, c.name])),
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="party" label="Party / Shared">Party / Shared</SelectItem>
                      {characters.map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-1 mb-4">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Available at Oleg's Trading Post"
                  />
                </div>

                {mode !== "aon" && (
                  <Button
                    className="w-full"
                    onClick={addItem}
                    disabled={
                      isPending ||
                      (mode === "catalog" && !selectedItem) ||
                      (mode === "custom" && !customName.trim())
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add to Wish List
                  </Button>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {displayItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {showAcquired
                ? "No wish list items."
                : "No pending items. Add items you want to buy!"}
            </p>
          </div>
        )}

        {displayItems.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">For</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((wi) => (
                  <TableRow
                    key={wi.id}
                    className={wi.isAcquired ? "opacity-50" : ""}
                  >
                    {/* Acquired toggle */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleAcquired(wi)}
                        disabled={isPending}
                      >
                        {wi.isAcquired ? (
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </TableCell>

                    {/* Name */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className={wi.isAcquired ? "line-through" : ""}>
                          {getItemName(wi)}
                        </span>
                        {wi.item && (
                          <Badge variant="outline" className="text-[10px]">
                            Lv {wi.item.level}
                          </Badge>
                        )}
                        {wi.isAcquired && (
                          <Badge variant="secondary" className="text-[10px]">
                            Acquired
                          </Badge>
                        )}
                      </div>
                      {/* Mobile: show "for" inline */}
                      <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                        {wi.character?.name ?? "Party"}
                      </div>
                    </TableCell>

                    {/* For */}
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {wi.character?.name ?? "Party"}
                    </TableCell>

                    {/* Price */}
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {getPrice(wi) != null
                        ? formatCurrency(getPrice(wi)!)
                        : "—"}
                    </TableCell>

                    {/* Notes */}
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-48 truncate">
                      {wi.notes ?? ""}
                    </TableCell>

                    {/* Delete */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteItem(wi.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Total cost */}
        {pending.length > 0 && (
          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">Total cost:</span>
            <Badge variant="secondary" className="text-sm font-mono">
              {formatCurrency(totalCostCp)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
