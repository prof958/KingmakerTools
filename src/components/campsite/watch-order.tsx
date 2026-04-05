"use client";

/**
 * WatchOrder — drag-and-drop ordered list of characters assigned to watch shifts.
 * Position in list determines shift assignment; shift count is configurable.
 */

import { useState, useMemo, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { Eye, Save, Plus, Trash2, GripVertical } from "lucide-react";

interface Character {
  id: string;
  name: string;
  isCompanion: boolean;
}

export interface WatchShiftData {
  shiftNumber: number;
  characterIds: string[];
}

/* ── helpers ── */

function flattenShifts(shifts: WatchShiftData[]): string[] {
  return [...shifts]
    .sort((a, b) => a.shiftNumber - b.shiftNumber)
    .flatMap((s) => s.characterIds);
}

function buildShiftMap(
  orderedIds: string[],
  shiftCount: number,
): Map<string, number> {
  const map = new Map<string, number>();
  if (orderedIds.length === 0 || shiftCount < 1) return map;
  const base = Math.floor(orderedIds.length / shiftCount);
  const remainder = orderedIds.length % shiftCount;
  let idx = 0;
  for (let s = 0; s < shiftCount; s++) {
    const size = base + (s < remainder ? 1 : 0);
    for (let i = 0; i < size; i++) {
      map.set(orderedIds[idx], s + 1);
      idx++;
    }
  }
  return map;
}

function shiftBoundaries(
  orderedIds: string[],
  shiftCount: number,
): Set<number> {
  const set = new Set<number>();
  if (orderedIds.length === 0 || shiftCount < 2) return set;
  const base = Math.floor(orderedIds.length / shiftCount);
  const remainder = orderedIds.length % shiftCount;
  let idx = 0;
  for (let s = 0; s < shiftCount - 1; s++) {
    idx += base + (s < remainder ? 1 : 0);
    if (idx < orderedIds.length) set.add(idx);
  }
  return set;
}

function toWatchShifts(
  orderedIds: string[],
  shiftCount: number,
): WatchShiftData[] {
  const shifts: WatchShiftData[] = [];
  const base = Math.floor(orderedIds.length / shiftCount);
  const remainder = orderedIds.length % shiftCount;
  let idx = 0;
  for (let s = 0; s < shiftCount; s++) {
    const size = base + (s < remainder ? 1 : 0);
    shifts.push({
      shiftNumber: s + 1,
      characterIds: orderedIds.slice(idx, idx + size),
    });
    idx += size;
  }
  return shifts;
}

/* ── sortable row ── */

function SortableWatchItem({
  id,
  name,
  isCompanion,
  shiftLabel,
  onRemove,
}: {
  id: string;
  name: string;
  isCompanion: boolean;
  shiftLabel: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm truncate">
        {isCompanion ? `🐾 ${name}` : name}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {shiftLabel}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ── main component ── */

export function WatchOrder({
  characters,
  layoutId,
  initialShifts,
}: {
  characters: Character[];
  layoutId: string | null;
  initialShifts: WatchShiftData[];
}) {
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    flattenShifts(initialShifts),
  );
  const [shiftCount, setShiftCount] = useState(
    initialShifts.length > 0 ? initialShifts.length : 3,
  );
  const [addCharId, setAddCharId] = useState("");
  const [isPending, startTransition] = useTransition();

  const charMap = useMemo(
    () => new Map(characters.map((c) => [c.id, c])),
    [characters],
  );

  const shiftMap = useMemo(
    () => buildShiftMap(orderedIds, shiftCount),
    [orderedIds, shiftCount],
  );

  const boundaries = useMemo(
    () => shiftBoundaries(orderedIds, shiftCount),
    [orderedIds, shiftCount],
  );

  const unusedChars = useMemo(
    () => characters.filter((c) => !orderedIds.includes(c.id)),
    [characters, orderedIds],
  );

  /* sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedIds((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function addCharacter() {
    if (!addCharId) return;
    setOrderedIds((prev) => [...prev, addCharId]);
    setAddCharId("");
  }

  function removeCharacter(id: string) {
    setOrderedIds((prev) => prev.filter((cid) => cid !== id));
  }

  function save() {
    if (!layoutId) return;
    startTransition(async () => {
      await fetch(`/api/campsite/${layoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchShifts: toWatchShifts(orderedIds, shiftCount),
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
            <span className="text-xs text-muted-foreground">Shifts</span>
            <NumberInput
              className="w-14 h-8"
              value={shiftCount}
              onValueChange={setShiftCount}
              min={1}
              max={10}
            />
            <Button size="sm" onClick={save} disabled={isPending || !layoutId}>
              <Save className="mr-1 h-4 w-4" />
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add character */}
        {unusedChars.length > 0 && (
          <div className="flex gap-2">
            <Select value={addCharId} onValueChange={(v) => setAddCharId(v ?? "")}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add a character…" />
              </SelectTrigger>
              <SelectContent>
                {unusedChars.filter((c) => !c.isCompanion).length > 0 && (
                  <>
                    {unusedChars
                      .filter((c) => !c.isCompanion)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </>
                )}
                {unusedChars.filter((c) => c.isCompanion).length > 0 && (
                  <>
                    {unusedChars
                      .filter((c) => c.isCompanion)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          🐾 {c.name}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addCharacter} disabled={!addCharId}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Sortable list */}
        {orderedIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add characters to assign watch duty.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {orderedIds.map((id, idx) => {
                  const char = charMap.get(id);
                  if (!char) return null;
                  return (
                    <div key={id}>
                      {boundaries.has(idx) && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex-1 border-t border-dashed" />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Shift {(shiftMap.get(id) ?? 1)}
                          </span>
                          <div className="flex-1 border-t border-dashed" />
                        </div>
                      )}
                      <SortableWatchItem
                        id={id}
                        name={char.name}
                        isCompanion={char.isCompanion}
                        shiftLabel={`Shift ${shiftMap.get(id) ?? 1}`}
                        onRemove={() => removeCharacter(id)}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {orderedIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Drag to reorder. Characters are split evenly across {shiftCount}{" "}
            shift{shiftCount !== 1 ? "s" : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
