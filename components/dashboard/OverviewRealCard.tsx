import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { DivisionMetrics } from "@/lib/dashboard/getDashboardData";
import { formatNumber } from "@/lib/metrics/format";
import { calcLeadsKadav, calcWorkdayKadav } from "@/lib/metrics/pacing";
import { StageBlock } from "@/components/dashboard/KadavRow";
import { FunnelShape } from "@/components/dashboard/FunnelShape";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function OverviewRealCard({
  divisions,
  asOf,
  monthLabel,
  targets,
  daysElapsed,
  daysInMonth,
  workDaysElapsed,
  workDaysInMonth,
}: {
  divisions: Record<Division, DivisionMetrics>;
  asOf: string | null;
  monthLabel: string;
  targets: Record<Division, Record<string, number>>;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const totals = DIVISIONS.reduce(
    (acc, d) => {
      const m = divisions[d];
      const t = targets[d];
      acc.leads += m.leads_funded + m.leads_organic;
      acc.funded += m.leads_funded;
      acc.organic += m.leads_organic;
      acc.arrivals += m.arrivals_funded_organic + m.arrivals_mailing;
      acc.closings += m.closings_funded_organic + m.closings_mailing;
      acc.revenue += m.revenue_funded_organic + m.revenue_mailing;
      acc.targetLeads += (t.leads_funded ?? 0) + (t.leads_organic ?? 0) + (t.leads_mailing ?? 0);
      acc.targetArrivals += (t.arrivals_funded_organic ?? 0) + (t.arrivals_mailing ?? 0);
      acc.targetClosings += (t.closings_funded_organic ?? 0) + (t.closings_mailing ?? 0);
      acc.targetRevenue += (t.revenue_funded_organic ?? 0) + (t.revenue_mailing ?? 0);
      if (Object.keys(t).length > 0) acc.hasTargets = true;
      return acc;
    },
    {
      leads: 0,
      funded: 0,
      organic: 0,
      arrivals: 0,
      closings: 0,
      revenue: 0,
      targetLeads: 0,
      targetArrivals: 0,
      targetClosings: 0,
      targetRevenue: 0,
      hasTargets: false,
    }
  );

  const leadsKadav = calcLeadsKadav(totals.leads, totals.hasTargets ? totals.targetLeads : undefined, daysElapsed, daysInMonth);
  const arrivalsKadav = calcWorkdayKadav(
    totals.arrivals,
    totals.hasTargets ? totals.targetArrivals : undefined,
    workDaysElapsed,
    workDaysInMonth
  );
  const closingsKadav = calcWorkdayKadav(
    totals.closings,
    totals.hasTargets ? totals.targetClosings : undefined,
    workDaysElapsed,
    workDaysInMonth
  );
  const revenueKadav = calcWorkdayKadav(
    totals.revenue,
    totals.hasTargets ? totals.targetRevenue : undefined,
    workDaysElapsed,
    workDaysInMonth
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

      <FunnelShape leads={totals.leads} arrivals={totals.arrivals} closings={totals.closings} />

      <StageBlock title="לידים" result={leadsKadav} />
      <StageBlock title="הגעות" note={`(${pct(totals.arrivals, totals.leads)} מהלידים)`} result={arrivalsKadav} />
      <StageBlock
        title="סגירות"
        note={`(${pct(totals.closings, totals.arrivals)} מהמגיעות)`}
        result={closingsKadav}
      />
      <StageBlock title="הכנסות (CRM בלבד)" result={revenueKadav} isCurrency />

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          לידים ממומן/אורגני לפי חטיבה
        </p>
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
      </div>

      <p className="real-note">
        <strong style={{ color: "var(--ink)" }}>פירוט מלא</strong> — כולל לידים לא תקינים, תקציב וניצול, ומחיר לליד
        בפועל מול יעד — נמצא בטאב של כל חטיבה בנפרד. הכנסות כאן הן מ-CRM בלבד, לא כוללות ספה/שדרוגים/ירוקים.
      </p>
    </div>
  );
}
