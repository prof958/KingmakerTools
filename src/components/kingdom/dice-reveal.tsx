"use client";

/**
 * DiceReveal — a dramatized "roll, then confirm" dice button.
 *
 * The real roll (`lib/dice.ts`) happens immediately on click, exactly as
 * before — nothing about the mechanics changes. What's new is that the
 * result isn't shown instantly: a hexagonal die badge tumbles through random
 * faces for a decelerating burst of ticks, then lands on the true result
 * with a tone-appropriate flourish (a golden ring for a critical success, a
 * shake for a critical failure). The number that lands is always the number
 * `roll()` actually produced — the animation delays the reveal, it never
 * substitutes a different one.
 */

import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiceTone = "critical-good" | "good" | "bad" | "critical-bad" | "neutral";

const TONE_RING: Record<DiceTone, string> = {
  "critical-good": "ring-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.55)]",
  good: "ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  bad: "ring-orange-400/80 shadow-[0_0_10px_rgba(251,146,60,0.25)]",
  "critical-bad": "ring-destructive shadow-[0_0_18px_rgba(239,68,68,0.45)]",
  neutral: "ring-primary/50",
};

const TONE_TEXT: Record<DiceTone, string> = {
  "critical-good": "text-amber-400",
  good: "text-emerald-400",
  bad: "text-orange-400",
  "critical-bad": "text-destructive",
  neutral: "text-foreground",
};

function DieBadge({
  value,
  tone,
  phase,
  size,
}: {
  value: number;
  tone: DiceTone;
  phase: "idle" | "rolling" | "landed";
  size: "sm" | "lg";
}) {
  return (
    <span
      key={phase === "rolling" ? value : "final"}
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-card font-heading font-bold tabular-nums ring-2 transition-shadow",
        size === "lg" ? "size-14 text-xl" : "size-9 text-sm",
        phase === "rolling" && "kt-dice-tumble ring-primary/40",
        phase === "landed" && ["kt-dice-land", TONE_RING[tone]],
        phase === "landed" && tone === "critical-bad" && "kt-dice-shake",
        phase === "idle" && "ring-border",
      )}
      style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
    >
      <span className={phase === "landed" ? TONE_TEXT[tone] : "text-muted-foreground"}>
        {value}
      </span>
      {phase === "landed" && tone === "critical-good" && (
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/30" />
      )}
    </span>
  );
}

/**
 * `roll()` is called exactly once per click, synchronously, so the outcome
 * is fixed the instant the player commits to rolling — the animation only
 * controls when it's revealed, not what it is.
 */
export function DiceReveal<T>({
  label,
  faces,
  dice = 1,
  roll,
  getTotal,
  getFace,
  getTone,
  onSettled,
  disabled,
  size = "sm",
}: {
  label: string;
  /** Face count of a single die (20 for a d20, 4 for a d4, ...). */
  faces: number;
  /** How many dice are rolled, so the tumble ranges over plausible sums. */
  dice?: number;
  roll: () => T;
  getTotal: (result: T) => number;
  /**
   * What the die badge lands on — the raw dice, before any modifier.
   *
   * This is deliberately separate from `getTotal`: the badge is drawn as a die
   * and tumbles through die faces, so landing it on a modifier-adjusted total
   * would misreport what was actually rolled (a natural 5 at +1 would read as
   * a 6). Defaults to `getTotal` for rolls that have no modifier, where the
   * two are the same number.
   */
  getFace?: (result: T) => number;
  getTone?: (result: T) => DiceTone;
  onSettled?: (result: T) => void;
  disabled?: boolean;
  size?: "sm" | "lg";
}) {
  const [phase, setPhase] = useState<"idle" | "rolling" | "landed">("idle");
  const [display, setDisplay] = useState(faces);
  const [settled, setSettled] = useState<T | null>(null);
  const tokenRef = useRef(0);

  // Cancel any in-flight tumble if the component unmounts (e.g. the player
  // switches phase tabs mid-roll) — a stray setTimeout must never call
  // setState on a gone component.
  useEffect(() => () => {
    tokenRef.current += 1;
  }, []);

  function start() {
    const result = roll();
    const myToken = ++tokenRef.current;
    setSettled(null);
    setPhase("rolling");

    const tumble = (ticksLeft: number, delay: number) => {
      if (tokenRef.current !== myToken) return;
      if (ticksLeft <= 0) {
        setDisplay((getFace ?? getTotal)(result));
        setPhase("landed");
        setSettled(result);
        onSettled?.(result);
        return;
      }
      // Tumble across the range the dice can actually produce (N .. N×faces),
      // so the numbers flickering past are ones this roll could have landed on.
      const span = dice * faces - dice + 1;
      setDisplay(dice + Math.floor(Math.random() * span));
      setTimeout(() => tumble(ticksLeft - 1, delay * 1.18), delay);
    };
    tumble(10, 45);
  }

  const tone = settled && getTone ? getTone(settled) : "neutral";

  return (
    <div className="flex items-center gap-2.5">
      <Button size={size === "lg" ? "default" : "sm"} variant="outline" onClick={start} disabled={disabled || phase === "rolling"}>
        <Dices className={cn(phase === "rolling" && "animate-spin")} /> {label}
      </Button>
      {phase !== "idle" && <DieBadge value={display} tone={tone} phase={phase} size={size} />}
    </div>
  );
}
