import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { DivisionMetrics } from "@/lib/dashboard/getDashboardData";
import { formatCurrency } from "@/lib/metrics/format";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

// Fixed categorical order + colors -- see app/globals.css --series-* tokens
// (validated together for CVD separation). Never reused for status/income-type.
const DIVISION_COLORS: Record<Division, string> = {
  ymax: "var(--series-ymax)",
  body: "var(--series-body)",
  tech: "var(--series-tech)",
  mira_dry: "var(--series-mira_dry)",
  doctor: "var(--series-doctor)",
};

export function RevenueByDivisionPie({
  divisions,
  spaUpgradesActual,
}: {
  divisions: Record<Division, DivisionMetrics>;
  spaUpgradesActual: Record<Division, number>;
}) {
  // ספה ושדרוגים here is already Rapid's category total for the division
  // minus that division's own CRM revenue (see getDashboardData.ts) -- adding
  // the raw category total on top of CRM revenue would double-count real
  // money Zoho already recorded for the same payments.
  const values = DIVISIONS.map((d) => {
    const m = divisions[d];
    return { division: d, value: m.revenue_funded_organic + m.revenue_mailing + spaUpgradesActual[d] };
  });
  const total = values.reduce((s, v) => s + v.value, 0);

  if (total <= 0) {
    return (
      <div className="missing-card">
        <div className="mc-text">
          <span className="mc-title">אין עדיין נתוני הכנסה החודש</span>
          <span className="mc-sub">הפילוח יופיע ברגע שיהיו נתוני CRM ו/או ראפיד לחודש הנוכחי.</span>
        </div>
        <span className="missing-badge">⏳ חסר נתון</span>
      </div>
    );
  }

  let acc = 0;
  const stops = values
    .filter((v) => v.value > 0)
    .map((v) => {
      const pct = (v.value / total) * 100;
      const from = acc;
      acc += pct;
      return `${DIVISION_COLORS[v.division]} ${from}% ${acc}%`;
    })
    .join(", ");

  return (
    <div className="pie-wrap">
      <div className="pie-donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="pie-hole">
          <span className="pie-hole-val">{formatCurrency(total)}</span>
          <span className="pie-hole-label">סה״כ הכנסה</span>
        </div>
      </div>
      <div className="pie-legend">
        {values.map(({ division, value }) => {
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div className="pie-legend-row" key={division}>
              <span className="pie-dot" style={{ background: DIVISION_COLORS[division] }} />
              <span className="pie-legend-label">{DIVISION_LABELS[division]}</span>
              <span className="pie-legend-val">{formatCurrency(value)}</span>
              <span className="pie-legend-pct">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
