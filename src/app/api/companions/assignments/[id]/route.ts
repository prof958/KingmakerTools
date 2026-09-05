/**
 * Single Companion Assignment API — edit, resolve, or delete.
 *
 * PATCH  /api/companions/assignments/[id]  — edit details, swap members, or resolve
 * DELETE /api/companions/assignments/[id]  — remove the assignment entirely
 *
 * Resolving is deliberately manual: the calendar moving on its own never
 * decides how a quest went, it only changes what the board *says* about a
 * still-active one (see `deriveCompanionState` in `lib/companions.ts`).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { ASSIGNMENT_KIND_META } from "@/lib/companions";
import {
  assignmentInclude,
  isAssignmentKind,
  describeResolution,
  findAlreadyDeployed,
  isAssignmentStatus,
  isDateError,
  joinNames,
  readDate,
  validateMemberIds,
} from "@/lib/companion-api";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const before = await prisma.companionAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!before) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // The kind decides whether this assignment can carry a location and a
    // return date at all, so it has to be resolved before either is written.
    const kind = isAssignmentKind(body.kind) ? body.kind : before.kind;
    if (kind !== before.kind) data.kind = kind;
    const shape = ASSIGNMENT_KIND_META[kind];

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }

    if ("description" in body) {
      data.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
    }

    // Switching to a kind that has nowhere to be (recovering, missing) clears
    // the place even when the caller did not mention it — otherwise the card
    // would keep claiming they are at the Fangberry Caves.
    if ("locationName" in body || !shape.hasLocation) {
      data.locationName =
        shape.hasLocation &&
        typeof body.locationName === "string" &&
        body.locationName.trim()
          ? body.locationName.trim()
          : null;
    }

    if ("hexId" in body || !shape.hasLocation) {
      data.hexId =
        shape.hasLocation && typeof body.hexId === "string" && body.hexId
          ? body.hexId
          : null;
    }

    if ("settlementId" in body || !shape.hasLocation) {
      data.settlementId =
        shape.hasLocation &&
        typeof body.settlementId === "string" &&
        body.settlementId
          ? body.settlementId
          : null;
    }

    const depart = readDate(body, "depart");
    if (isDateError(depart)) {
      return NextResponse.json({ error: depart.error }, { status: 400 });
    }
    if (depart) {
      data.departDay = depart.day;
      data.departMonth = depart.month;
      data.departYear = depart.year;
    } else if (depart === null) {
      return NextResponse.json(
        { error: "An assignment always has a departure date" },
        { status: 400 },
      );
    }

    const expectedReturn = readDate(body, "return");
    if (isDateError(expectedReturn)) {
      return NextResponse.json({ error: expectedReturn.error }, { status: 400 });
    }
    if (expectedReturn !== undefined || !shape.hasReturnDate) {
      const keep = shape.hasReturnDate ? expectedReturn : null;
      data.returnDay = keep?.day ?? null;
      data.returnMonth = keep?.month ?? null;
      data.returnYear = keep?.year ?? null;
    }

    if ("outcome" in body) {
      data.outcome =
        typeof body.outcome === "string" && body.outcome.trim()
          ? body.outcome.trim()
          : null;
    }

    // Resolving stamps the in-world date it happened on; re-opening clears it,
    // so a reopened assignment does not keep claiming it ended.
    let resolvedTo: string | null = null;
    if (isAssignmentStatus(body.status) && body.status !== before.status) {
      data.status = body.status;
      resolvedTo = body.status;

      if (body.status === "ACTIVE") {
        data.resolvedDay = null;
        data.resolvedMonth = null;
        data.resolvedYear = null;
      } else {
        const campaign = await prisma.campaign.findUnique({
          where: { id: before.campaignId },
          select: { golarionDay: true, golarionMonth: true, golarionYear: true },
        });
        data.resolvedDay = campaign?.golarionDay ?? null;
        data.resolvedMonth = campaign?.golarionMonth ?? null;
        data.resolvedYear = campaign?.golarionYear ?? null;
      }
    }

    // Re-opening a resolved assignment has to respect the same one-place-at-a-time
    // rule a fresh one does, or a companion could end up on two active rows.
    if (resolvedTo === "ACTIVE") {
      const clashing = await findAlreadyDeployed(
        before.members.map((m) => m.characterId),
        before.id,
      );
      if (clashing.length > 0) {
        return NextResponse.json(
          {
            error: `${joinNames(clashing)} ${
              clashing.length === 1 ? "is" : "are"
            } on another active assignment.`,
          },
          { status: 409 },
        );
      }
    }

    let memberIds: string[] | null = null;
    if ("characterIds" in body) {
      const members = await validateMemberIds(before.campaignId, body.characterIds);
      if ("error" in members) {
        return NextResponse.json({ error: members.error }, { status: 400 });
      }

      const nextStatus = (data.status as string | undefined) ?? before.status;
      if (nextStatus === "ACTIVE") {
        const clashing = await findAlreadyDeployed(members.ids, before.id);
        if (clashing.length > 0) {
          return NextResponse.json(
            {
              error: `${joinNames(clashing)} ${
                clashing.length === 1 ? "is" : "are"
              } already on an active assignment.`,
            },
            { status: 409 },
          );
        }
      }
      memberIds = members.ids;
    }

    if (Object.keys(data).length === 0 && memberIds === null) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // The member list is replaced wholesale rather than diffed — the join row
    // carries no state of its own, so there is nothing to preserve.
    const assignment = await prisma.$transaction(async (tx) => {
      if (memberIds !== null) {
        await tx.companionAssignmentMember.deleteMany({
          where: { assignmentId: before.id },
        });
        await tx.companionAssignmentMember.createMany({
          data: memberIds.map((characterId) => ({
            assignmentId: before.id,
            characterId,
          })),
        });
      }

      return tx.companionAssignment.update({
        where: { id: before.id },
        data,
        include: assignmentInclude,
      });
    });

    if (resolvedTo) {
      await logEvent({
        campaignId: assignment.campaignId,
        category: "PARTY",
        summary: describeResolution(
          resolvedTo as "ACTIVE" | "COMPLETED" | "FAILED" | "RECALLED",
          assignment.kind,
          assignment.members.map((m) => m.character.name),
          assignment.title,
        ),
        details: assignment.outcome,
        entityType: "companion_assignment",
        entityId: assignment.id,
        entityName: assignment.title,
      });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Failed to update companion assignment:", error);
    return NextResponse.json(
      { error: "Failed to update companion assignment" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.companionAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await prisma.companionAssignment.delete({ where: { id } });

    await logEvent({
      campaignId: existing.campaignId,
      category: "PARTY",
      summary: `Removed the assignment "${existing.title}" (${joinNames(
        existing.members.map((m) => m.character.name),
      )})`,
      entityType: "companion_assignment",
      entityId: existing.id,
      entityName: existing.title,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete companion assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete companion assignment" },
      { status: 500 },
    );
  }
}
