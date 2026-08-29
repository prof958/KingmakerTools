/**
 * Kingdom Settlements API — create and list.
 *
 * GET  /api/kingdom/settlements  — every settlement, Urban Grid included
 * POST /api/kingdom/settlements  — found a new settlement on a claimed hex
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import {
  activateBlock,
  emptyUrbanGrid,
  isOvercrowded,
  settlementLevel,
  type UrbanGridData,
} from "@/lib/urban-grid";
import { isResidentialStructure } from "@/lib/pf2e/kingdom-structures";

export async function GET() {
  try {
    const kingdom = await getOrCreateKingdom();
    const settlements = await prisma.settlement.findMany({
      where: { kingdomId: kingdom.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(settlements);
  } catch (error) {
    console.error("Failed to load settlements:", error);
    return NextResponse.json({ error: "Failed to load settlements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const kingdom = await getOrCreateKingdom();
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name the settlement" }, { status: 400 });
    }

    if (typeof body.hexId !== "string" || !body.hexId) {
      return NextResponse.json({ error: "Choose a hex to found it on" }, { status: 400 });
    }
    const hex = await prisma.hex.findUnique({
      where: { id: body.hexId },
      include: { settlement: true },
    });
    if (!hex || hex.kingdomId !== kingdom.id) {
      return NextResponse.json({ error: "Unknown hex" }, { status: 400 });
    }
    if (hex.state !== "CLAIMED") {
      return NextResponse.json({ error: "The hex must be claimed first" }, { status: 400 });
    }
    if (hex.settlement) {
      return NextResponse.json({ error: "That hex already has a settlement" }, { status: 400 });
    }

    // Every settlement needs somewhere to start building — RAW has the player
    // pick any one block for the founding village (KPG 47); the centre block
    // is a reasonable default since it leaves room to expand in every
    // direction, and it's still just a starting point the player can abandon
    // (once nothing is built on it) in favour of another block.
    const grid: UrbanGridData = emptyUrbanGrid();
    grid.grids[0] = activateBlock(grid.grids[0], { col: 1, row: 1 });

    // Set explicitly rather than trusting the schema's default(1): a founded
    // settlement with nothing built yet is level 0 by the same rule
    // (`settlementLevel`) every later mutation recomputes from, and letting
    // the stored value start out disagreeing with that rule — even briefly —
    // is exactly the kind of drift this app has been careful to avoid
    // elsewhere (kingdom Size, hex state, ...).
    const settlement = await prisma.settlement.create({
      data: {
        kingdomId: kingdom.id,
        hexId: hex.id,
        name,
        grid: grid as object,
        level: settlementLevel(grid.grids),
        overcrowded: isOvercrowded(grid.grids, isResidentialStructure),
      },
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("Failed to found settlement:", error);
    return NextResponse.json({ error: "Failed to found settlement" }, { status: 500 });
  }
}
