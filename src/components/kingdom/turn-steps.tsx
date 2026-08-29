"use client";

/**
 * Turn-step renderers — one component per shape of Upkeep-phase step, plus
 * the generic activity-check step shared by Collect Taxes and every
 * Leadership/Region/Civic/Army activity attempt.
 *
 * Every roll happens client-side (`lib/dice.ts`) and lands in an editable
 * field before anything is written — the "roll, then confirm" rule the
 * turn tracker exists to satisfy. Applying a step writes kingdom stats
 * through the same `onPatchKingdom` the rest of the Kingdom tab already
 * uses, and separately logs what happened to the turn's own record via
 * `onLog`, so this file never has to know how either is persisted.
 *
 * `DiceReveal` (dice-reveal.tsx) owns the tumble-then-land animation; this
 * file only decides *when* a roll counts as good/bad/critical for that
 * animation's flourish, which is domain knowledge DiceReveal shouldn't have.
 */

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, NotebookPen, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LEADERSHIP_ROLES,
  RUINS,
  UNREST_RUIN_THRESHOLD,
  advancementTable,
  controlDC,
  getKingdomSkill,
  investedStatusBonus,
  resourceDiceCount,
  sizeBracket,
  skillModifier,
  untrainedImprovisation,
  unrestStatusPenalty,
  vacancyPenalty,
  type KingdomAbility,
  type ProficiencyRank,
} from "@/lib/pf2e/kingdom";
import { COMMODITY_LABELS, type Commodity } from "@/lib/pf2e/kingdom";
import type { KingdomActivityDef } from "@/lib/pf2e/kingdom-activities";
import {
  applyStorageCap,
  commodityGains,
  consumptionRpCost,
  kingdomConsumption,
  unrestAdjustment,
  type WorkSiteHex,
} from "@/lib/pf2e/kingdom-turn";
import {
  DEGREE_LABELS,
  degreeOfSuccess,
  rollCheck,
  rollDice,
  rollFlatCheck,
  type CheckResult,
  type Degree,
} from "@/lib/dice";
import { DiceReveal, type DiceTone } from "./dice-reveal";
import { LeadershipRoster } from "./leadership-roster";
import type { CharacterLite, HexData, KingdomData, SettlementData } from "./types";

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Human-readable breakdown of where a check's modifier came from, skipping the
 * terms that are zero — so a roll can be audited at the table without anyone
 * re-deriving it from the Overview and Leadership tabs.
 */
function modifierParts(b: {
  abilityMod: number;
  proficiencyBonus: number;
  statusBonus: number;
  itemBonus: number;
  circumstanceBonus: number;
  ruinPenalty: number;
  vacancyPenalty: number;
  otherPenalty: number;
}): string[] {
  return [
    [b.abilityMod, "ability"],
    [b.proficiencyBonus, "proficiency"],
    [b.statusBonus, "invested"],
    [b.itemBonus, "item"],
    [b.circumstanceBonus, "circumstance"],
    [-b.ruinPenalty, "Ruin"],
    [-b.vacancyPenalty, "vacancy"],
    [-b.otherPenalty, "Unrest"],
  ]
    .filter(([value]) => value !== 0)
    .map(([value, label]) => `${fmtMod(value as number)} ${label}`);
}

/** Tab ids matching KingdomShell's <TabsTrigger value=...>. */
export type KingdomTab = "overview" | "turn" | "map" | "settlements" | "skills" | "leadership" | "founding";

/**
 * Sends the player to the tab a step's outcome actually requires. Several
 * outcomes ("choose which hex to abandon", "place the structure") can only be
 * carried out elsewhere in the Kingdom section, and telling someone to go to
 * the Map without taking them there is a needless step.
 */
export function GoToTab({
  tab,
  label,
  onNavigate,
}: {
  tab: KingdomTab;
  label: string;
  onNavigate?: (tab: KingdomTab) => void;
}) {
  if (!onNavigate) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => onNavigate(tab)}>
      {label} <ArrowRight className="size-3.5" />
    </Button>
  );
}

const DEGREE_TONE: Record<Degree, DiceTone> = {
  criticalSuccess: "critical-good",
  success: "good",
  failure: "bad",
  criticalFailure: "critical-bad",
};

function DegreeBadge({ degree }: { degree: Degree }) {
  const tone = DEGREE_TONE[degree];
  const cls: Record<DiceTone, string> = {
    "critical-good": "bg-amber-500/15 text-amber-400",
    good: "bg-emerald-500/15 text-emerald-400",
    bad: "bg-orange-500/15 text-orange-400",
    "critical-bad": "bg-destructive/15 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", cls[tone])}>
      {DEGREE_LABELS[degree]}
    </span>
  );
}

/**
 * Every step card. Once `done`, it collapses to a one-line summary (title,
 * a checkmark, the last thing that happened) so a finished turn doesn't
 * stay a wall of expanded forms — click it to re-open. A step still in
 * progress always stays open.
 */
export function StepShell({
  title,
  hint,
  done,
  onMarkDone,
  lastLog,
  children,
}: {
  title: string;
  hint: string;
  done: boolean;
  onMarkDone?: (done: boolean) => void;
  lastLog?: string;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(!done);
  // A step that just got marked done collapses on its own, and one that's
  // reopened for editing (done -> not done) expands on its own too. Adjusting
  // state during render (React's own recommended pattern for "derive state
  // from a prop change") rather than in an effect avoids an extra committed
  // render on every done/undone toggle.
  const [prevDone, setPrevDone] = useState(done);
  if (done !== prevDone) {
    setPrevDone(done);
    setExpanded(!done);
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        done ? "border-emerald-500/25 bg-emerald-500/[0.03]" : "bg-card/50",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
            {title}
            {done && <span className="text-emerald-400">✓</span>}
          </h3>
          {expanded ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : (
            lastLog && <p className="truncate text-xs text-muted-foreground">{lastLog}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onMarkDone && expanded && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onMarkDone(!done);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onMarkDone(!done);
                }
              }}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                done
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-input hover:bg-accent",
              )}
            >
              {done ? "Done" : "Mark done"}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Approve Expenses, Tap Commodities, Manage Trade Agreements, Event Resolution.
 *
 * These four have no mechanics this app models (there is no Lifestyle,
 * Treasury or Trade Agreement data in the schema), so rather than a bare
 * checkbox that records nothing, they take a free-text note. Whatever the
 * table actually decided gets written into the turn log alongside the rolled
 * steps, which is the only way those decisions survive the turn at all.
 */
export function NoteStep({
  title,
  hint,
  placeholder,
  done,
  onLog,
  onMarkDone,
  lastLog,
}: {
  title: string;
  hint: string;
  placeholder: string;
  done: boolean;
  onLog: (label: string) => void;
  onMarkDone: (done: boolean) => void;
  lastLog?: string;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();

  return (
    <StepShell title={title} hint={hint} done={done} onMarkDone={onMarkDone} lastLog={lastLog}>
      <Textarea
        className="min-h-16 text-sm"
        placeholder={placeholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        size="sm"
        disabled={!trimmed}
        onClick={() => {
          onLog(`${title}: ${trimmed}`);
          setNote("");
        }}
      >
        <NotebookPen /> Log note
      </Button>
    </StepShell>
  );
}

/** Assign Leadership Roles — embeds the same roster editor as the Leadership tab, so re-picking invested roles doesn't require leaving the Turn tab. */
export function LeadershipStep({
  kingdom,
  characters,
  done,
  onMarkDone,
  onLog,
  onRefresh,
  lastLog,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  done: boolean;
  onMarkDone: (done: boolean) => void;
  onLog: (label: string) => void;
  onRefresh: () => void;
  lastLog?: string;
}) {
  return (
    <StepShell
      title="Assign Leadership Roles"
      hint="Re-select invested roles; apply vacancy penalties."
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      <LeadershipRoster
        kingdom={kingdom}
        characters={characters}
        onRefresh={onRefresh}
        onChange={onLog}
        bare
      />
    </StepShell>
  );
}

/** Milestone Check — the kingdom levels by GM-set milestone, not XP; this lets the GM bump it right here instead of switching to Overview. */
export function MilestoneStep({
  kingdom,
  done,
  onMarkDone,
  onLevelUp,
  onNavigate,
  lastLog,
}: {
  kingdom: KingdomData;
  done: boolean;
  onMarkDone: (done: boolean) => void;
  onLevelUp: () => void;
  onNavigate?: (tab: KingdomTab) => void;
  lastLog?: string;
}) {
  const atMax = kingdom.level >= 20;
  const next = !atMax ? advancementTable(kingdom.ruleset)[kingdom.level] : null;

  return (
    <StepShell
      title="Milestone Check"
      hint="This table levels the kingdom by milestone, not XP — review progress and bump the level if it's earned."
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      <p className="text-sm">
        Currently <span className="font-semibold tabular-nums">Level {kingdom.level}</span>
      </p>
      {next && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-primary">Level {kingdom.level + 1} unlocks:</span>{" "}
          {next.features.join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={atMax} onClick={onLevelUp}>
          <TrendingUp /> Level up to {Math.min(20, kingdom.level + 1)}
        </Button>
        {/* A level-up usually owes the player a choice that lives on another
            tab — a skill increase, or ability boosts at 5/10/15/20. */}
        {next?.skillIncrease && (
          <GoToTab tab="skills" label="Pick the skill increase" onNavigate={onNavigate} />
        )}
        {next && next.abilityBoosts > 0 && (
          <GoToTab tab="overview" label={`Apply ${next.abilityBoosts} boosts`} onNavigate={onNavigate} />
        )}
      </div>
    </StepShell>
  );
}

export function AdjustUnrestStep({
  kingdom,
  settlements,
  isFirstTurn,
  done,
  onApply,
  onMarkDone,
  onNavigate,
  lastLog,
}: {
  kingdom: KingdomData;
  settlements: SettlementData[];
  isFirstTurn: boolean;
  done: boolean;
  onApply: (
    unrestDelta: number,
    ruinDeltas: Partial<Record<string, number>>,
    detail: string,
  ) => void;
  onMarkDone: (done: boolean) => void;
  onNavigate?: (tab: KingdomTab) => void;
  lastLog?: string;
}) {
  const overcrowded = settlements.filter((s) => s.overcrowded).length;
  const baseDelta = unrestAdjustment({
    isFirstTurn,
    overcrowdedSettlements: overcrowded,
    atWar: kingdom.atWar,
  });
  const [otherDelta, setOtherDelta] = useState(0);
  const [ruinTotal, setRuinTotal] = useState<number | null>(null);
  const [ruinSplit, setRuinSplit] = useState<Record<string, number>>({});
  const [hexLossPassed, setHexLossPassed] = useState<boolean | null>(null);

  const delta = baseDelta + otherDelta;
  const projected = Math.max(0, kingdom.unrest + delta);
  const needsRuinRoll = !isFirstTurn && projected >= UNREST_RUIN_THRESHOLD;
  const splitTotal = Object.values(ruinSplit).reduce((sum, v) => sum + v, 0);

  return (
    <StepShell
      title="Adjust Unrest"
      hint="+1 per Overcrowded settlement, +1 if at war; 1d10 Ruin and a hex-loss check once Unrest reaches 10."
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      {isFirstTurn ? (
        <p className="text-sm text-muted-foreground">First turn — Unrest starts at 0, nothing to adjust.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Overcrowded</p>
              <p className="font-semibold tabular-nums">+{overcrowded}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">At war</p>
              <p className="font-semibold tabular-nums">{kingdom.atWar ? "+1" : "+0"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ongoing events</p>
              <NumberInput className="h-8" value={otherDelta} onValueChange={setOtherDelta} />
            </div>
          </div>
          <p className="text-sm">
            Unrest {kingdom.unrest} → <span className="font-semibold tabular-nums">{projected}</span>
          </p>

          {needsRuinRoll && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-400">
                Unrest is 10 or higher — roll 1d10 Ruin and split it across categories, then a DC 11
                flat check for a lost hex.
              </p>
              <DiceReveal
                label="Roll 1d10 Ruin"
                faces={10}
                roll={() => rollDice(1, 10)}
                getTotal={(r) => r.total}
                onSettled={(r) => setRuinTotal(r.total)}
              />
              {ruinTotal !== null && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RUINS.map((ruin) => (
                    <label key={ruin.id} className="space-y-1">
                      <span className="text-[0.65rem] text-muted-foreground">{ruin.name}</span>
                      <NumberInput
                        className="h-7"
                        min={0}
                        value={ruinSplit[ruin.id] ?? 0}
                        onValueChange={(v) => setRuinSplit((s) => ({ ...s, [ruin.id]: v }))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {ruinTotal !== null && splitTotal !== ruinTotal && (
                <p className="text-xs text-amber-400">
                  Split adds up to {splitTotal}, needs to be {ruinTotal}.
                </p>
              )}
              <DiceReveal
                label="DC 11 flat check"
                faces={20}
                roll={() => rollFlatCheck(11)}
                getTotal={(r) => r.roll}
                getTone={(r) => (r.success ? "good" : "bad")}
                onSettled={(r) => setHexLossPassed(r.success)}
              />
              {hexLossPassed !== null &&
                (hexLossPassed ? (
                  <p className="text-sm font-medium text-emerald-400">No hex lost.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Lose a hex — choose which one to give up.
                    </p>
                    <GoToTab tab="map" label="Open the Map" onNavigate={onNavigate} />
                  </div>
                ))}
            </div>
          )}

          <Button
            size="sm"
            disabled={needsRuinRoll && ruinTotal !== null && splitTotal !== ruinTotal}
            onClick={() => {
              const parts = [
                `Sources: ${overcrowded} Overcrowded (+${overcrowded}), at war ${kingdom.atWar ? "+1" : "+0"}, ongoing events ${fmtMod(otherDelta)}`,
              ];
              if (ruinTotal !== null) parts.push(`Ruin roll 1d10 = ${ruinTotal}`);
              if (hexLossPassed !== null) {
                parts.push(
                  `Hex-loss DC 11 flat check: ${hexLossPassed ? "passed, no hex lost" : "failed, a hex is lost"}`,
                );
              }
              onApply(delta, needsRuinRoll ? ruinSplit : {}, parts.join(" · "));
            }}
          >
            Apply
          </Button>
        </>
      )}
    </StepShell>
  );
}

export function ResourceCollectionStep({
  kingdom,
  hexes,
  done,
  onApply,
  onMarkDone,
  lastLog,
}: {
  kingdom: KingdomData;
  hexes: HexData[];
  done: boolean;
  onApply: (rp: number, commodities: Record<Commodity, number>, detail: string) => void;
  onMarkDone: (done: boolean) => void;
  lastLog?: string;
}) {
  const size = sizeBracket(kingdom.size);
  const diceCount = resourceDiceCount(kingdom.level, kingdom.resourceDiceBonus);
  const [rolled, setRolled] = useState<ReturnType<typeof rollDice> | null>(null);
  const [rp, setRp] = useState(0);
  const [commodities, setCommodities] = useState<Record<Commodity, number> | null>(null);

  const gains = useMemo(() => commodityGains(hexes as WorkSiteHex[]), [hexes]);

  return (
    <StepShell
      title="Resource Collection"
      hint={`Roll ${diceCount}d${size.resourceDie} for RP (this replaces last turn's total); gather Commodities from Work Sites, capped at ${size.commodityStorage}.`}
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      <DiceReveal
        label={`Roll ${diceCount}d${size.resourceDie}`}
        faces={size.resourceDie}
        dice={diceCount}
        size="lg"
        roll={() => rollDice(diceCount, size.resourceDie)}
        getTotal={(r) => r.total}
        onSettled={(r) => {
          setRolled(r);
          setRp(r.total);
          setCommodities({
            food: applyStorageCap(kingdom.food, gains.food, size.commodityStorage),
            lumber: applyStorageCap(kingdom.lumber, gains.lumber, size.commodityStorage),
            luxuries: applyStorageCap(kingdom.luxuries, gains.luxuries, size.commodityStorage),
            ore: applyStorageCap(kingdom.ore, gains.ore, size.commodityStorage),
            stone: applyStorageCap(kingdom.stone, gains.stone, size.commodityStorage),
          });
        }}
      />
      {rolled && (
        <>
          <p className="text-xs text-muted-foreground">
            {rolled.dice.join(" + ")} = <span className="font-semibold text-foreground">{rolled.total}</span>
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">RP for this turn</span>
            <NumberInput className="h-8 w-28" min={0} value={rp} onValueChange={setRp} />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(COMMODITY_LABELS) as Commodity[]).map((c) => (
              <label key={c} className="space-y-1">
                <span className="text-[0.65rem] text-muted-foreground">{COMMODITY_LABELS[c]}</span>
                <NumberInput
                  className="h-7"
                  min={0}
                  value={commodities?.[c] ?? kingdom[c]}
                  onValueChange={(v) =>
                    setCommodities((cur) => ({
                      ...(cur ?? {
                        food: kingdom.food,
                        lumber: kingdom.lumber,
                        luxuries: kingdom.luxuries,
                        ore: kingdom.ore,
                        stone: kingdom.stone,
                      }),
                      [c]: v,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              const next = commodities ?? {
                food: kingdom.food,
                lumber: kingdom.lumber,
                luxuries: kingdom.luxuries,
                ore: kingdom.ore,
                stone: kingdom.stone,
              };
              const moved = (Object.keys(COMMODITY_LABELS) as Commodity[])
                .filter((c) => next[c] !== kingdom[c])
                .map((c) => `${COMMODITY_LABELS[c]} ${kingdom[c]} → ${next[c]}`);
              const parts = [
                `Rolled ${diceCount}d${size.resourceDie}: ${rolled.dice.join(" + ")} = ${rolled.total}`,
              ];
              if (rp !== rolled.total) parts.push(`adjusted to ${rp} RP before applying`);
              parts.push(
                moved.length
                  ? `Commodities: ${moved.join(", ")} (storage cap ${size.commodityStorage})`
                  : "Commodities unchanged",
              );
              onApply(rp, next, parts.join(" · "));
            }}
          >
            Apply
          </Button>
        </>
      )}
    </StepShell>
  );
}

export function PayConsumptionStep({
  kingdom,
  settlements,
  hexes,
  isFirstTurn,
  done,
  onApply,
  onMarkDone,
  lastLog,
}: {
  kingdom: KingdomData;
  settlements: SettlementData[];
  hexes: HexData[];
  isFirstTurn: boolean;
  done: boolean;
  onApply: (
    foodSpent: number,
    rpSpent: number,
    unrestGained: number,
    detail: string,
  ) => void;
  onMarkDone: (done: boolean) => void;
  lastLog?: string;
}) {
  const consumption = kingdomConsumption({
    isFirstTurn,
    settlementConsumption: settlements.map(
      (s) => ({ VILLAGE: 1, TOWN: 2, CITY: 4, METROPOLIS: 6 })[s.type] ?? 1,
    ),
    farmlandHexes: hexes.filter((h) => h.workSite === "farmland").length,
  });
  const foodSpent = Math.min(kingdom.food, consumption);
  const unpaid = consumption - foodSpent;
  const [unrestRolled, setUnrestRolled] = useState<number | null>(null);

  return (
    <StepShell
      title="Pay Consumption"
      hint="Spend Food equal to Consumption; any shortfall costs 5 RP per point or +1d4 Unrest."
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      {isFirstTurn ? (
        <p className="text-sm text-muted-foreground">First turn — Consumption starts at 0, nothing to pay.</p>
      ) : (
        <>
          <p className="text-sm">
            Consumption <span className="font-semibold tabular-nums">{consumption}</span> · Food on
            hand <span className="font-semibold tabular-nums">{kingdom.food}</span>
          </p>
          {unpaid === 0 ? (
            <Button
              size="sm"
              onClick={() =>
                onApply(
                  foodSpent,
                  0,
                  0,
                  `Consumption ${consumption} paid in full from Food (${kingdom.food} → ${kingdom.food - foodSpent})`,
                )
              }
            >
              Pay {foodSpent} Food
            </Button>
          ) : (
            <>
              <p className="text-sm text-amber-400">
                Short by {unpaid} — pay the rest with RP ({consumptionRpCost(unpaid)}) or take Unrest.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onApply(
                      foodSpent,
                      consumptionRpCost(unpaid),
                      0,
                      `Consumption ${consumption}, only ${foodSpent} Food available — covered the ${unpaid} short with ${consumptionRpCost(unpaid)} RP (5 per point)`,
                    )
                  }
                >
                  Pay {consumptionRpCost(unpaid)} RP
                </Button>
                {unrestRolled === null ? (
                  <DiceReveal
                    label="Roll 1d4 Unrest instead"
                    faces={4}
                    roll={() => rollDice(1, 4)}
                    getTotal={(r) => r.total}
                    getTone={() => "bad"}
                    onSettled={(r) => setUnrestRolled(r.total)}
                  />
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      onApply(
                        foodSpent,
                        0,
                        unrestRolled,
                        `Consumption ${consumption}, only ${foodSpent} Food available — took the ${unpaid} short as Unrest instead, rolled 1d4 = ${unrestRolled}`,
                      )
                    }
                  >
                    Apply +{unrestRolled} Unrest
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </StepShell>
  );
}

export function RandomEventStep({
  done,
  onLog,
  onMarkDone,
  lastLog,
}: {
  done: boolean;
  onLog: (label: string, detail?: string) => void;
  onMarkDone: (done: boolean) => void;
  lastLog?: string;
}) {
  const [outcome, setOutcome] = useState<{ roll: number; success: boolean } | null>(null);
  return (
    <StepShell
      title="Check for a Random Event"
      hint="DC 16 flat check. The DC drops by 5 each turn with no event — this app doesn't track that drift yet, so adjust it yourself if it applies."
      done={done}
      onMarkDone={onMarkDone}
      lastLog={lastLog}
    >
      <DiceReveal
        label="Roll DC 16 flat check"
        faces={20}
        size="lg"
        roll={() => rollFlatCheck(16)}
        getTotal={(r) => r.roll}
        getTone={(r) => (r.success ? "bad" : "good")}
        onSettled={(r) => {
          setOutcome(r);
          onLog(
            `Random event check: ${r.roll} vs DC 16 — ${r.success ? "event occurs" : "no event"}`,
            r.success
              ? "An event was triggered this turn — resolve it under Event Resolution."
              : "Quiet turn, no event triggered.",
          );
        }}
      />
      {outcome && (
        <p className={cn("text-sm font-medium", outcome.success ? "text-amber-400" : "text-emerald-400")}>
          {outcome.success ? "An event occurs — resolve it now." : "No event this turn."}
        </p>
      )}
    </StepShell>
  );
}

/**
 * Attempt one Kingdom activity: pick the activity and skill, roll against
 * Control DC, and log the matching outcome text. Shared by Collect Taxes
 * (Commerce) and every Leadership/Region/Civic/Army activity — the only
 * difference between them is which activities are offered.
 */
export function ActivityCheckStep({
  title,
  hint,
  kingdom,
  activities,
  done,
  onLog,
  onMarkDone,
  onNavigate,
  lastLog,
}: {
  title: string;
  hint: string;
  kingdom: KingdomData;
  activities: KingdomActivityDef[];
  done: boolean;
  onLog: (label: string, detail: string) => void;
  onMarkDone: (done: boolean) => void;
  onNavigate?: (tab: KingdomTab) => void;
  lastLog?: string;
}) {
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const activity = activities.find((a) => a.id === activityId) ?? null;

  const vacantRoleIds = useMemo(
    () =>
      LEADERSHIP_ROLES.filter((def) => {
        const row = kingdom.leadershipRoles.find((r) => r.role === def.id);
        return !row?.characterId && !row?.npcName;
      }).map((def) => def.id),
    [kingdom.leadershipRoles],
  );

  const skillOptions = useMemo(
    () =>
      activity?.skillChoice === "any"
        ? kingdom.skills.filter((s) => s.rank >= (activity.anyMinRank ?? 0)).map((s) => s.skill)
        : (activity?.skills.map((s) => s.skill) ?? []),
    [activity, kingdom.skills],
  );
  const [skillId, setSkillId] = useState(skillOptions[0] ?? "");
  const effectiveSkillId = useMemo(
    () => (skillOptions.includes(skillId) ? skillId : skillOptions[0]),
    [skillOptions, skillId],
  );

  const [result, setResult] = useState<CheckResult | null>(null);
  const [total, setTotal] = useState(0);

  const check = useMemo(() => {
    if (!effectiveSkillId) return null;
    const skill = getKingdomSkill(effectiveSkillId);
    if (!skill) return null;
    const rank = (kingdom.skills.find((s) => s.skill === effectiveSkillId)?.rank ?? 0) as ProficiencyRank;
    const ui = untrainedImprovisation(kingdom.ruleset, kingdom.level);
    const investedRoleIds = kingdom.leadershipRoles.filter((r) => r.invested).map((r) => r.role);
    const statusBonus = investedStatusBonus(skill.keyAbility, investedRoleIds);
    const ruinPenaltyByAbility: Record<KingdomAbility, number> = {
      culture: kingdom.corruptionPenalty,
      economy: kingdom.crimePenalty,
      stability: kingdom.decayPenalty,
      loyalty: kingdom.strifePenalty,
    };
    // A role is vacant when nobody holds it — separate from whether it's
    // invested. Which penalties bite depends on the activity's traits, so this
    // has to be recomputed per activity, not once per kingdom.
    const vacancy = vacancyPenalty(vacantRoleIds, skill.keyAbility, activity?.traits ?? []);
    const breakdown = skillModifier({
      keyAbilityScore: kingdom[skill.keyAbility],
      rank,
      level: kingdom.level,
      untrainedImprovisation: ui,
      statusBonus,
      ruinPenalty: ruinPenaltyByAbility[skill.keyAbility],
      vacancyPenalty: vacancy.total,
      otherPenalty: unrestStatusPenalty(kingdom.unrest),
    });
    return { skill, breakdown, vacancy };
  }, [effectiveSkillId, kingdom, vacantRoleIds, activity]);

  const dc = controlDC(kingdom.level, kingdom.size, vacantRoleIds.includes("ruler"));
  // Recomputed from the editable total (rather than frozen at roll time), so
  // nudging the number before logging keeps the degree badge honest — the
  // natural die face is what still decides a nat-20/nat-1 shift, not the edit.
  const degree = result ? degreeOfSuccess(total, dc, result.natural) : null;

  function apply() {
    if (!activity || !result || !degree) return;
    const outcome = activity.outcomes[degree] ?? "";
    onLog(
      `${activity.name}${check ? ` (${check.skill.name})` : ""}: ${total} vs DC ${dc} — ${DEGREE_LABELS[degree]}`,
      outcome,
    );
    setResult(null);
  }

  if (activities.length === 0) {
    return (
      <StepShell title={title} hint={hint} done={done} onMarkDone={onMarkDone} lastLog={lastLog}>
        <p className="text-sm text-muted-foreground">No activities catalogued for this step yet.</p>
      </StepShell>
    );
  }

  return (
    <StepShell title={title} hint={hint} done={done} onMarkDone={onMarkDone} lastLog={lastLog}>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap gap-2">
          <Select
            value={activityId}
            onValueChange={(v) => {
              if (v) setActivityId(v);
              setResult(null);
            }}
          >
            <SelectTrigger className="min-w-48 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activities.map((a) => (
                <SelectItem key={a.id} value={a.id} label={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {skillOptions.length > 1 && (
            <Select value={effectiveSkillId} onValueChange={(v) => v && setSkillId(v)}>
              <SelectTrigger className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {skillOptions.map((id) => (
                  <SelectItem key={id} value={id} label={getKingdomSkill(id)?.name ?? id}>
                    {getKingdomSkill(id)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {activity && (
          <p className="text-sm leading-relaxed text-muted-foreground">{activity.description}</p>
        )}

        {check && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {check.skill.name} modifier{" "}
              <span className="font-medium text-foreground">{fmtMod(check.breakdown.total)}</span> vs
              Control DC <span className="font-medium text-foreground">{dc}</span>
              {vacantRoleIds.includes("ruler") && (
                <span className="text-destructive"> (+2, Ruler vacant)</span>
              )}
            </p>
            <p className="text-[0.7rem] text-muted-foreground/70">
              {modifierParts(check.breakdown).join("  ")}
            </p>
            {check.vacancy.sources.length > 0 && (
              <p className="text-[0.7rem] text-destructive/80">
                Vacant:{" "}
                {check.vacancy.sources
                  .map((s) => `${s.roleName} −${s.amount} (${s.reason})`)
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <DiceReveal
          label={`Roll d20${check ? fmtMod(check.breakdown.total) : ""}`}
          faces={20}
          size="lg"
          disabled={!check}
          roll={() => rollCheck(check?.breakdown.total ?? 0, dc)}
          getTotal={(r) => r.total}
          // The die shows the d20 face; the modifier is added beside it.
          getFace={(r) => r.natural}
          getTone={(r) => DEGREE_TONE[r.degree]}
          onSettled={(r) => {
            setResult(r);
            setTotal(r.total);
          }}
        />
        {result && (
          <>
            <span className="text-sm text-muted-foreground">
              {fmtMod(check?.breakdown.total ?? 0)} =
            </span>
            <NumberInput className="h-8 w-20" value={total} onValueChange={setTotal} />
            {degree && <DegreeBadge degree={degree} />}
            {/* A natural 20 or 1 shifts the degree one step, so it has to be
                visible — otherwise the badge looks wrong for the total. */}
            {(result.natural === 20 || result.natural === 1) && (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  result.natural === 20
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                nat {result.natural}
              </span>
            )}
          </>
        )}
      </div>

      {result && activity && degree && (
        <div
          className={cn(
            "space-y-2.5 rounded-lg border-l-2 bg-muted/30 p-3 text-sm",
            {
              "critical-good": "border-l-amber-400",
              good: "border-l-emerald-400",
              bad: "border-l-orange-400",
              "critical-bad": "border-l-destructive",
              neutral: "border-l-border",
            }[DEGREE_TONE[degree]],
          )}
        >
          <p className="flex items-start gap-1.5 leading-relaxed">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            {activity.outcomes[degree]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={apply}>
              Log this result
            </Button>
            {/* Region activities act on hexes and Civic ones on settlements, so
                carrying out the outcome means going to that tab. */}
            {activity.traits.includes("REGION") && (
              <GoToTab tab="map" label="Open the Map" onNavigate={onNavigate} />
            )}
            {activity.traits.includes("CIVIC") && (
              <GoToTab tab="settlements" label="Open Settlements" onNavigate={onNavigate} />
            )}
          </div>
        </div>
      )}
    </StepShell>
  );
}
