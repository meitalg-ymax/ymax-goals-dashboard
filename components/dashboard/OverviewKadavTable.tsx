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

const COLS = "1.4fr 1fr 1fr 1fr 1fr";

function Row({
  label,
  result,
  isCurrency,
  bold,
}: {
  label: string;
  result: KadavResult | null;
  isCurrency?: boolean;
  bold?: boolean;
}) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  const status = result?.status;
  return (
    <div className="real-row" style={{ gridTemplateColumns: COLS, fontWeight: bold ? 700 : 400 }}>
      <span className="rname">{label}</span>
      <span>{result ? fmt(result.target) : "—"}</span>
      <span>{result ? fmt(result.actual) : "—"}</span>
      <span>{result ? fmt(result.kadav) : "—"}</span>
      <span
        className={status ? `chip ${status}` : undefined}
        style={{ width: "fit-content", justifySelf: "start" }}
      >
        {result?.pct !== null && result?.pct !== undefined ? `${Math.round(result.pct)}%` : "—"}
      </span>
    </div>
  );
}

export function OverviewKadavTable({
  divisions,
  targets,
  rapidCategories,
  daysElapsed,
  daysInMonth,
  workDaysElapsed,
  workDaysInMonth,
}: {
  divisions: Record<Division, DivisionMetrics>;
  targets: Record<Division, Record<string, number>>;
  rapidCategories: RapidCategory[];
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const REFERRALS_CATEGORY = "ירוקים (הפניות)";

  const rapidByDivision = (d: Division) =>
    rapidCategories.filter((c) => c.division === d).reduce((sum, c) => sum + c.amount, 0);

  // Unassigned (division=null) rapid categories cover two distinct
  // company-wide streams -- general product sales and referrals -- kept
  // separate rather than lumped into one "products" total.
  const productsActual = rapidCategories
    .filter((c) => c.division === null && c.category !== REFERRALS_CATEGORY)
    .reduce((sum, c) => sum + c.amount, 0);
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

    // "סה"כ כסף" -- the real reconciliation total, from Rapid (all money that
    // actually landed, CRM-tracked or not), not just Zoho CRM revenue.
    // Referrals are excluded here -- the source report has no division
    // column, so actual referral revenue can't be attributed to any one
    // division (see the dedicated "ירוקים" line below instead).
    const moneyActual = m.revenue_funded_organic + m.revenue_mailing + rapidByDivision(d);
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

  grandMoneyActual += productsActual + referralsActualTotal;
  grandMoneyTarget += referralsTargetTotal;

  const referralsKadav = calcWorkdayKadav(
    referralsActualTotal,
    referralsTargetTotal || undefined,
    workDaysElapsed,
    workDaysInMonth
  );

  const grandLeadsKadav = calcLeadsKadav(grandLeadsActual, grandLeadsTarget || undefined, daysElapsed, daysInMonth);
  const grandArrivalsKadav = calcWorkdayKadav(grandArrivalsActual, grandArrivalsTarget || undefined, workDaysElapsed, workDaysInMonth);
  const grandClosingsKadav = calcWorkdayKadav(grandClosingsActual, grandClosingsTarget || undefined, workDaysElapsed, workDaysInMonth);
  const grandMoneyKadav = calcWorkdayKadav(grandMoneyActual, grandMoneyTarget || undefined, workDaysElapsed, workDaysInMonth);

  return (
    <div className="real-card">
      <div className="real-head">
        <div className="real-title">
          <h2>מבט כללי — יעד מול ביצוע</h2>
          <span className="real-badge">✓ נתון חי</span>
        </div>
      </div>

      <div className="real-table">
        <div className="real-row head" style={{ gridTemplateColumns: COLS }}>
          <span>מדד</span>
          <span>יעד</span>
          <span>ביצוע</span>
          <span>קד&quot;ב</span>
          <span>אחוז קד&quot;ב</span>
        </div>

        {rows.map(({ division, leadsKadav, arrivalsKadav, closingsKadav, moneyKadav }) => (
          <div key={division} style={{ marginTop: 6 }}>
            <p className="section-label" style={{ margin: "0 0 6px" }}>
              {DIVISION_LABELS[division]}
            </p>
            <Row label="סה״כ לידים" result={leadsKadav} />
            <Row label="סה״כ הגעות" result={arrivalsKadav} />
            <Row label="סה״כ סגירות" result={closingsKadav} />
            <Row label="סה״כ כסף" result={moneyKadav} isCurrency />
          </div>
        ))}

        <div style={{ marginTop: 6 }}>
          <p className="section-label" style={{ margin: "0 0 6px" }}>
            מוצרים וירוקים — כלל החברה
          </p>
          <div className="real-row" style={{ gridTemplateColumns: COLS }}>
            <span className="rname">מכירת מוצרים (כללי)</span>
            <span>—</span>
            <span>{formatCurrency(productsActual)}</span>
            <span>—</span>
            <span>—</span>
          </div>
          <Row label="ירוקים (הפניות)" result={referralsKadav} isCurrency />
        </div>

        <div style={{ marginTop: 10, borderTop: "2px solid var(--border)", paddingTop: 10 }}>
          <p className="section-label" style={{ margin: "0 0 6px" }}>
            סה״כ הכל
          </p>
          <Row label="סה״כ לידים" result={grandLeadsKadav} bold />
          <Row label="סה״כ הגעות" result={grandArrivalsKadav} bold />
          <Row label="סה״כ סגירות" result={grandClosingsKadav} bold />
          <Row label="סה״כ כסף (כולל מוצרים וירוקים)" result={grandMoneyKadav} isCurrency bold />
        </div>
      </div>

      <p className="real-note">
        <strong style={{ color: "var(--ink)" }}>סה״כ כסף</strong> (לפי חטיבה) = הכנסות CRM (ממומן+אורגני+דיוור) + ספה
        ושדרוגים ששויכו לחטיבה. <strong style={{ color: "var(--ink)" }}>ירוקים (הפניות)</strong> מדווחים בדוח כלל-חברתי
        ללא פירוט לחטיבה, ולכן מוצגים כשורה נפרדת ולא מחולקים בין החטיבות (היעד עדיין מוזן לפי חטיבה ומסוכם כאן).{" "}
        <strong style={{ color: "var(--ink)" }}>מוצרים</strong> הן מכירות מוצרים כלליות שלא משויכות לחטיבה ספציפית —
        עדיין אין להן יעד מוגדר במערכת.
      </p>
    </div>
  );
}
