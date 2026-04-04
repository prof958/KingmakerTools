"use client";

/**
 * AddItemDialog — search the item catalog and add items to inventory.
 * Supports both catalog items and custom item creation.
 */

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search } from "lucide-react";
import { formatCurrency } from "@/lib/pf2e/currency";
import {
  AonItemSearch,
  aonToItemPayload,
  type AonItem,
} from "@/components/inventory/aon-item-search";

interface CatalogItem {
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
  description: string | null;
}

interface Character {
  id: string;
  name: string;
}

export function AddItemDialog({
  characters,
  onAdd,
}: {
  characters: Character[];
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [assignTo, setAssignTo] = useState<string>("shared");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedAonItem, setSelectedAonItem] = useState<AonItem | null>(null);

  // Custom item fields
  const [customName, setCustomName] = useState("");
  const [customBulk, setCustomBulk] = useState("0");
  const [customBulkLight, setCustomBulkLight] = useState(false);
  const [customValue, setCustomValue] = useState("0");
  const [customCategory, setCustomCategory] = useState("GEAR");
  const [customDesc, setCustomDesc] = useState("");

  // Search catalog
  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const res = await fetch(`/api/items?${params}`);
        if (res.ok) {
          setCatalogItems(await res.json());
        }
      } catch {
        // ignore
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, open]);

  async function addFromCatalog(item: CatalogItem) {
    startTransition(async () => {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          characterId: assignTo === "shared" ? null : assignTo,
          quantity,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        onAdd();
        setOpen(false);
        resetForm();
      }
    });
  }

  async function addFromAon(aonItem: AonItem) {
    startTransition(async () => {
      // Create the item definition locally from AoN data
      const payload = aonToItemPayload(aonItem);
      const itemRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!itemRes.ok) return;
      const newItem = await itemRes.json();

      // Then add it to inventory
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: newItem.id,
          characterId: assignTo === "shared" ? null : assignTo,
          quantity,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        onAdd();
        setOpen(false);
        resetForm();
      }
    });
  }

  async function addCustomItem() {
    if (!customName.trim()) return;

    startTransition(async () => {
      // Create the item definition first
      const itemRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          bulkValue: parseFloat(customBulk) || 0,
          isBulkLight: customBulkLight,
          category: customCategory,
          valueCp: Math.round(parseFloat(customValue) * 100), // input is in GP
          description: customDesc || null,
        }),
      });

      if (!itemRes.ok) return;
      const newItem = await itemRes.json();

      // Then add it to inventory
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: newItem.id,
          characterId: assignTo === "shared" ? null : assignTo,
          quantity,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        onAdd();
        setOpen(false);
        resetForm();
      }
    });
  }

  function resetForm() {
    setSearch("");
    setAssignTo("shared");
    setQuantity(1);
    setNotes("");
    setSelectedAonItem(null);
    setCustomName("");
    setCustomBulk("0");
    setCustomBulkLight(false);
    setCustomValue("0");
    setCustomCategory("GEAR");
    setCustomDesc("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
      >
        <Plus className="mr-1 h-4 w-4" /> Add Item
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Inventory</DialogTitle>
        </DialogHeader>

        {/* Item source tabs — main content area */}
        <Tabs defaultValue="aon">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aon">AoN Database</TabsTrigger>
            <TabsTrigger value="custom">Custom Item</TabsTrigger>
          </TabsList>

          <TabsContent value="aon" className="mt-3">
            {selectedAonItem ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{selectedAonItem.name}</span>
                    {selectedAonItem.level > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        Lv {selectedAonItem.level}
                      </Badge>
                    )}
                    {selectedAonItem.rarity !== "common" && (
                      <Badge variant="outline" className="text-[10px]">
                        {selectedAonItem.rarity}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAonItem(null)}
                  >
                    Change
                  </Button>
                </div>
                {selectedAonItem.summary && (
                  <p className="text-xs text-muted-foreground">{selectedAonItem.summary}</p>
                )}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {selectedAonItem.priceCp > 0 && (
                    <span>{formatCurrency(selectedAonItem.priceCp)}</span>
                  )}
                  <span>
                    {selectedAonItem.bulkRaw === "L" ? "L" : selectedAonItem.bulk || "—"} Bulk
                  </span>
                </div>
              </div>
            ) : (
              <AonItemSearch
                disabled={isPending}
                onSelect={(aonItem: AonItem) => setSelectedAonItem(aonItem)}
              />
            )}
          </TabsContent>

          <TabsContent value="catalog" className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items... (e.g., healing potion, backpack)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
              {catalogItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => addFromCatalog(item)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.name}
                      </span>
                      {item.level > 0 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Lv {item.level}
                        </Badge>
                      )}
                      {item.rarity !== "COMMON" && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {item.rarity}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                    <div>
                      {item.isBulkLight ? "L" : item.bulkValue || "—"} Bulk
                    </div>
                    {item.valueCp > 0 && (
                      <div>{formatCurrency(item.valueCp)}</div>
                    )}
                  </div>
                </div>
              ))}
              {catalogItems.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  {search ? "No items match your search." : "Loading catalog..."}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-3 space-y-3">
            <div>
              <Label>Item Name</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Mysterious Amulet"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Category</Label>
                <Select
                  value={customCategory}
                  onValueChange={(val) => setCustomCategory(val ?? "GEAR")}
                  items={{
                    WEAPON: "Weapon", ARMOR: "Armor", SHIELD: "Shield",
                    GEAR: "Gear", CONSUMABLE: "Consumable", WORN: "Worn",
                    HELD: "Held", CONTAINER: "Container", WAND: "Wand", OTHER: "Other",
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEAPON" label="Weapon">Weapon</SelectItem>
                    <SelectItem value="ARMOR" label="Armor">Armor</SelectItem>
                    <SelectItem value="SHIELD" label="Shield">Shield</SelectItem>
                    <SelectItem value="GEAR" label="Gear">Gear</SelectItem>
                    <SelectItem value="CONSUMABLE" label="Consumable">Consumable</SelectItem>
                    <SelectItem value="WORN" label="Worn">Worn</SelectItem>
                    <SelectItem value="HELD" label="Held">Held</SelectItem>
                    <SelectItem value="CONTAINER" label="Container">Container</SelectItem>
                    <SelectItem value="WAND" label="Wand">Wand</SelectItem>
                    <SelectItem value="OTHER" label="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bulk</Label>
                <div className="flex gap-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={customBulk}
                    onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setCustomBulk(e.target.value); }}
                    disabled={customBulkLight}
                  />
                  <Button
                    variant={customBulkLight ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setCustomBulkLight(!customBulkLight)}
                  >
                    L
                  </Button>
                </div>
              </div>
              <div>
                <Label>Value (gp)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={customValue}
                  onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setCustomValue(e.target.value); }}
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="A glowing amulet found in the ruins..."
                rows={2}
              />
            </div>
            <Button
              onClick={addCustomItem}
              disabled={isPending || !customName.trim()}
              className="w-full"
            >
              {isPending ? "Adding..." : "Add Custom Item"}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Bottom row: assign-to, qty, notes */}
        <div className="border-t pt-3 mt-1 space-y-2">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Assign to</Label>
              <Select
                value={assignTo}
                onValueChange={(val) => setAssignTo(val ?? "shared")}
                items={{
                  shared: "Shared / Party Loot",
                  ...Object.fromEntries(characters.map((c) => [c.id, c.name])),
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared" label="Shared / Party Loot">Shared / Party Loot</SelectItem>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-16">
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <NumberInput
                min={1}
                fallback={1}
                value={quantity}
                onValueChange={setQuantity}
                className="h-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Found in the Stag Lord's fortress"
              className="h-8"
            />
          </div>
          {selectedAonItem && (
            <Button
              onClick={() => addFromAon(selectedAonItem)}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Adding..." : "Add to Inventory"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
