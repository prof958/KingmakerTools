"use client";

/**
 * UrbanGridEditor — one Urban Grid instance (KPG 44-47): 3x3 blocks of 2x2
 * lots, rendered as one flat 6x6 CSS grid rather than nested per-block grids.
 * A flat grid is what lets a 2-lot structure span two lots in different
 * blocks (RAW doesn't require multi-lot structures to stay within one
 * block) — each visual item just declares its own `gridColumn`/`gridRow`
 * start and span, and an inactive block is drawn the same way a 4-lot
 * structure would be: one item spanning its whole 2x2 area.
 *
 * Every cell sits flush against its neighbors (no grid gap, no per-cell
 * border/card) on one continuous ground surface, so built tiles read as
 * part of a settlement rather than a row of UI buttons. The 3x3 block
 * structure is drawn as two thin divider lines overlaid on top rather than
 * as gaps between cells, so it stays legible without breaking that surface
 * up. The ground uses a fixed earthy palette rather than the app's
 * light/dark theme tokens, on purpose — it's meant to read as a physical
 * map, like the painted hex sheets on the Map tab, not as themed UI chrome.
 */

import { useMemo } from "react";
import { Plus, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRID_BLOCKS,
  GRID_LOTS,
  blockKey,
  blockOf,
  lotKey,
  placementCells,
  whyCannotActivateBlock,
  type Cell,
  type UrbanGridInstance,
} from "@/lib/urban-grid";
import { getKingdomStructure } from "@/lib/pf2e/kingdom-structures";

export function UrbanGridEditor({
  instance,
  maxBlocks,
  requireContiguous,
  selectedPlacementId,
  onSelectPlacement,
  onSelectEmptyLot,
  onSelectRubble,
  onActivateBlock,
}: {
  instance: UrbanGridInstance;
  maxBlocks: number;
  requireContiguous: boolean;
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  onSelectEmptyLot: (anchor: Cell) => void;
  onSelectRubble: (cell: Cell) => void;
  onActivateBlock: (block: Cell) => void;
}) {
  const activeBlocks = useMemo(() => new Set(instance.activeBlocks), [instance.activeBlocks]);
  const rubble = useMemo(() => new Set(instance.rubble), [instance.rubble]);

  const occupied = useMemo(() => {
    const cells = new Set<string>();
    for (const placement of Object.values(instance.placements)) {
      for (const cell of placementCells(placement)) cells.add(lotKey(cell.col, cell.row));
    }
    return cells;
  }, [instance.placements]);

  // Undeveloped blocks first, so an active block's own contents draw on top
  // in source order (grid item stacking follows DOM order on ties).
  const items: React.ReactNode[] = [];

  for (let bc = 0; bc < GRID_BLOCKS; bc++) {
    for (let br = 0; br < GRID_BLOCKS; br++) {
      if (activeBlocks.has(blockKey(bc, br))) continue;
      const block = { col: bc, row: br };
      const reason = whyCannotActivateBlock(instance, block, maxBlocks, requireContiguous);
      items.push(
        <button
          key={`block-${bc}-${br}`}
          type="button"
          disabled={reason !== null}
          title={reason ?? "Develop this block"}
          onClick={() => onActivateBlock(block)}
          style={{ gridColumn: `${bc * 2 + 1} / span 2`, gridRow: `${br * 2 + 1} / span 2` }}
          className={cn(
            "group/block relative flex items-center justify-center transition-colors",
            reason === null
              ? "cursor-pointer bg-black/35 hover:bg-black/10"
              : "cursor-not-allowed bg-black/50",
          )}
        >
          {reason === null ? (
            <Plus className="size-5 text-white/0 transition-opacity group-hover/block:text-white/80" />
          ) : (
            <Ban className="size-3.5 text-white/25" />
          )}
        </button>,
      );
    }
  }

  for (const [placementId, placement] of Object.entries(instance.placements)) {
    const structure = getKingdomStructure(placement.structureId);
    const { col, row } = placement.anchor;
    const isSelected = selectedPlacementId === placementId;
    items.push(
      <button
        key={placementId}
        type="button"
        onClick={() => onSelectPlacement(placementId)}
        title={structure?.name ?? placement.structureId}
        style={{
          gridColumn: `${col + 1} / span ${placement.lots === 4 ? 2 : placement.lots}`,
          gridRow: `${row + 1} / span ${placement.lots === 4 ? 2 : 1}`,
        }}
        className={cn(
          "relative overflow-hidden transition-[filter] hover:z-10 hover:brightness-110",
          isSelected && "z-10 ring-2 ring-inset ring-amber-400",
        )}
      >
        {structure?.tile ? (
          // A plain <img>, not next/image: the optimizer's /_next/image route
          // does a server-side loopback fetch with no session cookie, and the
          // auth proxy redirects that to /login — the tile "loads" as an HTML
          // page instead of a PNG. A browser-issued <img> request carries the
          // real session cookie and is unaffected.
          <img
            src={structure.tile}
            alt={structure.name}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black/40 p-0.5 text-center text-[0.6rem] leading-tight text-white/70">
            {structure?.name ?? placement.structureId}
          </div>
        )}
      </button>,
    );
  }

  // Empty and rubbled lots inside active blocks — whatever an active block's
  // 4 cells didn't get claimed by a block-item or a placement above.
  for (let col = 0; col < GRID_LOTS; col++) {
    for (let row = 0; row < GRID_LOTS; row++) {
      const key = lotKey(col, row);
      if (occupied.has(key)) continue;
      const block = blockOf({ col, row });
      if (!activeBlocks.has(blockKey(block.col, block.row))) continue;

      const isRubble = rubble.has(key);
      items.push(
        <button
          key={`lot-${key}`}
          type="button"
          onClick={() => (isRubble ? onSelectRubble({ col, row }) : onSelectEmptyLot({ col, row }))}
          title={isRubble ? "Rubble — demolish to clear" : "Empty lot — click to build"}
          style={{ gridColumn: `${col + 1}`, gridRow: `${row + 1}` }}
          className={cn(
            "group/lot relative flex items-center justify-center transition-colors",
            isRubble
              ? // A diagonal hatch reads as debris rather than another flat panel.
                "bg-[repeating-linear-gradient(135deg,rgba(120,40,30,0.55)_0_5px,rgba(80,25,20,0.55)_5px_10px)] hover:brightness-125"
              : "bg-amber-100/10 hover:bg-amber-100/25",
          )}
        >
          {isRubble ? (
            <span className="text-[0.55rem] font-medium tracking-wide text-white/80 uppercase">
              Rubble
            </span>
          ) : (
            <Plus className="size-4 text-white/0 transition-opacity group-hover/lot:text-white/70" />
          )}
        </button>,
      );
    }
  }

  return (
    <div
      className="relative aspect-square w-full max-w-md overflow-hidden rounded-xl ring-1 ring-black/40"
      style={{
        // A fixed earthy gradient, not a theme token — this is meant to read
        // as ground the settlement sits on, the same way the Map tab's
        // painted hex sheets don't reflow for light/dark mode either.
        background:
          "radial-gradient(circle at 22% 28%, rgba(255,255,255,0.05), transparent 42%), " +
          "radial-gradient(circle at 78% 74%, rgba(0,0,0,0.12), transparent 48%), " +
          "linear-gradient(135deg, #5b6b3f 0%, #4a5934 55%, #3c4a2a 100%)",
      }}
    >
      <div
        className="grid size-full"
        style={{
          gridTemplateColumns: `repeat(${GRID_LOTS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_LOTS}, 1fr)`,
        }}
      >
        {items}
      </div>

      {/* Block boundaries, drawn as overlaid lines rather than gaps between
          cells, so tiles inside a block still sit flush against each other. */}
      <div className="pointer-events-none absolute inset-0">
        {[1, 2].map((i) => (
          <div
            key={`v-${i}`}
            className="absolute inset-y-0 w-px bg-black/40"
            style={{ left: `${(i * 100) / GRID_BLOCKS}%` }}
          />
        ))}
        {[1, 2].map((i) => (
          <div
            key={`h-${i}`}
            className="absolute inset-x-0 h-px bg-black/40"
            style={{ top: `${(i * 100) / GRID_BLOCKS}%` }}
          />
        ))}
      </div>
    </div>
  );
}
