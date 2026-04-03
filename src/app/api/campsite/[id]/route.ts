/**
 * Single Campsite Layout API
 *
 * PATCH  /api/campsite/[id]  — update name, elements, isActive, watch shifts, activities
 * DELETE /api/campsite/[id]  — remove layout (cascades shifts & activities)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const campaign = await getOrCreateCampaign();

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    if ("elements" in body) {
      data.elements = body.elements;
    }

    if (typeof body.isActive === "boolean") {
      // Deactivate others if setting this one active
      if (body.isActive) {
        await prisma.campsiteLayout.updateMany({
          where: { campaignId: campaign.id, id: { not: id } },
          data: { isActive: false },
        });
      }
      data.isActive = body.isActive;
    }

    // Bulk-replace watch shifts if provided
    if (Array.isArray(body.watchShifts)) {
      await prisma.watchShift.deleteMany({
        where: { campsiteLayoutId: id },
      });

      if (body.watchShifts.length > 0) {
        await prisma.watchShift.createMany({
          data: body.watchShifts.map(
            (s: { shiftNumber: number; characterIds: string[] }) => ({
              campsiteLayoutId: id,
              shiftNumber: s.shiftNumber,
              characterIds: s.characterIds,
            }),
          ),
        });
      }
    }

    // Bulk-replace camping activities if provided
    if (Array.isArray(body.campingActivities)) {
      await prisma.campingActivity.deleteMany({
        where: { campsiteLayoutId: id },
      });

      if (body.campingActivities.length > 0) {
        await prisma.campingActivity.createMany({
          data: body.campingActivities.map(
            (a: {
              characterId: string;
              activityType: string;
              skill?: string;
              result?: string;
            }) => ({
              campsiteLayoutId: id,
              characterId: a.characterId,
              activityType: a.activityType,
              skill: a.skill || null,
              result: a.result || null,
            }),
          ),
        });
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.campsiteLayout.update({
        where: { id },
        data,
      });
    }

    // Return the full updated layout
    const layout = await prisma.campsiteLayout.findUnique({
      where: { id },
      include: {
        watchShifts: { orderBy: { shiftNumber: "asc" } },
        campingActivities: {
          include: { character: true },
        },
      },
    });

    return NextResponse.json(layout);
  } catch (error) {
    console.error("Failed to update campsite layout:", error);
    return NextResponse.json(
      { error: "Failed to update campsite layout" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.campsiteLayout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete campsite layout:", error);
    return NextResponse.json(
      { error: "Failed to delete campsite layout" },
      { status: 500 },
    );
  }
}
