/**
 * Items Catalog API — browse and create item definitions
 *
 * GET  /api/items   — list all items (with optional search)
 * POST /api/items   — create a custom item
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (category) {
      where.category = category;
    }

    const items = await prisma.item.findMany({
      where,
      orderBy: [{ category: "asc" }, { level: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to list items:", error);
    return NextResponse.json(
      { error: "Failed to list items" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        bulkValue: body.bulkValue ?? 0,
        isBulkLight: body.isBulkLight ?? false,
        level: body.level ?? 0,
        rarity: body.rarity ?? "COMMON",
        traits: body.traits ?? [],
        category: body.category ?? "GEAR",
        valueCp: body.valueCp ?? 0,
        isInvestable: body.isInvestable ?? false,
        containerCapacity: body.containerCapacity ?? null,
        containerBulkReduction: body.containerBulkReduction ?? null,
        description: body.description ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create item:", error);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }
}
