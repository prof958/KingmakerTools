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

    const data: { name?: string; emoji?: string | null; imageUrl?: string | null; strModifier?: number; isCompanion?: boolean; miscBulk?: number } = {};
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
    
    // First, merge their wallet into the party treasury to avoid orphaned null wallets
    const character = await prisma.character.findUnique({ where: { id }, include: { wallets: true } });
    if (character && character.wallets.length > 0) {
      const charWallet = character.wallets[0];
      const treasury = await prisma.wallet.findFirst({
        where: { campaignId: character.campaignId, characterId: null },
        orderBy: { id: "asc" }
      });
      
      if (treasury) {
        await prisma.wallet.update({
          where: { id: treasury.id },
          data: {
            cp: treasury.cp + charWallet.cp,
            sp: treasury.sp + charWallet.sp,
            gp: treasury.gp + charWallet.gp,
            pp: treasury.pp + charWallet.pp,
          }
        });
        await prisma.wallet.delete({ where: { id: charWallet.id } });
      }
    }
    
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
