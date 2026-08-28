"use client";

/**
 * Shared presentation pieces for the founding wizard.
 *
 * These carry the wizard's game feel — heraldic ability crests, pickable
 * charter/government cards, a step rail — so the wizard file itself stays a
 * state machine rather than a wall of markup.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ABILITY_LABELS,
  KINGDOM_ABILITIES,
  abilityModifier,
  type KingdomAbility,
} from "@/lib/pf2e/kingdom";

/** One accent per kingdom ability, used for crests, pips, and card trim. */
export const ABILITY_ACCENT: Record<KingdomAbility, string> = {
  culture: "text-violet-400",
  economy: "text-amber-400",
  loyalty: "text-rose-400",
  stability: "text-emerald-400",
};

const ABILITY_FILL: Record<KingdomAbility, string> = {
  culture: "fill-violet-500/15 stroke-violet-500/60",
  economy: "fill-amber-500/15 stroke-amber-500/60",
  loyalty: "fill-rose-500/15 stroke-rose-500/60",
  stability: "fill-emerald-500/15 stroke-emerald-500/60",
};

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * A heraldic shield showing one ability's score and modifier. `delta` is the
 * change the currently-focused choice would make, so the player can see what a
 * card does before committing to it.
 */
export function AbilityCrest({
  ability,
  score,
  delta = 0,
  compact = false,
}: {
  ability: KingdomAbility;
  score: number;
  delta?: number;
  compact?: boolean;
}) {
  const modifier = abilityModifier(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("relative", compact ? "h-14 w-12" : "h-20 w-16")}>
        <svg viewBox="0 0 64 80" className="h-full w-full" aria-hidden="true">
          <path
            d="M32 3 L60 12 V38 C60 57 47 70 32 77 C17 70 4 57 4 38 V12 Z"
            className={cn("stroke-[2.5]", ABILITY_FILL[ability])}
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-heading font-bold tabular-nums",
              compact ? "text-base" : "text-xl",
              ABILITY_ACCENT[ability],
            )}
          >
            {score}
          </span>
          <span className="text-[0.65rem] font-medium text-muted-foreground tabular-nums">
            {fmtMod(modifier)}
          </span>
        </div>
        {delta > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white tabular-nums">
            +{delta}
          </span>
        )}
        {delta < 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-destructive px-1.5 py-0.5 text-[0.6rem] font-bold text-white tabular-nums">
            {delta}
          </span>
        )}
      </div>
      <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {ABILITY_LABELS[ability]}
      </span>
    </div>
  );
}

/** The four crests in a row, with optional pending deltas from a hovered card. */
export function AbilityRow({
  scores,
  deltas,
  compact,
}: {
  scores: Record<KingdomAbility, number>;
  deltas?: Partial<Record<KingdomAbility, number>>;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-6">
      {KINGDOM_ABILITIES.map((ability) => (
        <AbilityCrest
          key={ability}
          ability={ability}
          score={scores[ability]}
          delta={deltas?.[ability] ?? 0}
          compact={compact}
        />
      ))}
    </div>
  );
}

/** A large pickable card — the wizard's main choice control. */
export function ChoiceCard({
  title,
  selected,
  onSelect,
  onFocus,
  onBlur,
  children,
  footer,
}: {
  title: string;
  selected: boolean;
  onSelect: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-pressed={selected}
      className={cn(
        "group relative flex h-full flex-col rounded-xl border p-4 text-left transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary/70 bg-primary/5 shadow-md ring-1 ring-primary/40"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
      <h3 className="font-heading text-base font-bold tracking-wide">{title}</h3>
      {children && <div className="mt-2 flex-1 text-sm text-muted-foreground">{children}</div>}
      {footer && <div className="mt-3 flex flex-wrap gap-1.5">{footer}</div>}
    </button>
  );
}

/** A small ability boost / flaw / skill chip for the choice cards. */
export function Pip({
  tone,
  children,
}: {
  tone: "boost" | "flaw" | "skill" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium",
        tone === "boost" && "bg-emerald-500/15 text-emerald-400",
        tone === "flaw" && "bg-destructive/15 text-destructive",
        tone === "skill" && "bg-sky-500/15 text-sky-400",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** The numbered progress rail across the top of the wizard. */
export function StepRail({
  steps,
  current,
  furthest,
  onJump,
}: {
  steps: { id: string; label: string }[];
  current: number;
  /** Highest step reached, so completed steps stay revisitable. */
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((step, index) => {
        const done = index < furthest;
        const active = index === current;
        const reachable = index <= furthest;
        return (
          <li key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(index)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors",
                active && "bg-primary/10 font-semibold text-primary",
                !active && reachable && "text-muted-foreground hover:bg-accent",
                !reachable && "cursor-not-allowed text-muted-foreground/40",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[0.7rem] font-bold",
                  active && "bg-primary text-primary-foreground",
                  done && !active && "bg-emerald-500/20 text-emerald-400",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done && !active ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <span className="mx-0.5 h-px w-2 bg-border sm:w-4" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
