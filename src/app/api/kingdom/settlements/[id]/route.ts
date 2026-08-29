/**
 * Single Settlement API — metadata and Urban Grid mutations.
 *
 * PATCH  /api/kingdom/settlements/[id]  — rename, retype, set capital/notes,
 *   or mutate the grid via an `action` (see below)
 * DELETE /api/kingdom/settlements/[id]  — abandon the settlement, freeing its hex
 *
 * Every grid action re-derives `level` and `overcrowded` from the resulting
 * grid rather than trusting the client to send them — both are pure
 * functions of the grid's placements, so keeping the stored copies in sync
 * by hand would just be one more way for them to drift.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateKingdom } from "@/lib/kingdom";
import { getKingdomStructure, isResidentialStructure } from "@/lib/pf2e/kingdom-structures";
import { getSettlementType } from "@/lib/pf2e/kingdom";
import {
  activateBlock,
  canDeactivateBlock,
  canPlace,
  clearRubble,
  deactivateBlock,
  emptyGridInstance,
  isOvercrowded,
  placeStructure,
  reduceToRubble,
  removePlacement,
  settlementLevel,
  whyCannotActivateBlock,
  whyCannotPlace,
  type UrbanGridData,
  type BorderSide,
  type BorderType,
} from "@/lib/urban-grid";

type RouteParams = { params: Promise<{ id: string }> };

const SETTLEMENT_TYPES = ["VILLAGE", "TOWN", "CITY", "METROPOLIS"] as const;
const BORDER_TYPES: BorderType[] = ["land", "water", "walled"];
const BORDER_SIDES: BorderSide[] = ["north", "east", "south", "west"];

async function loadOwnedSettlement(kingdomId: string, id: string) {
  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement || settlement.kingdomId !== kingdomId) return null;
  return settlement;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const kingdom = await getOrCreateKingdom();
    const settlement = await loadOwnedSettlement(kingdom.id, id);
    if (!settlement) {
      return NextResponse.json({ error: "Unknown settlement" }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.type === "string" && (SETTLEMENT_TYPES as readonly string[]).includes(body.type)) {
      data.type = body.type;
    }
    if (typeof body.isCapital === "boolean") {
      data.isCapital = body.isCapital;
    }
    if ("notes" in body) {
      data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }

    if (typeof body.action === "string") {
      const grid = settlement.grid as unknown as UrbanGridData;
      const gridIndex = Number.isInteger(body.gridIndex) ? body.gridIndex : 0;
      const instance = grid.grids[gridIndex];
      if (!instance) {
        return NextResponse.json({ error: "Unknown Urban Grid" }, { status: 400 });
      }

      switch (body.action) {
        case "place": {
          const structure = getKingdomStructure(body.structureId);
          if (!structure) {
            return NextResponse.json({ error: "Unknown structure" }, { status: 400 });
          }
          const anchor = { col: Number(body.col), row: Number(body.row) };
          const reason = whyCannotPlace(instance, anchor, structure.lots as 1 | 2 | 4);
          if (reason) {
            return NextResponse.json({ error: reason }, { status: 400 });
          }
          const placementId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          grid.grids[gridIndex] = placeStructure(
            instance,
            placementId,
            structure.id,
            anchor,
            structure.lots as 1 | 2 | 4,
          );
          break;
        }
        case "remove": {
          if (typeof body.placementId !== "string" || !instance.placements[body.placementId]) {
            return NextResponse.json({ error: "Unknown placement" }, { status: 400 });
          }
          grid.grids[gridIndex] = removePlacement(instance, body.placementId);
          break;
        }
        case "rubble": {
          if (typeof body.placementId !== "string" || !instance.placements[body.placementId]) {
            return NextResponse.json({ error: "Unknown placement" }, { status: 400 });
          }
          grid.grids[gridIndex] = reduceToRubble(instance, body.placementId);
          break;
        }
        case "clearRubble": {
          grid.grids[gridIndex] = clearRubble(instance, { col: Number(body.col), row: Number(body.row) });
          break;
        }
        case "activateBlock": {
          const block = { col: Number(body.col), row: Number(body.row) };
          const settlementType = getSettlementType((data.type ?? settlement.type).toString().toLowerCase());
          const maxBlocks = settlementType?.maxBlocks ?? 1;
          const requireContiguous = settlementType?.id === "village" || settlementType?.id === "town";
          const reason = whyCannotActivateBlock(instance, block, maxBlocks, requireContiguous);
          if (reason) {
            return NextResponse.json({ error: reason }, { status: 400 });
          }
          grid.grids[gridIndex] = activateBlock(instance, block);
          break;
        }
        case "deactivateBlock": {
          const block = { col: Number(body.col), row: Number(body.row) };
          if (!canDeactivateBlock(instance, block)) {
            return NextResponse.json(
              { error: "Clear every structure and rubble from the block first" },
              { status: 400 },
            );
          }
          grid.grids[gridIndex] = deactivateBlock(instance, block);
          break;
        }
        case "addGrid": {
          const settlementType = (data.type ?? settlement.type).toString();
          if (settlementType !== "METROPOLIS") {
            return NextResponse.json(
              { error: "Only a metropolis can add another Urban Grid" },
              { status: 400 },
            );
          }
          grid.grids = [...grid.grids, emptyGridInstance()];
          break;
        }
        case "setBorders": {
          if (typeof body.side !== "string" || !BORDER_SIDES.includes(body.side as BorderSide)) {
            return NextResponse.json({ error: "Unknown border side" }, { status: 400 });
          }
          if (typeof body.type !== "string" || !BORDER_TYPES.includes(body.type as BorderType)) {
            return NextResponse.json({ error: "Unknown border type" }, { status: 400 });
          }
          grid.borders = { ...grid.borders, [body.side as BorderSide]: body.type as BorderType };
          break;
        }
        default:
          return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }

      data.grid = grid as object;
      data.level = settlementLevel(grid.grids);
      data.overcrowded = isOvercrowded(grid.grids, isResidentialStructure);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Only one settlement can be the capital at a time.
    if (data.isCapital === true) {
      await prisma.settlement.updateMany({
        where: { kingdomId: kingdom.id, id: { not: id } },
        data: { isCapital: false },
      });
    }

    const updated = await prisma.settlement.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update settlement:", error);
    return NextResponse.json({ error: "Failed to update settlement" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const kingdom = await getOrCreateKingdom();
    const settlement = await loadOwnedSettlement(kingdom.id, id);
    if (!settlement) {
      return NextResponse.json({ error: "Unknown settlement" }, { status: 404 });
    }
    await prisma.settlement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete settlement:", error);
    return NextResponse.json({ error: "Failed to delete settlement" }, { status: 500 });
  }
}
