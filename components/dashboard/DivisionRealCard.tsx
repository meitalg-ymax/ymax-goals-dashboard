import Link from "next/link";
import type { Division } from "@/lib/zoho/transform";
import type { DivisionMetrics, InvalidReason, RapidCategory } from "@/lib/dashboard/getDashboardData";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { calcLeadsKadav, calcWorkdayKadav } from "@/lib/metrics/pacing";
import { StageBlock, MoneyOutcome } from "@/components/dashboard/KadavRow";
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
  rapidCategories,
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
  rapidCategories: RapidCategory[];
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const leadsFO = metrics.leads_funded + metrics.leads_organic;
  const arrivalsFO = metrics.arrivals_funded_organic;
  const closingsFO = metrics.closings_funded_organic;
  const revenueFO = metrics.revenue_funded_organic;
  const avgDealFOActual = closingsFO > 0 ? revenueFO / closingsFO : 0;

  const leadsMail = metrics.leads_mailing;
  const arrivalsMail = metrics.arrivals_mailing;
  const closingsMail = metrics.closings_mailing;
  const revenueMail = metrics.revenue_mailing;
  const avgDealMailActual = closingsMail > 0 ? revenueMail / closingsMail : 0;

  const targetLeadsFO = targets.leads_funded + targets.leads_organic;
  const leadsFOKadav = calcLeadsKadav(leadsFO, targetLeadsFO || undefined, daysElapsed, daysInMonth);
  const arrivalsFOKadav = calcWorkdayKadav(arrivalsFO, targets.arrivals_funded_organic || undefined, workDaysElapsed, workDaysInMonth);
  const closingsFOKadav = calcWorkdayKadav(closingsFO, targets.closings_funded_organic || undefined, workDaysElapsed, workDaysInMonth);
  const revenueFOKadav = calcWorkdayKadav(revenueFO, targets.revenue_funded_organic || undefined, workDaysElapsed, workDaysInMonth);

  const leadsMailKadav = calcLeadsKadav(leadsMail, targets.leads_mailing || undefined, daysElapsed, daysInMonth);
  const arrivalsMailKadav = calcWorkdayKadav(arrivalsMail, targets.arrivals_mailing || undefined, workDaysElapsed, workDaysInMonth);
  const closingsMailKadav = calcWorkdayKadav(closingsMail, targets.closings_mailing || undefined, workDaysElapsed, workDaysInMonth);
  const revenueMailKadav = calcWorkdayKadav(revenueMail, targets.revenue_mailing || undefined, workDaysElapsed, workDaysInMonth);

  const totalLeads = leadsFO + leadsMail;
  const totalArrivals = arrivalsFO + arrivalsMail;
  const totalClosings = closingsFO + closingsMail;
  const totalRevenueCRM = revenueFO + revenueMail;

  const targetLeads = targetLeadsFO + targets.leads_mailing;
  const leadsKadav = calcLeadsKadav(totalLeads, targetLeads || undefined, daysElapsed, daysInMonth);

  const targetArrivals = targets.arrivals_funded_organic + targets.arrivals_mailing;
  const arrivalsKadav = calcWorkdayKadav(totalArrivals, targetArrivals || undefined, workDaysElapsed, workDaysInMonth);

  const targetClosings = targets.closings_funded_organic + targets.closings_mailing;
  const closingsKadav = calcWorkdayKadav(totalClosings, targetClosings || undefined, workDaysElapsed, workDaysInMonth);

  const targetRevenue = targets.revenue_funded_organic + targets.revenue_mailing;
  const revenueKadav = calcWorkdayKadav(totalRevenueCRM, targetRevenue || undefined, workDaysElapsed, workDaysInMonth);

  // ספה/שדרוגים actual: prefer the imported category rows (scripts/import-rapid-sales.mjs
  // writes the SAME number into manual_entries too, so summing both would double-count).
  const spaFromCategories = rapidCategories.filter((c) => c.division === division).reduce((s, c) => s + c.amount, 0);
  const spaActual = spaFromCategories > 0 ? spaFromCategories : (rapidActuals.revenue_spa_upgrades ?? 0);
  const spaKadav = calcWorkdayKadav(spaActual, targets.revenue_spa_upgrades || undefined, workDaysElapsed, workDaysInMonth);

  // ירוקים excluded -- company-wide only, can't be attributed to this division (see overview).
  const totalMoneyActual = totalRevenueCRM + spaActual;
  const totalMoneyTarget = targets.revenue_funded_organic + targets.revenue_mailing + targets.revenue_spa_upgrades;
  const totalMoneyKadav = calcWorkdayKadav(totalMoneyActual, totalMoneyTarget || undefined, workDaysElapsed, workDaysInMonth);

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

      <div className="extra-revenue">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="section-label" style={{ margin: 0 }}>
            תקציב ועלות ליד
          </p>
          <Link className="source-chip" href={`/rapid?division=${division}`}>
            ✎ עדכון תקציב בפועל
          </Link>
        </div>
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
          תקציב בפועל מוזן ידנית ב<Link href={`/rapid?division=${division}`}>&quot;הזנת נתונים ידניים&quot;</Link> (לא
          מסונכרן מ-Zoho). מחיר לליד בפועל = תקציב בפועל ÷ לידים ממומן בפועל.
        </p>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 10 }}>
          המשפך הכללי — כל הערוצים ביחד
        </p>
        <FunnelShape leads={totalLeads} arrivals={totalArrivals} closings={totalClosings} />
        <StageBlock title="לידים" result={leadsKadav} />
        <StageBlock title="הגעות" note={`(${pct(totalArrivals, totalLeads)} מהלידים)`} result={arrivalsKadav} />
        <StageBlock title="סגירות" note={`(${pct(totalClosings, totalArrivals)} מהמגיעות)`} result={closingsKadav} />
        <MoneyOutcome
          title="כסף (CRM)"
          result={revenueKadav}
          avgDealActual={totalClosings > 0 ? totalRevenueCRM / totalClosings : 0}
          avgDealTarget={0}
        />
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 10 }}>
          אותו משפך, לפי ערוץ
        </p>
        <div className="subfunnels">
          <div className="subfunnel-panel">
            <p className="subfunnel-title">
              ממומן + אורגני
              <span className="sub">
                {formatNumber(metrics.leads_funded)} ממומן · {formatNumber(metrics.leads_organic)} אורגני
              </span>
            </p>
            <FunnelShape leads={leadsFO} arrivals={arrivalsFO} closings={closingsFO} />
            <StageBlock title="לידים" result={leadsFOKadav} />
            <StageBlock title="הגעות" note={`(${pct(arrivalsFO, leadsFO)} מהלידים)`} result={arrivalsFOKadav} />
            <p className="money-avg" style={{ margin: "-6px 0 0" }}>
              מתוך זה: {formatNumber(metrics.arrivals_funded)} ממומן · {formatNumber(metrics.arrivals_organic)} אורגני
            </p>
            <StageBlock title="סגירות" note={`(${pct(closingsFO, arrivalsFO)} מהמגיעות)`} result={closingsFOKadav} />
            <p className="money-avg" style={{ margin: "-6px 0 0" }}>
              מתוך זה: {formatNumber(metrics.closings_funded)} ממומן · {formatNumber(metrics.closings_organic)} אורגני
            </p>
            <MoneyOutcome
              title="כסף"
              result={revenueFOKadav}
              avgDealActual={avgDealFOActual}
              avgDealTarget={targets.avg_deal_value_funded_organic ?? 0}
              breakdown={`${formatCurrency(metrics.revenue_funded)} ממומן · ${formatCurrency(metrics.revenue_organic)} אורגני`}
            />
          </div>
          <div className="subfunnel-panel">
            <p className="subfunnel-title">
              דיוור
              <span className="sub">ערוץ שני, נפרד מהממומן</span>
            </p>
            <FunnelShape leads={leadsMail} arrivals={arrivalsMail} closings={closingsMail} />
            <StageBlock title="לידים" result={leadsMailKadav} />
            <StageBlock title="הגעות" note={`(${pct(arrivalsMail, leadsMail)} מהלידים)`} result={arrivalsMailKadav} />
            <StageBlock title="סגירות" note={`(${pct(closingsMail, arrivalsMail)} מהמגיעות)`} result={closingsMailKadav} />
            <MoneyOutcome
              title="כסף"
              result={revenueMailKadav}
              avgDealActual={avgDealMailActual}
              avgDealTarget={targets.avg_deal_value_mailing ?? 0}
            />
          </div>
        </div>
      </div>

      <div className="extra-revenue">
        <p className="section-label" style={{ margin: 0 }}>
          הכנסות נוספות
        </p>
        <div className="extra-grid">
          <div className="extra-tile">
            <span className="et-label">ספה ושדרוגים</span>
            <span className="et-value" style={{ color: spaKadav.status === "good" ? "var(--good)" : "var(--ink)" }}>
              {formatCurrency(spaActual)}
            </span>
            <div className="mini-stat-row">
              <div className="mini-stat">
                <div className="ms-label">יעד</div>
                <div className="ms-val">{formatCurrency(targets.revenue_spa_upgrades ?? 0)}</div>
              </div>
              <div className="mini-stat">
                <div className="ms-label">קד״ב</div>
                <div className="ms-val">{formatCurrency(spaKadav.kadav)}</div>
              </div>
              <div className={`mini-stat pct ${spaKadav.status ?? ""}`}>
                <div className="ms-label">אחוז</div>
                <div className="ms-val">{spaKadav.pct !== null ? `${Math.round(spaKadav.pct)}%` : "—"}</div>
              </div>
            </div>
          </div>
          <div className="extra-tile">
            <span className="et-label">ירוקים (הפניות)</span>
            <span className="et-value">{formatCurrency(targets.revenue_referrals ?? 0)}</span>
            <span className="et-note">יעד בלבד — מדווח כלל-חברתי, לא מחולק לפי חטיבה (ר&apos; מבט כללי)</span>
          </div>
          <div className="extra-tile total">
            <span className="et-label">סה״כ כסף (החטיבה, ללא ירוקים)</span>
            <span className="et-value">{formatCurrency(totalMoneyActual)}</span>
            <div className="mini-stat-row">
              <div className="mini-stat">
                <div className="ms-label">יעד</div>
                <div className="ms-val">{formatCurrency(totalMoneyTarget)}</div>
              </div>
              <div className="mini-stat">
                <div className="ms-label">קד״ב</div>
                <div className="ms-val">{formatCurrency(totalMoneyKadav.kadav)}</div>
              </div>
              <div className={`mini-stat pct ${totalMoneyKadav.status ?? ""}`}>
                <div className="ms-label">אחוז</div>
                <div className="ms-val">{totalMoneyKadav.pct !== null ? `${Math.round(totalMoneyKadav.pct)}%` : "—"}</div>
              </div>
            </div>
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
        יעוץ/עסקה&quot;, סטטוס ליד = נסגרה עסקה. <strong style={{ color: "var(--ink)" }}>ירוקים (הפניות):</strong> מדווח
        כלל-חברתי בלבד, לא מחולק לפי חטיבה — ר&apos; מבט כללי. מתעדכן אוטומטית כל יום.
      </p>
    </div>
  );
}
