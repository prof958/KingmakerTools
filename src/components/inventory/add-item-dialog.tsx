"use client";

/**
 * AddItemDialog — search the item catalog and add items to inventory.
 * Supports both catalog items and custom item creation.
 */

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Item to Inventory</DialogTitle>
        </DialogHeader>

        {/* Common fields: assign-to + quantity */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label>Assign to</Label>
            <Select value={assignTo} onValueChange={(val) => setAssignTo(val ?? "shared")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Shared / Party Loot</SelectItem>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label>Qty</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Found in the Stag Lord's fortress"
          />
        </div>

        <Tabs defaultValue="aon" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="aon">AoN Database</TabsTrigger>
            <TabsTrigger value="catalog">Local Catalog</TabsTrigger>
            <TabsTrigger value="custom">Custom Item</TabsTrigger>
          </TabsList>

          <TabsContent value="aon" className="space-y-3">
            <AonItemSearch
              disabled={isPending}
              onSelect={(aonItem: AonItem) => addFromAon(aonItem)}
            />
          </TabsContent>

          <TabsContent value="catalog" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items... (e.g., healing potion, backpack)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
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

          <TabsContent value="custom" className="space-y-3">
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
                <Select value={customCategory} onValueChange={(val) => setCustomCategory(val ?? "GEAR")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEAPON">Weapon</SelectItem>
                    <SelectItem value="ARMOR">Armor</SelectItem>
                    <SelectItem value="SHIELD">Shield</SelectItem>
                    <SelectItem value="GEAR">Gear</SelectItem>
                    <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                    <SelectItem value="WORN">Worn</SelectItem>
                    <SelectItem value="HELD">Held</SelectItem>
                    <SelectItem value="CONTAINER">Container</SelectItem>
                    <SelectItem value="WAND">Wand</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bulk</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={customBulk}
                    onChange={(e) => setCustomBulk(e.target.value)}
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
                  type="number"
                  min={0}
                  step={0.01}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
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
      </DialogContent>
    </Dialog>
  );
}
