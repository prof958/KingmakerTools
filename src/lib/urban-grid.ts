/**
 * Urban Grid — the settlement building-out minigame (KPG 44-47).
 *
 * A settlement's Urban Grid is 3x3 blocks in a square, each block 2x2 lots —
 * 9 blocks, 36 lots. Not every block is buildable from the start: a village
 * starts with a single block, and (per RAW) a town's blocks must stay
 * contiguous with each other as it grows, while a city or metropolis may use
 * any block on the grid freely. Structures occupy 1, 2, or 4 lots (matching
 * the `lots` field already on every `KingdomStructureDef`): a 2-lot structure
 * as a horizontal pair, a 4-lot structure as one whole block.
 *
 * This module is pure state-transition logic over the JSON shape stored in
 * `Settlement.grid` — no DB, no React. Coordinates are flattened to a single
 * 6x6 lot space (col, row each 0-5) rather than nested block+lot pairs,
 * because every placement, adjacency, and occupancy check reduces to plain
 * 2D grid arithmetic that way; `blockOf()` recovers the 3x3 block a lot
 * belongs to whenever the rules need it.
 */

export const GRID_BLOCKS = 3; // blocks per side
export const BLOCK_LOTS = 2; // lots per side, per block
export const GRID_LOTS = GRID_BLOCKS * BLOCK_LOTS; // lots per side, per grid (6)

export interface Cell {
  col: number;
  row: number;
}

/** One structure's footprint on the grid. */
export interface StructurePlacement {
  structureId: string;
  /** Top-left occupied lot. */
  anchor: Cell;
  /** 1, 2, or 4 — cached from the structure def so this module never has to import the catalog. */
  lots: 1 | 2 | 4;
}

/** One Urban Grid's worth of state. A metropolis can have more than one. */
export interface UrbanGridInstance {
  /** Block keys ("col,row", each 0-2) the settlement has expanded into. */
  activeBlocks: string[];
  placements: Record<string, StructurePlacement>;
  /** Lot keys ("col,row", each 0-5) cleared to rubble — must be demolished before rebuilding. */
  rubble: string[];
}

export type BorderSide = "north" | "east" | "south" | "west";
export type BorderType = "land" | "water" | "walled";

export interface UrbanGridData {
  grids: UrbanGridInstance[];
  borders: Record<BorderSide, BorderType>;
}

export const BORDER_SIDES: BorderSide[] = ["north", "east", "south", "west"];

export function blockKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function lotKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseKey(key: string): Cell {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

/** The 3x3 block a lot belongs to. */
export function blockOf({ col, row }: Cell): Cell {
  return { col: Math.floor(col / BLOCK_LOTS), row: Math.floor(row / BLOCK_LOTS) };
}

export function emptyGridInstance(): UrbanGridInstance {
  return { activeBlocks: [], placements: {}, rubble: [] };
}

export function emptyUrbanGrid(): UrbanGridData {
  return {
    grids: [emptyGridInstance()],
    borders: { north: "land", east: "land", south: "land", west: "land" },
  };
}

/** Every lot cell a placement covers, given its anchor and lot count. */
export function placementCells({ anchor, lots }: Pick<StructurePlacement, "anchor" | "lots">): Cell[] {
  const { col, row } = anchor;
  if (lots === 1) return [{ col, row }];
  if (lots === 2) return [{ col, row }, { col: col + 1, row }];
  // A 4-lot structure fills exactly one block, so its anchor must already be
  // that block's own top-left lot — canPlace() enforces this before a
  // placement is ever constructed.
  return [
    { col, row },
    { col: col + 1, row },
    { col, row: row + 1 },
    { col: col + 1, row: row + 1 },
  ];
}

function inBounds({ col, row }: Cell): boolean {
  return col >= 0 && col < GRID_LOTS && row >= 0 && row < GRID_LOTS;
}

/** The four orthogonal neighbors of a block, in bounds or not. */
function blockNeighbors({ col, row }: Cell): Cell[] {
  return [
    { col: col - 1, row },
    { col: col + 1, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ];
}

function inGridBounds({ col, row }: Cell, size: number): boolean {
  return col >= 0 && col < size && row >= 0 && row < size;
}

/** Every occupied cell in an instance — placements and rubble alike. */
function occupiedCells(instance: UrbanGridInstance): Set<string> {
  const cells = new Set<string>(instance.rubble);
  for (const placement of Object.values(instance.placements)) {
    for (const cell of placementCells(placement)) cells.add(lotKey(cell.col, cell.row));
  }
  return cells;
}

/**
 * Why a structure can't go at this anchor, or null if it can. Checking this
 * before `placeStructure` is what keeps the state pure — placement never
 * needs to fail internally, because nothing calls it without asking first.
 */
export function whyCannotPlace(
  instance: UrbanGridInstance,
  anchor: Cell,
  lots: 1 | 2 | 4,
): string | null {
  if (lots === 4 && (anchor.col % BLOCK_LOTS !== 0 || anchor.row % BLOCK_LOTS !== 0)) {
    return "A four-lot structure must start at a block's corner.";
  }

  const cells = placementCells({ anchor, lots });
  for (const cell of cells) {
    if (!inBounds(cell)) return "That structure would run off the edge of the grid.";
  }

  const activeBlocks = new Set(instance.activeBlocks);
  for (const cell of cells) {
    const block = blockOf(cell);
    if (!activeBlocks.has(blockKey(block.col, block.row))) {
      return "That lot's block hasn't been developed yet.";
    }
  }

  const occupied = occupiedCells(instance);
  for (const cell of cells) {
    if (occupied.has(lotKey(cell.col, cell.row))) {
      return "One of those lots is already built on or rubbled.";
    }
  }

  return null;
}

export function canPlace(instance: UrbanGridInstance, anchor: Cell, lots: 1 | 2 | 4): boolean {
  return whyCannotPlace(instance, anchor, lots) === null;
}

/** Place a structure. Caller must have checked `canPlace` first. */
export function placeStructure(
  instance: UrbanGridInstance,
  placementId: string,
  structureId: string,
  anchor: Cell,
  lots: 1 | 2 | 4,
): UrbanGridInstance {
  return {
    ...instance,
    placements: { ...instance.placements, [placementId]: { structureId, anchor, lots } },
  };
}

/** Clear a structure's lots back to empty (a successful Demolish). */
export function removePlacement(instance: UrbanGridInstance, placementId: string): UrbanGridInstance {
  const { [placementId]: _removed, ...rest } = instance.placements;
  return { ...instance, placements: rest };
}

/**
 * Clear a structure's lots to rubble instead of empty (a failed Demolish, or
 * a kingdom event) — the lots stay unbuildable until demolished again.
 */
export function reduceToRubble(instance: UrbanGridInstance, placementId: string): UrbanGridInstance {
  const placement = instance.placements[placementId];
  if (!placement) return instance;
  const { [placementId]: _removed, ...rest } = instance.placements;
  const cells = placementCells(placement).map((c) => lotKey(c.col, c.row));
  return {
    ...instance,
    placements: rest,
    rubble: [...new Set([...instance.rubble, ...cells])],
  };
}

/** Demolish rubble back to a buildable empty lot. */
export function clearRubble(instance: UrbanGridInstance, cell: Cell): UrbanGridInstance {
  const key = lotKey(cell.col, cell.row);
  return { ...instance, rubble: instance.rubble.filter((k) => k !== key) };
}

/**
 * Why a block can't be activated, or null if it can. RAW only requires
 * contiguity while the settlement is still growing as a village or town; a
 * city or metropolis may build in any of the 9 blocks freely (KPG 46).
 */
export function whyCannotActivateBlock(
  instance: UrbanGridInstance,
  block: Cell,
  maxBlocks: number,
  requireContiguous: boolean,
): string | null {
  if (!inGridBounds(block, GRID_BLOCKS)) return "That block isn't on the grid.";
  const key = blockKey(block.col, block.row);
  if (instance.activeBlocks.includes(key)) return "That block is already developed.";
  if (instance.activeBlocks.length >= maxBlocks) {
    return "This settlement can't support another block yet.";
  }
  if (requireContiguous && instance.activeBlocks.length > 0) {
    const active = new Set(instance.activeBlocks);
    const touchesActive = blockNeighbors(block).some(
      (n) => inGridBounds(n, GRID_BLOCKS) && active.has(blockKey(n.col, n.row)),
    );
    if (!touchesActive) return "New blocks must border a block you've already developed.";
  }
  return null;
}

export function activateBlock(instance: UrbanGridInstance, block: Cell): UrbanGridInstance {
  return { ...instance, activeBlocks: [...instance.activeBlocks, blockKey(block.col, block.row)] };
}

/** A block can't be abandoned while anything is built or rubbled in it. */
export function canDeactivateBlock(instance: UrbanGridInstance, block: Cell): boolean {
  const key = blockKey(block.col, block.row);
  if (!instance.activeBlocks.includes(key)) return false;
  for (const occupiedKey of occupiedCells(instance)) {
    const occupiedBlock = blockOf(parseKey(occupiedKey));
    if (blockKey(occupiedBlock.col, occupiedBlock.row) === key) return false;
  }
  return true;
}

export function deactivateBlock(instance: UrbanGridInstance, block: Cell): UrbanGridInstance {
  const key = blockKey(block.col, block.row);
  return { ...instance, activeBlocks: instance.activeBlocks.filter((k) => k !== key) };
}

/** Settlement level: blocks (across every grid) with at least one structure, capped at 20 (KPG 47). */
export function settlementLevel(grids: UrbanGridInstance[]): number {
  const built = new Set<string>();
  grids.forEach((instance, gridIndex) => {
    for (const placement of Object.values(instance.placements)) {
      const block = blockOf(placement.anchor);
      built.add(`${gridIndex}:${blockKey(block.col, block.row)}`);
    }
  });
  return Math.min(20, built.size);
}

/** Blocks (across every grid) that have at least one structure. */
function blocksWithStructures(grids: UrbanGridInstance[]): number {
  return settlementLevel(grids); // same count, before the level-20 cap matters
}

/**
 * Whether a settlement is Overcrowded: fewer built Residential lots than
 * blocks that have any structure at all (KPG 48). Counted in lots, not
 * buildings — a 2-lot Residential structure contributes 2.
 */
export function isOvercrowded(
  grids: UrbanGridInstance[],
  isResidential: (structureId: string) => boolean,
): boolean {
  let residentialLots = 0;
  for (const instance of grids) {
    for (const placement of Object.values(instance.placements)) {
      if (isResidential(placement.structureId)) residentialLots += placement.lots;
    }
  }
  return residentialLots < blocksWithStructures(grids);
}
