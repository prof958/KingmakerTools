"use client";

/**
 * FoundingChoices — Kingdom Creation steps 2–5: charter, heartland, government,
 * and the free / finalize ability boosts. Shows the ability scores these
 * choices imply and lets the player write them onto the kingdom in one click.
 */

import { useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
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
import {
  ABILITY_LABELS,
  CHARTERS,
  GOVERNMENTS,
  HEARTLANDS,
  KINGDOM_ABILITIES,
  computeAbilityScores,
  finalizeBoostCount,
  getCharter,
  getGovernment,
  getKingdomSkill,
  type KingdomAbility,
} from "@/lib/pf2e/kingdom";
import { ABILITY_KEYS, type KingdomData } from "./types";

const NONE = "__none__";

function AbilitySelect({
  value,
  onChange,
  disabledAbilities = [],
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabledAbilities?: KingdomAbility[];
  placeholder: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v && v !== NONE ? v : null)}>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} label={placeholder}>
          {placeholder}
        </SelectItem>
        {KINGDOM_ABILITIES.map((a) => (
          <SelectItem
            key={a}
            value={a}
            label={ABILITY_LABELS[a]}
            disabled={disabledAbilities.includes(a)}
          >
            {ABILITY_LABELS[a]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FoundingChoices({
  kingdom,
  onPatch,
  onDeleted,
}: {
  kingdom: KingdomData;
  onPatch: (patch: Record<string, unknown>) => void;
  /** Called after the kingdom is deleted, so the parent can reload into the founding wizard. */
  onDeleted?: () => void;
}) {
  const boostCount = finalizeBoostCount(kingdom.ruleset);
  const charter = getCharter(kingdom.charter);
  const government = getGovernment(kingdom.government);

  const preview = useMemo(
    () =>
      computeAbilityScores({
        charter: kingdom.charter,
        charterFreeBoost: kingdom.charterFreeBoost as KingdomAbility | null,
        heartland: kingdom.heartland,
        government: kingdom.government,
        governmentFreeBoost: kingdom.governmentFreeBoost as KingdomAbility | null,
        finalizeBoosts: kingdom.finalizeBoosts as KingdomAbility[],
      }),
    [kingdom],
  );

  const currentScores: Record<KingdomAbility, number> = {
    culture: kingdom.culture,
    economy: kingdom.economy,
    loyalty: kingdom.loyalty,
    stability: kingdom.stability,
  };
  const matches = ABILITY_KEYS.every((a) => currentScores[a] === preview.scores[a]);

  const finalizeBoosts = kingdom.finalizeBoosts ?? [];
  function setFinalizeBoost(index: number, value: string | null) {
    const next = [...finalizeBoosts];
    if (value) next[index] = value;
    else next.splice(index, 1);
    onPatch({ finalizeBoosts: next.filter(Boolean) });
  }

  const governmentFlawAbilities = government ? government.boosts : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Founding Choices</CardTitle>
            <div className="flex gap-1">
              {(["VK", "RAW"] as const).map((rs) => (
                <Button
                  key={rs}
                  size="sm"
                  variant={kingdom.ruleset === rs ? "default" : "outline"}
                  onClick={() => onPatch({ ruleset: rs })}
                >
                  {rs === "VK" ? "Vance & Kerenshara" : "Rules as written"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Charter */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-medium">Charter</span>
              <Select
                value={kingdom.charter ?? NONE}
                onValueChange={(v) => onPatch({ charter: v && v !== NONE ? v : null })}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} label="Choose…">
                    Choose…
                  </SelectItem>
                  {CHARTERS.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {charter && (
                <AbilitySelect
                  value={kingdom.charterFreeBoost}
                  onChange={(v) => onPatch({ charterFreeBoost: v })}
                  disabledAbilities={
                    [charter.boost, charter.flaw].filter(Boolean) as KingdomAbility[]
                  }
                  placeholder="free boost"
                />
              )}
            </div>
            {charter && (
              <p className="text-xs text-muted-foreground">
                {charter.boost && <>Boost {ABILITY_LABELS[charter.boost]} · </>}
                {charter.flaw && <>Flaw {ABILITY_LABELS[charter.flaw]} · </>}
                {charter.description}
              </p>
            )}
          </div>

          {/* Heartland */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm font-medium">Heartland</span>
            <Select
              value={kingdom.heartland ?? NONE}
              onValueChange={(v) => onPatch({ heartland: v && v !== NONE ? v : null })}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} label="Choose…">
                  Choose…
                </SelectItem>
                {HEARTLANDS.map((h) => (
                  <SelectItem key={h.id} value={h.id} label={h.name}>
                    {h.name} (+{ABILITY_LABELS[h.boost]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Government */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-medium">Government</span>
              <Select
                value={kingdom.government ?? NONE}
                onValueChange={(v) => onPatch({ government: v && v !== NONE ? v : null })}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} label="Choose…">
                    Choose…
                  </SelectItem>
                  {GOVERNMENTS.map((g) => (
                    <SelectItem key={g.id} value={g.id} label={g.name}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {government && (
                <AbilitySelect
                  value={kingdom.governmentFreeBoost}
                  onChange={(v) => onPatch({ governmentFreeBoost: v })}
                  disabledAbilities={governmentFlawAbilities}
                  placeholder="free boost"
                />
              )}
            </div>
            {government && (
              <p className="text-xs text-muted-foreground">
                Boost {ABILITY_LABELS[government.boosts[0]]} &amp;{" "}
                {ABILITY_LABELS[government.boosts[1]]} · Trained in{" "}
                {government.skills.map((s) => getKingdomSkill(s)?.name ?? s).join(" &amp; ")} · Bonus
                feat {government.bonusFeat}
              </p>
            )}
          </div>

          {/* Finalize boosts */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm font-medium">Finalize</span>
            {Array.from({ length: boostCount }).map((_, i) => (
              <AbilitySelect
                key={i}
                value={finalizeBoosts[i] ?? null}
                onChange={(v) => setFinalizeBoost(i, v)}
                placeholder={`boost ${i + 1}`}
              />
            ))}
            <span className="text-xs text-muted-foreground">
              {kingdom.ruleset === "VK" ? "3 free boosts (house rule)" : "2 free boosts"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ability scores from these choices</CardTitle>
            {matches ? (
              <Badge variant="secondary">In sync</Badge>
            ) : (
              <Button size="sm" onClick={() => onPatch(preview.scores)}>
                Apply to kingdom
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {ABILITY_KEYS.map((a) => (
              <div key={a} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{ABILITY_LABELS[a]}</div>
                <div className="text-2xl font-bold tabular-nums">
                  {preview.scores[a]}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({preview.modifiers[a] >= 0 ? "+" : ""}
                    {preview.modifiers[a]})
                  </span>
                </div>
                {currentScores[a] !== preview.scores[a] && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400">
                    currently {currentScores[a]}
                  </div>
                )}
                {preview.ledger[a].length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {preview.ledger[a].join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DangerZone kingdom={kingdom} onDeleted={onDeleted} />
    </div>
  );
}

/**
 * Erase the kingdom and start over. Deletion cascades to hexes, settlements,
 * leadership, skills, and turns — everything hangs off the Kingdom row in the
 * schema — so this is asked for like the one-way action it is: the player
 * types the kingdom's name before the button will even enable.
 */
function DangerZone({
  kingdom,
  onDeleted,
}: {
  kingdom: KingdomData;
  onDeleted?: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmText.trim() === kingdom.name;

  async function handleDelete() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/kingdom", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: confirmText.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not delete the kingdom.");
        setDeleting(false);
        return;
      }
      onDeleted?.();
      // Deliberately not resetting `deleting`: the parent is about to swap
      // this whole tree out for the founding wizard, and re-enabling the
      // button in the meantime would just invite a second click.
    } catch {
      setError("Could not reach the server.");
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <TriangleAlert className="h-4 w-4" />
          Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently deletes <span className="font-medium text-foreground">{kingdom.name}</span>{" "}
          — the hex map, every settlement, leadership assignments, skill ranks, and turn
          history. This cannot be undone. To start over, type the kingdom&apos;s name below.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-9 w-64"
            placeholder={kingdom.name}
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              if (error) setError(null);
            }}
            disabled={deleting}
          />
          <Button
            variant="destructive"
            disabled={!matches || deleting}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TriangleAlert className="h-4 w-4" />}
            Delete kingdom
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
