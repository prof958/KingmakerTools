"use client";

/**
 * LeadershipRoster — assign the 8 leadership roles to party characters or NPCs
 * and choose which are invested (invested roles grant a +1 status bonus to the
 * key ability's Kingdom skills). The rules expect 4 invested roles.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const byRole = new Map(kingdom.leadershipRoles.map((r) => [r.role, r]));
  const investedCount = kingdom.leadershipRoles.filter((r) => r.invested).length;
  const pcs = characters.filter((c) => !c.isCompanion);
  const companions = characters.filter((c) => c.isCompanion);

  async function patchRole(role: string, body: Record<string, unknown>) {
    setPending(role);
    try {
      const res = await fetch("/api/kingdom/leadership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ...body }),
      });
      if (res.ok) onRefresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Leadership</CardTitle>
          <Badge variant={investedCount === 4 ? "secondary" : "outline"}>
            {investedCount} / 4 invested
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  onClick={() => patchRole(def.id, { invested: !row?.invested })}
                >
                  {row?.invested ? "Invested" : "Invest"}
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={assignedValue}
                  onValueChange={(v) =>
                    patchRole(def.id, { characterId: v && v !== VACANT ? v : null })
                  }
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

                <Input
                  className="h-7 w-40"
                  placeholder="or NPC name"
                  defaultValue={row?.npcName ?? ""}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next !== (row?.npcName ?? "")) {
                      patchRole(def.id, { npcName: next || null });
                    }
                  }}
                />
              </div>

              {!row?.characterId && !row?.npcName && (
                <p className="mt-2 text-xs text-destructive">Vacant — {def.vacancyPenalty}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
