"use client";

/**
 * StructurePicker — choose a structure to build at an already-selected lot.
 *
 * Only lists structures that would actually fit there (lot count and every
 * covered cell free/active — the same `canPlace` check the API re-validates
 * server-side) and that the kingdom's level allows. Cost is shown but not
 * enforced: this app doesn't deduct kingdom resources for construction yet
 * (that lands with the turn tracker, which is also where a real Build
 * Structure check belongs) — for now this is a bookkeeping tool, not a rules
 * gate, matching how the map lets you set a hex CLAIMED without spending RP.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KINGDOM_STRUCTURES, type KingdomStructureDef } from "@/lib/pf2e/kingdom-structures";
import { COMMODITY_LABELS } from "@/lib/pf2e/kingdom";
import { canPlace, type Cell, type UrbanGridInstance } from "@/lib/urban-grid";

function CostLine({ cost }: { cost: KingdomStructureDef["cost"] }) {
  const parts = [
    cost.rp > 0 && `${cost.rp} RP`,
    ...(Object.keys(COMMODITY_LABELS) as (keyof typeof COMMODITY_LABELS)[])
      .filter((k) => k !== "food")
      .map((k) => cost[k as keyof typeof cost] > 0 && `${cost[k as keyof typeof cost]} ${COMMODITY_LABELS[k]}`),
  ].filter(Boolean);
  return <span>{parts.length > 0 ? parts.join(" · ") : "Free"}</span>;
}

export function StructurePicker({
  open,
  onOpenChange,
  instance,
  anchor,
  kingdomLevel,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: UrbanGridInstance;
  anchor: Cell;
  kingdomLevel: number;
  onPick: (structureId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KINGDOM_STRUCTURES.filter((s) => s.lots > 0 && s.id !== "rubble") // infrastructure has no lot tile; rubble only appears from a failed Demolish or event, never chosen here
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        structure: s,
        fits: canPlace(instance, anchor, s.lots as 1 | 2 | 4),
        levelOk: s.level <= kingdomLevel,
      }))
      .sort((a, b) => {
        if (a.fits !== b.fits) return a.fits ? -1 : 1;
        return a.structure.level - b.structure.level;
      });
  }, [instance, anchor, kingdomLevel, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Build at lot {anchor.col}, {anchor.row}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search structures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
          {options.map(({ structure, fits, levelOk }) => (
            <button
              key={structure.id}
              type="button"
              disabled={!fits}
              onClick={() => onPick(structure.id)}
              className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors enabled:hover:border-primary/50 enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded ring-1 ring-black/20">
                {/* Plain <img>, not next/image — see the note in urban-grid-editor.tsx. */}
                {structure.tile && (
                  <img src={structure.tile} alt="" className="absolute inset-0 size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{structure.name}</span>
                  <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                    Lv {structure.level}
                  </Badge>
                  <Badge variant="secondary" className="shrink-0 text-[0.65rem]">
                    {structure.lots} lot{structure.lots > 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  <CostLine cost={structure.cost} />
                </p>
              </div>
              {!levelOk && (
                <span className="shrink-0 text-[0.65rem] text-amber-500">above kingdom level</span>
              )}
            </button>
          ))}
          {options.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No structures match.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
