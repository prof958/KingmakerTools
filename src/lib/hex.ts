/**
 * Pointy-top hex grid maths for the Stolen Lands map sheets.
 *
 * Coordinates are axial (q, r), the usual scheme for hex grids: `r` is the row,
 * and each row is shifted half a column to the right of the one above it, so
 * `q` counts columns along that slanted axis.
 *
 * Pixel positions come from the pitches measured off the printed sheets rather
 * than from a single circumradius. The printed grid is 175 x 152 px; a perfect
 * lattice with rowPitch 152 would want a column pitch of 175.5, so deriving one
 * from the other would drift by half a pixel per column — about 4px across a
 * sheet, enough to see. Keeping both measurements avoids that.
 */

export interface HexGeometry {
  /** Horizontal distance between hex centres in the same row. */
  colPitch: number;
  /** Vertical distance between rows. */
  rowPitch: number;
  /** Pixel position of hex (0, 0)'s centre within the sheet. */
  originX: number;
  originY: number;
  /** Extent of the sheet, in whole hexes. */
  cols: number;
  rows: number;
}

export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Centre of hex (q, r) in sheet pixels. */
export function hexCenter({ q, r }: Axial, geom: HexGeometry): Point {
  return {
    x: geom.originX + geom.colPitch * (q + r / 2),
    y: geom.originY + geom.rowPitch * r,
  };
}

/**
 * The six corners of hex (q, r), starting at the top vertex and going
 * clockwise. The radii come from the pitches so the polygon matches the
 * printed hex exactly: half the column pitch across the flats, and two thirds
 * of the row pitch from centre to vertex.
 */
export function hexCorners(hex: Axial, geom: HexGeometry): Point[] {
  const { x, y } = hexCenter(hex, geom);
  const halfWidth = geom.colPitch / 2;
  const circumradius = (geom.rowPitch * 2) / 3;
  const halfHeight = circumradius / 2;
  return [
    { x, y: y - circumradius },
    { x: x + halfWidth, y: y - halfHeight },
    { x: x + halfWidth, y: y + halfHeight },
    { x, y: y + circumradius },
    { x: x - halfWidth, y: y + halfHeight },
    { x: x - halfWidth, y: y - halfHeight },
  ];
}

/** Corners flattened to the [x, y, x, y, …] list Konva's Line wants. */
export function hexPoints(hex: Axial, geom: HexGeometry): number[] {
  return hexCorners(hex, geom).flatMap((p) => [p.x, p.y]);
}

/** Round fractional axial coordinates to the nearest hex, via cube rounding. */
export function axialRound(q: number, r: number): Axial {
  // Cube coordinates sum to zero, which is what makes the rounding unambiguous:
  // round all three, then fix up whichever moved furthest.
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;

  // Math.round and the negations above both yield -0, which compares equal to 0
  // but is a distinct value to Object.is and to anything keying on it. Adding
  // zero folds it back: -0 + 0 is +0.
  return { q: rq + 0, r: rr + 0 };
}

/** The hex containing a point given in sheet pixels. */
export function hexAt({ x, y }: Point, geom: HexGeometry): Axial {
  const r = (y - geom.originY) / geom.rowPitch;
  const q = (x - geom.originX) / geom.colPitch - r / 2;
  return axialRound(q, r);
}

/** The six axial directions, starting east and going clockwise. */
export const HEX_DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export function hexNeighbors({ q, r }: Axial): Axial[] {
  return HEX_DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

/** Steps between two hexes — the Claim Hex adjacency rule needs this. */
export function hexDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  // In cube space the distance is the largest of the three axis deltas.
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** A stable key for maps and React lists. */
export function hexKey(sheet: number, { q, r }: Axial): string {
  return `${sheet}:${q},${r}`;
}

/**
 * Every hex whose centre falls on the sheet, in reading order.
 *
 * Rows are shifted right by half a column as `r` grows, so the `q` range walks
 * left to keep each row over the sheet rather than sliding off its edge.
 */
export function sheetHexes(geom: HexGeometry): Axial[] {
  const hexes: Axial[] = [];
  for (let r = 0; r < geom.rows; r++) {
    const shift = Math.floor(r / 2);
    for (let q = -shift; q < geom.cols - shift; q++) {
      hexes.push({ q: q + 0, r }); // -shift is -0 on even rows; see axialRound
    }
  }
  return hexes;
}
