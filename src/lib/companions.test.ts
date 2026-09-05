import { describe, it, expect } from "vitest";
import {
  compareBoardEntries,
  daysAway,
  daysUntilReturn,
  deriveCompanionState,
  describeDateRange,
  describeTiming,
  progressFraction,
  returnDate,
  type AssignmentLike,
  type BoardEntry,
} from "./companions";
import { absoluteDay, daysBetween } from "./pf2e/calendar";

const TODAY = { day: 10, month: 3, year: 4710 }; // 10 Pharast 4710 AR

function quest(overrides: Partial<AssignmentLike> = {}): AssignmentLike {
  return {
    kind: "QUEST",
    status: "ACTIVE",
    departDay: 1,
    departMonth: 3,
    departYear: 4710,
    returnDay: 15,
    returnMonth: 3,
    returnYear: 4710,
    ...overrides,
  };
}

describe("calendar date arithmetic", () => {
  it("orders dates across a month boundary", () => {
    expect(absoluteDay(1, 4, 4710)).toBe(absoluteDay(31, 3, 4710) + 1);
  });

  it("counts days across a year boundary", () => {
    // 31 Kuthona 4710 -> 1 Abadius 4711 is one day.
    expect(
      daysBetween({ day: 31, month: 12, year: 4710 }, { day: 1, month: 1, year: 4711 }),
    ).toBe(1);
  });

  it("accounts for the Calistril leap day", () => {
    // 4712 is a leap year, so Calistril has 29 days.
    expect(
      daysBetween({ day: 1, month: 2, year: 4712 }, { day: 1, month: 3, year: 4712 }),
    ).toBe(29);
    expect(
      daysBetween({ day: 1, month: 2, year: 4711 }, { day: 1, month: 3, year: 4711 }),
    ).toBe(28);
  });

  it("is signed — a past date gives a negative count", () => {
    expect(daysBetween(TODAY, { day: 5, month: 3, year: 4710 })).toBe(-5);
  });
});

describe("deriveCompanionState", () => {
  it("treats no assignment as being with the party", () => {
    expect(deriveCompanionState(null, TODAY)).toBe("WITH_PARTY");
  });

  it("ignores assignments that are already resolved", () => {
    expect(deriveCompanionState(quest({ status: "COMPLETED" }), TODAY)).toBe(
      "WITH_PARTY",
    );
    expect(deriveCompanionState(quest({ status: "FAILED" }), TODAY)).toBe(
      "WITH_PARTY",
    );
    expect(deriveCompanionState(quest({ status: "RECALLED" }), TODAY)).toBe(
      "WITH_PARTY",
    );
  });

  it("reports a quest with a future return date as away", () => {
    expect(deriveCompanionState(quest(), TODAY)).toBe("AWAY");
  });

  it("flips to due-back on the return day itself", () => {
    expect(deriveCompanionState(quest({ returnDay: 10 }), TODAY)).toBe("DUE_BACK");
  });

  it("flips to overdue once the return day has passed", () => {
    expect(deriveCompanionState(quest({ returnDay: 9 }), TODAY)).toBe("OVERDUE");
  });

  it("advancing the calendar alone moves a quest away -> due -> overdue", () => {
    const a = quest({ returnDay: 12 });
    expect(deriveCompanionState(a, { day: 11, month: 3, year: 4710 })).toBe("AWAY");
    expect(deriveCompanionState(a, { day: 12, month: 3, year: 4710 })).toBe("DUE_BACK");
    expect(deriveCompanionState(a, { day: 13, month: 3, year: 4710 })).toBe("OVERDUE");
  });

  it("keeps a station active regardless of the date", () => {
    const a = quest({ kind: "STATION", returnDay: null, returnMonth: null, returnYear: null });
    expect(deriveCompanionState(a, TODAY)).toBe("STATIONED");
    expect(deriveCompanionState(a, { day: 1, month: 1, year: 4799 })).toBe("STATIONED");
  });

  it("turns recovery into READY on and after the recovery date", () => {
    const a = quest({ kind: "RECOVERING", returnDay: 12 });
    expect(deriveCompanionState(a, TODAY)).toBe("RECOVERING");
    expect(deriveCompanionState(a, { day: 12, month: 3, year: 4710 })).toBe("READY");
    expect(deriveCompanionState(a, { day: 20, month: 3, year: 4710 })).toBe("READY");
  });

  it("leaves an open-ended recovery pending forever", () => {
    const a = quest({ kind: "RECOVERING", returnDay: null, returnMonth: null, returnYear: null });
    expect(deriveCompanionState(a, { day: 1, month: 1, year: 4799 })).toBe("RECOVERING");
  });

  it("reports a missing companion as missing", () => {
    const a = quest({ kind: "MISSING", returnDay: null, returnMonth: null, returnYear: null });
    expect(deriveCompanionState(a, TODAY)).toBe("MISSING");
  });

  it("lets a fallen character override an assignment still marked active", () => {
    expect(deriveCompanionState(quest(), TODAY, true)).toBe("FALLEN");
    expect(deriveCompanionState(null, TODAY, true)).toBe("FALLEN");
  });
});

describe("returnDate", () => {
  it("is null unless all three date parts are present", () => {
    expect(returnDate(quest({ returnDay: null }))).toBeNull();
    expect(returnDate(quest({ returnMonth: null }))).toBeNull();
    expect(returnDate(quest({ returnYear: null }))).toBeNull();
    expect(returnDate(quest())).toEqual({ day: 15, month: 3, year: 4710 });
  });
});

describe("daysUntilReturn / daysAway", () => {
  it("counts down to the return date", () => {
    expect(daysUntilReturn(quest(), TODAY)).toBe(5);
  });

  it("goes negative past the return date", () => {
    expect(daysUntilReturn(quest({ returnDay: 5 }), TODAY)).toBe(-5);
  });

  it("is null for an open-ended assignment", () => {
    expect(daysUntilReturn(quest({ returnDay: null }), TODAY)).toBeNull();
  });

  it("counts up from departure", () => {
    expect(daysAway(quest(), TODAY)).toBe(9);
  });
});

describe("describeTiming", () => {
  it("says nothing for a companion with no active assignment", () => {
    expect(describeTiming(null, TODAY)).toBeNull();
    expect(describeTiming(quest({ status: "COMPLETED" }), TODAY)).toBeNull();
  });

  it("phrases a quest countdown", () => {
    expect(describeTiming(quest(), TODAY)).toBe("Back in 5 days");
    expect(describeTiming(quest({ returnDay: 11 }), TODAY)).toBe("Back in 1 day");
    expect(describeTiming(quest({ returnDay: 10 }), TODAY)).toBe("Due back today");
    expect(describeTiming(quest({ returnDay: 9 }), TODAY)).toBe("1 day overdue");
    expect(describeTiming(quest({ returnDay: 3 }), TODAY)).toBe("7 days overdue");
  });

  it("phrases recovery in its own words", () => {
    const rec = (returnDay: number) => quest({ kind: "RECOVERING", returnDay });
    expect(describeTiming(rec(13), TODAY)).toBe("On their feet in 3 days");
    expect(describeTiming(rec(10), TODAY)).toBe("Ready today");
    expect(describeTiming(rec(8), TODAY)).toBe("Recovered 2 days ago");
  });

  it("counts up for an open-ended assignment", () => {
    const station = quest({ kind: "STATION", returnDay: null, returnMonth: null, returnYear: null });
    expect(describeTiming(station, TODAY)).toBe("Away 9 days");
    expect(describeTiming(station, { day: 1, month: 3, year: 4710 })).toBe("Departed today");
    expect(describeTiming(station, { day: 28, month: 2, year: 4710 })).toBe("Leaves in 1 day");
  });
});

describe("progressFraction", () => {
  it("is null without a return date", () => {
    expect(progressFraction(quest({ returnDay: null }), TODAY)).toBeNull();
  });

  it("tracks elapsed time over the full span", () => {
    // 1 Pharast -> 15 Pharast is 14 days; today is 9 days in.
    expect(progressFraction(quest(), TODAY)).toBeCloseTo(9 / 14);
  });

  it("clamps rather than overflowing when overdue", () => {
    expect(progressFraction(quest({ returnDay: 5 }), TODAY)).toBe(1);
  });

  it("clamps at zero before departure", () => {
    expect(progressFraction(quest(), { day: 25, month: 2, year: 4710 })).toBe(0);
  });

  it("treats a same-day assignment as complete rather than dividing by zero", () => {
    expect(progressFraction(quest({ departDay: 15 }), TODAY)).toBe(1);
  });
});

describe("describeDateRange", () => {
  it("shows both ends when there is a return date", () => {
    expect(describeDateRange(quest())).toBe("1 Pharast 4710 AR → 15 Pharast 4710 AR");
  });

  it("shows only the departure when open-ended", () => {
    expect(describeDateRange(quest({ returnDay: null }))).toBe("From 1 Pharast 4710 AR");
  });
});

describe("compareBoardEntries", () => {
  function entry(name: string, state: BoardEntry["state"], a: AssignmentLike | null = null): BoardEntry {
    return { name, state, assignment: a };
  }

  it("puts what needs attention above what does not", () => {
    const rows: BoardEntry[] = [
      entry("Calm", "WITH_PARTY"),
      entry("Posted", "STATIONED"),
      entry("Gone", "MISSING"),
      entry("Late", "OVERDUE"),
    ];
    const sorted = [...rows].sort((a, b) => compareBoardEntries(a, b, TODAY));
    expect(sorted.map((r) => r.name)).toEqual(["Gone", "Late", "Posted", "Calm"]);
  });

  it("sorts the soonest return first within one state", () => {
    const rows: BoardEntry[] = [
      entry("Later", "AWAY", quest({ returnDay: 20 })),
      entry("Sooner", "AWAY", quest({ returnDay: 12 })),
    ];
    const sorted = [...rows].sort((a, b) => compareBoardEntries(a, b, TODAY));
    expect(sorted.map((r) => r.name)).toEqual(["Sooner", "Later"]);
  });

  it("ranks a dated assignment ahead of an open-ended one", () => {
    const dated = entry("Dated", "AWAY", quest({ returnDay: 20 }));
    const open = entry("Open", "AWAY", quest({ returnDay: null, returnMonth: null, returnYear: null }));
    expect(compareBoardEntries(dated, open, TODAY)).toBeLessThan(0);
    expect(compareBoardEntries(open, dated, TODAY)).toBeGreaterThan(0);
  });

  it("falls back to name so the order is stable", () => {
    const rows: BoardEntry[] = [entry("Zora", "WITH_PARTY"), entry("Amiri", "WITH_PARTY")];
    const sorted = [...rows].sort((a, b) => compareBoardEntries(a, b, TODAY));
    expect(sorted.map((r) => r.name)).toEqual(["Amiri", "Zora"]);
  });
});
