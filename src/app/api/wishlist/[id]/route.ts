/**
 * Single Wish List Item API — update / delete
 *
 * PATCH  /api/wishlist/[id]   — mark acquired, update notes
 * DELETE /api/wishlist/[id]   — remove from wish list
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.isAcquired === "boolean") {
      data.isAcquired = body.isAcquired;
    }
    if ("notes" in body) {
      data.notes = body.notes || null;
    }
    if ("characterId" in body) {
      data.characterId = body.characterId || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const item = await prisma.wishListItem.update({
      where: { id },
      data,
      include: { item: true, character: true },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update wish list item:", error);
    return NextResponse.json(
      { error: "Failed to update wish list item" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.wishListItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete wish list item:", error);
    return NextResponse.json(
      { error: "Failed to delete wish list item" },
      { status: 500 }
    );
  }
}
