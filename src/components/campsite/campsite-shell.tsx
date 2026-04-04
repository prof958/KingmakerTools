"use client";

/**
 * CampsiteShell — client wrapper that orchestrates all campsite sub-components.
 * Loads the react-konva canvas via dynamic import (no SSR).
 */

import { useEffect, useTransition, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tent, Save, Plus, Trash2, RotateCcw } from "lucide-react";
import {
  useCampsiteStore,
  ELEMENT_PALETTE,
  type CampElement,
} from "@/stores/campsite-store";
import { ActivityPicker, type ActivityAssignment } from "./activity-picker";
import { WatchOrder, type WatchShiftData } from "./watch-order";
import { RecipeBook, type RecipeData } from "./recipe-book";

// Dynamic import for react-konva canvas (no SSR)
const CampsiteCanvas = dynamic(() => import("./campsite-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-md border bg-muted/50">
      <p className="text-sm text-muted-foreground">Loading canvas…</p>
    </div>
  ),
});

// ─── Types for server data ───

interface LayoutData {
  id: string;
  name: string;
  isActive: boolean;
  elements: CampElement[];
  watchShifts: { shiftNumber: number; characterIds: string[] }[];
  campingActivities: {
    characterId: string;
    activityType: string;
    skill: string | null;
    result: string | null;
    character: { id: string; name: string };
  }[];
}

interface Character {
  id: string;
  name: string;
  isCompanion: boolean;
}

// ─── Component ───

export function CampsiteShell({
  initialLayouts,
  characters,
  recipes,
}: {
  initialLayouts: LayoutData[];
  characters: Character[];
  recipes: RecipeData[];
}) {
  const store = useCampsiteStore();
  const [layouts, setLayouts] = useState<LayoutData[]>(initialLayouts);
  const [isPending, startTransition] = useTransition();

  // Load active layout into store on mount
  useEffect(() => {
    const active = layouts.find((l) => l.isActive) ?? layouts[0];
    if (active) {
      store.setLayout(
        active.id,
        active.name,
        Array.isArray(active.elements) ? active.elements : [],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLayout = layouts.find((l) => l.id === store.layoutId);

  // Derive activity assignments for current layout
  const activityAssignments: ActivityAssignment[] = (
    activeLayout?.campingActivities ?? []
  ).map((a) => ({
    characterId: a.characterId,
    characterName: a.character.name,
    activityType: a.activityType,
    skill: a.skill,
    result: (a.result as ActivityAssignment["result"]) ?? null,
  }));

  // Derive watch shifts
  const watchShifts: WatchShiftData[] = (
    activeLayout?.watchShifts ?? []
  ).map((s) => ({
    shiftNumber: s.shiftNumber,
    characterIds: s.characterIds,
  }));

  // ─── Actions ───

  const createLayout = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/campsite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Camp" }),
      });
      if (res.ok) {
        const created = await res.json();
        setLayouts((prev) =>
          prev.map((l) => ({ ...l, isActive: false })).concat({
            ...created,
            watchShifts: [],
            campingActivities: [],
            elements: [],
          }),
        );
        store.setLayout(created.id, created.name, []);
      }
    });
  }, [store]);

  const saveLayout = useCallback(() => {
    if (!store.layoutId) return;
    startTransition(async () => {
      store.setSaving(true);
      try {
        await fetch(`/api/campsite/${store.layoutId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: store.layoutName,
            elements: store.elements,
          }),
        });
        // Sync saved data back into local layouts state so switching works
        setLayouts((prev) =>
          prev.map((l) =>
            l.id === store.layoutId
              ? { ...l, name: store.layoutName, elements: [...store.elements] }
              : l,
          ),
        );
        store.markSaved();
      } finally {
        store.setSaving(false);
      }
    });
  }, [store]);

  const deleteLayout = useCallback(() => {
    if (!store.layoutId) return;
    startTransition(async () => {
      const res = await fetch(`/api/campsite/${store.layoutId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLayouts((prev) => prev.filter((l) => l.id !== store.layoutId));
        store.resetCanvas();
        // Load first remaining layout
        const remaining = layouts.filter((l) => l.id !== store.layoutId);
        if (remaining.length > 0) {
          const next = remaining[0];
          store.setLayout(
            next.id,
            next.name,
            Array.isArray(next.elements) ? next.elements : [],
          );
        }
      }
    });
  }, [store, layouts]);

  const switchLayout = useCallback(
    (layoutId: string) => {
      if (store.isDirty) {
        const ok = window.confirm(
          "You have unsaved changes. Switch layout and discard them?",
        );
        if (!ok) return;
      }
      const layout = layouts.find((l) => l.id === layoutId);
      if (layout) {
        store.setLayout(
          layout.id,
          layout.name,
          Array.isArray(layout.elements) ? layout.elements : [],
        );
      }
    },
    [layouts, store],
  );

  // Compute the center of the current viewport in canvas coordinates
  const getViewportCenter = useCallback(() => {
    // Approximate canvas size (matches CampsiteCanvas default)
    const canvasW = 800;
    const canvasH = 500;
    const { stageX, stageY, scale } = useCampsiteStore.getState();
    return {
      x: Math.round((-stageX + canvasW / 2) / scale),
      y: Math.round((-stageY + canvasH / 2) / scale),
    };
  }, []);

  // Add element to canvas
  const addCanvasElement = useCallback(
    (type: (typeof ELEMENT_PALETTE)[number]["type"]) => {
      const palette = ELEMENT_PALETTE.find((p) => p.type === type);
      if (!palette) return;
      const center = getViewportCenter();
      const el: CampElement = {
        id: crypto.randomUUID(),
        type,
        label: palette.label,
        x: center.x + Math.round(Math.random() * 60 - 30),
        y: center.y + Math.round(Math.random() * 60 - 30),
      };
      store.addElement(el);
    },
    [store],
  );

  // Add character token to canvas
  const addCharacterToken = useCallback(
    (char: Character) => {
      // Don't add if already on canvas
      if (store.elements.some((el) => el.characterId === char.id)) return;
      const center = getViewportCenter();
      const el: CampElement = {
        id: crypto.randomUUID(),
        type: "character",
        label: char.name,
        characterId: char.id,
        x: center.x + Math.round(Math.random() * 60 - 30),
        y: center.y + Math.round(Math.random() * 60 - 30),
      };
      store.addElement(el);
    },
    [store],
  );

  const removeSelected = useCallback(() => {
    if (store.selectedId) {
      store.removeElement(store.selectedId);
    }
  }, [store]);

  return (
    <Tabs defaultValue="layout" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="layout">Camp Layout</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="watch">Watch Order</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
        </TabsList>
      </div>

      {/* ─── Layout Tab ─── */}
      <TabsContent value="layout" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Tent className="h-5 w-5" />
                <CardTitle>Camp Layout</CardTitle>
                {store.isDirty && (
                  <Badge variant="secondary" className="text-xs">
                    Unsaved
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Layout switcher */}
                {layouts.length > 0 && (
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={store.layoutId ?? ""}
                    onChange={(e) => switchLayout(e.target.value)}
                  >
                    {layouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}

                <Button variant="outline" size="sm" onClick={createLayout} disabled={isPending}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">New</span>
                </Button>
                <Button size="sm" onClick={saveLayout} disabled={isPending || !store.isDirty}>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">{store.isSaving ? "Saving…" : "Save"}</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteLayout}
                  disabled={isPending || !store.layoutId}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Delete</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Layout name */}
            <div className="flex items-center gap-2">
              <Input
                value={store.layoutName}
                onChange={(e) => {
                  useCampsiteStore.setState({
                    layoutName: e.target.value,
                    isDirty: true,
                  });
                }}
                className="max-w-xs"
                placeholder="Camp name"
              />
              <Button variant="ghost" size="icon" onClick={() => store.setViewport(0, 0, 1)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Element palette toolbar */}
            <div className="flex flex-wrap gap-2">
              {ELEMENT_PALETTE.map((p) => (
                <Button
                  key={p.type}
                  variant="outline"
                  size="sm"
                  onClick={() => addCanvasElement(p.type)}
                >
                  {p.emoji} {p.label}
                </Button>
              ))}
              {characters.map((char) => (
                <Button
                  key={char.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addCharacterToken(char)}
                  disabled={store.elements.some(
                    (el) => el.characterId === char.id,
                  )}
                >
                  🧑 {char.name}
                </Button>
              ))}
              {store.selectedId && (
                <Button variant="destructive" size="sm" onClick={removeSelected}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>

            {/* Canvas */}
            <CampsiteCanvas />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Activities Tab ─── */}
      <TabsContent value="activities">
        <ActivityPicker
          characters={characters}
          layoutId={store.layoutId}
          initialActivities={activityAssignments}
        />
      </TabsContent>

      {/* ─── Watch Tab ─── */}
      <TabsContent value="watch">
        <WatchOrder
          characters={characters}
          layoutId={store.layoutId}
          initialShifts={watchShifts}
        />
      </TabsContent>

      {/* ─── Recipes Tab ─── */}
      <TabsContent value="recipes">
        <RecipeBook initialRecipes={recipes} />
      </TabsContent>
    </Tabs>
  );
}
