"use client";

/**
 * DeploymentBoard — the Dashboard card: every companion, their state, where
 * they are, and how long until they are back.
 *
 * Read-only on purpose. It answers "is anyone waiting on me?" at a glance and
 * hands you off to the Party page to actually do something about it.
 */

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight, MapPin, Users } from "lucide-react";
import {
  COMPANION_STATE_META,
  compareBoardEntries,
  deriveCompanionState,
  describeTiming,
  type CompanionState,
} from "@/lib/companions";
import { CompanionAvatar, StateBadge, toneOf } from "./shared";
import type { Assignment, CompanionLite, GolarionToday } from "./types";

export function DeploymentBoard({
  companions,
  assignments,
  today,
}: {
  companions: CompanionLite[];
  /** Active assignments only — resolved ones say nothing about where anyone is. */
  assignments: Assignment[];
  today: GolarionToday;
}) {
  const rows = useMemo(() => {
    const byCharacter = new Map<string, Assignment>();
    for (const a of assignments) {
      for (const m of a.members) byCharacter.set(m.characterId, a);
    }

    return companions
      .map((c) => {
        const assignment = byCharacter.get(c.id) ?? null;
        return {
          companion: c,
          assignment,
          state: deriveCompanionState(assignment, today, c.status === "FALLEN"),
        };
      })
      .sort((a, b) =>
        compareBoardEntries(
          { name: a.companion.name, state: a.state, assignment: a.assignment },
          { name: b.companion.name, state: b.state, assignment: b.assignment },
          today,
        ),
      );
  }, [companions, assignments, today]);

  const attention = rows.filter((r) => COMPANION_STATE_META[r.state].needsAttention);
  const out = rows.filter(
    (r) => r.state !== "WITH_PARTY" && r.state !== "FALLEN",
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Companions
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? "No companions on the roster"
              : attention.length > 0
                ? `${out} deployed · ${attention.length} need${
                    attention.length === 1 ? "s" : ""
                  } your attention`
                : out > 0
                  ? `${out} deployed · all on schedule`
                  : "All at your side"}
          </p>
        </div>
        <Link
          href="/party"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Command
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Mark a party member as a companion, then send them out from the{" "}
            <Link href="/party" className="underline underline-offset-2">
              Party
            </Link>{" "}
            page.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(({ companion, assignment, state }) => (
              <BoardRow
                key={companion.id}
                companion={companion}
                state={state}
                where={assignment?.locationName ?? null}
                timing={describeTiming(assignment, today)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BoardRow({
  companion,
  state,
  where,
  timing,
}: {
  companion: CompanionLite;
  state: CompanionState;
  where: string | null;
  timing: string | null;
}) {
  const tone = toneOf(state);
  const meta = COMPANION_STATE_META[state];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        meta.needsAttention ? tone.row : "border-transparent",
      )}
    >
      <CompanionAvatar companion={companion} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{companion.name}</span>
          <StateBadge state={state} />
        </div>
        {where && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{where}</span>
          </span>
        )}
      </div>

      {timing && (
        <span
          className={cn(
            "shrink-0 text-right text-xs font-semibold tabular-nums",
            tone.text,
          )}
        >
          {timing}
        </span>
      )}
    </div>
  );
}
