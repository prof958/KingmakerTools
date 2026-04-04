"use client";

import { useState, useRef, useEffect, type ComponentProps } from "react";
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
  onFocus,
  ...props
}: NumberInputProps) {
  const [display, setDisplay] = useState(String(value));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) {
      setDisplay(String(value));
    }
  }, [value]);

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const commit = () => {
    editing.current = false;
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
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty, minus sign, digits, and decimal point only
        if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
          setDisplay(raw);
        }
      }}
      onFocus={(e) => {
        editing.current = true;
        e.target.select();
        onFocus?.(e);
      }}
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
