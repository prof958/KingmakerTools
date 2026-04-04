"use client";

/**
 * ActivityPicker — assign camping activities to characters.
 * Each character can pick one activity per camping session.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UtensilsCrossed, Save, Trash2, PawPrint } from "lucide-react";
import {
  CAMPING_ACTIVITIES,
  type CheckResult,
} from "@/lib/pf2e/camping";

export interface ActivityAssignment {
  characterId: string;
  characterName: string;
  activityType: string;
  skill: string | null;
  result: CheckResult | null;
}

interface Character {
  id: string;
  name: string;
  isCompanion: boolean;
}

export function ActivityPicker({
  characters,
  layoutId,
  initialActivities,
}: {
  characters: Character[];
  layoutId: string | null;
  initialActivities: ActivityAssignment[];
}) {
  const [activities, setActivities] =
    useState<ActivityAssignment[]>(initialActivities);
  const [isPending, startTransition] = useTransition();

  function setActivity(charId: string, activityId: string | null) {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;

    if (!activityId) {
      setActivities((prev) => prev.filter((a) => a.characterId !== charId));
      return;
    }

    const def = CAMPING_ACTIVITIES.find((a) => a.id === activityId);
    if (!def) return;

    setActivities((prev) => {
      const existing = prev.find((a) => a.characterId === charId);
      if (existing) {
        return prev.map((a) =>
          a.characterId === charId
            ? { ...a, activityType: activityId, skill: def.skill, result: null }
            : a,
        );
      }
      return [
        ...prev,
        {
          characterId: charId,
          characterName: char.name,
          activityType: activityId,
          skill: def.skill,
          result: null,
        },
      ];
    });
  }

  function setResult(charId: string, result: CheckResult | null) {
    setActivities((prev) =>
      prev.map((a) => (a.characterId === charId ? { ...a, result } : a)),
    );
  }

  function removeActivity(charId: string) {
    setActivities((prev) => prev.filter((a) => a.characterId !== charId));
  }

  function save() {
    if (!layoutId) return;
    startTransition(async () => {
      await fetch(`/api/campsite/${layoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campingActivities: activities.map((a) => ({
            characterId: a.characterId,
            activityType: a.activityType,
            skill: a.skill,
            result: a.result,
          })),
        }),
      });
    });
  }

  const resultOptions: { value: CheckResult; label: string; color: string }[] =
    [
      { value: "critical_success", label: "Crit Success", color: "text-green-400" },
      { value: "success", label: "Success", color: "text-blue-400" },
      { value: "failure", label: "Failure", color: "text-orange-400" },
      { value: "critical_failure", label: "Crit Failure", color: "text-red-400" },
    ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            <CardTitle>Camping Activities</CardTitle>
          </div>
          <Button size="sm" onClick={save} disabled={isPending || !layoutId}>
            <Save className="mr-1 h-4 w-4" />
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {characters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add characters on the Inventory page first.
          </p>
        )}

        {characters.filter((c) => !c.isCompanion).map((char) => {
          const assignment = activities.find(
            (a) => a.characterId === char.id,
          );
          const activityDef = assignment
            ? CAMPING_ACTIVITIES.find((a) => a.id === assignment.activityType)
            : undefined;

          return (
            <ActivityRow
              key={char.id}
              char={char}
              assignment={assignment}
              activityDef={activityDef}
              setActivity={setActivity}
              setResult={setResult}
              removeActivity={removeActivity}
              resultOptions={resultOptions}
            />
          );
        })}

        {characters.some((c) => c.isCompanion) && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <PawPrint className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
              <div className="flex-1 border-t border-border" />
            </div>
            {characters.filter((c) => c.isCompanion).map((char) => {
              const assignment = activities.find(
                (a) => a.characterId === char.id,
              );
              const activityDef = assignment
                ? CAMPING_ACTIVITIES.find((a) => a.id === assignment.activityType)
                : undefined;

              return (
                <ActivityRow
                  key={char.id}
                  char={char}
                  assignment={assignment}
                  activityDef={activityDef}
                  setActivity={setActivity}
                  setResult={setResult}
                  removeActivity={removeActivity}
                  resultOptions={resultOptions}
                />
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type CampingActivityDef = (typeof CAMPING_ACTIVITIES)[number];

function ActivityRow({
  char,
  assignment,
  activityDef,
  setActivity,
  setResult,
  removeActivity,
  resultOptions,
}: {
  char: Character;
  assignment: ActivityAssignment | undefined;
  activityDef: CampingActivityDef | undefined;
  setActivity: (charId: string, activityId: string | null) => void;
  setResult: (charId: string, result: CheckResult | null) => void;
  removeActivity: (charId: string) => void;
  resultOptions: { value: CheckResult; label: string; color: string }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <span className="w-28 shrink-0 font-medium text-sm">{char.name}</span>

      <Select
        value={assignment?.activityType ?? ""}
        onValueChange={(val) => setActivity(char.id, val || null)}
        items={Object.fromEntries(CAMPING_ACTIVITIES.map((a) => [a.id, a.name]))}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Choose activity…" />
        </SelectTrigger>
        <SelectContent>
          {CAMPING_ACTIVITIES.map((act) => (
            <SelectItem key={act.id} value={act.id} label={act.name}>
              {act.name}
              {act.isRequired && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  Req
                </Badge>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {assignment && (
        <Select
          value={assignment.result ?? ""}
          onValueChange={(val) =>
            setResult(char.id, (val as CheckResult) || null)
          }
          items={Object.fromEntries(
            resultOptions.map((r) => [r.value, r.label]),
          )}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Result…" />
          </SelectTrigger>
          <SelectContent>
            {resultOptions.map((r) => (
              <SelectItem key={r.value} value={r.value} label={r.label}>
                <span className={r.color}>{r.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {activityDef && (
        <Badge variant="outline" className="text-xs">
          {activityDef.skill}
        </Badge>
      )}

      {assignment && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => removeActivity(char.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
