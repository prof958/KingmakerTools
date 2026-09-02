"use client";

/**
 * KingdomSkills — the 16 Kingdom skills with their computed check modifiers and
 * a proficiency-rank picker. Modifier = key ability mod + proficiency bonus +
 * invested-leadership status bonus − the opposing Ruin's penalty.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ABILITY_LABELS,
  abilityModifier,
  investedStatusBonus,
  KINGDOM_ABILITIES,
  KINGDOM_SKILLS,
  PROFICIENCY_LABELS,
  skillModifier,
  untrainedImprovisation,
  type KingdomAbility,
  type ProficiencyRank,
} from "@/lib/pf2e/kingdom";
import type { KingdomData } from "./types";

const RANKS: ProficiencyRank[] = [0, 1, 2, 3, 4];

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function KingdomSkills({
  kingdom,
  onRefresh,
}: {
  kingdom: KingdomData;
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const investedRoleIds = kingdom.leadershipRoles.filter((r) => r.invested).map((r) => r.role);
  const ui = untrainedImprovisation(kingdom.ruleset, kingdom.level);

  const ruinPenaltyByAbility: Record<KingdomAbility, number> = {
    culture: kingdom.corruptionPenalty,
    economy: kingdom.crimePenalty,
    stability: kingdom.decayPenalty,
    loyalty: kingdom.strifePenalty,
  };

  const rankBySkill = new Map(kingdom.skills.map((s) => [s.skill, s.rank]));

  async function setRank(skillId: string, rank: number) {
    setPending(skillId);
    try {
      const res = await fetch("/api/kingdom/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: skillId, rank }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        toast.error("Couldn't update that skill rank. Try again.");
      }
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {KINGDOM_ABILITIES.map((ability) => {
        const score = kingdom[ability as keyof KingdomData] as number;
        const abilityMod = abilityModifier(score);
        const skills = KINGDOM_SKILLS.filter((s) => s.keyAbility === ability);
        const ruinPenalty = ruinPenaltyByAbility[ability];

        return (
          <Card key={ability}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{ABILITY_LABELS[ability]}</CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {ABILITY_LABELS[ability]} {fmtMod(abilityMod)}
                  {ruinPenalty > 0 && (
                    <span className="ml-1 text-destructive">− {ruinPenalty} ruin</span>
                  )}
                </span>
              </div>
            </CardHeader>
            <CardContent className="divide-y">
              {skills.map((skill) => {
                const rank = (rankBySkill.get(skill.id) ?? 0) as ProficiencyRank;
                const statusBonus = investedStatusBonus(ability, investedRoleIds);
                const { total } = skillModifier({
                  keyAbilityScore: score,
                  rank,
                  level: kingdom.level,
                  untrainedImprovisation: ui,
                  statusBonus,
                  ruinPenalty,
                });

                return (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{skill.name}</span>
                      {statusBonus > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          +{statusBonus} invested
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-right text-sm font-semibold tabular-nums">
                        {fmtMod(total)}
                      </span>
                      <Select
                        value={String(rank)}
                        onValueChange={(v) => setRank(skill.id, Number(v ?? "0"))}
                        disabled={pending === skill.id}
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RANKS.map((r) => (
                            <SelectItem key={r} value={String(r)} label={PROFICIENCY_LABELS[r]}>
                              {PROFICIENCY_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
