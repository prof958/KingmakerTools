/**
 * Single Character API — update / delete
 *
 * PATCH  /api/characters/[id]  — update name, STR modifier, companion flag,
 *                                or K.I.A. status (ACTIVE ⇄ FALLEN)
 * DELETE /api/characters/[id]  — remove character
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { describeCharacterChange, logEvent } from "@/lib/log";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const before = await prisma.character.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      emoji?: string | null;
      imageUrl?: string | null;
      strModifier?: number;
      isCompanion?: boolean;
      miscBulk?: number;
      status?: "ACTIVE" | "FALLEN";
      kiaAt?: Date | null;
      kiaNote?: string | null;
    } = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if ("emoji" in body) {
      data.emoji = typeof body.emoji === "string" ? body.emoji : null;
    }
    if ("imageUrl" in body) {
      data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : null;
    }
    if (typeof body.strModifier === "number") {
      data.strModifier = body.strModifier;
    }
    if (typeof body.isCompanion === "boolean") {
      data.isCompanion = body.isCompanion;
    }
    if (typeof body.miscBulk === "number" && body.miscBulk >= 0) {
      data.miscBulk = body.miscBulk;
    }

    // K.I.A. transition. Marking FALLEN stamps the time + optional note;
    // reviving clears both.
    const kiaNote =
      typeof body.kiaNote === "string" && body.kiaNote.trim()
        ? body.kiaNote.trim()
        : null;
    let kiaTransition: "kia" | "revive" | null = null;
    if (body.status === "FALLEN" && before.status !== "FALLEN") {
      data.status = "FALLEN";
      data.kiaAt = new Date();
      data.kiaNote = kiaNote;
      kiaTransition = "kia";
    } else if (body.status === "ACTIVE" && before.status !== "ACTIVE") {
      data.status = "ACTIVE";
      data.kiaAt = null;
      data.kiaNote = null;
      kiaTransition = "revive";
    } else if (kiaTransition === null && kiaNote && before.status === "FALLEN") {
      // Editing the note on an already-fallen character.
      data.kiaNote = kiaNote;
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

    if (kiaTransition === "kia") {
      await logEvent({
        campaignId: character.campaignId,
        category: "DEATH",
        summary: `${character.name} was killed in action`,
        details: kiaNote,
        entityType: "character",
        entityId: character.id,
        entityName: character.name,
      });
    } else if (kiaTransition === "revive") {
      await logEvent({
        campaignId: character.campaignId,
        category: "PARTY",
        summary: `${character.name} was revived and rejoined the party`,
        entityType: "character",
        entityId: character.id,
        entityName: character.name,
      });
    } else {
      const change = describeCharacterChange(before, character);
      if (change) {
        await logEvent({
          campaignId: character.campaignId,
          category: change.category,
          summary: change.summary,
          entityType: "character",
          entityId: character.id,
          entityName: character.name,
        });
      }
    }

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
    const existing = await prisma.character.findUnique({ where: { id } });
    await prisma.character.delete({ where: { id } });

    if (existing) {
      await logEvent({
        campaignId: existing.campaignId,
        category: "PARTY",
        summary: `${existing.name} was removed from the party`,
        entityType: "character",
        entityId: existing.id,
        entityName: existing.name,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete character:", error);
    return NextResponse.json(
      { error: "Failed to delete character" },
      { status: 500 }
    );
  }
}
