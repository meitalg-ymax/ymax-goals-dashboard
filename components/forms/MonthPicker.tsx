"use client";

import { useRouter } from "next/navigation";

const MONTH_NAMES_HE = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({ month, basePath }: { month: string; basePath: string }) {
  const router = useRouter();
  const [y, m] = month.split("-").map(Number);

  function go(newMonth: string) {
    router.push(`${basePath}?month=${newMonth}`);
  }

  return (
    <div className="date-picker">
      <button type="button" aria-label="חודש קודם" onClick={() => go(shiftMonth(month, -1))}>
        ‹
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", padding: "4px 6px" }}>
        {MONTH_NAMES_HE[m - 1]} {y}
      </span>
      <button type="button" aria-label="חודש הבא" onClick={() => go(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  );
}
