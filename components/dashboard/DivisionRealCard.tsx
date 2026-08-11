import type { Division } from "@/lib/zoho/transform";
import type { DivisionMetrics, InvalidReason } from "@/lib/dashboard/getDashboardData";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { calcLeadsKadav, calcWorkdayKadav } from "@/lib/metrics/pacing";
import { StageBlock } from "@/components/dashboard/KadavRow";
import { FunnelShape } from "@/components/dashboard/FunnelShape";

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function DivisionRealCard({
  division,
  metrics,
  reasons,
  asOf,
  targets,
  rapidActuals,
  daysElapsed,
  daysInMonth,
  workDaysElapsed,
  workDaysInMonth,
}: {
  division: Division;
  metrics: DivisionMetrics;
  reasons: InvalidReason[];
  asOf: string | null;
  targets: Record<string, number>;
  rapidActuals: Record<string, number>;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const totalLeads = metrics.leads_funded + metrics.leads_organic;
  const totalArrivals = metrics.arrivals_funded_organic + metrics.arrivals_mailing;
  const totalClosings = metrics.closings_funded_organic + metrics.closings_mailing;
  const totalRevenue = metrics.revenue_funded_organic + metrics.revenue_mailing;

  const targetLeads = targets.leads_funded + targets.leads_organic + targets.leads_mailing;
  const hasLeadsTarget = targets.leads_funded || targets.leads_organic || targets.leads_mailing;
  const leadsKadav = calcLeadsKadav(totalLeads, hasLeadsTarget ? targetLeads : undefined, daysElapsed, daysInMonth);

  const targetArrivals = targets.arrivals_funded_organic + targets.arrivals_mailing;
  const hasArrivalsTarget = targets.arrivals_funded_organic || targets.arrivals_mailing;
  const arrivalsKadav = calcWorkdayKadav(
    totalArrivals,
    hasArrivalsTarget ? targetArrivals : undefined,
    workDaysElapsed,
    workDaysInMonth
  );

  const targetClosings = targets.closings_funded_organic + targets.closings_mailing;
  const hasClosingsTarget = targets.closings_funded_organic || targets.closings_mailing;
  const closingsKadav = calcWorkdayKadav(
    totalClosings,
    hasClosingsTarget ? targetClosings : undefined,
    workDaysElapsed,
    workDaysInMonth
  );

  const targetRevenue = targets.revenue_funded_organic + targets.revenue_mailing;
  const hasRevenueTarget = targets.revenue_funded_organic || targets.revenue_mailing;
  const revenueKadav = calcWorkdayKadav(
    totalRevenue,
    hasRevenueTarget ? targetRevenue : undefined,
    workDaysElapsed,
    workDaysInMonth
  );

  const budgetTarget = targets.budget_funded;
  const budgetActual = rapidActuals.budget_funded ?? 0;
  const hasBudgetTarget = Boolean(budgetTarget);
  const budgetUtilizationPct = hasBudgetTarget ? (budgetActual / budgetTarget) * 100 : null;

  const costPerLeadActual = metrics.leads_funded > 0 ? budgetActual / metrics.leads_funded : null;
  const costPerLeadTarget = targets.cost_per_lead_funded || null;

  return (
    <div className="real-card">
      <div className="real-head">
        <div className="real-title">
          <h2>נתונים אמיתיים מ-Zoho</h2>
          <span className="real-badge">✓ נתון חי</span>
        </div>
        {asOf && (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            1–{new Date(asOf).getUTCDate()} בחודש (עד אתמול)
          </span>
        )}
      </div>

      <FunnelShape leads={totalLeads} arrivals={totalArrivals} closings={totalClosings} />

      <StageBlock title="לידים" result={leadsKadav} />
      <StageBlock
        title="הגעות"
        note={`(${pct(totalArrivals, totalLeads)} מהלידים)`}
        result={arrivalsKadav}
      />
      <StageBlock
        title="סגירות"
        note={`(${pct(totalClosings, totalArrivals)} מהמגיעות)`}
        result={closingsKadav}
      />
      <StageBlock
        title="הכנסות (CRM בלבד)"
        result={revenueKadav}
        isCurrency
      />

      <div className="extra-revenue">
        <p className="section-label" style={{ margin: 0 }}>
          תקציב ועלות ליד
        </p>
        {!hasBudgetTarget ? (
          <div className="missing-card">
            <div className="mc-text">
              <span className="mc-title">חסר יעד תקציב</span>
              <span className="mc-sub">הזיני יעד תקציב ממומן ב&quot;הזנת יעדים&quot; כדי לראות ניצול.</span>
            </div>
            <span className="missing-badge">⏳ חסר יעד</span>
          </div>
        ) : (
          <div className="stage-block">
            <p className="stage-title">ניצול תקציב (מתחילת החודש)</p>
            <div className="stat-row">
              <div className="stat-box">
                <span className="stat-label">יעד חודשי</span>
                <span className="stat-val">{formatCurrency(budgetTarget)}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">נוצל בפועל</span>
                <span className="stat-val">{formatCurrency(budgetActual)}</span>
              </div>
              <div
                className={`stat-box pct ${
                  budgetUtilizationPct === null
                    ? ""
                    : budgetUtilizationPct <= 100
                      ? "good"
                      : budgetUtilizationPct <= 110
                        ? "warn"
                        : "critical"
                }`}
              >
                <span className="stat-label">אחוז ניצול</span>
                <span className="stat-val">
                  {budgetUtilizationPct === null ? "—" : `${Math.round(budgetUtilizationPct)}%`}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="conv-table">
          <div className="conv-row">
            <span className="cv-label">מחיר לליד ממומן</span>
            <div className="cv-val">
              <span className="cv-num">{costPerLeadTarget ? formatCurrency(costPerLeadTarget) : "—"}</span>
              <span className="cv-tag">יעד</span>
            </div>
            <div className="cv-val">
              <span className="cv-num">{costPerLeadActual !== null ? formatCurrency(costPerLeadActual) : "—"}</span>
              <span className="cv-tag">בפועל</span>
            </div>
          </div>
        </div>
        <p className="note-text">
          תקציב בפועל מוזן ידנית ב&quot;הזנת נתונים ידניים&quot; (לא מסונכרן מ-Zoho). מחיר לליד בפועל = תקציב בפועל ÷
          לידים ממומן בפועל.
        </p>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          פירוט לידים
        </p>
        <div className="real-summary" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.leads_funded)}</div>
            <div className="l">ממומן</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.leads_organic)}</div>
            <div className="l">אורגני</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.leads_mailing)}</div>
            <div className="l">מדיוור</div>
          </div>
        </div>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          לידים לא תקינים (ממומן בלבד)
        </p>
        {metrics.leads_funded === 0 ? (
          <div className="missing-card">
            <div className="mc-text">
              <span className="mc-title">חסר נתון — אין לידים ממומן</span>
              <span className="mc-sub">לחטיבה זו אין כרגע לידים ממומן, ולכן אין על מה לחשב.</span>
            </div>
            <span className="missing-badge">⏳ חסר נתון</span>
          </div>
        ) : (
          <div className="invalid-tile">
            <div className="invalid-head-row">
              <span className="invalid-big">{formatNumber(metrics.invalid_leads_funded)}</span>
              <span className="invalid-pct">
                {((metrics.invalid_leads_funded / metrics.leads_funded) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="invalid-of">מתוך {formatNumber(metrics.leads_funded)} ממומן</div>
            {reasons.length > 0 && (
              <div className="reason-list">
                {reasons.map((r) => (
                  <div className="reason-row" key={r.reason}>
                    <span>{r.reason}</span>
                    <span className="rv">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="real-note">
        <strong style={{ color: "var(--ink)" }}>לידים:</strong> לפי מקור ליד (מכיל &quot;marketism&quot; = ממומן,
        חוץ מ-&quot;ig_linktree&quot; שנחשב אורגני). <strong style={{ color: "var(--ink)" }}>לא תקינים:</strong> שדה
        &quot;מעקב פניה&quot;, ממומן בלבד. <strong style={{ color: "var(--ink)" }}>הגעות:</strong> שדה &quot;זמן
        פגישת ייעוץ&quot;. <strong style={{ color: "var(--ink)" }}>סגירות והכנסות:</strong> שדה &quot;תאריך
        יעוץ/עסקה&quot;, סטטוס ליד = נסגרה עסקה. <strong style={{ color: "var(--ink)" }}>לא כלול:</strong> ספה,
        שדרוגים וירוקים — יתווסף בנפרד בהמשך. מתעדכן אוטומטית כל יום.
      </p>
    </div>
  );
}
