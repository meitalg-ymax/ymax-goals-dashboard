// קד"ב (paced full-month projection), confirmed against Meital's real Excel
// formulas ("כמו שמחושב באקסל"):
// - leads: (ביצוע ÷ calendar days elapsed) × calendar days in month
// - everything else (arrivals/closings/revenue): (ביצוע ÷ work-days elapsed) × work-days in month
// Status thresholds: critical <85%, warn 85-99%, good >=100%.

export type PaceStatus = "good" | "warn" | "critical";

export type KadavResult = {
  target: number;
  actual: number;
  kadav: number;
  pct: number | null; // null when there's no target to compare against
  status: PaceStatus | null;
};

function statusFor(pct: number): PaceStatus {
  if (pct >= 100) return "good";
  if (pct >= 85) return "warn";
  return "critical";
}

export function calcKadav(
  actual: number,
  target: number | undefined,
  elapsed: number,
  totalInMonth: number
): KadavResult {
  const kadav = elapsed > 0 ? (actual / elapsed) * totalInMonth : 0;
  const hasTarget = target !== undefined && target > 0;
  const pct = hasTarget ? (kadav / target!) * 100 : null;
  return {
    target: target ?? 0,
    actual,
    kadav,
    pct,
    status: pct === null ? null : statusFor(pct),
  };
}

// leads use calendar-day pacing.
export function calcLeadsKadav(actual: number, target: number | undefined, daysElapsed: number, daysInMonth: number) {
  return calcKadav(actual, target, daysElapsed, daysInMonth);
}

// arrivals/closings/revenue use work-day pacing.
export function calcWorkdayKadav(
  actual: number,
  target: number | undefined,
  workDaysElapsed: number,
  workDaysInMonth: number
) {
  return calcKadav(actual, target, workDaysElapsed, workDaysInMonth);
}
