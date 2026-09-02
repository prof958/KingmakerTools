"use client";

/**
 * LeadershipRoster — assign the 8 leadership roles to party characters or NPCs
 * and choose which are invested (invested roles grant a +1 status bonus to the
 * key ability's Kingdom skills). The rules expect 4 invested roles.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurCommitInput } from "@/components/blur-commit-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ABILITY_LABELS, LEADERSHIP_ROLES } from "@/lib/pf2e/kingdom";
import type { CharacterLite, KingdomData } from "./types";

const VACANT = "__vacant__";

export function LeadershipRoster({
  kingdom,
  characters,
  onRefresh,
  onChange,
  bare = false,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  onRefresh: () => void;
  /**
   * Called with a human-readable description of each successful edit. The Turn
   * tab passes this through to the turn log so re-shuffling leadership during
   * Upkeep is recorded like every other thing that happens in a turn; the
   * standalone Leadership tab leaves it off and nothing is logged.
   */
  onChange?: (label: string) => void;
  /** Skip the outer Card chrome — for embedding inside another card, e.g. the Turn tab's Assign Leadership Roles step. */
  bare?: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const byRole = new Map(kingdom.leadershipRoles.map((r) => [r.role, r]));
  const investedCount = kingdom.leadershipRoles.filter(
    (r) => r.invested,
  ).length;
  const pcs = characters.filter((c) => !c.isCompanion);
  const companions = characters.filter((c) => c.isCompanion);

  async function patchRole(
    role: string,
    body: Record<string, unknown>,
    logLabel?: string,
  ) {
    setPending(role);
    try {
      const res = await fetch("/api/kingdom/leadership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ...body }),
      });
      if (res.ok) {
        if (logLabel) onChange?.(logLabel);
        onRefresh();
      } else {
        toast.error("Couldn't update that leadership role. Try again.");
      }
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  function nameFor(characterId: string | null, npcName: string | null): string {
    if (characterId) {
      return characters.find((c) => c.id === characterId)?.name ?? "someone";
    }
    return npcName || "Vacant";
  }

  const roles = (
    <div className="space-y-3">
      {LEADERSHIP_ROLES.map((def) => {
        const row = byRole.get(def.id);
        const assignedValue = row?.characterId ?? VACANT;
        return (
          <div key={def.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium">{def.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  key {ABILITY_LABELS[def.keyAbility]}
                </span>
              </div>
              <Button
                size="sm"
                variant={row?.invested ? "default" : "outline"}
                disabled={pending === def.id}
                onClick={() =>
                  patchRole(
                    def.id,
                    { invested: !row?.invested },
                    `${def.name} ${row?.invested ? "divested" : "invested"} (${nameFor(
                      row?.characterId ?? null,
                      row?.npcName ?? null,
                    )})`,
                  )
                }
              >
                {row?.invested ? "Invested" : "Invest"}
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                value={assignedValue}
                onValueChange={(v) => {
                  const nextId = v && v !== VACANT ? v : null;
                  patchRole(
                    def.id,
                    { characterId: nextId },
                    `${def.name}: ${nameFor(row?.characterId ?? null, row?.npcName ?? null)} → ${nameFor(nextId, null)}`,
                  );
                }}
                disabled={pending === def.id}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VACANT} label="Vacant">
                    Vacant
                  </SelectItem>
                  {pcs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Party</SelectLabel>
                      {pcs.map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.name}>
                          {c.emoji ? `${c.emoji} ` : ""}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {companions.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Companions</SelectLabel>
                      {companions.map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.name}>
                          {c.emoji ? `${c.emoji} ` : ""}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>

              <BlurCommitInput
                className="h-7 w-40"
                placeholder="or NPC name"
                value={row?.npcName ?? ""}
                onCommit={(next) =>
                  patchRole(
                    def.id,
                    { npcName: next || null },
                    `${def.name}: ${nameFor(row?.characterId ?? null, row?.npcName ?? null)} → ${next || "Vacant"}`,
                  )
                }
              />
            </div>

            {!row?.characterId && !row?.npcName && (
              <p className="mt-2 text-xs text-destructive">
                Vacant — {def.vacancyPenalty}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  const badge = (
    <Badge variant={investedCount === 4 ? "secondary" : "outline"}>
      {investedCount} / 4 invested
    </Badge>
  );

  if (bare) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Invested roles grant a +1 status bonus to their key ability&apos;s
            Kingdom skills.
          </span>
          {badge}
        </div>
        {roles}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Leadership</CardTitle>
          {badge}
        </div>
      </CardHeader>
      <CardContent>{roles}</CardContent>
    </Card>
  );
}
