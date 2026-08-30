"use client";

/**
 * KingdomOverview — ability scores, derived stats, unrest, ruin, and resources.
 * Redesigned to feel like a browser kingdom builder.
 */

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Wheat,
  Axe,
  Gem,
  Pickaxe,
  Mountain,
  Coins,
  ShieldAlert,
  Shield,
  Flame,
  Swords,
  Skull,
  Activity,
  Zap,
  Globe2,
  Dices,
  Landmark,
  Sparkles,
  BookOpen,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  ABILITY_LABELS,
  abilityModifier,
  advancementTable,
  controlDC,
  COMMODITIES,
  COMMODITY_LABELS,
  ANARCHY_UNREST,
  UNREST_RUIN_THRESHOLD,
  RUINS,
  resourceDiceCount,
  sizeBracket,
  untrainedImprovisation,
  type KingdomAbility,
  type Commodity,
} from "@/lib/pf2e/kingdom";
import { ABILITY_KEYS, type KingdomData } from "./types";

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

const RESOURCE_ICONS: Record<Commodity | "rp", React.ElementType> = {
  food: Wheat,
  lumber: Axe,
  luxuries: Gem,
  ore: Pickaxe,
  stone: Mountain,
  rp: Coins,
};

const RUIN_ICONS: Record<string, React.ElementType> = {
  corruption: Skull,
  crime: Swords,
  decay: Flame,
  strife: ShieldAlert,
};

/**
 * A distinct color identity per Kingdom Ability, reused everywhere an ability
 * (or the Ruin that opposes it) shows up on Overview — the score badge, its
 * Ruin card's accent. Deliberately outside the amber/emerald/orange/destructive
 * set, which is already spoken for as the Turn tab's degree-of-success tones
 * (dice-reveal.tsx) — reusing those here would make an ability's *identity*
 * read as a roll *outcome*.
 */
const ABILITY_THEME: Record<
  KingdomAbility,
  { text: string; bg: string; solid: string; ring: string; border: string }
> = {
  // `solid` is a literal class (not built via string-editing `text`/`bg` at
  // runtime) — Tailwind's scanner only picks up class names it can see
  // verbatim in source, so a computed one would silently never be generated.
  culture: { text: "text-violet-400", bg: "bg-violet-500/10", solid: "bg-violet-400", ring: "ring-violet-400/30", border: "border-l-violet-400" },
  economy: { text: "text-teal-400", bg: "bg-teal-500/10", solid: "bg-teal-400", ring: "ring-teal-400/30", border: "border-l-teal-400" },
  loyalty: { text: "text-sky-400", bg: "bg-sky-500/10", solid: "bg-sky-400", ring: "ring-sky-400/30", border: "border-l-sky-400" },
  stability: { text: "text-lime-400", bg: "bg-lime-500/10", solid: "bg-lime-400", ring: "ring-lime-400/30", border: "border-l-lime-400" },
};

/** Per-commodity color identity for the resource strip's icon chips. */
const RESOURCE_THEME: Record<Commodity | "rp", { text: string; bg: string }> = {
  food: { text: "text-amber-400", bg: "bg-amber-500/10" },
  lumber: { text: "text-orange-400", bg: "bg-orange-500/10" },
  luxuries: { text: "text-fuchsia-400", bg: "bg-fuchsia-500/10" },
  ore: { text: "text-slate-400", bg: "bg-slate-500/10" },
  stone: { text: "text-stone-400", bg: "bg-stone-500/10" },
  rp: { text: "text-amber-500", bg: "bg-amber-500/10" },
};

/** Icon for a level-up feature, matched by keyword so new advancement-table entries pick up an icon for free. */
function featureIcon(feature: string): React.ElementType {
  const f = feature.toLowerCase();
  if (f.includes("feat")) return Star;
  if (f.includes("skill")) return BookOpen;
  if (f.includes("ability boost")) return TrendingUp;
  return Sparkles;
}

export function KingdomOverview({
  kingdom,
  onPatch,
}: {
  kingdom: KingdomData;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const set = useCallback(
    (field: string) => (value: number) => onPatch({ [field]: value }),
    [onPatch],
  );

  const size = sizeBracket(kingdom.size);
  const dice = resourceDiceCount(kingdom.level, kingdom.resourceDiceBonus);
  const ui = untrainedImprovisation(kingdom.ruleset, kingdom.level);
  // A vacant Ruler seat adds +2 to Control DC (KPG 19) — the Turn tab's
  // activity checks already account for this, so Overview has to as well or
  // the two tabs would show two different Control DCs for the same kingdom.
  const rulerVacant = !kingdom.leadershipRoles.find((r) => r.role === "ruler")?.characterId &&
    !kingdom.leadershipRoles.find((r) => r.role === "ruler")?.npcName;
  const dc = controlDC(kingdom.level, kingdom.size, rulerVacant);
  const nextLevelFeatures = advancementTable(kingdom.ruleset)[
    Math.min(19, Math.max(0, kingdom.level))
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar: Resources Strip — the kingdom's treasury, so it gets the
          warmest, most "hoard-like" framing on the page: a gold-toned border
          instead of the neutral card border everything else uses. */}
      <Card className="bg-muted/30 border-amber-500/25">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-around gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-1 group">
              <div className={cn("mb-1 flex items-center gap-2 rounded-full px-2.5 py-1", RESOURCE_THEME.rp.bg, RESOURCE_THEME.rp.text)}>
                <Coins className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">RP</span>
              </div>
              <NumberInput
                className="h-9 w-20 text-center font-heading text-lg font-bold bg-background"
                value={kingdom.rp}
                min={0}
                onValueChange={set("rp")}
              />
              <span className="text-[10px] text-muted-foreground">Carry: {fmtMod(kingdom.resourceDiceBonus)}</span>
            </div>

            <Separator orientation="vertical" className="hidden sm:block h-12" />

            {COMMODITIES.map((c) => {
              const value = kingdom[c as keyof KingdomData] as number;
              const over = value > size.commodityStorage;
              const Icon = RESOURCE_ICONS[c as Commodity];
              const theme = RESOURCE_THEME[c as Commodity];

              return (
                <div key={c} className="flex flex-col items-center gap-1 group">
                  <div className={cn("mb-1 flex items-center gap-2 rounded-full px-2.5 py-1", theme.bg, theme.text)}>
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {COMMODITY_LABELS[c as Commodity]}
                    </span>
                  </div>
                  <div className="relative">
                    <NumberInput
                      className={`h-9 w-20 text-center font-heading text-lg font-bold bg-background ${over ? "border-amber-500 text-amber-600 focus-visible:ring-amber-500" : ""}`}
                      value={value}
                      min={0}
                      onValueChange={set(c)}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">/ {size.commodityStorage} max</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Abilities & Unrest */}
        <div className="space-y-6 lg:col-span-1">
          {/* Ability Scores */}
          <Card>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Kingdom Abilities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ABILITY_KEYS.map((ability) => {
                  const score = kingdom[ability as keyof KingdomData] as number;
                  const mod = abilityModifier(score);
                  const theme = ABILITY_THEME[ability as KingdomAbility];
                  return (
                    <div key={ability} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-full font-heading text-lg font-bold ring-2",
                            theme.bg,
                            theme.text,
                            theme.ring,
                          )}
                        >
                          {fmtMod(mod)}
                        </div>
                        <span className="font-medium">{ABILITY_LABELS[ability as KingdomAbility]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">score</span>
                        <NumberInput
                          className="h-8 w-16 text-center font-heading"
                          value={score}
                          min={0}
                          onValueChange={set(ability)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Unrest — the one stat that should visibly escalate: calm green,
              a watchful amber once Ruin can trigger, an urgent pulsing red at
              Anarchy. The tick marks pin the two thresholds to the bar itself
              rather than leaving them as a caption underneath. */}
          <Card className={kingdom.unrest >= UNREST_RUIN_THRESHOLD ? "border-destructive/30" : ""}>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle
                className={cn(
                  "font-heading text-base flex items-center gap-2",
                  kingdom.unrest >= UNREST_RUIN_THRESHOLD ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <Flame className={cn("h-4 w-4", kingdom.unrest >= ANARCHY_UNREST && "kt-pulse-danger")} />
                Unrest
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        kingdom.unrest >= ANARCHY_UNREST
                          ? "bg-destructive kt-pulse-danger"
                          : kingdom.unrest >= UNREST_RUIN_THRESHOLD
                            ? "bg-amber-500"
                            : "bg-emerald-500",
                      )}
                      style={{ width: `${Math.min(100, (kingdom.unrest / ANARCHY_UNREST) * 100)}%` }}
                    />
                  </div>
                  {/* Threshold ticks, positioned as a fraction of the Anarchy
                      max so they track the same scale as the fill. */}
                  <div
                    className="absolute top-0 h-3 w-px bg-foreground/30"
                    style={{ left: `${(UNREST_RUIN_THRESHOLD / ANARCHY_UNREST) * 100}%` }}
                    title={`Ruin at ${UNREST_RUIN_THRESHOLD}`}
                  />
                </div>
                <NumberInput
                  className={cn(
                    "h-9 w-20 text-center font-heading font-bold",
                    kingdom.unrest >= UNREST_RUIN_THRESHOLD ? "text-destructive" : "text-foreground",
                  )}
                  value={kingdom.unrest}
                  min={0}
                  onValueChange={set("unrest")}
                />
              </div>

              {kingdom.unrest >= ANARCHY_UNREST ? (
                <div className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  Anarchy — only Quell Unrest, all checks worsened
                </div>
              ) : kingdom.unrest >= UNREST_RUIN_THRESHOLD ? (
                <div className="text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  Upkeep: gain 1d10 Ruin, DC 11 flat check or lose a hex
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center">
                  Thresholds: {UNREST_RUIN_THRESHOLD} (Ruin), {ANARCHY_UNREST} (Anarchy)
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ruin, Progression & Derived */}
        <div className="space-y-6 lg:col-span-2">
          {/* Ruin Tracks */}
          <Card>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Skull className="h-4 w-4" />
                Ruin Penalties
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {RUINS.map((ruin) => {
                  const points = kingdom[`${ruin.id}Points` as keyof KingdomData] as number;
                  const threshold = kingdom[`${ruin.id}Threshold` as keyof KingdomData] as number;
                  const penalty = kingdom[`${ruin.id}Penalty` as keyof KingdomData] as number;
                  const Icon = RUIN_ICONS[ruin.id] || Skull;
                  const progress = Math.min(100, (points / threshold) * 100);
                  const theme = ABILITY_THEME[ruin.ability];

                  return (
                    <div
                      key={ruin.id}
                      className={cn(
                        "rounded-xl border border-l-4 bg-card p-4 shadow-sm space-y-3 transition-colors",
                        theme.border,
                        penalty > 0 && "bg-destructive/[0.03]",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              penalty > 0 ? "bg-destructive/10 text-destructive" : cn(theme.bg, theme.text),
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium leading-none">{ruin.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                              Opposes {ABILITY_LABELS[ruin.ability]}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-heading text-2xl font-bold leading-none text-destructive">
                            {penalty > 0 ? `-${penalty}` : "0"}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Penalty</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{points} points</span>
                          <span className="text-muted-foreground">/ {threshold}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              progress >= 75 ? "bg-destructive" : theme.solid,
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <label className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground">Pts</span>
                          <NumberInput className="h-7 text-xs" value={points} min={0} onValueChange={set(`${ruin.id}Points`)} />
                        </label>
                        <label className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground">Max</span>
                          <NumberInput className="h-7 text-xs" value={threshold} min={1} onValueChange={set(`${ruin.id}Threshold`)} />
                        </label>
                        <label className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground">Pen</span>
                          <NumberInput className="h-7 text-xs" value={penalty} min={0} onValueChange={set(`${ruin.id}Penalty`)} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Progression */}
            <Card>
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  {/* A rank medallion rather than a plain number box — still
                      the same editable field underneath, just styled like the
                      seal it represents. */}
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Level</span>
                    <NumberInput
                      // `dark:bg-amber-500/10` has to be spelled out (not just
                      // `bg-amber-500/10`) — Input's own base classes already
                      // set `dark:bg-input/30`, and tailwind-merge only treats
                      // two classes as the same slot (letting ours win) when
                      // they share the same variant prefix. Without it, this
                      // app's default dark theme would silently mask the tint.
                      className="h-14 w-14 rounded-full border-2 border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/10 text-center font-heading text-xl font-bold text-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.15)]"
                      value={kingdom.level}
                      min={1}
                      max={20}
                      onValueChange={set("level")}
                    />
                  </label>
                  {/*
                    Size is counted from the claimed hexes on the map, not typed
                    in. It drives the Size table, Control DC, and resource dice,
                    so an editable copy here would silently disagree with the
                    map the moment either changed.
                  */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Size (Hexes)</span>
                    <div className="flex h-10 items-baseline gap-2">
                      <span className="font-heading text-lg font-bold tabular-nums">{kingdom.size}</span>
                      <span className="text-xs text-muted-foreground">from the map</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Advancement</div>
                  <div className="text-sm font-medium">Milestone (GM sets level)</div>
                </div>

                {nextLevelFeatures && kingdom.level < 20 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-primary">Level {kingdom.level + 1} unlocks</span>
                    <div className="flex flex-wrap gap-1.5">
                      {advancementTable(kingdom.ruleset)[kingdom.level].features.map((feature) => {
                        const FeatureIcon = featureIcon(feature);
                        return (
                          <span
                            key={feature}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                          >
                            <FeatureIcon className="size-3" />
                            {feature}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Derived Stats */}
            <Card>
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <Globe2 className="h-4 w-4" />
                  Nation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-3">
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="size-3.5" /> Control DC
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-heading font-bold text-lg">{dc}</span>
                      {rulerVacant && (
                        <span className="text-[0.65rem] font-medium text-destructive">(+2, Ruler vacant)</span>
                      )}
                    </span>
                  </li>
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Dices className="size-3.5" /> Resource Dice
                    </span>
                    <span className="font-heading font-bold">{dice}d{size.resourceDie}</span>
                  </li>
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Landmark className="size-3.5" /> Nation Rank
                    </span>
                    <span className="font-medium">{size.nation}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="size-3.5" /> Untrained Improv.
                    </span>
                    <span className="font-medium capitalize">{ui === "none" ? "—" : ui}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

