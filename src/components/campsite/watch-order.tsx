"use client";

/**
 * WatchOrder — assign characters to numbered watch shifts.
 * Each shift can have multiple characters; typically 3 shifts per night.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Save, Plus, Trash2 } from "lucide-react";

interface Character {
  id: string;
  name: string;
  isCompanion: boolean;
}

export interface WatchShiftData {
  shiftNumber: number;
  characterIds: string[];
}

export function WatchOrder({
  characters,
  layoutId,
  initialShifts,
}: {
  characters: Character[];
  layoutId: string | null;
  initialShifts: WatchShiftData[];
}) {
  const [shifts, setShifts] = useState<WatchShiftData[]>(
    initialShifts.length > 0
      ? initialShifts
      : [
          { shiftNumber: 1, characterIds: [] },
          { shiftNumber: 2, characterIds: [] },
          { shiftNumber: 3, characterIds: [] },
        ],
  );
  const [isPending, startTransition] = useTransition();

  function toggleCharOnShift(shiftNumber: number, charId: string) {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.shiftNumber !== shiftNumber) return s;
        const has = s.characterIds.includes(charId);
        return {
          ...s,
          characterIds: has
            ? s.characterIds.filter((id) => id !== charId)
            : [...s.characterIds, charId],
        };
      }),
    );
  }

  function addShift() {
    const next = shifts.length > 0 ? Math.max(...shifts.map((s) => s.shiftNumber)) + 1 : 1;
    setShifts((prev) => [...prev, { shiftNumber: next, characterIds: [] }]);
  }

  function removeShift(shiftNumber: number) {
    setShifts((prev) => prev.filter((s) => s.shiftNumber !== shiftNumber));
  }

  function save() {
    if (!layoutId) return;
    startTransition(async () => {
      await fetch(`/api/campsite/${layoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchShifts: shifts.map((s) => ({
            shiftNumber: s.shiftNumber,
            characterIds: s.characterIds,
          })),
        }),
      });
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Watch Order</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addShift}>
              <Plus className="mr-1 h-4 w-4" />
              Shift
            </Button>
            <Button size="sm" onClick={save} disabled={isPending || !layoutId}>
              <Save className="mr-1 h-4 w-4" />
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {shifts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add shifts to assign watch duty.
          </p>
        )}

        {shifts.map((shift) => (
          <div
            key={shift.shiftNumber}
            className="rounded-md border p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">
                Shift {shift.shiftNumber}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeShift(shift.shiftNumber)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {characters.filter((c) => !c.isCompanion).map((char) => {
                const assigned = shift.characterIds.includes(char.id);
                return (
                  <Badge
                    key={char.id}
                    variant={assigned ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() =>
                      toggleCharOnShift(shift.shiftNumber, char.id)
                    }
                  >
                    {char.name}
                  </Badge>
                );
              })}
              {characters.some((c) => c.isCompanion) && (
                <>
                  <span className="text-xs text-muted-foreground self-center">|</span>
                  {characters.filter((c) => c.isCompanion).map((char) => {
                    const assigned = shift.characterIds.includes(char.id);
                    return (
                      <Badge
                        key={char.id}
                        variant={assigned ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() =>
                          toggleCharOnShift(shift.shiftNumber, char.id)
                        }
                      >
                        🐾 {char.name}
                      </Badge>
                    );
                  })}
                </>
              )}
              {characters.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No characters
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
