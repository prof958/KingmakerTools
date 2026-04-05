"use client";

/**
 * GolarionCalendar — Absalom Reckoning date display + picker.
 *
 * Default: shows current in-game date in a rectangle.
 * Hover: ←/→ arrows appear for ±1 day navigation.
 * Click: opens a full month calendar popover to pick a date directly.
 */

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  MONTHS,
  WEEKDAY_ABBR,
  daysInMonth,
  dayOfWeek,
  weekdayName,
  formatGolarionDate,
  addDays,
} from "@/lib/pf2e/calendar";

interface Props {
  initialDay: number;
  initialMonth: number;
  initialYear: number;
}

export function GolarionCalendar({ initialDay, initialMonth, initialYear }: Props) {
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [isHovered, setIsHovered] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Popover browsing state (independent of the committed date)
  const [browseMonth, setBrowseMonth] = useState(initialMonth);
  const [browseYear, setBrowseYear] = useState(initialYear);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Persist date to server
  const persistDate = useCallback(
    (d: number, m: number, y: number) => {
      startTransition(async () => {
        await fetch("/api/campaign", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ golarionDay: d, golarionMonth: m, golarionYear: y }),
        });
      });
    },
    []
  );

  function navigate(delta: number) {
    const next = addDays(day, month, year, delta);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
    persistDate(next.day, next.month, next.year);
  }

  function selectDay(d: number) {
    setDay(d);
    setMonth(browseMonth);
    setYear(browseYear);
    setPopoverOpen(false);
    persistDate(d, browseMonth, browseYear);
  }

  function openPopover() {
    setBrowseMonth(month);
    setBrowseYear(year);
    setPopoverOpen(true);
  }

  function browseMonthPrev() {
    if (browseMonth === 1) {
      setBrowseMonth(12);
      setBrowseYear(browseYear - 1);
    } else {
      setBrowseMonth(browseMonth - 1);
    }
  }

  function browseMonthNext() {
    if (browseMonth === 12) {
      setBrowseMonth(1);
      setBrowseYear(browseYear + 1);
    } else {
      setBrowseMonth(browseMonth + 1);
    }
  }

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  // Close on Escape
  useEffect(() => {
    if (!popoverOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [popoverOpen]);

  const weekday = weekdayName(day, month, year);
  const dateStr = formatGolarionDate(day, month, year);

  return (
    <div className="relative" ref={containerRef}>
      <Card
        className={`relative flex items-center justify-center py-4 px-6 cursor-pointer select-none transition-colors hover:bg-muted/50 ${isPending ? "opacity-60" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={openPopover}
      >
        {/* Left arrow */}
        <button
          className={`absolute left-3 p-1 rounded-md hover:bg-muted transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Date display */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-semibold tracking-tight">{dateStr}</span>
          </div>
          <span className="text-sm text-muted-foreground">{weekday}</span>
        </div>

        {/* Right arrow */}
        <button
          className={`absolute right-3 p-1 rounded-md hover:bg-muted transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(1);
          }}
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </Card>

      {/* Popover calendar */}
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-80 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <MonthCalendar
            browseMonth={browseMonth}
            browseYear={browseYear}
            selectedDay={month === browseMonth && year === browseYear ? day : null}
            onPrevMonth={browseMonthPrev}
            onNextMonth={browseMonthNext}
            onYearChange={setBrowseYear}
            onSelectDay={selectDay}
          />
        </div>
      )}
    </div>
  );
}

// ─── Month Calendar Grid ─────────────────────────────────

function MonthCalendar({
  browseMonth,
  browseYear,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onYearChange,
  onSelectDay,
}: {
  browseMonth: number;
  browseYear: number;
  selectedDay: number | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onYearChange: (y: number) => void;
  onSelectDay: (d: number) => void;
}) {
  const monthObj = MONTHS[browseMonth - 1];
  const totalDays = daysInMonth(browseMonth, browseYear);
  const firstDayOfWeek = dayOfWeek(1, browseMonth, browseYear); // 0=Mon … 6=Sun

  // Build grid cells: leading blanks + day numbers
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="space-y-3">
      {/* Header: month nav + year input */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{monthObj?.name}</span>
          <input
            type="text"
            inputMode="numeric"
            value={browseYear}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v) onYearChange(parseInt(v, 10));
            }}
            className="w-16 rounded-md border bg-transparent px-2 py-0.5 text-center text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground font-medium">
        {WEEKDAY_ABBR.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((d, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {d !== null ? (
              <button
                onClick={() => onSelectDay(d)}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors
                  ${d === selectedDay
                    ? "bg-primary text-primary-foreground font-bold"
                    : "hover:bg-muted"
                  }`}
              >
                {d}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
