import type { Division } from "@/lib/zoho/transform";
import type { DivisionMetrics, InvalidReason } from "@/lib/dashboard/getDashboardData";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { calcLeadsKadav, calcWorkdayKadav } from "@/lib/metrics/pacing";
import { KadavRow } from "@/components/dashboard/KadavRow";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

export function DivisionRealCard({
  division,
  metrics,
  reasons,
  asOf,
  targets,
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

  return (
    <div className="real-card">
      <div className="real-head">
        <div className="real-title">
          <h2>נתונים אמיתיים מ-Zoho — {DIVISION_LABELS[division]}</h2>
          <span className="real-badge">✓ נתון חי</span>
        </div>
        {asOf && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>1–{new Date(asOf).getUTCDate()} בחודש (עד אתמול)</span>}
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          לידים
        </p>
        <div className="real-summary" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <div className="real-tile">
            <div className="n">{formatNumber(totalLeads)}</div>
            <div className="l">סה״כ לידים</div>
          </div>
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
        <KadavRow result={leadsKadav} />
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

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          הגעות
        </p>
        <div className="real-summary" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.arrivals_funded_organic)}</div>
            <div className="l">ממומן+אורגני</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.arrivals_mailing)}</div>
            <div className="l">דיוור</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(totalArrivals)}</div>
            <div className="l">סה״כ הגעות</div>
          </div>
        </div>
        <KadavRow result={arrivalsKadav} />
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          סגירות
        </p>
        <div className="real-summary" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.closings_funded_organic)}</div>
            <div className="l">ממומן+אורגני</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(metrics.closings_mailing)}</div>
            <div className="l">דיוור</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatNumber(totalClosings)}</div>
            <div className="l">סה״כ סגירות</div>
          </div>
        </div>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 8 }}>
          הכנסות (CRM בלבד — לא כולל ספה/שדרוגים/ירוקים)
        </p>
        <div className="real-summary" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="real-tile">
            <div className="n">{formatCurrency(metrics.revenue_funded_organic)}</div>
            <div className="l">ממומן+אורגני</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatCurrency(metrics.revenue_mailing)}</div>
            <div className="l">דיוור</div>
          </div>
          <div className="real-tile">
            <div className="n">{formatCurrency(totalRevenue)}</div>
            <div className="l">סה״כ הכנסות</div>
          </div>
        </div>
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
