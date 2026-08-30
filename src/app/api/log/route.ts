/**
 * Campaign Log API
 *
 * GET  /api/log   — list log entries, newest first.
 *                   Filters: ?category= ?source= ?q= ?limit= (default 200)
 * POST /api/log   — create a manual log entry
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import type { Prisma } from "@/generated/prisma/client";

const CATEGORIES = [
  "PARTY",
  "INVENTORY",
  "CAMPSITE",
  "KINGDOM",
  "SESSION",
  "NOTE",
  "DEATH",
] as const;

export async function GET(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const { searchParams } = new URL(req.url);

    const where: Prisma.LogEntryWhereInput = { campaignId: campaign.id };

    const category = searchParams.get("category");
    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      where.category = category as (typeof CATEGORIES)[number];
    }

    const source = searchParams.get("source");
    if (source === "MANUAL" || source === "SYSTEM") {
      where.source = source;
    }

    const q = searchParams.get("q")?.trim();
    if (q) {
      where.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { details: { contains: q, mode: "insensitive" } },
      ];
    }

    const limitRaw = parseInt(searchParams.get("limit") ?? "", 10);
    const take = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 1000)
      : 200;

    const entries = await prisma.logEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to list log entries:", error);
    return NextResponse.json(
      { error: "Failed to list log entries" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = await req.json();

    const { summary, details, category } = body;

    if (!summary || typeof summary !== "string" || !summary.trim()) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 });
    }

    const cat =
      typeof category === "string" &&
      (CATEGORIES as readonly string[]).includes(category)
        ? (category as (typeof CATEGORIES)[number])
        : "NOTE";

    // Optional in-world date override; falls back to the campaign's current date.
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    const golarionDay = num(body.golarionDay) ?? campaign.golarionDay;
    const golarionMonth = num(body.golarionMonth) ?? campaign.golarionMonth;
    const golarionYear = num(body.golarionYear) ?? campaign.golarionYear;

    const entry = await prisma.logEntry.create({
      data: {
        campaignId: campaign.id,
        category: cat,
        source: "MANUAL",
        summary: summary.trim(),
        details:
          typeof details === "string" && details.trim() ? details.trim() : null,
        golarionDay,
        golarionMonth,
        golarionYear,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create log entry:", error);
    return NextResponse.json(
      { error: "Failed to create log entry" },
      { status: 500 },
    );
  }
}
