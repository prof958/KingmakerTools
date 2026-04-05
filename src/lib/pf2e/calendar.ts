/**
 * Golarion Calendar (Absalom Reckoning)
 *
 * 12 months, 7-day weeks, leap year every 4 years (extra day in Calistril).
 * Epoch: 1 Abadius 1 AR = Moonday (weekday index 0).
 */

export interface GolarionMonth {
  /** 1-indexed month number */
  index: number;
  name: string;
  /** Base number of days (28 for Calistril in non-leap years) */
  days: number;
}

export const MONTHS: GolarionMonth[] = [
  { index: 1,  name: "Abadius",   days: 31 },
  { index: 2,  name: "Calistril", days: 28 },
  { index: 3,  name: "Pharast",   days: 31 },
  { index: 4,  name: "Gozran",    days: 30 },
  { index: 5,  name: "Desnus",    days: 31 },
  { index: 6,  name: "Sarenith",  days: 30 },
  { index: 7,  name: "Erastus",   days: 31 },
  { index: 8,  name: "Arodus",    days: 31 },
  { index: 9,  name: "Rova",      days: 30 },
  { index: 10, name: "Lamashan",  days: 31 },
  { index: 11, name: "Neth",      days: 30 },
  { index: 12, name: "Kuthona",   days: 31 },
];

export const WEEKDAYS = [
  "Moonday",
  "Toilday",
  "Wealday",
  "Oathday",
  "Fireday",
  "Starday",
  "Sunday",
] as const;

export const WEEKDAY_ABBR = ["Mon", "Toi", "Wea", "Oat", "Fir", "Sta", "Sun"] as const;

/** Leap year: every 4 years (PF2e rule). */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0;
}

/** Number of days in a given month (1-indexed), accounting for leap years. */
export function daysInMonth(month: number, year: number): number {
  const m = MONTHS[month - 1];
  if (!m) return 30;
  if (month === 2 && isLeapYear(year)) return 29;
  return m.days;
}

/** Total days in a year. */
function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Count total days from epoch (1 Abadius 1 AR) to a given date.
 * The epoch day itself is day 0.
 */
function totalDaysFromEpoch(day: number, month: number, year: number): number {
  let total = 0;

  // Full years before this one
  for (let y = 1; y < year; y++) {
    total += daysInYear(y);
  }

  // Full months before this one in the current year
  for (let m = 1; m < month; m++) {
    total += daysInMonth(m, year);
  }

  // Days in current month (0-indexed: day 1 = 0 extra)
  total += day - 1;

  return total;
}

/**
 * Get the weekday index (0 = Moonday … 6 = Sunday) for a date.
 * Epoch: 1 Abadius 1 AR = Moonday (index 0).
 */
export function dayOfWeek(day: number, month: number, year: number): number {
  const total = totalDaysFromEpoch(day, month, year);
  return ((total % 7) + 7) % 7; // always non-negative
}

/** Get the weekday name for a date. */
export function weekdayName(day: number, month: number, year: number): string {
  return WEEKDAYS[dayOfWeek(day, month, year)];
}

/** Format a Golarion date, e.g. "1 Pharast 4710 AR". */
export function formatGolarionDate(day: number, month: number, year: number): string {
  const m = MONTHS[month - 1];
  return `${day} ${m?.name ?? "?"} ${year} AR`;
}

/** Get the month name by 1-indexed month number. */
export function monthName(month: number): string {
  return MONTHS[month - 1]?.name ?? "?";
}

export interface GolarionDate {
  day: number;
  month: number;
  year: number;
}

/** Add (or subtract) days from a Golarion date, rolling months/years. */
export function addDays(day: number, month: number, year: number, delta: number): GolarionDate {
  let d = day;
  let m = month;
  let y = year;

  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      d++;
      if (d > daysInMonth(m, y)) {
        d = 1;
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
  } else {
    for (let i = 0; i < -delta; i++) {
      d--;
      if (d < 1) {
        m--;
        if (m < 1) {
          m = 12;
          y--;
        }
        d = daysInMonth(m, y);
      }
    }
  }

  return { day: d, month: m, year: y };
}
