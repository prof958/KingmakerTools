"use client";

/**
 * CompanionCommand — the Party page section for sending companions out and
 * seeing where everyone is.
 *
 * Everything on screen is derived from the assignments plus the campaign's
 * current Golarion date, so moving the date on the Dashboard moves this board
 * with no writes of its own. Only resolving an assignment — saying how it
 * actually went — touches the database.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  MapPin,
  Pencil,
  Scroll,
  Swords,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { formatGolarionDate } from "@/lib/pf2e/calendar";
import {
  ASSIGNMENT_KIND_META,
  COMPANION_STATE_META,
  compareBoardEntries,
  deriveCompanionState,
  describeDateRange,
  describeTiming,
  progressFraction,
  type AssignmentStatus,
  type CompanionState,
} from "@/lib/companions";
import { AssignmentDialog, type AssignmentDraft } from "./assignment-dialog";
import { CompanionAvatar, JourneyRail, KIND_ICON, StateBadge, toneOf } from "./shared";
import type {
  Assignment,
  CompanionLite,
  GolarionToday,
  LocationOption,
} from "./types";

export function CompanionCommand({
  companions,
  assignments,
  locations,
  today,
}: {
  companions: CompanionLite[];
  assignments: Assignment[];
  locations: LocationOption[];
  today: GolarionToday;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Resolve flow — one dialog for "returned" / "failed" / "recalled".
  const [resolving, setResolving] = useState<{
    assignment: Assignment;
    status: AssignmentStatus;
  } | null>(null);
  const [outcome, setOutcome] = useState("");

  const active = useMemo(
    () => assignments.filter((a) => a.status === "ACTIVE"),
    [assignments],
  );
  const resolved = useMemo(
    () => assignments.filter((a) => a.status !== "ACTIVE"),
    [assignments],
  );

  /** characterId -> their one active assignment. */
  const deployed = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of active) {
      for (const m of a.members) map.set(m.characterId, a);
    }
    return map;
  }, [active]);

  const atHand = useMemo(
    () =>
      companions
        .filter((c) => c.status !== "FALLEN" && !deployed.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [companions, deployed],
  );

  const sortedActive = useMemo(() => {
    const stateOf = (a: Assignment) => deriveCompanionState(a, today);
    return [...active].sort((x, y) =>
      compareBoardEntries(
        { name: x.title, state: stateOf(x), assignment: x },
        { name: y.title, state: stateOf(y), assignment: y },
        today,
      ),
    );
  }, [active, today]);

  const tally = useMemo(() => {
    const counts: Partial<Record<CompanionState, number>> = {};
    for (const c of companions) {
      if (c.status === "FALLEN") continue;
      const state = deriveCompanionState(deployed.get(c.id) ?? null, today);
      counts[state] = (counts[state] ?? 0) + 1;
    }
    return counts;
  }, [companions, deployed, today]);

  const send = useCallback(
    async (url: string, method: string, body?: unknown) => {
      setSaving(true);
      try {
        const res = await fetch(url, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (res.ok) {
          router.refresh();
          return true;
        }
        // The API explains conflicts in plain language ("Amiri is already on an
        // active assignment"), so surface its own wording rather than a generic
        // failure the player cannot act on.
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Couldn't save that. Try again.");
        return false;
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  async function submitDraft(draft: AssignmentDraft) {
    const ok = editing
      ? await send(`/api/companions/assignments/${editing.id}`, "PATCH", draft)
      : await send("/api/companions/assignments", "POST", draft);
    if (ok) {
      setDialogOpen(false);
      setEditing(null);
    }
  }

  async function confirmResolve() {
    if (!resolving) return;
    const ok = await send(
      `/api/companions/assignments/${resolving.assignment.id}`,
      "PATCH",
      { status: resolving.status, outcome: outcome.trim() || null },
    );
    if (ok) {
      setResolving(null);
      setOutcome("");
    }
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(a: Assignment) {
    setEditing(a);
    setDialogOpen(true);
  }

  // The dialog may pick from anyone free, plus whoever is already on the
  // assignment being edited — otherwise editing would silently drop its own crew.
  const selectable = useMemo(() => {
    if (!editing) return atHand;
    const own = editing.members.map((m) => m.character);
    const seen = new Set(atHand.map((c) => c.id));
    return [...atHand, ...own.filter((c) => !seen.has(c.id))].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [atHand, editing]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Companion Command
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Who is out, where, and when they are due back.
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={companions.length === 0}>
          <Scroll className="mr-1 h-4 w-4" />
          Send out
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {companions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No companions yet. Mark a party member as a companion below, then send
            them somewhere.
          </p>
        ) : (
          <>
            <Tally counts={tally} />

            {/* Out in the world */}
            <section className="space-y-3">
              <SectionHeading
                label={`Out in the world (${sortedActive.length})`}
              />
              {sortedActive.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Everyone is at your side. Quiet day in the Stolen Lands.
                </p>
              ) : (
                <div className="space-y-3">
                  {sortedActive.map((a) => (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      today={today}
                      saving={saving}
                      onEdit={() => openEdit(a)}
                      onResolve={(status) => {
                        setResolving({ assignment: a, status });
                        setOutcome("");
                      }}
                      onDelete={() =>
                        send(`/api/companions/assignments/${a.id}`, "DELETE")
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {/* At hand */}
            <section className="space-y-3">
              <SectionHeading label={`At your side (${atHand.length})`} />
              {atHand.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every companion is out on an assignment.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {atHand.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm"
                    >
                      <CompanionAvatar companion={c} size="sm" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* History */}
            {resolved.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex w-full items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      !showHistory && "-rotate-90",
                    )}
                  />
                  Ledger ({resolved.length})
                  <div className="flex-1 border-t border-border" />
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {resolved.map((a) => (
                      <ResolvedRow
                        key={a.id}
                        assignment={a}
                        saving={saving}
                        onReopen={() =>
                          send(`/api/companions/assignments/${a.id}`, "PATCH", {
                            status: "ACTIVE",
                          })
                        }
                        onDelete={() =>
                          send(`/api/companions/assignments/${a.id}`, "DELETE")
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </CardContent>

      <AssignmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onCancel={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        today={today}
        available={selectable}
        locations={locations}
        existing={editing}
        saving={saving}
        onSubmit={submitDraft}
      />

      <Dialog
        open={resolving !== null}
        onOpenChange={(open) => {
          if (!open) setResolving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{RESOLVE_TITLE[resolving?.status ?? "COMPLETED"]}</DialogTitle>
            <DialogDescription>
              {resolving
                ? `${resolving.assignment.members
                    .map((m) => m.character.name)
                    .join(", ")} — "${resolving.assignment.title}"`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What happened? (optional)"
                rows={3}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded on {formatGolarionDate(today.day, today.month, today.year)}{" "}
                and written to the campaign log.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setResolving(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmResolve} disabled={saving}>
                {saving ? "Saving…" : "Record it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const RESOLVE_TITLE: Record<AssignmentStatus, string> = {
  COMPLETED: "They made it back",
  FAILED: "It went badly",
  RECALLED: "Called back early",
  ACTIVE: "Back out again",
};

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

/** Counts by state — the "at a glance" strip above the board. */
function Tally({ counts }: { counts: Partial<Record<CompanionState, number>> }) {
  const shown = (
    ["AWAY", "DUE_BACK", "OVERDUE", "STATIONED", "RECOVERING", "READY", "MISSING", "WITH_PARTY"] as CompanionState[]
  ).filter((s) => (counts[s] ?? 0) > 0);

  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((state) => {
        const tone = toneOf(state);
        return (
          <div
            key={state}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5",
              tone.row,
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
            <span className="text-lg font-bold leading-none tabular-nums">
              {counts[state]}
            </span>
            <span className="text-xs text-muted-foreground">
              {COMPANION_STATE_META[state].label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AssignmentCard({
  assignment: a,
  today,
  saving,
  onEdit,
  onResolve,
  onDelete,
}: {
  assignment: Assignment;
  today: GolarionToday;
  saving: boolean;
  onEdit: () => void;
  onResolve: (status: AssignmentStatus) => void;
  onDelete: () => void;
}) {
  const state = deriveCompanionState(a, today);
  const tone = toneOf(state);
  const Icon = KIND_ICON[a.kind];
  const timing = describeTiming(a, today);

  return (
    <div className={cn("relative overflow-hidden rounded-lg border", tone.row)}>
      {/* Accent spine — the card's status colour, readable before any text */}
      <div className={cn("absolute inset-y-0 left-0 w-1", tone.accent)} />

      <div className="space-y-3 p-4 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className={cn("h-4 w-4 shrink-0", tone.text)} />
              <span className="font-semibold break-words">{a.title}</span>
              <StateBadge state={state} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {ASSIGNMENT_KIND_META[a.kind].label}
              </Badge>
              {a.locationName && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {a.locationName}
                </span>
              )}
              <span>{describeDateRange(a)}</span>
            </div>
          </div>

          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit} title="Edit orders">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={saving}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Crew */}
        <div className="flex flex-wrap items-center gap-2">
          {a.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 rounded-full bg-background/70 py-0.5 pl-0.5 pr-2 text-xs ring-1 ring-border"
            >
              <CompanionAvatar companion={m.character} size="sm" />
              <span className="font-medium">{m.character.name}</span>
            </div>
          ))}
        </div>

        {a.description && (
          <p className="text-sm text-muted-foreground">{a.description}</p>
        )}

        {/* Journey */}
        <div className="space-y-1.5">
          <JourneyRail fraction={progressFraction(a, today)} state={state} />
          {timing && (
            <p className={cn("text-sm font-semibold", tone.text)}>{timing}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onResolve("COMPLETED")} disabled={saving}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {a.kind === "RECOVERING" ? "Recovered" : "Returned"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve("FAILED")}
            disabled={saving}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Failed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onResolve("RECALLED")}
            disabled={saving}
          >
            <Undo2 className="mr-1 h-4 w-4" />
            Recall
          </Button>
        </div>
      </div>
    </div>
  );
}

const RESOLVED_TONE: Record<Exclude<AssignmentStatus, "ACTIVE">, string> = {
  COMPLETED: "text-emerald-600 dark:text-emerald-400",
  FAILED: "text-red-600 dark:text-red-400",
  RECALLED: "text-muted-foreground",
};

const RESOLVED_LABEL: Record<Exclude<AssignmentStatus, "ACTIVE">, string> = {
  COMPLETED: "Succeeded",
  FAILED: "Failed",
  RECALLED: "Recalled",
};

function ResolvedRow({
  assignment: a,
  saving,
  onReopen,
  onDelete,
}: {
  assignment: Assignment;
  saving: boolean;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const status = a.status as Exclude<AssignmentStatus, "ACTIVE">;

  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{a.title}</span>
          <span className={cn("text-xs font-semibold", RESOLVED_TONE[status])}>
            {RESOLVED_LABEL[status]}
          </span>
          {a.resolvedDay !== null && a.resolvedMonth !== null && a.resolvedYear !== null && (
            <span className="text-xs text-muted-foreground">
              {formatGolarionDate(a.resolvedDay, a.resolvedMonth, a.resolvedYear)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {a.members.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <CompanionAvatar companion={m.character} size="sm" />
              {m.character.name}
            </span>
          ))}
        </div>
        {a.outcome && <p className="text-xs text-muted-foreground">{a.outcome}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onReopen}
          disabled={saving}
          title="Send them back out"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={saving}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
