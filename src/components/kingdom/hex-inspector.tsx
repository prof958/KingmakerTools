"use client";

/**
 * HexInspector — the side panel for whichever hex is selected on the map.
 *
 * Every control writes straight through to the API. Claim Hex requires the
 * target to be adjacent to the kingdom, so the panel says whether it is rather
 * than leaving the player to work it out from the map.
 */

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hexDistance, type Axial } from "@/lib/hex";
import type { HexData } from "./types";

const STATES = [
  { id: "UNCLAIMED", label: "Unexplored" },
  { id: "RECONNOITERED", label: "Reconnoitered" },
  { id: "CLAIMED", label: "Claimed" },
] as const;

const TERRAINS = [
  "plains", "forest", "hills", "mountains", "swamp", "lake", "wetlands", "desert",
] as const;

const WORK_SITES = [
  { id: "farmland", label: "Farmland" },
  { id: "lumber", label: "Lumber Camp" },
  { id: "mine", label: "Mine" },
  { id: "quarry", label: "Quarry" },
] as const;

const FEATURES = [
  "landmark", "refuge", "resource", "bridge", "ruins", "freehold", "structure",
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs capitalize transition-colors",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "hover:border-primary/50 hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function HexInspector({
  sheet,
  selected,
  hex,
  claimedHexes,
  onPatch,
  saving,
}: {
  sheet: number;
  selected: Axial;
  hex: HexData | undefined;
  /** Claimed hexes on this sheet, for the adjacency check. */
  claimedHexes: Axial[];
  onPatch: (changes: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(hex?.label ?? "");
  const state = hex?.state ?? "UNCLAIMED";
  const features = hex?.features ?? [];

  const adjacent = claimedHexes.some((c) => hexDistance(c, selected) === 1);
  const isClaimed = state === "CLAIMED";
  // The first hex a kingdom claims is its capital and has nothing to be
  // adjacent to, so the rule only bites once something is already claimed.
  const canClaim = isClaimed || claimedHexes.length === 0 || adjacent;

  function toggleFeature(feature: string) {
    const next = features.includes(feature)
      ? features.filter((f) => f !== feature)
      : [...features, feature];
    onPatch({ features: next });
  }

  return (
    <aside className="space-y-4 rounded-xl border bg-card p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <h3 className="font-heading text-sm font-bold">
            Sheet {sheet} · {selected.q}, {selected.r}
          </h3>
        </div>
        {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </header>

      <Section title="State">
        <div className="flex flex-wrap gap-1.5">
          {STATES.map((s) => (
            <Chip
              key={s.id}
              active={state === s.id}
              onClick={() => onPatch({ state: s.id })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
        {!canClaim && (
          <p className="text-xs text-amber-400">
            Not adjacent to your territory — Claim Hex needs a neighbouring claimed hex.
          </p>
        )}
      </Section>

      <Section title="Terrain">
        <div className="flex flex-wrap gap-1.5">
          {TERRAINS.map((terrain) => (
            <Chip
              key={terrain}
              active={(hex?.terrain ?? "plains") === terrain}
              onClick={() => onPatch({ terrain })}
            >
              {terrain}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Work site">
        <div className="flex flex-wrap gap-1.5">
          {WORK_SITES.map((site) => (
            <Chip
              key={site.id}
              active={hex?.workSite === site.id}
              onClick={() => onPatch({ workSite: hex?.workSite === site.id ? null : site.id })}
            >
              {site.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Terrain features">
        <div className="flex flex-wrap gap-1.5">
          {FEATURES.map((feature) => (
            <Chip
              key={feature}
              active={features.includes(feature)}
              onClick={() => toggleFeature(feature)}
            >
              {feature}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Improvements">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={Boolean(hex?.hasRoads)} onClick={() => onPatch({ hasRoads: !hex?.hasRoads })}>
            Roads
          </Chip>
          <Chip active={Boolean(hex?.fortified)} onClick={() => onPatch({ fortified: !hex?.fortified })}>
            Fortified
          </Chip>
        </div>
      </Section>

      <Section title="Label">
        <Input
          className="h-8 text-sm"
          placeholder="e.g. Oleg's Trading Post"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== (hex?.label ?? "")) onPatch({ label });
          }}
        />
      </Section>

      {hex && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => onPatch({ state: "UNCLAIMED", workSite: null, features: [], hasRoads: false, fortified: false })}
        >
          Reset hex
        </Button>
      )}
    </aside>
  );
}
