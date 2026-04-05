"use client";

/**
 * ActivityPicker — assign camping activities to characters.
 * Each character can pick one activity per camping session.
 * Supports built-in AoN activities + campaign-scoped custom activities.
 */

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UtensilsCrossed, Save, Trash2, PawPrint, Plus, Settings2 } from "lucide-react";
import {
  CAMPING_ACTIVITIES,
  type CampingActivityDef,
  type CheckResult,
} from "@/lib/pf2e/camping";
import type { CustomCampActivityData } from "./campsite-shell";

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

/** Unified shape for selects (built-in or custom). */
interface ActivityOption {
  id: string;
  name: string;
  skill: string | null;
  isRequired: boolean;
  isCustom: boolean;
}

export function ActivityPicker({
  characters,
  layoutId,
  initialActivities,
  customActivities,
  onCustomActivitiesChange,
  onSave: onSaveCallback,
}: {
  characters: Character[];
  layoutId: string | null;
  initialActivities: ActivityAssignment[];
  customActivities: CustomCampActivityData[];
  onCustomActivitiesChange: (activities: CustomCampActivityData[]) => void;
  onSave?: (activities: ActivityAssignment[]) => void;
}) {
  const [activities, setActivities] =
    useState<ActivityAssignment[]>(initialActivities);
  const [isPending, startTransition] = useTransition();
  const [showManager, setShowManager] = useState(false);

  // Merge built-in + custom into a unified list
  const allActivities: ActivityOption[] = useMemo(() => {
    const builtIn: ActivityOption[] = CAMPING_ACTIVITIES.map((a) => ({
      id: a.id,
      name: a.name,
      skill: a.skill,
      isRequired: a.isRequired,
      isCustom: false,
    }));
    const custom: ActivityOption[] = customActivities.map((a) => ({
      id: `custom:${a.id}`,
      name: a.name,
      skill: a.skill,
      isRequired: false,
      isCustom: true,
    }));
    return [...builtIn, ...custom];
  }, [customActivities]);

  function findActivity(activityId: string): ActivityOption | undefined {
    return allActivities.find((a) => a.id === activityId);
  }

  function setActivity(charId: string, activityId: string | null) {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;

    if (!activityId) {
      setActivities((prev) => prev.filter((a) => a.characterId !== charId));
      return;
    }

    const def = findActivity(activityId);
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
      const res = await fetch(`/api/campsite/${layoutId}`, {
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
      if (res.ok) {
        onSaveCallback?.(activities);
      }
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              <CardTitle>Camping Activities</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManager((v) => !v)}
              >
                <Settings2 className="mr-1 h-4 w-4" />
                Custom
              </Button>
              <Button size="sm" onClick={save} disabled={isPending || !layoutId}>
                <Save className="mr-1 h-4 w-4" />
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
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
              ? findActivity(assignment.activityType)
              : undefined;

            return (
              <ActivityRow
                key={char.id}
                char={char}
                assignment={assignment}
                activityDef={activityDef}
                allActivities={allActivities}
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
                  ? findActivity(assignment.activityType)
                  : undefined;

                return (
                  <ActivityRow
                    key={char.id}
                    char={char}
                    assignment={assignment}
                    activityDef={activityDef}
                    allActivities={allActivities}
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

      {showManager && (
        <CustomActivityManager
          customActivities={customActivities}
          onChange={onCustomActivitiesChange}
        />
      )}
    </div>
  );
}

// ─── ActivityRow ───

function ActivityRow({
  char,
  assignment,
  activityDef,
  allActivities,
  setActivity,
  setResult,
  removeActivity,
  resultOptions,
}: {
  char: Character;
  assignment: ActivityAssignment | undefined;
  activityDef: ActivityOption | undefined;
  allActivities: ActivityOption[];
  setActivity: (charId: string, activityId: string | null) => void;
  setResult: (charId: string, result: CheckResult | null) => void;
  removeActivity: (charId: string) => void;
  resultOptions: { value: CheckResult; label: string; color: string }[];
}) {
  const builtInActivities = allActivities.filter((a) => !a.isCustom);
  const customActivities = allActivities.filter((a) => a.isCustom);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <span className="w-28 shrink-0 font-medium text-sm">{char.name}</span>

      <Select
        value={assignment?.activityType ?? ""}
        onValueChange={(val) => setActivity(char.id, val || null)}
        items={Object.fromEntries(allActivities.map((a) => [a.id, a.name]))}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Choose activity…" />
        </SelectTrigger>
        <SelectContent>
          {builtInActivities.map((act) => (
            <SelectItem key={act.id} value={act.id} label={act.name}>
              {act.name}
              {act.isRequired && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  Req
                </Badge>
              )}
            </SelectItem>
          ))}
          {customActivities.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Custom
              </div>
              {customActivities.map((act) => (
                <SelectItem key={act.id} value={act.id} label={act.name}>
                  {act.name}
                </SelectItem>
              ))}
            </>
          )}
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

      {activityDef?.skill && activityDef.skill !== "None" && (
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

// ─── Custom Activity Manager ───

function CustomActivityManager({
  customActivities,
  onChange,
}: {
  customActivities: CustomCampActivityData[];
  onChange: (activities: CustomCampActivityData[]) => void;
}) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function addActivity() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/camp-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          skill: skill.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onChange([...customActivities, created]);
        setName("");
        setSkill("");
        setDescription("");
      }
    });
  }

  function removeActivity(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/camp-activities/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onChange(customActivities.filter((a) => a.id !== id));
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          <CardTitle>Custom Activities</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Add learned companion activities or homebrew camping activities here.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing custom activities */}
        {customActivities.map((act) => (
          <div
            key={act.id}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <span className="flex-1 text-sm font-medium">{act.name}</span>
            {act.skill && (
              <Badge variant="outline" className="text-xs">
                {act.skill}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeActivity(act.id)}
              disabled={isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {customActivities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No custom activities yet.
          </p>
        )}

        {/* Add form */}
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Activity name…"
              className="flex-1"
            />
            <Input
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="Skill (optional)…"
              className="w-40"
            />
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)…"
          />
          <Button
            size="sm"
            onClick={addActivity}
            disabled={isPending || !name.trim()}
            className="self-start"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
