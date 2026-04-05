"use client";

/**
 * BulkCarrierManager — CRUD for mounts, vehicles, and magical storage.
 * Presets populate name/capacity; everything is stored as a regular BulkCarrier row.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
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
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Truck } from "lucide-react";
import type { InventoryItemData } from "./inventory-table";
import { sumBulk, type BulkItem } from "@/lib/pf2e/bulk";

// ─── Presets ───────────────────────────────────────────────

interface Preset {
  name: string;
  type: string;
  bulkCapacity: number;
}

const PRESETS: { group: string; items: Preset[] }[] = [
  {
    group: "Mounts",
    items: [
      { name: "Riding Horse", type: "MOUNT", bulkCapacity: 14 },
      { name: "Pony", type: "MOUNT", bulkCapacity: 10 },
      { name: "Camel", type: "MOUNT", bulkCapacity: 18 },
      { name: "War Horse", type: "MOUNT", bulkCapacity: 18 },
    ],
  },
  {
    group: "Pack Animals",
    items: [
      { name: "Pack Mule", type: "PACK_ANIMAL", bulkCapacity: 14 },
      { name: "Pack Horse", type: "PACK_ANIMAL", bulkCapacity: 14 },
    ],
  },
  {
    group: "Vehicles",
    items: [
      { name: "Cart", type: "VEHICLE", bulkCapacity: 40 },
      { name: "Wagon", type: "VEHICLE", bulkCapacity: 200 },
      { name: "Rowboat", type: "VEHICLE", bulkCapacity: 500 },
      { name: "Keelboat", type: "VEHICLE", bulkCapacity: 1000 },
    ],
  },
  {
    group: "Magical Storage",
    items: [
      { name: "Spacious Pouch (Type I)", type: "MAGICAL_STORAGE", bulkCapacity: 25 },
      { name: "Spacious Pouch (Type II)", type: "MAGICAL_STORAGE", bulkCapacity: 50 },
    ],
  },
];

// ─── Types ─────────────────────────────────────────────────

export interface BulkCarrierData {
  id: string;
  name: string;
  type: string;
  bulkCapacity: number;
  notes: string | null;
  assignedCharacterId: string | null;
  assignedCharacter: { id: string; name: string } | null;
  inventoryItems: InventoryItemData[];
}

interface Character {
  id: string;
  name: string;
  isCompanion: boolean;
}

// ─── Component ─────────────────────────────────────────────

export function BulkCarrierManager({
  initialCarriers,
  characters,
}: {
  initialCarriers: BulkCarrierData[];
  characters: Character[];
}) {
  const [carriers, setCarriers] = useState<BulkCarrierData[]>(initialCarriers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState("CUSTOM");
  const [bulkCapacity, setBulkCapacity] = useState(0);
  const [notes, setNotes] = useState("");
  const [assignedCharacterId, setAssignedCharacterId] = useState<string>("none");

  function resetForm() {
    setEditId(null);
    setName("");
    setType("CUSTOM");
    setBulkCapacity(0);
    setNotes("");
    setAssignedCharacterId("none");
  }

  function openAdd() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(c: BulkCarrierData) {
    setEditId(c.id);
    setName(c.name);
    setType(c.type);
    setBulkCapacity(c.bulkCapacity);
    setNotes(c.notes ?? "");
    setAssignedCharacterId(c.assignedCharacterId ?? "none");
    setDialogOpen(true);
  }

  function applyPreset(preset: Preset) {
    setName(preset.name);
    setType(preset.type);
    setBulkCapacity(preset.bulkCapacity);
  }

  async function handleSave() {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      type,
      bulkCapacity,
      notes: notes || null,
      assignedCharacterId: assignedCharacterId === "none" ? null : assignedCharacterId,
    };

    startTransition(async () => {
      if (editId) {
        const res = await fetch(`/api/bulk-carriers/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setCarriers((prev) => prev.map((c) => (c.id === editId ? updated : c)));
          setDialogOpen(false);
          resetForm();
        }
      } else {
        const res = await fetch("/api/bulk-carriers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setCarriers((prev) => [...prev, created]);
          setDialogOpen(false);
          resetForm();
        }
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/bulk-carriers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCarriers((prev) => prev.filter((c) => c.id !== id));
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Bulk Carriers
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editId ? "Edit Carrier" : "Add Bulk Carrier"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Preset picker — only for new carriers */}
              {!editId && (
                <div>
                  <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {PRESETS.map((group) => (
                      <div key={group.group} className="w-full">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{group.group}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5 mb-2">
                          {group.items.map((p) => (
                            <Button
                              key={p.name}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => applyPreset(p)}
                            >
                              {p.name} ({p.bulkCapacity})
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="carrier-name">Name</Label>
                <Input
                  id="carrier-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pack Mule"
                />
              </div>

              <div>
                <Label htmlFor="carrier-capacity">Bulk Capacity</Label>
                <NumberInput
                  id="carrier-capacity"
                  value={bulkCapacity}
                  fallback={0}
                  min={0}
                  onValueChange={setBulkCapacity}
                />
              </div>

              <div>
                <Label>Assigned To (optional)</Label>
                <Select
                  value={assignedCharacterId}
                  onValueChange={(val) => setAssignedCharacterId(val ?? "none")}
                  items={{
                    none: "Nobody",
                    ...Object.fromEntries(characters.map((c) => [c.id, c.name])),
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" label="Nobody">Nobody</SelectItem>
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
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="carrier-notes">Notes (optional)</Label>
                <Input
                  id="carrier-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bought in Restov"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={isPending || !name.trim()}
                className="w-full"
              >
                {isPending ? "Saving..." : editId ? "Update" : "Add Carrier"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {carriers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No carriers yet. Add mounts, pack animals, or vehicles to carry bulk.
          </p>
        ) : (
          <div className="space-y-2">
            {carriers.map((c) => (
              <CarrierRow
                key={c.id}
                carrier={c}
                onEdit={openEdit}
                onDelete={handleDelete}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function carrierBulk(carrier: BulkCarrierData): { total: number; lightRemainder: number } {
  const items: BulkItem[] = carrier.inventoryItems.map((inv) => ({
    bulkValue: inv.item.bulkValue,
    isBulkLight: inv.item.isBulkLight,
    quantity: inv.quantity,
  }));
  const { numericBulk, lightItems } = sumBulk(items);
  const bulkFromLight = Math.floor(lightItems / 10);
  return {
    total: numericBulk + bulkFromLight,
    lightRemainder: lightItems % 10,
  };
}

const TYPE_LABELS: Record<string, string> = {
  MOUNT: "Mount",
  PACK_ANIMAL: "Pack Animal",
  VEHICLE: "Vehicle",
  MAGICAL_STORAGE: "Magic",
  CUSTOM: "Custom",
};

function CarrierRow({
  carrier,
  onEdit,
  onDelete,
  isPending,
}: {
  carrier: BulkCarrierData;
  onEdit: (c: BulkCarrierData) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const bulk = carrierBulk(carrier);
  const isOver = bulk.total > carrier.bulkCapacity;

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{carrier.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABELS[carrier.type] ?? carrier.type}
          </Badge>
        </div>
        <div className="flex gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {bulk.total}
            {bulk.lightRemainder > 0 && <span>+{bulk.lightRemainder}L</span>}
            {" / "}
            {carrier.bulkCapacity} Bulk
          </span>
          {carrier.assignedCharacter && (
            <span className="text-xs text-muted-foreground">
              → {carrier.assignedCharacter.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isOver && (
          <Badge variant="destructive" className="text-xs">
            Over
          </Badge>
        )}
        <Button size="icon" variant="ghost" onClick={() => onEdit(carrier)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(carrier.id)}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
