"use client";

/**
 * FoundingWizard — Kingdom Creation as a guided, character-creation-style flow.
 *
 * Walks the Player's Guide steps (charter, heartland, government, ability
 * finalization) plus the V&K trained skills and the leadership draft, showing
 * the resulting ability scores live so each choice has visible consequences.
 * Nothing is written until the last step: POST /api/kingdom/found commits it in
 * one transaction, recomputing scores and skills server-side from the same
 * choices so the two can never drift.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ABILITY_LABELS,
  CHARTERS,
  GOVERNMENTS,
  HEARTLANDS,
  KINGDOM_ABILITIES,
  KINGDOM_SKILLS,
  LEADERSHIP_ROLES,
  computeAbilityScores,
  finalizeBoostCount,
  getCharter,
  getGovernment,
  getHeartland,
  getKingdomSkill,
  startingSkills,
  type KingdomAbility,
  type KingdomRuleset,
} from "@/lib/pf2e/kingdom";
import { AbilityRow, ChoiceCard, Pip, StepRail, fmtMod } from "./founding-parts";
import type { CharacterLite, KingdomData } from "./types";

interface Draft {
  name: string;
  ruleset: KingdomRuleset;
  charter: string | null;
  charterFreeBoost: KingdomAbility | null;
  heartland: string | null;
  government: string | null;
  governmentFreeBoost: KingdomAbility | null;
  finalizeBoosts: KingdomAbility[];
  skillPicks: string[];
  leadership: Record<string, { characterId: string | null; npcName: string }>;
}

const STEPS = [
  { id: "identity", label: "Name" },
  { id: "charter", label: "Charter" },
  { id: "heartland", label: "Heartland" },
  { id: "government", label: "Government" },
  { id: "abilities", label: "Abilities" },
  { id: "skills", label: "Skills" },
  { id: "leadership", label: "Leadership" },
  { id: "review", label: "Review" },
] as const;

/** The ability change a not-yet-selected card would make, for the preview. */
function previewDeltas(
  base: Record<KingdomAbility, number>,
  next: Record<KingdomAbility, number>,
): Partial<Record<KingdomAbility, number>> {
  const deltas: Partial<Record<KingdomAbility, number>> = {};
  for (const ability of KINGDOM_ABILITIES) {
    const change = next[ability] - base[ability];
    if (change !== 0) deltas[ability] = change;
  }
  return deltas;
}

export function FoundingWizard({
  kingdom,
  characters,
}: {
  kingdom: KingdomData;
  characters: CharacterLite[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<Partial<Draft> | null>(null);

  const [draft, setDraft] = useState<Draft>(() => ({
    name: kingdom.name === "Unnamed Kingdom" ? "" : kingdom.name,
    ruleset: kingdom.ruleset,
    charter: kingdom.charter,
    charterFreeBoost: kingdom.charterFreeBoost as KingdomAbility | null,
    heartland: kingdom.heartland,
    government: kingdom.government,
    governmentFreeBoost: kingdom.governmentFreeBoost as KingdomAbility | null,
    finalizeBoosts: kingdom.finalizeBoosts as KingdomAbility[],
    skillPicks: kingdom.skillPicks,
    leadership: Object.fromEntries(
      LEADERSHIP_ROLES.map((role) => {
        const existing = kingdom.leadershipRoles.find((r) => r.role === role.id);
        return [role.id, { characterId: existing?.characterId ?? null, npcName: existing?.npcName ?? "" }];
      }),
    ),
  }));

  const patch = useCallback((changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const boostCount = finalizeBoostCount(draft.ruleset);

  const scores = useMemo(() => computeAbilityScores(draft).scores, [draft]);
  const hoverScores = useMemo(
    () => (hover ? computeAbilityScores({ ...draft, ...hover }).scores : null),
    [draft, hover],
  );
  const deltas = hoverScores ? previewDeltas(scores, hoverScores) : undefined;

  const skills = useMemo(
    () =>
      startingSkills({
        ruleset: draft.ruleset,
        charter: draft.charter,
        heartland: draft.heartland,
        government: draft.government,
        picks: draft.skillPicks,
      }),
    [draft],
  );

  const grantedSkills = new Set(skills.granted.map((g) => g.skill));

  const complete: Record<number, boolean> = {
    0: draft.name.trim().length > 0,
    1: Boolean(draft.charter) && Boolean(draft.charterFreeBoost),
    2: Boolean(draft.heartland),
    3: Boolean(draft.government) && Boolean(draft.governmentFreeBoost),
    4: draft.finalizeBoosts.length === boostCount,
    5: skills.remaining === 0,
    6: true, // roles may be left vacant
    7: true,
  };

  const canAdvance = complete[step];

  function go(next: number) {
    const target = Math.max(0, Math.min(STEPS.length - 1, next));
    setStep(target);
    setFurthest((f) => Math.max(f, target));
  }

  async function found() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kingdom/found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          leadership: Object.entries(draft.leadership).map(([role, value]) => ({
            role,
            characterId: value.characterId,
            npcName: value.npcName,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not found the kingdom.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Crown className="size-7 text-primary" />
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Found a Kingdom</h1>
            <p className="text-sm text-muted-foreground">
              Claim the Stolen Lands. Every choice shapes the nation you rule.
            </p>
          </div>
        </div>
        <StepRail steps={[...STEPS]} current={step} furthest={furthest} onJump={go} />
      </header>

      {/* Live ability preview — the running consequence of every choice so far. */}
      <div className="rounded-xl border bg-card/50 p-4">
        <AbilityRow scores={scores} deltas={deltas} />
      </div>

      <div className="min-h-[22rem]">
        {step === 0 && <IdentityStep draft={draft} onPatch={patch} />}

        {step === 1 && (
          <ChoiceGrid caption="Your sponsor's terms. Each charter boosts one ability, most at the cost of another, and all grant a free boost.">
            {CHARTERS.map((charter) => (
              <ChoiceCard
                key={charter.id}
                title={charter.name}
                selected={draft.charter === charter.id}
                onSelect={() => patch({ charter: charter.id, charterFreeBoost: null })}
                onFocus={() => setHover({ charter: charter.id, charterFreeBoost: null })}
                onBlur={() => setHover(null)}
                footer={
                  <>
                    {charter.boost && <Pip tone="boost">+{ABILITY_LABELS[charter.boost]}</Pip>}
                    {charter.flaw && <Pip tone="flaw">−{ABILITY_LABELS[charter.flaw]}</Pip>}
                    <Pip tone="muted">+1 free</Pip>
                    {draft.ruleset === "VK" && (
                      <Pip tone="skill">
                        {charter.grantedSkill
                          ? getKingdomSkill(charter.grantedSkill)?.name
                          : "Any skill"}
                      </Pip>
                    )}
                  </>
                }
              >
                {charter.description}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        )}

        {step === 1 && draft.charter && (
          <AbilityPicker
            label="Charter free boost"
            hint="Any ability."
            selected={draft.charterFreeBoost ? [draft.charterFreeBoost] : []}
            onToggle={(ability) => patch({ charterFreeBoost: ability })}
          />
        )}

        {step === 2 && (
          <ChoiceGrid caption="The land your first hex sits on. This also sets which terrain your Favored Land ability applies to.">
            {HEARTLANDS.map((heartland) => (
              <ChoiceCard
                key={heartland.id}
                title={heartland.name}
                selected={draft.heartland === heartland.id}
                onSelect={() => patch({ heartland: heartland.id })}
                onFocus={() => setHover({ heartland: heartland.id })}
                onBlur={() => setHover(null)}
                footer={
                  <>
                    <Pip tone="boost">+{ABILITY_LABELS[heartland.boost]}</Pip>
                    {draft.ruleset === "VK" && (
                      <>
                        <Pip tone="skill">{getKingdomSkill(heartland.grantedSkill)?.name}</Pip>
                        <Pip tone="muted">+1 free skill</Pip>
                      </>
                    )}
                  </>
                }
              >
                Terrain: {heartland.terrain.join(", ")}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        )}

        {step === 3 && (
          <ChoiceGrid caption="How power is held. Government grants two fixed boosts, a free one, two trained skills, and a bonus Kingdom feat.">
            {GOVERNMENTS.map((government) => (
              <ChoiceCard
                key={government.id}
                title={government.name}
                selected={draft.government === government.id}
                onSelect={() => patch({ government: government.id, governmentFreeBoost: null })}
                onFocus={() => setHover({ government: government.id, governmentFreeBoost: null })}
                onBlur={() => setHover(null)}
                footer={
                  <>
                    {government.boosts.map((b) => (
                      <Pip key={b} tone="boost">
                        +{ABILITY_LABELS[b]}
                      </Pip>
                    ))}
                    <Pip tone="muted">+1 free</Pip>
                    {government.skills.map((s) => (
                      <Pip key={s} tone="skill">
                        {getKingdomSkill(s)?.name}
                      </Pip>
                    ))}
                    <Pip tone="muted">{government.bonusFeat}</Pip>
                  </>
                }
              >
                {government.description}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        )}

        {step === 3 && draft.government && (
          <AbilityPicker
            label="Government free boost"
            hint="Any ability other than the two this government already boosts."
            selected={draft.governmentFreeBoost ? [draft.governmentFreeBoost] : []}
            disabled={getGovernment(draft.government)?.boosts ?? []}
            onToggle={(ability) => patch({ governmentFreeBoost: ability })}
          />
        )}

        {step === 4 && (
          <StepBody
            title="Finalize ability scores"
            caption={`Choose ${boostCount} different abilities to boost.${
              draft.ruleset === "VK" ? " The V&K rules grant one more than RAW." : ""
            }`}
          >
            <AbilityPicker
              label={`${draft.finalizeBoosts.length} of ${boostCount} chosen`}
              selected={draft.finalizeBoosts}
              onToggle={(ability) => {
                const chosen = draft.finalizeBoosts.includes(ability)
                  ? draft.finalizeBoosts.filter((a) => a !== ability)
                  : [...draft.finalizeBoosts, ability].slice(-boostCount);
                patch({ finalizeBoosts: chosen });
              }}
            />
          </StepBody>
        )}

        {step === 5 && (
          <SkillStep
            draft={draft}
            granted={skills.granted}
            grantedSkills={grantedSkills}
            remaining={skills.remaining}
            freePicks={skills.freePicks}
            onPatch={patch}
          />
        )}

        {step === 6 && (
          <LeadershipStep draft={draft} characters={characters} onPatch={patch} />
        )}

        {step === 7 && (
          <ReviewStep
            draft={draft}
            scores={scores}
            trained={skills.trained}
            characters={characters}
          />
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <footer className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || saving}>
          <ArrowLeft /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => go(step + 1)} disabled={!canAdvance}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button onClick={found} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Crown />}
            Found the kingdom
          </Button>
        )}
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────
// Steps
// ──────────────────────────────────────────────

function StepBody({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceGrid({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{caption}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function AbilityPicker({
  label,
  hint,
  selected,
  disabled = [],
  onToggle,
}: {
  label: string;
  hint?: string;
  selected: KingdomAbility[];
  disabled?: readonly KingdomAbility[];
  onToggle: (ability: KingdomAbility) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border bg-card/50 p-4">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {KINGDOM_ABILITIES.map((ability) => {
          const isOff = disabled.includes(ability);
          const isOn = selected.includes(ability);
          return (
            <button
              key={ability}
              type="button"
              disabled={isOff}
              onClick={() => onToggle(ability)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                isOn && "border-primary bg-primary text-primary-foreground",
                !isOn && !isOff && "border-border hover:border-primary/50 hover:bg-accent",
                isOff && "cursor-not-allowed border-dashed text-muted-foreground/40",
              )}
            >
              {ABILITY_LABELS[ability]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkillStep({
  draft,
  granted,
  grantedSkills,
  remaining,
  freePicks,
  onPatch,
}: {
  draft: Draft;
  granted: { skill: string; source: string }[];
  grantedSkills: Set<string>;
  remaining: number;
  freePicks: number;
  onPatch: (changes: Partial<Draft>) => void;
}) {
  function togglePick(skillId: string) {
    const picked = draft.skillPicks.includes(skillId);
    if (picked) {
      onPatch({ skillPicks: draft.skillPicks.filter((s) => s !== skillId) });
    } else if (draft.skillPicks.length < freePicks) {
      onPatch({ skillPicks: [...draft.skillPicks, skillId] });
    }
  }

  return (
    <StepBody
      title="Trained skills"
      caption={
        draft.ruleset === "VK"
          ? "Your government trains two skills. Under the V&K rules your charter and heartland each train one more and grant a free pick — and a grant you already have becomes another free pick."
          : "Your government trains two skills. RAW grants no others at founding."
      }
    >
      {granted.length > 0 && (
        <div className="rounded-xl border bg-card/50 p-4">
          <p className="text-sm font-medium">Granted</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {granted.map((entry) => (
              <span
                key={entry.skill}
                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-sm text-sky-300"
              >
                {getKingdomSkill(entry.skill)?.name}
                <span className="ml-1.5 text-xs text-sky-400/70">{entry.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card/50 p-4">
        <p className="text-sm font-medium">
          Free picks{" "}
          <span className={cn("tabular-nums", remaining > 0 ? "text-amber-400" : "text-emerald-400")}>
            {draft.skillPicks.length} / {freePicks}
          </span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINGDOM_SKILLS.map((skill) => {
            const isGranted = grantedSkills.has(skill.id);
            const isPicked = draft.skillPicks.includes(skill.id);
            const full = draft.skillPicks.length >= freePicks && !isPicked;
            return (
              <button
                key={skill.id}
                type="button"
                disabled={isGranted || full}
                onClick={() => togglePick(skill.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                  isPicked && "border-primary bg-primary font-medium text-primary-foreground",
                  isGranted && "cursor-not-allowed border-dashed text-muted-foreground/40",
                  !isPicked && !isGranted && !full && "hover:border-primary/50 hover:bg-accent",
                  full && !isGranted && "cursor-not-allowed text-muted-foreground/40",
                )}
              >
                {skill.name}
                <span
                  className={cn(
                    "block text-[0.7rem]",
                    isPicked ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {ABILITY_LABELS[skill.keyAbility]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </StepBody>
  );
}

function LeadershipStep({
  draft,
  characters,
  onPatch,
}: {
  draft: Draft;
  characters: CharacterLite[];
  onPatch: (changes: Partial<Draft>) => void;
}) {
  function assign(role: string, characterId: string | null) {
    onPatch({
      leadership: {
        ...draft.leadership,
        [role]: { characterId, npcName: characterId ? "" : draft.leadership[role].npcName },
      },
    });
  }

  function setNpc(role: string, npcName: string) {
    onPatch({
      leadership: { ...draft.leadership, [role]: { characterId: null, npcName } },
    });
  }

  return (
    <StepBody
      title="Leadership roles"
      caption="Assign your party to the eight roles. A role can go to an NPC, or be left vacant — vacancies carry a penalty, and filling all eight is a kingdom milestone."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {LEADERSHIP_ROLES.map((role) => {
          const current = draft.leadership[role.id];
          return (
            <div key={role.id} className="rounded-xl border bg-card/50 p-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-sm font-bold tracking-wide">{role.name}</h3>
                <span className="text-[0.7rem] text-muted-foreground uppercase">
                  {ABILITY_LABELS[role.keyAbility]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {characters.map((character) => {
                  const isOn = current.characterId === character.id;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => assign(role.id, isOn ? null : character.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        isOn
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary/50 hover:bg-accent",
                      )}
                    >
                      {character.emoji && <span className="mr-1">{character.emoji}</span>}
                      {character.name}
                    </button>
                  );
                })}
              </div>

              <Input
                className="mt-2 h-7 text-xs"
                placeholder="…or an NPC"
                value={current.npcName}
                onChange={(e) => setNpc(role.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </StepBody>
  );
}

function IdentityStep({
  draft,
  onPatch,
}: {
  draft: Draft;
  onPatch: (changes: Partial<Draft>) => void;
}) {
  return (
    <StepBody title="Name your kingdom" caption="You can rename it later; the ruleset is harder to change.">
      <Input
        autoFocus
        className="h-12 max-w-md font-heading text-xl"
        placeholder="e.g. Sootscale Reach"
        value={draft.name}
        onChange={(e) => onPatch({ name: e.target.value })}
      />

      <div className="grid gap-3 sm:max-w-2xl sm:grid-cols-2">
        <ChoiceCard
          title="Vance & Kerenshara"
          selected={draft.ruleset === "VK"}
          onSelect={() => onPatch({ ruleset: "VK", finalizeBoosts: [], skillPicks: [] })}
          footer={<Pip tone="muted">House rules</Pip>}
        >
          More trained skills, a skill increase every level, three finalize boosts, and Untrained
          Improvisation from level 2. The rules this table plays with.
        </ChoiceCard>
        <ChoiceCard
          title="Rules as written"
          selected={draft.ruleset === "RAW"}
          onSelect={() => onPatch({ ruleset: "RAW", finalizeBoosts: [], skillPicks: [] })}
          footer={<Pip tone="muted">Player&apos;s Guide</Pip>}
        >
          Kingdom building exactly as printed in the Kingmaker Player&apos;s Guide.
        </ChoiceCard>
      </div>
    </StepBody>
  );
}

function ReviewStep({
  draft,
  scores,
  trained,
  characters,
}: {
  draft: Draft;
  scores: Record<KingdomAbility, number>;
  trained: string[];
  characters: CharacterLite[];
}) {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const filled = LEADERSHIP_ROLES.filter((role) => {
    const entry = draft.leadership[role.id];
    return entry.characterId || entry.npcName.trim();
  });

  return (
    <StepBody
      title={draft.name || "Your kingdom"}
      caption="Founding writes these choices to the kingdom and opens the dashboard."
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Charter" value={getCharter(draft.charter)?.name} />
        <Summary label="Heartland" value={getHeartland(draft.heartland)?.name} />
        <Summary label="Government" value={getGovernment(draft.government)?.name} />
        <Summary label="Ruleset" value={draft.ruleset === "VK" ? "V&K house rules" : "RAW"} />
      </dl>

      <div className="rounded-xl border bg-card/50 p-4">
        <p className="mb-3 text-sm font-medium">Ability scores</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {KINGDOM_ABILITIES.map((ability) => (
            <span key={ability} className="tabular-nums">
              <span className="text-muted-foreground">{ABILITY_LABELS[ability]}</span>{" "}
              <span className="font-semibold">{scores[ability]}</span>{" "}
              <span className="text-muted-foreground">
                ({fmtMod(Math.floor((scores[ability] - 10) / 2))})
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium">
          Trained skills <span className="text-muted-foreground">({trained.length})</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {trained.map((skill) => (
            <Pip key={skill} tone="skill">
              {getKingdomSkill(skill)?.name}
            </Pip>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium">
          Leadership{" "}
          <span className="text-muted-foreground">
            ({filled.length} of {LEADERSHIP_ROLES.length} filled)
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LEADERSHIP_ROLES.map((role) => {
            const entry = draft.leadership[role.id];
            const holder = entry.characterId
              ? byId.get(entry.characterId)?.name
              : entry.npcName.trim();
            return (
              <Pip key={role.id} tone={holder ? "muted" : "flaw"}>
                {role.name}: {holder || "vacant"}
              </Pip>
            );
          })}
        </div>
      </div>
    </StepBody>
  );
}

function Summary({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base font-bold">{value ?? "—"}</dd>
    </div>
  );
}
