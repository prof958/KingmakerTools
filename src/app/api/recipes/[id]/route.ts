/**
 * Single Recipe API — update / delete
 *
 * PATCH  /api/recipes/[id]  — update name, ingredients, dc, effects, discovered
 * DELETE /api/recipes/[id]  — remove recipe
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    if ("ingredients" in body) {
      data.ingredients = body.ingredients?.trim() || null;
    }

    if ("dc" in body) {
      data.dc = typeof body.dc === "number" ? body.dc : null;
    }

    if ("effectsSuccess" in body) {
      data.effectsSuccess = body.effectsSuccess?.trim() || null;
    }

    if ("effectsFail" in body) {
      data.effectsFail = body.effectsFail?.trim() || null;
    }

    if (typeof body.isDiscovered === "boolean") {
      data.isDiscovered = body.isDiscovered;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const recipe = await prisma.recipe.update({
      where: { id },
      data,
    });

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Failed to update recipe:", error);
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.recipe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete recipe:", error);
    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 },
    );
  }
}
