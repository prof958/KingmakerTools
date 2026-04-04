/**
 * Single Character API — update / delete
 *
 * PATCH  /api/characters/[id]  — update name or STR modifier
 * DELETE /api/characters/[id]  — remove character
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: { name?: string; strModifier?: number; isCompanion?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.strModifier === "number") {
      data.strModifier = body.strModifier;
    }
    if (typeof body.isCompanion === "boolean") {
      data.isCompanion = body.isCompanion;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const character = await prisma.character.update({
      where: { id },
      data,
    });

    return NextResponse.json(character);
  } catch (error) {
    console.error("Failed to update character:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.character.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete character:", error);
    return NextResponse.json(
      { error: "Failed to delete character" },
      { status: 500 }
    );
  }
}
