import { describe, expect, it } from "vitest";
import {
  axialRound,
  hexAt,
  hexCenter,
  hexCorners,
  hexDistance,
  hexKey,
  hexNeighbors,
  sheetHexes,
  type HexGeometry,
} from "./hex";

/** Sheet 1's measured geometry, from public/kingdom/map/manifest.json. */
const GEOM: HexGeometry = {
  colPitch: 175,
  rowPitch: 152,
  originX: 80,
  originY: 55,
  cols: 7,
  rows: 11,
};

describe("hexCenter", () => {
  it("puts hex (0,0) on the sheet's grid origin", () => {
    expect(hexCenter({ q: 0, r: 0 }, GEOM)).toEqual({ x: 80, y: 55 });
  });

  it("steps one column pitch along q", () => {
    expect(hexCenter({ q: 1, r: 0 }, GEOM)).toEqual({ x: 255, y: 55 });
    expect(hexCenter({ q: -1, r: 0 }, GEOM)).toEqual({ x: -95, y: 55 });
  });

  it("shifts each row half a column to the right", () => {
    expect(hexCenter({ q: 0, r: 1 }, GEOM)).toEqual({ x: 80 + 87.5, y: 207 });
    expect(hexCenter({ q: 0, r: 2 }, GEOM)).toEqual({ x: 80 + 175, y: 359 });
  });
});

describe("hexCorners", () => {
  const corners = hexCorners({ q: 0, r: 0 }, GEOM);

  it("returns six points, top vertex first", () => {
    expect(corners).toHaveLength(6);
    expect(corners[0].x).toBe(80);
    expect(corners[0].y).toBeLessThan(55); // straight up from the centre
  });

  it("spans one column pitch across the flats", () => {
    const xs = corners.map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)) .toBe(GEOM.colPitch);
  });

  it("spans two circumradii point to point", () => {
    const ys = corners.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo((GEOM.rowPitch * 4) / 3, 6);
  });

  it("is centred on the hex", () => {
    const avgX = corners.reduce((sum, c) => sum + c.x, 0) / 6;
    const avgY = corners.reduce((sum, c) => sum + c.y, 0) / 6;
    expect(avgX).toBeCloseTo(80, 6);
    expect(avgY).toBeCloseTo(55, 6);
  });
});

describe("axialRound", () => {
  it("keeps whole coordinates untouched", () => {
    expect(axialRound(2, -3)).toEqual({ q: 2, r: -3 });
  });

  it("keeps the cube constraint when rounding a fraction", () => {
    const { q, r } = axialRound(0.4, 0.4);
    expect(Number.isInteger(q) && Number.isInteger(r)).toBe(true);
  });
});

describe("hexAt", () => {
  it("round-trips every hex centre on the sheet", () => {
    for (const hex of sheetHexes(GEOM)) {
      expect(hexAt(hexCenter(hex, GEOM), GEOM)).toEqual(hex);
    }
  });

  it("stays on the same hex for a point well inside it", () => {
    const centre = hexCenter({ q: 2, r: 3 }, GEOM);
    expect(hexAt({ x: centre.x + 40, y: centre.y + 30 }, GEOM)).toEqual({ q: 2, r: 3 });
    expect(hexAt({ x: centre.x - 40, y: centre.y - 30 }, GEOM)).toEqual({ q: 2, r: 3 });
  });

  it("crosses into the neighbour past the shared edge", () => {
    const centre = hexCenter({ q: 2, r: 3 }, GEOM);
    // Just beyond the right flat, which is half a column pitch away.
    expect(hexAt({ x: centre.x + 100, y: centre.y }, GEOM)).toEqual({ q: 3, r: 3 });
  });
});

describe("hexNeighbors", () => {
  it("returns six distinct hexes, each one step away", () => {
    const origin = { q: 4, r: 2 };
    const neighbors = hexNeighbors(origin);
    expect(neighbors).toHaveLength(6);
    expect(new Set(neighbors.map((n) => hexKey(1, n))).size).toBe(6);
    for (const n of neighbors) {
      expect(hexDistance(origin, n)).toBe(1);
    }
  });

  it("puts each neighbour's centre one pitch away on the sheet", () => {
    const centre = hexCenter({ q: 4, r: 2 }, GEOM);
    for (const n of hexNeighbors({ q: 4, r: 2 })) {
      const p = hexCenter(n, GEOM);
      const distance = Math.hypot(p.x - centre.x, p.y - centre.y);
      // Either straight across the flats, or diagonally to the next row.
      expect(distance).toBeGreaterThan(GEOM.colPitch - 3);
      expect(distance).toBeLessThan(GEOM.colPitch + 3);
    }
  });
});

describe("hexDistance", () => {
  it("is zero to itself and symmetric", () => {
    expect(hexDistance({ q: 1, r: 1 }, { q: 1, r: 1 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(
      hexDistance({ q: 3, r: -1 }, { q: 0, r: 0 }),
    );
  });

  it("counts steps along a straight run", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 3 })).toBe(3);
    // Moving along q and r together is a diagonal, not two separate runs.
    expect(hexDistance({ q: 0, r: 0 }, { q: -2, r: 2 })).toBe(2);
  });
});

describe("sheetHexes", () => {
  const hexes = sheetHexes(GEOM);

  it("covers the sheet's full extent once", () => {
    expect(hexes).toHaveLength(GEOM.cols * GEOM.rows);
    expect(new Set(hexes.map((h) => hexKey(1, h))).size).toBe(hexes.length);
  });

  it("keeps every hex centre over the sheet", () => {
    // Sheet 1 is 1261 x 1636; centres should sit inside it, allowing the half
    // hex that the printed grid runs off each edge.
    for (const hex of hexes) {
      const { x, y } = hexCenter(hex, GEOM);
      expect(x, hexKey(1, hex)).toBeGreaterThan(-GEOM.colPitch);
      expect(x, hexKey(1, hex)).toBeLessThan(1261 + GEOM.colPitch);
      expect(y, hexKey(1, hex)).toBeGreaterThan(-GEOM.rowPitch);
      expect(y, hexKey(1, hex)).toBeLessThan(1636 + GEOM.rowPitch);
    }
  });
});
