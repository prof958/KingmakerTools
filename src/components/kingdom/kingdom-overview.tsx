"use client";

/**
 * KingdomOverview — ability scores, derived stats, unrest, ruin, and resources.
 * Every field writes straight back to PATCH /api/kingdom on commit.
 */

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Separator } from "@/components/ui/separator";
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
  xpToNextLevel,
  XP_PER_LEVEL,
  type KingdomAbility,
  type Commodity,
} from "@/lib/pf2e/kingdom";
import { ABILITY_KEYS, type KingdomData } from "./types";

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
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
  const nextLevelFeatures = advancementTable(kingdom.ruleset)[
    Math.min(19, Math.max(0, kingdom.level))
  ];
  const xpInLevel = ((kingdom.xp % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;

  return (
    <div className="space-y-6">
      {/* Progression */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Level</span>
              <NumberInput
                className="h-8"
                value={kingdom.level}
                min={1}
                max={20}
                onValueChange={set("level")}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Size (hexes)</span>
              <NumberInput
                className="h-8"
                value={kingdom.size}
                min={1}
                onValueChange={set("size")}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">XP toward next level</span>
              <NumberInput
                className="h-8"
                value={xpInLevel}
                min={0}
                onValueChange={(v) =>
                  onPatch({ xp: Math.floor(kingdom.xp / XP_PER_LEVEL) * XP_PER_LEVEL + v })
                }
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Next level in</span>
              <div className="flex h-8 items-center font-medium tabular-nums">
                {xpToNextLevel(kingdom.xp)} XP
              </div>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(xpInLevel / XP_PER_LEVEL) * 100}%` }}
            />
          </div>

          {nextLevelFeatures && kingdom.level < 20 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Level {kingdom.level + 1}:</span>{" "}
              {advancementTable(kingdom.ruleset)[kingdom.level].features.join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ability scores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ABILITY_KEYS.map((ability) => {
          const score = kingdom[ability as keyof KingdomData] as number;
          return (
            <Card key={ability}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {ABILITY_LABELS[ability as KingdomAbility]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold tabular-nums">{fmtMod(abilityModifier(score))}</div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  score
                  <NumberInput
                    className="h-7 w-16"
                    value={score}
                    min={0}
                    onValueChange={set(ability)}
                  />
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Derived stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Derived</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Control DC</dt>
              <dd className="text-lg font-semibold tabular-nums">{controlDC(kingdom.level, kingdom.size)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Resource Dice</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {dice}d{size.resourceDie}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Commodity storage</dt>
              <dd className="text-lg font-semibold tabular-nums">{size.commodityStorage}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Nation size</dt>
              <dd className="text-lg font-semibold">{size.nation}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Untrained Improvisation</dt>
              <dd className="text-sm font-medium capitalize">{ui === "none" ? "—" : ui}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Unrest & Ruin */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unrest &amp; Ruin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Unrest</span>
              <NumberInput
                className="h-8 w-20"
                value={kingdom.unrest}
                min={0}
                onValueChange={set("unrest")}
              />
            </label>
            {kingdom.unrest >= ANARCHY_UNREST ? (
              <Badge variant="destructive">Anarchy — only Quell Unrest, all checks worsened</Badge>
            ) : kingdom.unrest >= UNREST_RUIN_THRESHOLD ? (
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                Upkeep: gain 1d10 Ruin, DC 11 flat check or lose a hex
              </Badge>
            ) : null}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            {RUINS.map((ruin) => {
              const points = kingdom[`${ruin.id}Points` as keyof KingdomData] as number;
              const threshold = kingdom[`${ruin.id}Threshold` as keyof KingdomData] as number;
              const penalty = kingdom[`${ruin.id}Penalty` as keyof KingdomData] as number;
              return (
                <div key={ruin.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ruin.name}</span>
                    <span className="text-xs text-muted-foreground">
                      opposes {ABILITY_LABELS[ruin.ability]}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Points</span>
                      <NumberInput
                        className="h-7"
                        value={points}
                        min={0}
                        onValueChange={set(`${ruin.id}Points`)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Threshold</span>
                      <NumberInput
                        className="h-7"
                        value={threshold}
                        min={1}
                        onValueChange={set(`${ruin.id}Threshold`)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Penalty</span>
                      <NumberInput
                        className="h-7"
                        value={penalty}
                        min={0}
                        onValueChange={set(`${ruin.id}Penalty`)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Resource Points</span>
              <NumberInput className="h-8 w-24" value={kingdom.rp} min={0} onValueChange={set("rp")} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Carryover dice (±)</span>
              <NumberInput
                className="h-8 w-24"
                value={kingdom.resourceDiceBonus}
                onValueChange={set("resourceDiceBonus")}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COMMODITIES.map((c) => {
              const value = kingdom[c as keyof KingdomData] as number;
              const over = value > size.commodityStorage;
              return (
                <label key={c} className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {COMMODITY_LABELS[c as Commodity]}
                  </span>
                  <NumberInput
                    className={`h-8 ${over ? "border-amber-500" : ""}`}
                    value={value}
                    min={0}
                    onValueChange={set(c)}
                  />
                  <span className="text-[10px] text-muted-foreground">/ {size.commodityStorage} max</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
