"use client";

/**
 * KingdomShell — client wrapper for the Kingdom tab. Owns the shared PATCH
 * helper and router refresh, and lays the sections out under tabs.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { KingdomOverview } from "./kingdom-overview";
import { KingdomSkills } from "./kingdom-skills";
import { LeadershipRoster } from "./leadership-roster";
import { FoundingChoices } from "./founding-choices";
import { KingdomMap } from "./kingdom-map";
import type { CharacterLite, HexData, KingdomData } from "./types";

export function KingdomShell({
  kingdom,
  characters,
  hexes,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  hexes: HexData[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  const patchKingdom = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/kingdom", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input
            className="h-9 w-64 text-lg font-semibold"
            defaultValue={kingdom.name}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== kingdom.name) patchKingdom({ name: next });
            }}
          />
          <Badge variant="outline">Level {kingdom.level}</Badge>
          <Badge variant="secondary">
            {kingdom.ruleset === "VK" ? "V&K rules" : "RAW"}
          </Badge>
          {kingdom.atWar && <Badge variant="destructive">At war</Badge>}
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="founding">Founding</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <KingdomOverview kingdom={kingdom} onPatch={patchKingdom} />
        </TabsContent>
        <TabsContent value="map">
          <KingdomMap hexes={hexes} />
        </TabsContent>
        <TabsContent value="skills">
          <KingdomSkills kingdom={kingdom} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="leadership">
          <LeadershipRoster kingdom={kingdom} characters={characters} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="founding">
          <FoundingChoices kingdom={kingdom} onPatch={patchKingdom} onDeleted={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
