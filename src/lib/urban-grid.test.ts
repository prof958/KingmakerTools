import { describe, expect, it } from "vitest";
import {
  activateBlock,
  blockOf,
  canDeactivateBlock,
  canPlace,
  clearRubble,
  deactivateBlock,
  emptyGridInstance,
  emptyUrbanGrid,
  isOvercrowded,
  placeStructure,
  placementCells,
  reduceToRubble,
  removePlacement,
  settlementLevel,
  whyCannotActivateBlock,
  whyCannotPlace,
  type UrbanGridInstance,
} from "./urban-grid";

/** A fresh instance with the given blocks already active. */
function withBlocks(...blocks: [number, number][]): UrbanGridInstance {
  let instance = emptyGridInstance();
  for (const [col, row] of blocks) instance = activateBlock(instance, { col, row });
  return instance;
}

describe("emptyUrbanGrid", () => {
  it("starts with one grid, no active blocks, and land on every border", () => {
    const grid = emptyUrbanGrid();
    expect(grid.grids).toHaveLength(1);
    expect(grid.grids[0].activeBlocks).toEqual([]);
    expect(Object.values(grid.borders)).toEqual(["land", "land", "land", "land"]);
  });
});

describe("blockOf", () => {
  it("maps each 2x2 group of lots to one block", () => {
    expect(blockOf({ col: 0, row: 0 })).toEqual({ col: 0, row: 0 });
    expect(blockOf({ col: 1, row: 1 })).toEqual({ col: 0, row: 0 });
    expect(blockOf({ col: 2, row: 0 })).toEqual({ col: 1, row: 0 });
    expect(blockOf({ col: 5, row: 5 })).toEqual({ col: 2, row: 2 });
  });
});

describe("placementCells", () => {
  it("covers one cell for a 1-lot structure", () => {
    expect(placementCells({ anchor: { col: 2, row: 3 }, lots: 1 })).toEqual([{ col: 2, row: 3 }]);
  });

  it("covers a horizontal pair for a 2-lot structure", () => {
    expect(placementCells({ anchor: { col: 2, row: 3 }, lots: 2 })).toEqual([
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ]);
  });

  it("covers a full 2x2 block for a 4-lot structure", () => {
    expect(placementCells({ anchor: { col: 2, row: 2 }, lots: 4 })).toEqual([
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ]);
  });
});

describe("whyCannotPlace / canPlace", () => {
  it("refuses a lot in a block that hasn't been developed", () => {
    const instance = emptyGridInstance();
    expect(canPlace(instance, { col: 0, row: 0 }, 1)).toBe(false);
    expect(whyCannotPlace(instance, { col: 0, row: 0 }, 1)).toMatch(/developed/);
  });

  it("allows a 1-lot structure in an active block", () => {
    const instance = withBlocks([0, 0]);
    expect(canPlace(instance, { col: 0, row: 0 }, 1)).toBe(true);
  });

  it("refuses a 4-lot structure anchored off a block corner", () => {
    const instance = withBlocks([0, 0], [1, 0]);
    expect(whyCannotPlace(instance, { col: 1, row: 0 }, 4)).toMatch(/block's corner/);
  });

  it("refuses a placement that runs off the edge of the grid", () => {
    const instance = withBlocks([2, 2]);
    expect(whyCannotPlace(instance, { col: 5, row: 5 }, 2)).toMatch(/off the edge/);
  });

  it("refuses a 2-lot structure that would straddle an inactive block", () => {
    // (3,0) is in block (1,0), which is active; (4,0) is in block (2,0), which isn't.
    const instance = withBlocks([1, 0]);
    expect(whyCannotPlace(instance, { col: 3, row: 0 }, 2)).toMatch(/developed/);
  });

  it("refuses a lot that's already built on", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    expect(whyCannotPlace(instance, { col: 0, row: 0 }, 1)).toMatch(/already built/);
  });

  it("refuses a lot that's rubbled", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    instance = reduceToRubble(instance, "p1");
    expect(whyCannotPlace(instance, { col: 0, row: 0 }, 1)).toMatch(/already built/);
  });
});

describe("placeStructure / removePlacement", () => {
  it("records a placement retrievable by id", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    expect(instance.placements.p1).toEqual({
      structureId: "shrine",
      anchor: { col: 0, row: 0 },
      lots: 1,
    });
  });

  it("frees every cell a multi-lot structure occupied", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "castle", { col: 0, row: 0 }, 4);
    instance = removePlacement(instance, "p1");
    expect(instance.placements).toEqual({});
    expect(canPlace(instance, { col: 0, row: 0 }, 4)).toBe(true);
  });
});

describe("reduceToRubble / clearRubble", () => {
  it("turns every occupied cell to rubble and drops the placement", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "tavern-dive", { col: 0, row: 0 }, 2);
    instance = reduceToRubble(instance, "p1");
    expect(instance.placements).toEqual({});
    expect(instance.rubble.sort()).toEqual(["0,0", "1,0"]);
    // Still blocked until explicitly demolished.
    expect(canPlace(instance, { col: 0, row: 0 }, 1)).toBe(false);
  });

  it("clearing rubble makes the lot buildable again", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    instance = reduceToRubble(instance, "p1");
    instance = clearRubble(instance, { col: 0, row: 0 });
    expect(instance.rubble).toEqual([]);
    expect(canPlace(instance, { col: 0, row: 0 }, 1)).toBe(true);
  });

  it("is a no-op for an id that was never placed", () => {
    const instance = withBlocks([0, 0]);
    expect(reduceToRubble(instance, "ghost")).toBe(instance);
  });
});

describe("whyCannotActivateBlock / activateBlock", () => {
  it("allows the very first block with no contiguity check", () => {
    const instance = emptyGridInstance();
    expect(whyCannotActivateBlock(instance, { col: 1, row: 1 }, 4, true)).toBeNull();
  });

  it("requires later blocks to touch an already-active one when contiguity is required", () => {
    const instance = withBlocks([1, 1]);
    expect(whyCannotActivateBlock(instance, { col: 0, row: 0 }, 4, true)).toMatch(/border/); // diagonal only
    expect(whyCannotActivateBlock(instance, { col: 1, row: 0 }, 4, true)).toBeNull(); // orthogonal
  });

  it("does not require contiguity once the settlement is a city", () => {
    const instance = withBlocks([1, 1]);
    expect(whyCannotActivateBlock(instance, { col: 2, row: 2 }, 9, false)).toBeNull();
  });

  it("refuses past the settlement type's block cap", () => {
    const instance = withBlocks([1, 1]);
    expect(whyCannotActivateBlock(instance, { col: 1, row: 0 }, 1, true)).toMatch(/support/);
  });

  it("refuses a block that is already active", () => {
    const instance = withBlocks([1, 1]);
    expect(whyCannotActivateBlock(instance, { col: 1, row: 1 }, 9, false)).toMatch(/already/);
  });

  it("refuses coordinates outside the 3x3 grid", () => {
    const instance = emptyGridInstance();
    expect(whyCannotActivateBlock(instance, { col: 3, row: 0 }, 9, false)).toMatch(/grid/);
  });
});

describe("canDeactivateBlock / deactivateBlock", () => {
  it("allows abandoning an empty active block", () => {
    const instance = withBlocks([0, 0]);
    expect(canDeactivateBlock(instance, { col: 0, row: 0 })).toBe(true);
    expect(deactivateBlock(instance, { col: 0, row: 0 }).activeBlocks).toEqual([]);
  });

  it("refuses to abandon a block with a structure in it", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    expect(canDeactivateBlock(instance, { col: 0, row: 0 })).toBe(false);
  });

  it("refuses to abandon a block with rubble in it", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    instance = reduceToRubble(instance, "p1");
    expect(canDeactivateBlock(instance, { col: 0, row: 0 })).toBe(false);
  });

  it("refuses a block that was never active", () => {
    const instance = emptyGridInstance();
    expect(canDeactivateBlock(instance, { col: 0, row: 0 })).toBe(false);
  });
});

describe("settlementLevel", () => {
  it("is zero for a settlement with no structures", () => {
    expect(settlementLevel([withBlocks([0, 0])])).toBe(0);
  });

  it("counts blocks with at least one structure, not lots or structures", () => {
    let instance = withBlocks([0, 0], [1, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    instance = placeStructure(instance, "p2", "smithy", { col: 1, row: 0 }, 1);
    instance = placeStructure(instance, "p3", "inn", { col: 2, row: 0 }, 1); // same block as p2
    expect(settlementLevel([instance])).toBe(2);
  });

  it("sums across every grid for a metropolis", () => {
    let a = withBlocks([0, 0]);
    a = placeStructure(a, "p1", "shrine", { col: 0, row: 0 }, 1);
    let b = withBlocks([0, 0]);
    b = placeStructure(b, "p1", "shrine", { col: 0, row: 0 }, 1);
    expect(settlementLevel([a, b])).toBe(2);
  });

  it("caps at 20", () => {
    // 9 blocks in one grid can't reach 20 alone; three grids of 9 can.
    const grids = Array.from({ length: 3 }, () => {
      let instance = emptyGridInstance();
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          instance = activateBlock(instance, { col, row });
          instance = placeStructure(instance, `${col},${row}`, "shrine", { col: col * 2, row: row * 2 }, 1);
        }
      }
      return instance;
    });
    expect(settlementLevel(grids)).toBe(20);
  });
});

describe("isOvercrowded", () => {
  const isResidential = (id: string) => id === "houses" || id === "tenement";

  it("is overcrowded once any block has a structure but no residential lots exist", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "shrine", { col: 0, row: 0 }, 1);
    expect(isOvercrowded([instance], isResidential)).toBe(true);
  });

  it("is not overcrowded once residential lots match the built-block count", () => {
    let instance = withBlocks([0, 0]);
    instance = placeStructure(instance, "p1", "houses", { col: 0, row: 0 }, 1);
    expect(isOvercrowded([instance], isResidential)).toBe(false);
  });

  it("counts a multi-lot residential structure by its lot count, not as one", () => {
    let instance = withBlocks([0, 0], [1, 0]);
    // Two built blocks need two residential lots; one 2-lot Tenement covers it.
    instance = placeStructure(instance, "p1", "tenement", { col: 0, row: 0 }, 2);
    instance = placeStructure(instance, "p2", "smithy", { col: 2, row: 0 }, 1);
    expect(isOvercrowded([instance], isResidential)).toBe(false);
  });

  it("is never overcrowded with nothing built at all", () => {
    const instance = withBlocks([0, 0]);
    expect(isOvercrowded([instance], isResidential)).toBe(false);
  });
});
