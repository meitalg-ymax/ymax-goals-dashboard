// Standing rule (confirmed by Meital): any "current month" filter caps its
// upper bound at yesterday, never month-end -- future-dated records/meetings
// haven't happened yet. Note: +03:00 is Israel Daylight Time (roughly
// Mar-Oct); winter months are actually +02:00 -- revisit if this sync is
// still running into the winter and dates look off by an hour.
const TZ_OFFSET = "+03:00";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export type MonthRange = {
  /** First of the month, as a Date, for storing in the month column (day 1). */
  monthDate: Date;
  /** 'YYYY-MM-DD', for plain date fields like field_16. */
  monthStartDateStr: string;
  /** 'YYYY-MM-DD', for plain date fields like field_16 -- capped at yesterday. */
  yesterdayDateStr: string;
  /** Full ISO datetime with offset, start of month, for datetime fields like field13. */
  monthStartDateTimeStr: string;
  /** Full ISO datetime with offset, end of yesterday, for datetime fields like field13. */
  yesterdayEndDateTimeStr: string;
};

// `today` is passed in explicitly (rather than read via `new Date()` here)
// so this function stays easy to unit-test with a fixed date.
export function currentMonthToYesterday(today: Date): MonthRange {
  const monthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));

  return {
    monthDate,
    monthStartDateStr: toDateStr(monthDate),
    yesterdayDateStr: toDateStr(yesterday),
    monthStartDateTimeStr: `${toDateStr(monthDate)}T00:00:00${TZ_OFFSET}`,
    yesterdayEndDateTimeStr: `${toDateStr(yesterday)}T23:59:59${TZ_OFFSET}`,
  };
}

// Work-day calendar for קד"ב pacing: Sun-Thu = 1, Friday = 0.5, Saturday = 0.
// Verified against the original tracking workbook's own day-counts for July 2026.
export function workDaysBetween(start: Date, endInclusive: Date): number {
  let total = 0;
  const cursor = new Date(start);
  while (cursor <= endInclusive) {
    const dow = cursor.getUTCDay(); // 0=Sun ... 6=Sat
    if (dow === 6) total += 0;
    else if (dow === 5) total += 0.5;
    else total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

export function daysInMonth(monthDate: Date): number {
  return new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
}
