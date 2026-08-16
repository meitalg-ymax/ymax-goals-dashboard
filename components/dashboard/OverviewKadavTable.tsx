import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { DivisionMetrics, RapidCategory } from "@/lib/dashboard/getDashboardData";
import { calcLeadsKadav, calcWorkdayKadav, type KadavResult } from "@/lib/metrics/pacing";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

const DIVISION_COLORS: Record<Division, string> = {
  ymax: "var(--series-ymax)",
  body: "var(--series-body)",
  tech: "var(--series-tech)",
  mira_dry: "var(--series-mira_dry)",
  doctor: "var(--series-doctor)",
};

function HeroTile({
  label,
  result,
  isCurrency,
  total,
}: {
  label: string;
  result: KadavResult | null;
  isCurrency?: boolean;
  total?: boolean;
}) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  return (
    <div className={`extra-tile${total ? " total" : ""}`}>
      <span className="et-label">{label}</span>
      <span className="et-value">{result ? fmt(result.actual) : "—"}</span>
      {result && (
        <div className="mini-stat-row">
          <div className="mini-stat">
            <div className="ms-label">יעד</div>
            <div className="ms-val">{fmt(result.target)}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">קד״ב</div>
            <div className="ms-val">{fmt(result.kadav)}</div>
          </div>
          <div className={`mini-stat pct ${result.status ?? ""}`}>
            <div className="ms-label">אחוז</div>
            <div className="ms-val">{result.pct !== null ? `${Math.round(result.pct)}%` : "—"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBar({ label, result, isCurrency }: { label: string; result: KadavResult; isCurrency?: boolean }) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  const barWidth = result.pct === null ? 0 : Math.max(Math.min(result.pct, 100), result.actual > 0 ? 3 : 0);
  return (
    <div className="ov-metric">
      <div className="ov-metric-top">
        <span className="ov-metric-label">{label}</span>
        <span className="ov-metric-nums">
          {fmt(result.actual)} <span className="target">/ {result.target ? fmt(result.target) : "—"}</span>
        </span>
      </div>
      <div className="ov-bar-track">
        <div className={`ov-bar-fill ${result.status ?? ""}`} style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  );
}

export function OverviewKadavTable({
  divisions,
  targets,
  rapidCategories,
  spaUpgradesActual,
  companyTargets,
  daysElapsed,
  daysInMonth,
  workDaysElapsed,
  workDaysInMonth,
}: {
  divisions: Record<Division, DivisionMetrics>;
  targets: Record<Division, Record<string, number>>;
  rapidCategories: RapidCategory[];
  spaUpgradesActual: Record<Division, number>;
  companyTargets: Record<string, number>;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const REFERRALS_CATEGORY = "ירוקים (הפניות)";

  // Unassigned (division=null) rapid categories cover two distinct
  // company-wide streams -- general product sales and referrals -- kept
  // separate rather than lumped into one "products" total.
  const productsActual = rapidCategories
    .filter((c) => c.division === null && c.category !== REFERRALS_CATEGORY)
    .reduce((sum, c) => sum + c.amount, 0);
  // ירוקים -- ymax's own spaUpgradesActual already has this subtracted out
  // (see getDashboardData.ts, confirmed with Meital 2026-08-16: ymax's own
  // Rapid total needs referrals removed to avoid double-counting against
  // its own tracked revenue), so it's no longer embedded in any division's
  // total above -- it must be added back here explicitly, the same way
  // productsActual is, or this real money would silently disappear from the
  // company grand total.
  const referralsActualTotal = rapidCategories
    .filter((c) => c.division === null && c.category === REFERRALS_CATEGORY)
    .reduce((sum, c) => sum + c.amount, 0);

  let grandLeadsActual = 0,
    grandLeadsTarget = 0,
    grandArrivalsActual = 0,
    grandArrivalsTarget = 0,
    grandClosingsActual = 0,
    grandClosingsTarget = 0,
    grandMoneyActual = 0,
    grandMoneyTarget = 0,
    referralsTargetTotal = 0;

  const rows = DIVISIONS.map((d) => {
    const m = divisions[d];
    const t = targets[d] ?? {};

    const leadsActual = m.leads_funded + m.leads_organic + m.leads_mailing;
    const leadsTarget = (t.leads_funded ?? 0) + (t.leads_organic ?? 0) + (t.leads_mailing ?? 0);
    const leadsKadav = calcLeadsKadav(leadsActual, leadsTarget || undefined, daysElapsed, daysInMonth);

    const arrivalsActual = m.arrivals_funded_organic + m.arrivals_mailing;
    const arrivalsTarget = (t.arrivals_funded_organic ?? 0) + (t.arrivals_mailing ?? 0);
    const arrivalsKadav = calcWorkdayKadav(arrivalsActual, arrivalsTarget || undefined, workDaysElapsed, workDaysInMonth);

    const closingsActual = m.closings_funded_organic + m.closings_mailing;
    const closingsTarget = (t.closings_funded_organic ?? 0) + (t.closings_mailing ?? 0);
    const closingsKadav = calcWorkdayKadav(closingsActual, closingsTarget || undefined, workDaysElapsed, workDaysInMonth);

    // "סה"כ כסף" -- CRM revenue + this division's ספה ושדרוגים actual, which
    // is already Rapid's category total for this division MINUS the same
    // CRM revenue (see getDashboardData.ts) -- so this correctly resolves to
    // Rapid's real total for the division, not a double-counted sum of both.
    const moneyActual = m.revenue_funded_organic + m.revenue_mailing + spaUpgradesActual[d];
    const moneyTarget = (t.revenue_funded_organic ?? 0) + (t.revenue_mailing ?? 0) + (t.revenue_spa_upgrades ?? 0);
    const moneyKadav = calcWorkdayKadav(moneyActual, moneyTarget || undefined, workDaysElapsed, workDaysInMonth);

    grandLeadsActual += leadsActual;
    grandLeadsTarget += leadsTarget;
    grandArrivalsActual += arrivalsActual;
    grandArrivalsTarget += arrivalsTarget;
    grandClosingsActual += closingsActual;
    grandClosingsTarget += closingsTarget;
    grandMoneyActual += moneyActual;
    grandMoneyTarget += moneyTarget;
    referralsTargetTotal += t.revenue_referrals ?? 0;

    return { division: d, leadsKadav, arrivalsKadav, closingsKadav, moneyKadav };
  });

  const productsTarget = companyTargets.revenue_products ?? 0;

  // Products (division=null) are genuinely separate money, not embedded in
  // any division's Rapid total -- added normally. Referrals used to be
  // skipped here (already embedded in a division's total, don't double-add)
  // -- but ymax's spaUpgradesActual now has referrals subtracted out (see
  // getDashboardData.ts), so that money needs to be added back here or it
  // silently disappears from the company grand total.
  grandMoneyActual += productsActual + referralsActualTotal;
  grandMoneyTarget += referralsTargetTotal + productsTarget;

  const referralsKadav = calcWorkdayKadav(
    referralsActualTotal,
    referralsTargetTotal || undefined,
    workDaysElapsed,
    workDaysInMonth
  );
  const productsKadav = calcWorkdayKadav(productsActual, productsTarget || undefined, workDaysElapsed, workDaysInMonth);

  const grandLeadsKadav = calcLeadsKadav(grandLeadsActual, grandLeadsTarget || undefined, daysElapsed, daysInMonth);
  const grandArrivalsKadav = calcWorkdayKadav(grandArrivalsActual, grandArrivalsTarget || undefined, workDaysElapsed, workDaysInMonth);
  const grandClosingsKadav = calcWorkdayKadav(grandClosingsActual, grandClosingsTarget || undefined, workDaysElapsed, workDaysInMonth);
  const grandMoneyKadav = calcWorkdayKadav(grandMoneyActual, grandMoneyTarget || undefined, workDaysElapsed, workDaysInMonth);

  return (
    <>
      <div className="extra-revenue">
        <p className="section-label" style={{ margin: 0 }}>
          סה״כ הכל — כלל החברה
        </p>
        <div className="extra-grid">
          <HeroTile label="סה״כ לידים" result={grandLeadsKadav} />
          <HeroTile label="סה״כ הגעות" result={grandArrivalsKadav} />
          <HeroTile label="סה״כ סגירות" result={grandClosingsKadav} />
          <HeroTile label="סה״כ כסף (כולל מוצרים וירוקים)" result={grandMoneyKadav} isCurrency total />
        </div>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: 10 }}>
          מבט כללי — לפי חטיבה
        </p>
        <div className="ov-grid">
          {rows.map(({ division, leadsKadav, arrivalsKadav, closingsKadav, moneyKadav }) => (
            <div className="ov-card" key={division}>
              <div className="ov-card-head">
                <span className="ov-dot" style={{ background: DIVISION_COLORS[division] }} />
                <span className="ov-card-name">{DIVISION_LABELS[division]}</span>
                {moneyKadav.pct !== null && (
                  <span className={`chip ${moneyKadav.status ?? ""}`}>{Math.round(moneyKadav.pct)}%</span>
                )}
              </div>
              <MetricBar label="לידים" result={leadsKadav} />
              <MetricBar label="הגעות" result={arrivalsKadav} />
              <MetricBar label="סגירות" result={closingsKadav} />
              <MetricBar label="כסף" result={moneyKadav} isCurrency />
            </div>
          ))}

          <div className="ov-card">
            <div className="ov-card-head">
              <span className="ov-dot" style={{ background: "var(--gold)" }} />
              <span className="ov-card-name">מוצרים וירוקים — כלל החברה</span>
            </div>
            <MetricBar label="מכירת מוצרים (כללי)" result={productsKadav} isCurrency />
            <MetricBar label="ירוקים (הפניות)" result={referralsKadav} isCurrency />
          </div>
        </div>
      </div>

      <p className="real-note">
        <strong style={{ color: "var(--ink)" }}>סה״כ כסף</strong> (לפי חטיבה) = הכנסות CRM (ממומן+אורגני+דיוור) + ספה
        ושדרוגים בפועל, כאשר ספה ושדרוגים = הסה״כ שדיווח ראפיד לחטיבה הזו <em>פחות</em> ההכנסות מ-CRM — כי ראפיד
        רושם כל תשלום שהתקבל בקליניקה, כולל תשלומים שכבר נספרו בנפרד ב-Zoho, ולא צריך לספור אותם פעמיים. עבור ymax
        ספציפית מורידים גם את <strong style={{ color: "var(--ink)" }}>ירוקים (הפניות)</strong> מהסה״כ של ראפיד, מאותה
        סיבה — לקוח שהגיע בהפניה עדיין מוקלד בראפיד תחת ymax. <strong style={{ color: "var(--ink)" }}>ירוקים</strong>{" "}
        עצמו מתווסף בנפרד בסה״כ הכללי למטה (בדיוק כמו <strong style={{ color: "var(--ink)" }}>מוצרים</strong>), כך
        שהכסף לא נעלם, רק מוצג כשורה נפרדת במקום להיחשב בטעות כחלק מהביצוע של ymax.
      </p>
    </>
  );
}
