/**
 * Companion Assignments API — where each companion is and what they are doing.
 *
 * GET  /api/companions/assignments        — list assignments (?status=ACTIVE to filter)
 * POST /api/companions/assignments        — send companions out on one
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCampaign } from "@/lib/campaign";
import { logEvent } from "@/lib/log";
import { ASSIGNMENT_KIND_META } from "@/lib/companions";
import {
  assignmentInclude,
  describeDeparture,
  findAlreadyDeployed,
  isAssignmentKind,
  isAssignmentStatus,
  isDateError,
  readDate,
  validateMemberIds,
} from "@/lib/companion-api";

export async function GET(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const status = req.nextUrl.searchParams.get("status");

    const assignments = await prisma.companionAssignment.findMany({
      where: {
        campaignId: campaign.id,
        ...(isAssignmentStatus(status) ? { status } : {}),
      },
      include: assignmentInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to list companion assignments:", error);
    return NextResponse.json(
      { error: "Failed to list companion assignments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const campaign = await getOrCreateCampaign();
    const body = (await req.json()) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const kind = isAssignmentKind(body.kind) ? body.kind : "QUEST";

    const members = await validateMemberIds(campaign.id, body.characterIds);
    if ("error" in members) {
      return NextResponse.json({ error: members.error }, { status: 400 });
    }

    const clashing = await findAlreadyDeployed(members.ids);
    if (clashing.length > 0) {
      return NextResponse.json(
        {
          error: `${clashing.join(", ")} ${
            clashing.length === 1 ? "is" : "are"
          } already on an active assignment. Resolve it first.`,
        },
        { status: 409 },
      );
    }

    // Departure defaults to today's in-world date — the common case is sending
    // someone off during play, and the calendar already knows what day it is.
    const depart = readDate(body, "depart");
    if (isDateError(depart)) {
      return NextResponse.json({ error: depart.error }, { status: 400 });
    }
    const departParts = depart ?? {
      day: campaign.golarionDay,
      month: campaign.golarionMonth,
      year: campaign.golarionYear,
    };

    const expectedReturn = readDate(body, "return");
    if (isDateError(expectedReturn)) {
      return NextResponse.json({ error: expectedReturn.error }, { status: 400 });
    }
    // Kinds that are open-ended by definition never carry a return date, even
    // if a caller sends one.
    const returnParts = ASSIGNMENT_KIND_META[kind].hasReturnDate
      ? (expectedReturn ?? null)
      : null;

    const locationName =
      typeof body.locationName === "string" && body.locationName.trim()
        ? body.locationName.trim()
        : null;

    const assignment = await prisma.companionAssignment.create({
      data: {
        campaignId: campaign.id,
        kind,
        title,
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        locationName,
        hexId: typeof body.hexId === "string" && body.hexId ? body.hexId : null,
        settlementId:
          typeof body.settlementId === "string" && body.settlementId
            ? body.settlementId
            : null,
        departDay: departParts.day,
        departMonth: departParts.month,
        departYear: departParts.year,
        returnDay: returnParts?.day ?? null,
        returnMonth: returnParts?.month ?? null,
        returnYear: returnParts?.year ?? null,
        members: {
          create: members.ids.map((characterId) => ({ characterId })),
        },
      },
      include: assignmentInclude,
    });

    await logEvent({
      campaignId: campaign.id,
      category: "PARTY",
      summary: describeDeparture(
        kind,
        assignment.members.map((m) => m.character.name),
        title,
        locationName,
      ),
      details: assignment.description,
      entityType: "companion_assignment",
      entityId: assignment.id,
      entityName: title,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("Failed to create companion assignment:", error);
    return NextResponse.json(
      { error: "Failed to create companion assignment" },
      { status: 500 },
    );
  }
}
