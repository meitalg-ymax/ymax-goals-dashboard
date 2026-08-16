import type { DivisionMetrics } from "@/lib/dashboard/getDashboardData";
import { calcKadav, type KadavResult } from "@/lib/metrics/pacing";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";

const COLS = "1.6fr 1fr 1fr 1fr 1fr";

function PacedRow({ label, result, isCurrency, bold }: { label: string; result: KadavResult; isCurrency?: boolean; bold?: boolean }) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  return (
    <div className="real-row" style={{ gridTemplateColumns: COLS, fontWeight: bold ? 700 : 400 }}>
      <span className="rname">{label}</span>
      <span>{result.target ? fmt(result.target) : "—"}</span>
      <span>{fmt(result.actual)}</span>
      <span>{result.pct !== null ? fmt(result.kadav) : "—"}</span>
      <span
        className={result.status ? `chip ${result.status}` : undefined}
        style={{ width: "fit-content", justifySelf: "start" }}
      >
        {result.pct !== null ? `${Math.round(result.pct!)}%` : "—"}
      </span>
    </div>
  );
}

// Ratios (conversion %, avg deal value) aren't paced/projected -- they're
// compared directly, target vs actual, with no קד"ב column.
function RatioRow({ label, target, actual, isCurrency }: { label: string; target: number; actual: number; isCurrency?: boolean }) {
  const fmt = isCurrency ? formatCurrency : (n: number) => `${n.toFixed(1)}%`;
  return (
    <div className="real-row" style={{ gridTemplateColumns: COLS }}>
      <span className="rname">{label}</span>
      <span>{target ? fmt(target) : "—"}</span>
      <span>{fmt(actual)}</span>
      <span>—</span>
      <span>—</span>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="real-row" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
      <span className="section-label" style={{ margin: 0 }}>
        {label}
      </span>
    </div>
  );
}

function PlainRow({ label, value, isCurrency }: { label: string; value: number; isCurrency?: boolean }) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  return (
    <div className="real-row" style={{ gridTemplateColumns: COLS }}>
      <span className="rname" style={{ color: "var(--muted)", fontSize: 12.5 }}>
        {label}
      </span>
      <span>—</span>
      <span>{fmt(value)}</span>
      <span>—</span>
      <span>—</span>
    </div>
  );
}

// ירוקים (referrals) actual comes from a company-wide report with no
// division column -- can't be attributed to this division, so show the
// target only and point to the overview for the real number.
function UnsplitRow({ label, target, isCurrency }: { label: string; target: number; isCurrency?: boolean }) {
  const fmt = isCurrency ? formatCurrency : formatNumber;
  return (
    <div className="real-row" style={{ gridTemplateColumns: COLS }}>
      <span className="rname">{label}</span>
      <span>{target ? fmt(target) : "—"}</span>
      <span style={{ gridColumn: "span 3", color: "var(--muted)", fontSize: 12.5 }}>
        לא מחולק לפי חטיבה — ר&apos; מבט כללי
      </span>
    </div>
  );
}

export function DivisionDetailTable({
  metrics,
  targets,
  rapidActuals,
  spaUpgradesActual,
  daysElapsed,
  daysInMonth,
  workDaysElapsed,
  workDaysInMonth,
}: {
  metrics: DivisionMetrics;
  targets: Record<string, number>;
  rapidActuals: Record<string, number>;
  spaUpgradesActual: number;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
}) {
  const t = (key: string) => targets[key] ?? 0;
  const calendar = (actual: number, target: number) => calcKadav(actual, target || undefined, daysElapsed, daysInMonth);
  const workday = (actual: number, target: number) => calcKadav(actual, target || undefined, workDaysElapsed, workDaysInMonth);

  const budgetActual = rapidActuals.budget_funded ?? 0;
  const costPerLeadActual = metrics.leads_funded > 0 ? budgetActual / metrics.leads_funded : 0;

  const leadsFO = metrics.leads_funded + metrics.leads_organic;
  const leadsFOTarget = t("leads_funded") + t("leads_organic");

  const convLeadArrivalFO = leadsFO > 0 ? (metrics.arrivals_funded_organic / leadsFO) * 100 : 0;
  const convArrivalClosingFO =
    metrics.arrivals_funded_organic > 0 ? (metrics.closings_funded_organic / metrics.arrivals_funded_organic) * 100 : 0;
  const avgDealFO = metrics.closings_funded_organic > 0 ? metrics.revenue_funded_organic / metrics.closings_funded_organic : 0;

  const convLeadArrivalMail = metrics.leads_mailing > 0 ? (metrics.arrivals_mailing / metrics.leads_mailing) * 100 : 0;
  const convArrivalClosingMail =
    metrics.arrivals_mailing > 0 ? (metrics.closings_mailing / metrics.arrivals_mailing) * 100 : 0;
  const avgDealMail = metrics.closings_mailing > 0 ? metrics.revenue_mailing / metrics.closings_mailing : 0;

  // ספה ושדרוגים actual is passed in already computed (Rapid's category total
  // for this division minus Zoho's revenue_funded_organic/mailing -- see
  // getDashboardData.ts for why the raw category total on its own double-counts
  // real money that Zoho already recorded for the same underlying payments).
  const spaActual = spaUpgradesActual;

  // Referrals excluded from this division's total -- see UnsplitRow below.
  const totalMoneyActual = metrics.revenue_funded_organic + metrics.revenue_mailing + spaActual;
  const totalMoneyTarget = t("revenue_funded_organic") + t("revenue_mailing") + t("revenue_spa_upgrades");

  return (
    <div className="real-table">
      <div className="real-row head" style={{ gridTemplateColumns: COLS }}>
        <span>מדד</span>
        <span>יעד</span>
        <span>בפועל</span>
        <span>קד&quot;ב</span>
        <span>אחוז קד&quot;ב</span>
      </div>

      <PacedRow label="תקציב ממומן" result={calendar(budgetActual, t("budget_funded"))} isCurrency />
      <RatioRow label="עלות ליד ממומן" target={t("cost_per_lead_funded")} actual={costPerLeadActual} isCurrency />

      <SectionHeader label="ממומן + אורגני" />
      <PacedRow label="לידים ממומן+אורגני" result={calendar(leadsFO, leadsFOTarget)} bold />
      <PacedRow label="לידים ממומן" result={calendar(metrics.leads_funded, t("leads_funded"))} />
      <PacedRow label="לידים אורגני" result={calendar(metrics.leads_organic, t("leads_organic"))} />
      <PlainRow label="לידים לא תקינים (ממומן)" value={metrics.invalid_leads_funded} />
      <PacedRow
        label="הגעות ממומן+אורגני"
        result={workday(metrics.arrivals_funded_organic, t("arrivals_funded_organic"))}
        bold
      />
      <PlainRow label="↳ מתוך זה ממומן" value={metrics.arrivals_funded} />
      <PlainRow label="↳ מתוך זה אורגני" value={metrics.arrivals_organic} />
      <RatioRow
        label="% המרה ליד→הגעה (ממומן+אורגני)"
        target={t("conversion_lead_arrival_funded_organic")}
        actual={convLeadArrivalFO}
      />
      <PacedRow label="סגירות ממומן+אורגני" result={workday(metrics.closings_funded_organic, t("closings_funded_organic"))} />
      <PlainRow label="↳ מתוך זה ממומן" value={metrics.closings_funded} />
      <PlainRow label="↳ מתוך זה אורגני" value={metrics.closings_organic} />
      <RatioRow
        label="% סגירה (ממומן+אורגני)"
        target={t("conversion_arrival_closing_funded_organic")}
        actual={convArrivalClosingFO}
      />
      <PacedRow
        label="כסף ממומן+אורגני"
        result={workday(metrics.revenue_funded_organic, t("revenue_funded_organic"))}
        isCurrency
      />
      <PlainRow label="↳ מתוך זה ממומן" value={metrics.revenue_funded} isCurrency />
      <PlainRow label="↳ מתוך זה אורגני" value={metrics.revenue_organic} isCurrency />
      <RatioRow label="שווי עסקה ממוצע (ממומן+אורגני)" target={t("avg_deal_value_funded_organic")} actual={avgDealFO} isCurrency />

      <SectionHeader label="דיוור" />
      <PacedRow label="לידים דיוור" result={calendar(metrics.leads_mailing, t("leads_mailing"))} bold />
      <PacedRow label="הגעות דיוור" result={workday(metrics.arrivals_mailing, t("arrivals_mailing"))} />
      <RatioRow label="% המרה ליד→הגעה (דיוור)" target={t("conversion_lead_arrival_mailing")} actual={convLeadArrivalMail} />
      <PacedRow label="סגירות דיוור" result={workday(metrics.closings_mailing, t("closings_mailing"))} />
      <RatioRow
        label="% סגירה (דיוור)"
        target={t("conversion_arrival_closing_mailing")}
        actual={convArrivalClosingMail}
      />
      <PacedRow label="כסף דיוור" result={workday(metrics.revenue_mailing, t("revenue_mailing"))} isCurrency />
      <RatioRow label="שווי עסקה ממוצע (דיוור)" target={t("avg_deal_value_mailing")} actual={avgDealMail} isCurrency />

      <SectionHeader label="הכנסות נוספות" />
      <PacedRow label="ספה ושדרוגים" result={workday(spaActual, t("revenue_spa_upgrades"))} isCurrency />
      <UnsplitRow label="ירוקים (הפניות)" target={t("revenue_referrals")} isCurrency />

      <div style={{ borderTop: "2px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
        <PacedRow label="סה״כ כסף ראפיד" result={workday(totalMoneyActual, totalMoneyTarget)} isCurrency bold />
      </div>
    </div>
  );
}
