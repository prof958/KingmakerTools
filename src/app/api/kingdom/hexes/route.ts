/**
 * Kingdom Hex API — the Stolen Lands map.
 *
 * GET   /api/kingdom/hexes           — every hex the party has touched
 * PATCH /api/kingdom/hexes           — upsert one hex by (sheet, q, r)
 *
 * Hexes are stored lazily: a row appears the first time a hex is reconnoitered,
 * claimed, or annotated, so an untouched map costs nothing. The kingdom's Size
 * is recounted from the claimed hexes on every write rather than tracked by
 * hand — Size drives the Size table, Control DC, and resource dice, so letting
 * it drift from the map would quietly corrupt every check.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { MAP_SHEETS, getMapSheet } from "@/lib/map-sheets";
import { sheetHexes } from "@/lib/hex";

const HEX_STATES = ["UNCLAIMED", "RECONNOITERED", "CLAIMED"] as const;
type HexState = (typeof HEX_STATES)[number];

const WORK_SITES = ["farmland", "lumber", "mine", "quarry"] as const;

const TERRAINS = [
  "plains", "forest", "hills", "mountains", "swamp", "lake", "wetlands", "desert",
] as const;

const FEATURES = [
  "landmark", "refuge", "resource", "bridge", "ruins", "freehold", "structure",
] as const;

/** Hexes whose centre actually falls on the given sheet. */
function isOnSheet(sheet: number, q: number, r: number): boolean {
  const geometry = getMapSheet(sheet)?.hex;
  if (!geometry) return false;
  return sheetHexes(geometry).some((h) => h.q === q && h.r === r);
}

export async function GET() {
  try {
    const kingdom = await getOrCreateKingdom();
    const hexes = await prisma.hex.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: [{ sheet: "asc" }, { r: "asc" }, { q: "asc" }],
    });
    return NextResponse.json(hexes);
  } catch (error) {
    console.error("Failed to load hexes:", error);
    return NextResponse.json({ error: "Failed to load hexes" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();

    const sheet = Number(body.sheet);
    const q = Number(body.q);
    const r = Number(body.r);

    if (!MAP_SHEETS.some((s) => s.id === sheet) || !Number.isInteger(q) || !Number.isInteger(r)) {
      return NextResponse.json({ error: "Unknown hex" }, { status: 400 });
    }
    if (!isOnSheet(sheet, q, r)) {
      return NextResponse.json({ error: "Hex is not on that sheet" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.state === "string" && (HEX_STATES as readonly string[]).includes(body.state)) {
      const state = body.state as HexState;
      data.state = state;
      // Claiming implies the hex was scouted; the two flags are never
      // meaningfully out of step, so keep them consistent here rather than
      // relying on every caller to remember.
      if (state !== "UNCLAIMED") data.reconnoitered = true;
      if (state === "UNCLAIMED") data.reconnoitered = false;
    }

    if (typeof body.reconnoitered === "boolean") {
      data.reconnoitered = body.reconnoitered;
    }

    if (typeof body.terrain === "string" && (TERRAINS as readonly string[]).includes(body.terrain)) {
      data.terrain = body.terrain;
    }

    for (const flag of ["hasRoads", "fortified"] as const) {
      if (typeof body[flag] === "boolean") data[flag] = body[flag];
    }

    if ("workSite" in body) {
      const site = body.workSite;
      data.workSite =
        typeof site === "string" && (WORK_SITES as readonly string[]).includes(site) ? site : null;
    }

    if (Array.isArray(body.features)) {
      data.features = body.features.filter(
        (f: unknown): f is string =>
          typeof f === "string" && (FEATURES as readonly string[]).includes(f),
      );
    }

    for (const field of ["label", "notes"] as const) {
      if (field in body) {
        data[field] =
          typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const hex = await prisma.hex.upsert({
      where: { kingdomId_sheet_q_r: { kingdomId: kingdom.id, sheet, q, r } },
      create: { kingdomId: kingdom.id, sheet, q, r, ...data },
      update: data,
    });

    const claimed = await prisma.hex.count({
      where: { kingdomId: kingdom.id, state: "CLAIMED" },
    });
    // A kingdom always occupies at least its capital hex, so Size floors at 1.
    const size = Math.max(1, claimed);
    if (size !== kingdom.size) {
      await prisma.kingdom.update({ where: { id: kingdom.id }, data: { size } });
    }

    return NextResponse.json({ hex, size });
  } catch (error) {
    console.error("Failed to update hex:", error);
    return NextResponse.json({ error: "Failed to update hex" }, { status: 500 });
  }
}
