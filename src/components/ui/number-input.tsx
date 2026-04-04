"use client";

import { useState, useEffect, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number | string;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  fallback?: number;
}

function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  fallback,
  onBlur,
  ...props
}: NumberInputProps) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const commit = () => {
    const trimmed = display.trim();
    if (trimmed === "" || isNaN(Number(trimmed))) {
      const def = fallback ?? min ?? 0;
      setDisplay(String(def));
      onValueChange(def);
    } else {
      const clamped = clamp(Number(trimmed));
      setDisplay(String(clamped));
      onValueChange(clamped);
    }
  };

  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export { NumberInput };
