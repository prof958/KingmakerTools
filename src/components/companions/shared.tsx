"use client";

/**
 * Shared vocabulary for the companion board and the dashboard card, so a
 * status can never mean one colour in one place and another colour elsewhere.
 *
 * Every class string here is written out verbatim — Tailwind's scanner only
 * emits classes it can literally see in source, so none of these may be built
 * by string-concatenating a tone name at runtime.
 */

import {
  Compass,
  Flag,
  HeartPulse,
  HelpCircle,
  Home,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANION_STATE_META,
  type AssignmentKind,
  type CompanionState,
  type StateTone,
} from "@/lib/companions";
import type { CompanionLite } from "./types";

export interface ToneClasses {
  /** Pill background + text for the status badge. */
  badge: string;
  /** Left accent bar on a card. */
  accent: string;
  /** Filled portion of a progress rail. */
  bar: string;
  /** Small status dot. */
  dot: string;
  /** Text colour for the countdown line. */
  text: string;
  /** Tinted row background for entries that need attention. */
  row: string;
}

export const TONE_CLASSES: Record<StateTone, ToneClasses> = {
  neutral: {
    badge: "bg-muted text-muted-foreground",
    accent: "bg-border",
    bar: "bg-muted-foreground/40",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    row: "",
  },
  active: {
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    accent: "bg-sky-500",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
    row: "",
  },
  ready: {
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    accent: "bg-emerald-500",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    row: "bg-emerald-500/5",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    accent: "bg-amber-500",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    row: "bg-amber-500/5",
  },
  danger: {
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
    accent: "bg-red-500",
    bar: "bg-red-500",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    row: "bg-red-500/5",
  },
};

export function toneOf(state: CompanionState): ToneClasses {
  return TONE_CLASSES[COMPANION_STATE_META[state].tone];
}

export const KIND_ICON: Record<AssignmentKind, LucideIcon> = {
  QUEST: Compass,
  STATION: Flag,
  RECOVERING: HeartPulse,
  MISSING: HelpCircle,
};

export const STATE_ICON: Record<CompanionState, LucideIcon> = {
  WITH_PARTY: Home,
  AWAY: Compass,
  DUE_BACK: Compass,
  OVERDUE: Compass,
  STATIONED: Flag,
  RECOVERING: HeartPulse,
  READY: HeartPulse,
  MISSING: HelpCircle,
  FALLEN: HelpCircle,
};

/** Status pill. Attention states get a pulsing dot so they read at a glance. */
export function StateBadge({
  state,
  className,
}: {
  state: CompanionState;
  className?: string;
}) {
  const meta = COMPANION_STATE_META[state];
  const tone = TONE_CLASSES[meta.tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone.badge,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone.dot,
          meta.needsAttention && "animate-pulse",
        )}
      />
      {meta.label}
    </span>
  );
}

/**
 * Portrait, emoji, or fallback glyph — same precedence the party roster uses,
 * so a companion looks the same everywhere in the app.
 */
export function CompanionAvatar({
  companion,
  size = "md",
  className,
}: {
  companion: Pick<CompanionLite, "name" | "emoji" | "imageUrl" | "status" | "isCompanion">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg" ? "h-11 w-11 text-2xl" : size === "sm" ? "h-6 w-6 text-sm" : "h-8 w-8 text-lg";
  const fallen = companion.status === "FALLEN";

  if (companion.imageUrl) {
    return (
      // Plain <img>: next/image's optimizer fetches server-side without the
      // session cookie, so the auth proxy hands it a login page instead.
      <img
        src={companion.imageUrl}
        alt={companion.name}
        className={cn(
          "shrink-0 rounded-full border object-cover",
          box,
          fallen && "grayscale",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border bg-muted",
        box,
        className,
      )}
      aria-hidden
    >
      {fallen ? "💀" : (companion.emoji ?? (companion.isCompanion ? "🐾" : "🧑"))}
    </span>
  );
}

/**
 * The journey rail: how far along an assignment is. `fraction` is null for
 * open-ended assignments, which get a striped "no end in sight" rail instead
 * of a misleading progress reading.
 */
export function JourneyRail({
  fraction,
  state,
  className,
}: {
  fraction: number | null;
  state: CompanionState;
  className?: string;
}) {
  const tone = toneOf(state);

  if (fraction === null) {
    return (
      <div
        className={cn(
          "h-1.5 w-full rounded-full bg-[repeating-linear-gradient(45deg,var(--color-border)_0_6px,transparent_6px_12px)]",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone.bar)}
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  );
}
