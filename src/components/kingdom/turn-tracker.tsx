"use client";

/**
 * TurnTracker — walks a Kingdom turn through its four phases (KPG 42-44),
 * rolling and logging as it goes. Numeric consequences are written through
 * `onPatchKingdom` (the same callback every other Kingdom tab already uses),
 * so this file never talks to the kingdom's own fields except by computing
 * the next absolute value from the current one — `PATCH /api/kingdom` sets
 * fields, it doesn't increment them.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Loader2,
  Play,
  ScrollText,
  Swords,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KINGDOM_TURN_PHASES, advancementTable, resolveRuin } from "@/lib/pf2e/kingdom";
import { activitiesForPhase, getKingdomActivity } from "@/lib/pf2e/kingdom-activities";
import type { Commodity } from "@/lib/pf2e/kingdom";
import {
  ActivityCheckStep,
  AdjustUnrestStep,
  LeadershipStep,
  MilestoneStep,
  NoteStep,
  PayConsumptionStep,
  RandomEventStep,
  ResourceCollectionStep,
  type KingdomTab,
} from "./turn-steps";
import type { CharacterLite, HexData, KingdomData, SettlementData, TurnData } from "./types";

const PHASE_ICON: Record<string, typeof Wrench> = {
  upkeep: Wrench,
  commerce: Coins,
  activity: Swords,
  event: ScrollText,
};

/**
 * Turn-level events (started, completed) are logged against this pseudo-step
 * so they live in the same `phaseData.steps` structure as everything else and
 * show up in the journal. It is deliberately not one of KINGDOM_TURN_PHASES'
 * steps, so it never counts toward the N/15 progress.
 */
const LIFECYCLE_KEY = "turn.lifecycle";

const STEP_NAMES: Record<string, { phase: string; step: string }> = Object.fromEntries(
  KINGDOM_TURN_PHASES.flatMap((phase) =>
    phase.steps.map((step) => [
      `${phase.id}.${step.id}`,
      { phase: phase.name, step: step.name },
    ]),
  ),
);

function stepNameFor(stepKey: string): string {
  return STEP_NAMES[stepKey]?.step ?? "Turn";
}

/** Free-text prompts for the steps this app has no mechanics for. */
const NOTE_PLACEHOLDERS: Record<string, string> = {
  "commerce.approve-expenses":
    "e.g. Improved the Ruler's Lifestyle to Fine; tapped the treasury for 40 gp.",
  "commerce.tap-commodities": "e.g. Sold 2 Lumber and 1 Ore to top up RP before the Activity phase.",
  "commerce.manage-trade": "e.g. Renewed the Restov grain agreement; +1 Food per turn.",
  "event.resolve-event": "e.g. Bandit raid on Oleg's — Quelled with a Warfare check, lost 1 Food.",
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function TurnTracker({
  kingdom,
  characters,
  hexes,
  settlements,
  turns,
  onPatchKingdom,
  onRefresh,
  onNavigate,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  hexes: HexData[];
  settlements: SettlementData[];
  turns: TurnData[];
  onPatchKingdom: (patch: Record<string, unknown>) => void;
  onRefresh: () => void;
  onNavigate?: (tab: KingdomTab) => void;
}) {
  const router = useRouter();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  const current = turns.find((t) => t.status === "in_progress") ?? null;
  const isFirstTurn = current?.turnNumber === 1;

  function refresh() {
    router.refresh();
  }

  async function startTurn() {
    setBusy(true);
    try {
      const turn = await api("/api/kingdom/turns", "POST");
      // The turn didn't exist a moment ago, so this can't go through
      // `patchStep` (which writes to `current`) — use the id POST handed back.
      await api(`/api/kingdom/turns/${turn.id}`, "PATCH", {
        stepKey: LIFECYCLE_KEY,
        appendLog: {
          label: `Turn ${turn.turnNumber} started`,
          detail: `Kingdom at Level ${kingdom.level}, Size ${kingdom.size}, ${kingdom.rp} RP, Unrest ${kingdom.unrest}.`,
        },
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patchStep(stepKey: string, body: Record<string, unknown>) {
    if (!current) return;
    setBusy(true);
    try {
      await api(`/api/kingdom/turns/${current.id}`, "PATCH", { stepKey, ...body });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  /**
   * `silent` is for the steps that apply their own, far more informative log
   * entry and then mark themselves done — without it every such step would
   * write two entries, the useful one and a bare "marked done" right after.
   */
  function markDone(stepKey: string, done: boolean, silent = false) {
    if (silent) {
      void patchStep(stepKey, { done });
      return;
    }
    void patchStep(stepKey, {
      done,
      appendLog: { label: `${stepNameFor(stepKey)} — ${done ? "marked done" : "reopened"}` },
    });
  }

  function log(stepKey: string, label: string, detail?: string) {
    void patchStep(stepKey, { appendLog: { label, detail } });
  }

  /**
   * Logging an outcome *is* doing the step, so it ticks the step off in the
   * same request — no separate "mark done" click after every activity check or
   * note. `done` is set alongside the entry rather than through `markDone` so
   * it doesn't also append a redundant "marked done" line.
   */
  function logAndComplete(stepKey: string, label: string, detail?: string) {
    void patchStep(stepKey, { done: true, appendLog: { label, detail } });
  }

  function removeLog(stepKey: string, index: number) {
    void patchStep(stepKey, { removeLogAt: index });
  }

  async function completeTurn() {
    if (!current) return;
    const doneCount = Object.values(current.phaseData.steps).filter((s) => s.done).length;
    const totalSteps = KINGDOM_TURN_PHASES.reduce((n, p) => n + p.steps.length, 0);
    setBusy(true);
    try {
      await api(`/api/kingdom/turns/${current.id}`, "PATCH", {
        stepKey: LIFECYCLE_KEY,
        appendLog: {
          label: `Turn ${current.turnNumber} completed`,
          detail: `${doneCount}/${totalSteps} steps done. Kingdom ended the turn at Level ${kingdom.level}, Size ${kingdom.size}, ${kingdom.rp} RP, Unrest ${kingdom.unrest}.`,
        },
      });
      await api(`/api/kingdom/turns/${current.id}`, "PATCH", {
        status: "complete",
        summary: `${doneCount}/${totalSteps} steps completed`,
      });
      setPhaseIndex(0);
      setConfirmingComplete(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!current) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            No turn in progress. Starting one begins Turn {kingdom.currentTurn + 1}.
          </p>
          <Button onClick={startTurn} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />} Start Turn{" "}
            {kingdom.currentTurn + 1}
          </Button>
        </div>
        {turns.length > 0 && <TurnHistory turns={turns} />}
      </div>
    );
  }

  function applyAdjustUnrest(
    delta: number,
    ruinDeltas: Partial<Record<string, number>>,
    detail: string,
  ) {
    const patch: Record<string, unknown> = {
      unrest: Math.max(0, kingdom.unrest + delta),
    };
    const ruinNotes: string[] = [];
    for (const [ruinId, add] of Object.entries(ruinDeltas)) {
      if (!add) continue;
      const pointsField = `${ruinId}Points` as keyof KingdomData;
      const threshField = `${ruinId}Threshold` as keyof KingdomData;
      const penField = `${ruinId}Penalty` as keyof KingdomData;
      const resolved = resolveRuin(
        (kingdom[pointsField] as number) + add,
        kingdom[threshField] as number,
        kingdom[penField] as number,
      );
      patch[pointsField] = resolved.points;
      patch[penField] = resolved.penalty;
      ruinNotes.push(
        `${ruinId} +${add} (now ${resolved.points} pts, penalty ${resolved.penalty})`,
      );
    }
    onPatchKingdom(patch);
    log(
      "upkeep.adjust-unrest",
      `Adjust Unrest: ${kingdom.unrest} → ${patch.unrest}`,
      [detail, ruinNotes.length ? `Ruin: ${ruinNotes.join(", ")}` : null]
        .filter(Boolean)
        .join(" · "),
    );
    markDone("upkeep.adjust-unrest", true, true);
  }

  function applyResourceCollection(
    rp: number,
    commodities: Record<Commodity, number>,
    detail: string,
  ) {
    onPatchKingdom({ rp, ...commodities });
    log("upkeep.resource-collection", `Resource Collection: ${rp} RP`, detail);
    markDone("upkeep.resource-collection", true, true);
  }

  function applyPayConsumption(
    foodSpent: number,
    rpSpent: number,
    unrestGained: number,
    detail: string,
  ) {
    onPatchKingdom({
      food: Math.max(0, kingdom.food - foodSpent),
      rp: Math.max(0, kingdom.rp - rpSpent),
      unrest: kingdom.unrest + unrestGained,
    });
    const parts = [`${foodSpent} Food`];
    if (rpSpent) parts.push(`${rpSpent} RP`);
    if (unrestGained) parts.push(`+${unrestGained} Unrest`);
    log("upkeep.pay-consumption", `Pay Consumption: ${parts.join(", ")}`, detail);
    markDone("upkeep.pay-consumption", true, true);
  }

  function levelUp() {
    if (kingdom.level >= 20) return;
    const nextLevel = kingdom.level + 1;
    onPatchKingdom({ level: nextLevel });
    log(
      "event.milestone-check",
      `Kingdom leveled up to ${nextLevel}`,
      `Unlocks: ${advancementTable(kingdom.ruleset)[kingdom.level].features.join(" · ")}`,
    );
    markDone("event.milestone-check", true, true);
  }

  const phase = KINGDOM_TURN_PHASES[phaseIndex];
  const doneSteps = new Set(
    Object.entries(current.phaseData.steps)
      .filter(([, v]) => v.done)
      .map(([k]) => k),
  );
  const totalSteps = KINGDOM_TURN_PHASES.reduce((n, p) => n + p.steps.length, 0);

  const allDone = doneSteps.size === totalSteps;
  const phaseStepKeys = phase.steps.map((s) => `${phase.id}.${s.id}`);
  const phaseDone = phaseStepKeys.filter((k) => doneSteps.has(k)).length;
  const phaseComplete = phaseDone === phase.steps.length;
  const nextPhase = KINGDOM_TURN_PHASES[phaseIndex + 1];

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-xl border bg-card/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="font-heading font-bold">Turn {current.turnNumber}</span>
            <Badge variant="outline">
              {doneSteps.size} / {totalSteps} steps
            </Badge>
          </div>
          {/* Completing is one-way — the API refuses further edits to a
              closed turn — so an incomplete one asks first rather than
              silently discarding the steps still open. */}
          {confirmingComplete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400">
                {totalSteps - doneSteps.size} steps still open — close the turn anyway?
              </span>
              <Button size="sm" variant="outline" onClick={() => setConfirmingComplete(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={completeTurn} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Yes, complete
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => (allDone ? completeTurn() : setConfirmingComplete(true))}
              disabled={busy}
              variant={allDone ? "default" : "outline"}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Complete Turn
            </Button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${totalSteps === 0 ? 0 : (doneSteps.size / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {KINGDOM_TURN_PHASES.map((p, i) => {
            const stepKeys = p.steps.map((s) => `${p.id}.${s.id}`);
            const done = stepKeys.filter((k) => doneSteps.has(k)).length;
            const complete = done === p.steps.length;
            const Icon = PHASE_ICON[p.id] ?? Wrench;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhaseIndex(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  phaseIndex === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : complete
                      ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/10"
                      : "hover:border-primary/50 hover:bg-accent",
                )}
              >
                <Icon className="size-3.5" />
                {p.name}{" "}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    phaseIndex === i ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {done}/{p.steps.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {phase.steps.map((step) => {
          const stepKey = `${phase.id}.${step.id}`;
          const record = current.phaseData.steps[stepKey];
          const done = record?.done ?? false;
          const lastLog = record?.log.length ? record.log[record.log.length - 1].label : undefined;

          let body: React.ReactNode;
          switch (step.id) {
            case "assign-leadership":
              body = (
                <LeadershipStep
                  kingdom={kingdom}
                  characters={characters}
                  done={done}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  onLog={(label) => log(stepKey, label)}
                  onRefresh={onRefresh}
                  lastLog={lastLog}
                />
              );
              break;
            case "milestone-check":
              body = (
                <MilestoneStep
                  kingdom={kingdom}
                  done={done}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  onLevelUp={levelUp}
                  onNavigate={onNavigate}
                  lastLog={lastLog}
                />
              );
              break;
            case "adjust-unrest":
              body = (
                <AdjustUnrestStep
                  kingdom={kingdom}
                  settlements={settlements}
                  isFirstTurn={isFirstTurn}
                  done={done}
                  onApply={applyAdjustUnrest}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  onNavigate={onNavigate}
                  lastLog={lastLog}
                />
              );
              break;
            case "resource-collection":
              body = (
                <ResourceCollectionStep
                  kingdom={kingdom}
                  hexes={hexes}
                  done={done}
                  onApply={applyResourceCollection}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  lastLog={lastLog}
                />
              );
              break;
            case "pay-consumption":
              body = (
                <PayConsumptionStep
                  kingdom={kingdom}
                  settlements={settlements}
                  hexes={hexes}
                  isFirstTurn={isFirstTurn}
                  done={done}
                  onApply={applyPayConsumption}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  lastLog={lastLog}
                />
              );
              break;
            case "check-event":
              body = (
                <RandomEventStep
                  done={done}
                  onLog={(label, detail) => logAndComplete(stepKey, label, detail)}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  lastLog={lastLog}
                />
              );
              break;
            case "collect-taxes": {
              const activity = getKingdomActivity("collect-taxes");
              body = (
                <ActivityCheckStep
                  title={step.name}
                  hint={step.hint}
                  kingdom={kingdom}
                  activities={activity ? [activity] : []}
                  done={done}
                  onLog={(label, detail) => logAndComplete(stepKey, label, detail)}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  onNavigate={onNavigate}
                  lastLog={lastLog}
                />
              );
              break;
            }
            case "leadership-activities":
            case "region-activities":
            case "civic-activities":
            case "army-activities": {
              const phaseKey = step.id.split("-")[0] as "leadership" | "region" | "civic" | "army";
              const activities = activitiesForPhase(phaseKey).filter(
                (a) => a.id !== "build-structure",
              );
              body = (
                <ActivityCheckStep
                  title={step.name}
                  hint={step.hint}
                  kingdom={kingdom}
                  activities={activities}
                  done={done}
                  onLog={(label, detail) => logAndComplete(stepKey, label, detail)}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  onNavigate={onNavigate}
                  lastLog={lastLog}
                />
              );
              break;
            }
            default:
              body = (
                <NoteStep
                  title={step.name}
                  hint={step.hint}
                  placeholder={
                    NOTE_PLACEHOLDERS[stepKey] ?? "What happened? This goes into the turn log."
                  }
                  done={done}
                  onLog={(label) => logAndComplete(stepKey, label)}
                  onMarkDone={(d) => markDone(stepKey, d)}
                  lastLog={lastLog}
                />
              );
          }

          return (
            <div key={step.id}>
              {body}
              {record && record.log.length > 0 && (
                <ul className="ml-4 mt-1.5 space-y-2 border-l-2 border-border pl-3">
                  {record.log.map((entry, i) => (
                    <li key={i} className="group flex items-start gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-muted-foreground">{entry.label}</p>
                        {entry.detail && (
                          <p className="mt-0.5 leading-relaxed text-muted-foreground/80">{entry.detail}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        title="Remove this log entry"
                        onClick={() => removeLog(stepKey, i)}
                        disabled={busy}
                        className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Sits after the steps, not up by the phase rail: you reach it by
          working down the phase, and this is where you actually are when the
          last step is finished. */}
      {phaseComplete && nextPhase && (
        <div>
          <Button size="sm" onClick={() => setPhaseIndex(phaseIndex + 1)}>
            Continue to {nextPhase.name} <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}

      <TurnLogPanel current={current} open={logOpen} onOpenChange={setLogOpen} />

      {turns.length > 1 && <TurnHistory turns={turns.filter((t) => t.id !== current.id)} />}
    </div>
  );
}

/**
 * Flatten one turn's whole journal into chronological order.
 *
 * It walks the stored `phaseData.steps` keys rather than KINGDOM_TURN_PHASES,
 * so entries under the `turn.lifecycle` pseudo-step (turn started / completed)
 * are included alongside the real steps instead of being silently dropped.
 */
function journalFor(turn: TurnData) {
  return Object.entries(turn.phaseData.steps)
    .flatMap(([stepKey, record]) =>
      (record?.log ?? []).map((entry) => ({
        stepKey,
        phaseName: STEP_NAMES[stepKey]?.phase ?? "Turn",
        stepName: STEP_NAMES[stepKey]?.step ?? "Lifecycle",
        entry,
      })),
    )
    .sort((a, b) => a.entry.at.localeCompare(b.entry.at));
}

function LogEntryRow({
  phaseName,
  stepName,
  entry,
}: {
  phaseName: string;
  stepName: string;
  entry: { at: string; label: string; detail?: string };
}) {
  return (
    <div className="border-l-2 border-border pl-3 text-xs">
      <p className="text-muted-foreground/70">
        {phaseName} · {stepName} ·{" "}
        {new Date(entry.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="mt-0.5 font-medium text-foreground">{entry.label}</p>
      {entry.detail && (
        <p className="mt-0.5 leading-relaxed text-muted-foreground">{entry.detail}</p>
      )}
    </div>
  );
}

/**
 * Every logged entry for the current turn in one chronological journal —
 * separate from the inline per-step log lines above, which are easy to miss
 * once a step collapses. This is the direct answer to "can we see the logs".
 */
function TurnLogPanel({
  current,
  open,
  onOpenChange,
}: {
  current: TurnData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entries = journalFor(current);

  return (
    <div className="rounded-xl border bg-card/50">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <ScrollText className="size-4 text-muted-foreground" />
          Turn Log
          <Badge variant="outline">{entries.length}</Badge>
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-2">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing logged yet this turn.</p>
          ) : (
            entries.map((row, i) => <LogEntryRow key={i} {...row} />)
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Past turns. The chips used to be dead text; each one now opens that turn's
 * full journal, which is the only way to read back what happened in a turn
 * once it's closed.
 */
function TurnHistory({ turns }: { turns: TurnData[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (turns.length === 0) return null;

  const opened = turns.find((t) => t.id === openId) ?? null;
  const entries = opened ? journalFor(opened) : [];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Past turns</p>
      <div className="flex flex-wrap gap-1.5">
        {turns.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOpenId(openId === t.id ? null : t.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs transition-colors",
              openId === t.id ? "border-primary bg-primary/10" : "bg-card/50 hover:bg-accent",
            )}
          >
            Turn {t.turnNumber}
            {t.summary && <span className="text-muted-foreground"> — {t.summary}</span>}
          </button>
        ))}
      </div>
      {opened && (
        <div className="space-y-3 rounded-xl border bg-card/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Turn {opened.turnNumber} log · {entries.length} entries
          </p>
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing was logged during this turn.</p>
          ) : (
            entries.map((row, i) => <LogEntryRow key={i} {...row} />)
          )}
        </div>
      )}
    </div>
  );
}
