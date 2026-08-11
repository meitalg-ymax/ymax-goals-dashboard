import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { DivisionMetrics } from "@/lib/dashboard/getDashboardData";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  doctor: "doctor",
};

export function OverviewRealCard({
  divisions,
  asOf,
  monthLabel,
}: {
  divisions: Record<Division, DivisionMetrics>;
  asOf: string | null;
  monthLabel: string;
}) {
  const totals = DIVISIONS.reduce(
    (acc, d) => {
      const m = divisions[d];
      acc.leads += m.leads_funded + m.leads_organic;
      acc.funded += m.leads_funded;
      acc.organic += m.leads_organic;
      acc.arrivals += m.arrivals_funded_organic + m.arrivals_mailing;
      acc.closings += m.closings_funded_organic + m.closings_mailing;
      acc.revenue += m.revenue_funded_organic + m.revenue_mailing;
      return acc;
    },
    { leads: 0, funded: 0, organic: 0, arrivals: 0, closings: 0, revenue: 0 }
  );

  return (
    <div className="real-card">
      <div className="real-head">
        <div className="real-title">
          <h2>נתונים אמיתיים מ-Zoho — כל החטיבות</h2>
          <span className="real-badge">✓ נתון חי</span>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {monthLabel}
          {asOf ? ` — עד ${new Date(asOf).toLocaleDateString("he-IL")}` : ""}
        </span>
      </div>

      <div className="real-summary">
        <div className="real-tile">
          <div className="n">{formatNumber(totals.leads)}</div>
          <div className="l">סה״כ לידים</div>
        </div>
        <div className="real-tile">
          <div className="n">{formatNumber(totals.funded)}</div>
          <div className="l">ממומן</div>
        </div>
        <div className="real-tile">
          <div className="n">{formatNumber(totals.organic)}</div>
          <div className="l">אורגני</div>
        </div>
      </div>

      <div className="real-table">
        <div className="real-row head">
          <span>חטיבה</span>
          <span>יחס ממומן / אורגני</span>
          <span>ממומן</span>
          <span>אורגני</span>
          <span>סהכ</span>
        </div>
        {DIVISIONS.map((d) => {
          const m = divisions[d];
          const total = m.leads_funded + m.leads_organic;
          const paidPct = total > 0 ? (m.leads_funded / total) * 100 : 0;
          const orgPct = total > 0 ? 100 - paidPct : 0;
          return (
            <div className="real-row" key={d}>
              <span className="rname">{DIVISION_LABELS[d]}</span>
              <span className="rbar-wrap">
                <span className="rbar-paid" style={{ width: `${paidPct}%` }} />
                <span className="rbar-org" style={{ width: `${orgPct}%` }} />
              </span>
              <span>{formatNumber(m.leads_funded)}</span>
              <span>{formatNumber(m.leads_organic)}</span>
              <span>{formatNumber(total)}</span>
            </div>
          );
        })}
      </div>

      <div className="summary">
        <div className="tile">
          <span className="label">סה״כ הגעות</span>
          <div className="value-row">
            <span className="value">{formatNumber(totals.arrivals)}</span>
          </div>
        </div>
        <div className="tile">
          <span className="label">סה״כ סגירות</span>
          <div className="value-row">
            <span className="value">{formatNumber(totals.closings)}</span>
          </div>
        </div>
        <div className="tile">
          <span className="label">סה״כ הכנסות (CRM בלבד)</span>
          <div className="value-row">
            <span className="value">{formatCurrency(totals.revenue)}</span>
          </div>
        </div>
      </div>

      <p className="real-note">
        <strong style={{ color: "var(--ink)" }}>פירוט מלא</strong> — כולל לידים לא תקינים, הגעות, סגירות והכנסות
        בפילוח ממומן/אורגני/דיוור — נמצא בטאב של כל חטיבה בנפרד. הכנסות כאן הן מ-CRM בלבד, לא כוללות ספה/שדרוגים/ירוקים.
      </p>
    </div>
  );
}
