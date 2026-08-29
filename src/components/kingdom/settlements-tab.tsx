"use client";

/**
 * SettlementsTab — settlement switcher, founding flow, and the selected
 * settlement's Urban Grid editor with its inspector panel.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ABILITY_LABELS,
  getSettlementType,
  SETTLEMENT_TYPES,
} from "@/lib/pf2e/kingdom";
import { getKingdomStructure } from "@/lib/pf2e/kingdom-structures";
import {
  BORDER_SIDES,
  emptyGridInstance,
  type BorderSide,
  type BorderType,
  type Cell,
} from "@/lib/urban-grid";
import { UrbanGridEditor } from "./urban-grid-editor";
import { StructurePicker } from "./structure-picker";
import type { HexData, SettlementData } from "./types";

const BORDER_LABEL: Record<BorderType, string> = { land: "Land", water: "Water", walled: "Walled" };
const BORDER_CYCLE: BorderType[] = ["land", "water", "walled"];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function SettlementsTab({
  settlements,
  hexes,
  kingdomLevel,
}: {
  settlements: SettlementData[];
  hexes: HexData[];
  kingdomLevel: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(settlements[0]?.id ?? null);
  const [gridIndex, setGridIndex] = useState(0);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<Cell | null>(null);
  const [founding, setFounding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHexId, setNewHexId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = settlements.find((s) => s.id === selectedId) ?? null;
  const instance = selected?.grid.grids[gridIndex];

  const availableHexes = useMemo(() => {
    const taken = new Set(settlements.map((s) => s.hexId).filter(Boolean));
    return hexes.filter((h) => h.state === "CLAIMED" && !taken.has(h.id));
  }, [hexes, settlements]);

  const settlementType = selected ? getSettlementType(selected.type.toLowerCase()) : undefined;

  function refresh() {
    router.refresh();
  }

  async function foundSettlement() {
    if (!newName.trim() || !newHexId) return;
    setBusy(true);
    setError(null);
    try {
      const settlement = await api("/api/kingdom/settlements", "POST", {
        name: newName.trim(),
        hexId: newHexId,
      });
      setFounding(false);
      setNewName("");
      setNewHexId(null);
      setSelectedId(settlement.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not found the settlement.");
    } finally {
      setBusy(false);
    }
  }

  async function mutate(action: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/kingdom/settlements/${selected.id}`, "PATCH", {
        gridIndex,
        ...action,
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSettlement() {
    if (!selected) return;
    if (!confirm(`Abandon ${selected.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/kingdom/settlements/${selected.id}`, "DELETE");
      setSelectedId(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const selectedPlacement =
    instance && selectedPlacementId ? instance.placements[selectedPlacementId] : null;
  const selectedStructure = selectedPlacement ? getKingdomStructure(selectedPlacement.structureId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {settlements.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedId(s.id);
                setGridIndex(0);
                setSelectedPlacementId(null);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                selectedId === s.id
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "hover:border-primary/50 hover:bg-accent",
              )}
            >
              {s.isCapital && <Crown className="size-3.5" />}
              {s.name}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  selectedId === s.id ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                Lv{s.level}
              </span>
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setFounding(true)}>
            <Plus /> Found settlement
          </Button>
        </div>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {founding && (
        <div className="space-y-3 rounded-xl border bg-card/50 p-4">
          <h3 className="font-heading text-sm font-bold">Found a new settlement</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              className="h-9 w-56"
              placeholder="Settlement name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={newHexId ?? ""}
              onChange={(e) => setNewHexId(e.target.value || null)}
            >
              <option value="">Choose a claimed hex…</option>
              {availableHexes.map((h) => (
                <option key={h.id} value={h.id}>
                  Sheet {h.sheet} · {h.q},{h.r}
                  {h.label ? ` — ${h.label}` : ""}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!newName.trim() || !newHexId || busy} onClick={foundSettlement}>
              Found it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFounding(false)}>
              Cancel
            </Button>
          </div>
          {availableHexes.length === 0 && (
            <p className="text-xs text-amber-400">
              No claimed hexes are free — claim one on the Map tab first.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!selected ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {settlements.length === 0
            ? "No settlements yet — found your capital to get started."
            : "Select a settlement above."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm font-medium"
                  value={selected.type}
                  onChange={(e) => mutate({ type: e.target.value })}
                >
                  {SETTLEMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id.toUpperCase()}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Badge variant="outline">Level {selected.level}</Badge>
                {selected.overcrowded && <Badge variant="destructive">Overcrowded</Badge>}
                <Button
                  size="sm"
                  variant={selected.isCapital ? "default" : "outline"}
                  onClick={() => mutate({ isCapital: !selected.isCapital })}
                >
                  <Crown className="size-3.5" /> {selected.isCapital ? "Capital" : "Make capital"}
                </Button>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={deleteSettlement} title="Abandon settlement">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>

            {selected.grid.grids.length > 1 && (
              <div className="flex gap-1.5">
                {selected.grid.grids.map((_g, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setGridIndex(i);
                      setSelectedPlacementId(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs",
                      gridIndex === i
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    District {i + 1}
                  </button>
                ))}
              </div>
            )}

            {instance && (
              <UrbanGridEditor
                instance={instance}
                maxBlocks={settlementType?.maxBlocks ?? 1}
                requireContiguous={settlementType?.id === "village" || settlementType?.id === "town"}
                selectedPlacementId={selectedPlacementId}
                onSelectPlacement={setSelectedPlacementId}
                onSelectEmptyLot={setPickerAnchor}
                onSelectRubble={(cell) => mutate({ action: "clearRubble", col: cell.col, row: cell.row })}
                onActivateBlock={(block) => mutate({ action: "activateBlock", col: block.col, row: block.row })}
              />
            )}

            {selected.type === "METROPOLIS" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutate({ action: "addGrid" })}
              >
                <Plus /> Add district
              </Button>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card/50 p-4">
              <p className="mb-2 text-sm font-medium">Borders</p>
              <div className="grid grid-cols-2 gap-1.5">
                {BORDER_SIDES.map((side: BorderSide) => {
                  const current = selected.grid.borders[side];
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => {
                        const next = BORDER_CYCLE[(BORDER_CYCLE.indexOf(current) + 1) % BORDER_CYCLE.length];
                        mutate({ action: "setBorders", side, type: next });
                      }}
                      className="flex items-center justify-between rounded-lg border px-2 py-1 text-xs capitalize hover:bg-accent"
                    >
                      {side}
                      <span className="font-medium">{BORDER_LABEL[current]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPlacement && selectedStructure ? (
              <div className="space-y-2 rounded-xl border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold">{selectedStructure.name}</h3>
                  <Badge variant="outline">Lv {selectedStructure.level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{selectedStructure.description}</p>
                {selectedStructure.effects && (
                  <p className="text-xs">
                    <span className="font-medium">Effects </span>
                    {selectedStructure.effects}
                  </p>
                )}
                {selectedStructure.itemBonuses.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedStructure.itemBonuses.map((b, i) => (
                      <Badge key={i} variant="secondary" className="text-[0.65rem]">
                        +{b.value} {b.ability ? ABILITY_LABELS[b.ability as keyof typeof ABILITY_LABELS] : b.activities.join(", ")}
                        {b.source === "VK" && " (V&K)"}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      mutate({ action: "remove", placementId: selectedPlacementId });
                      setSelectedPlacementId(null);
                    }}
                  >
                    Demolish
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      mutate({ action: "rubble", placementId: selectedPlacementId });
                      setSelectedPlacementId(null);
                    }}
                  >
                    Reduce to rubble
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
                Click an empty lot to build, or a structure to inspect it.
              </div>
            )}
          </aside>
        </div>
      )}

      {selected && instance && pickerAnchor && (
        <StructurePicker
          open
          onOpenChange={(open) => !open && setPickerAnchor(null)}
          instance={instance}
          anchor={pickerAnchor}
          kingdomLevel={kingdomLevel}
          onPick={(structureId) => {
            mutate({ action: "place", structureId, col: pickerAnchor.col, row: pickerAnchor.row });
            setPickerAnchor(null);
          }}
        />
      )}
    </div>
  );
}

// Re-exported so a fresh grid instance is available without importing
// urban-grid directly wherever a settlement needs one (e.g. tests/fixtures).
export { emptyGridInstance };
