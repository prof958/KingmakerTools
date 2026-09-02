"use client";

/**
 * KingdomShell — client wrapper for the Kingdom tab. Owns the shared PATCH
 * helper and router refresh, and lays the sections out under tabs.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BlurCommitInput } from "@/components/blur-commit-input";
import { KingdomOverview } from "./kingdom-overview";
import { KingdomSkills } from "./kingdom-skills";
import { LeadershipRoster } from "./leadership-roster";
import { FoundingChoices } from "./founding-choices";
import { KingdomMap } from "./kingdom-map";
import { SettlementsTab } from "./settlements-tab";
import { TurnTracker } from "./turn-tracker";
import type { CharacterLite, HexData, KingdomData, SettlementData, TurnData } from "./types";

export function KingdomShell({
  kingdom,
  characters,
  hexes,
  settlements,
  turns,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
  hexes: HexData[];
  settlements: SettlementData[];
  turns: TurnData[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");

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
        if (res.ok) {
          refresh();
        } else {
          toast.error("Couldn't save that kingdom change. Try again.");
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
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
          <BlurCommitInput
            className="h-9 w-64 text-lg font-semibold"
            value={kingdom.name}
            onCommit={(next) => {
              if (next) patchKingdom({ name: next });
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

      {/* Controlled rather than defaultValue so the Turn tab can send you
          straight to the tab a step's outcome needs (the Map to give up a hex,
          Settlements to place a structure) instead of just naming it. */}
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="turn">Turn</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="founding">Founding</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <KingdomOverview kingdom={kingdom} onPatch={patchKingdom} />
        </TabsContent>
        <TabsContent value="turn">
          <TurnTracker
            kingdom={kingdom}
            characters={characters}
            hexes={hexes}
            settlements={settlements}
            turns={turns}
            onPatchKingdom={patchKingdom}
            onRefresh={refresh}
            onNavigate={setTab}
          />
        </TabsContent>
        <TabsContent value="map">
          <KingdomMap hexes={hexes} />
        </TabsContent>
        <TabsContent value="settlements">
          <SettlementsTab settlements={settlements} hexes={hexes} kingdomLevel={kingdom.level} />
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
