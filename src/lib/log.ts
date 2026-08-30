/**
 * Campaign log — records a chronological trail of what happens in a campaign.
 *
 * `logEvent` is the single write path used by API routes to auto-record changes;
 * it snapshots the in-world (Golarion) date and never throws, so a logging
 * failure can't break the request that triggered it.
 *
 * The pure `describe*` change helpers live in `./log-format` and are re-exported
 * here for convenience.
 */

import { prisma } from "@/lib/db";
import type {
  LogCategory,
  LogSource,
  Prisma,
} from "@/generated/prisma/client";

export {
  describeCharacterChange,
  describeInventoryChange,
  describeCampsiteChange,
  type DescribedChange,
} from "./log-format";

export interface LogEventInput {
  campaignId: string;
  category: LogCategory;
  summary: string;
  details?: string | null;
  /** Defaults to SYSTEM — every route call site is an auto-record. */
  source?: LogSource;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Write one log entry. Best-effort: any failure is swallowed with a
 * `console.error` so callers never need to guard it.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { golarionDay: true, golarionMonth: true, golarionYear: true },
    });

    await prisma.logEntry.create({
      data: {
        campaignId: input.campaignId,
        category: input.category,
        source: input.source ?? "SYSTEM",
        summary: input.summary,
        details: input.details ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityName: input.entityName ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        golarionDay: campaign?.golarionDay ?? null,
        golarionMonth: campaign?.golarionMonth ?? null,
        golarionYear: campaign?.golarionYear ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write log entry:", error);
  }
}
