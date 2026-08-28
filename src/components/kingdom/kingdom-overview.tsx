"use client";

/**
 * KingdomOverview — ability scores, derived stats, unrest, ruin, and resources.
 * Redesigned to feel like a browser kingdom builder.
 */

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Separator } from "@/components/ui/separator";
import { 
  Wheat, 
  Axe, 
  Gem, 
  Pickaxe, 
  Mountain, 
  Coins, 
  ShieldAlert,
  Flame,
  Swords,
  Skull,
  Activity,
  Zap,
  Globe2
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
  const nextLevelFeatures = advancementTable(kingdom.ruleset)[
    Math.min(19, Math.max(0, kingdom.level))
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar: Resources Strip */}
      <Card className="bg-muted/30 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-around gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-1 group">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Coins className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">RP</span>
              </div>
              <NumberInput 
                className="h-8 w-20 text-center font-bold bg-background" 
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
              
              return (
                <div key={c} className="flex flex-col items-center gap-1 group">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {COMMODITY_LABELS[c as Commodity]}
                    </span>
                  </div>
                  <div className="relative">
                    <NumberInput
                      className={`h-8 w-20 text-center font-bold bg-background ${over ? "border-amber-500 text-amber-600 focus-visible:ring-amber-500" : ""}`}
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
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Kingdom Abilities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ABILITY_KEYS.map((ability) => {
                  const score = kingdom[ability as keyof KingdomData] as number;
                  const mod = abilityModifier(score);
                  return (
                    <div key={ability} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                          {fmtMod(mod)}
                        </div>
                        <span className="font-medium">{ABILITY_LABELS[ability as KingdomAbility]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">score</span>
                        <NumberInput
                          className="h-8 w-16 text-center"
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

          {/* Unrest */}
          <Card className={kingdom.unrest > 0 ? "border-destructive/30" : ""}>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <Flame className="h-4 w-4" />
                Unrest
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive transition-all" 
                      style={{ width: `${Math.min(100, (kingdom.unrest / ANARCHY_UNREST) * 100)}%` }}
                    />
                  </div>
                </div>
                <NumberInput
                  className="h-9 w-20 text-center font-bold text-destructive"
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
              <CardTitle className="text-base flex items-center gap-2">
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
                  
                  return (
                    <div key={ruin.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${penalty > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
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
                          <div className="text-2xl font-bold leading-none text-destructive">{penalty > 0 ? `-${penalty}` : "0"}</div>
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
                            className={`h-full transition-all ${progress >= 75 ? "bg-destructive" : "bg-primary"}`} 
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Level</span>
                    <NumberInput
                      className="h-10 text-lg font-bold"
                      value={kingdom.level}
                      min={1}
                      max={20}
                      onValueChange={set("level")}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Size (Hexes)</span>
                    <NumberInput
                      className="h-10 text-lg font-bold"
                      value={kingdom.size}
                      min={1}
                      onValueChange={set("size")}
                    />
                  </label>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Advancement</div>
                  <div className="text-sm font-medium">Milestone (GM sets level)</div>
                </div>

                {nextLevelFeatures && kingdom.level < 20 && (
                  <div className="text-sm">
                    <span className="font-semibold text-primary">Level {kingdom.level + 1} unlocks:</span>{" "}
                    <span className="text-muted-foreground">{advancementTable(kingdom.ruleset)[kingdom.level].features.join(" · ")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Derived Stats */}
            <Card>
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe2 className="h-4 w-4" />
                  Nation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-3">
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Control DC</span>
                    <span className="font-bold text-lg">{controlDC(kingdom.level, kingdom.size)}</span>
                  </li>
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Resource Dice</span>
                    <span className="font-bold">{dice}d{size.resourceDie}</span>
                  </li>
                  <li className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Nation Rank</span>
                    <span className="font-medium">{size.nation}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Untrained Improv.</span>
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

