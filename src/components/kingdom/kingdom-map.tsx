"use client";

/**
 * KingdomMap — the map tab: sheet picker, canvas, and hex inspector.
 *
 * Hex state lives here rather than in the canvas so the inspector and the
 * legend read the same data the map draws. The canvas itself is loaded without
 * SSR because Konva needs a DOM.
 */

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAP_SHEETS } from "@/lib/map-sheets";
import type { Axial } from "@/lib/hex";
import { HexInspector } from "./hex-inspector";
import type { HexData } from "./types";

const HexMapCanvas = dynamic(
  () => import("./hex-map-canvas").then((m) => m.HexMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        Unrolling the map…
      </div>
    ),
  },
);

const LEGEND = [
  { label: "Claimed", className: "bg-emerald-400/40 border-emerald-400" },
  { label: "Reconnoitered", className: "bg-sky-400/25 border-sky-400" },
  { label: "Selected", className: "border-amber-400" },
];

export function KingdomMap({ hexes: initialHexes }: { hexes: HexData[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(1);
  const [selected, setSelected] = useState<Axial | null>(null);
  const [hexes, setHexes] = useState(initialHexes);
  const [saving, setSaving] = useState(false);

  const bySheet = useMemo(() => {
    const map = new Map<string, HexData>();
    for (const hex of hexes) {
      if (hex.sheet === sheet) map.set(`${hex.q},${hex.r}`, hex);
    }
    return map;
  }, [hexes, sheet]);

  const claimed = useMemo(
    () => hexes.filter((h) => h.sheet === sheet && h.state === "CLAIMED"),
    [hexes, sheet],
  );

  const totalClaimed = hexes.filter((h) => h.state === "CLAIMED").length;

  const patchHex = useCallback(
    async (changes: Record<string, unknown>) => {
      if (!selected) return;
      setSaving(true);
      try {
        const res = await fetch("/api/kingdom/hexes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet, q: selected.q, r: selected.r, ...changes }),
        });
        if (!res.ok) return;
        const { hex } = (await res.json()) as { hex: HexData };
        setHexes((current) => {
          const rest = current.filter(
            (h) => !(h.sheet === hex.sheet && h.q === hex.q && h.r === hex.r),
          );
          return [...rest, hex];
        });
        // Claiming or abandoning a hex moves the kingdom's Size, which the
        // Overview tab renders from server data.
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [router, selected, sheet],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {MAP_SHEETS.map((s) => {
            const count = hexes.filter((h) => h.sheet === s.id && h.state === "CLAIMED").length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSheet(s.id);
                  setSelected(null);
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  sheet === s.id
                    ? "border-primary bg-primary font-medium text-primary-foreground"
                    : "hover:border-primary/50 hover:bg-accent",
                )}
              >
                {s.name}
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 text-xs tabular-nums",
                      sheet === s.id ? "text-primary-foreground/70" : "text-emerald-400",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{totalClaimed}</span> hexes
          claimed
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-2">
          <HexMapCanvas
            sheet={MAP_SHEETS.find((s) => s.id === sheet)!}
            hexes={bySheet}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {LEGEND.map((entry) => (
              <span key={entry.label} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded-sm border-2", entry.className)} />
                {entry.label}
              </span>
            ))}
            <span className="ml-auto">Scroll to zoom · drag to pan · click a hex</span>
          </div>
        </div>

        {selected ? (
          <HexInspector
            key={`${sheet}:${selected.q},${selected.r}`}
            sheet={sheet}
            selected={selected}
            hex={bySheet.get(`${selected.q},${selected.r}`)}
            claimedHexes={claimed}
            onPatch={patchHex}
            saving={saving}
          />
        ) : (
          <aside className="flex items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Click a hex to reconnoiter, claim, or annotate it.
          </aside>
        )}
      </div>
    </div>
  );
}
