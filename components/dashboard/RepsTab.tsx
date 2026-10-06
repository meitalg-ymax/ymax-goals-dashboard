"use client";

import { useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { BRANCHES, DIVISIONS, type Branch, type Division } from "@/lib/zoho/transform";
import type {
  BranchMetrics,
  RapidRepDivision,
  RapidRepDivisionRow,
  RepDivisionMetricRow,
} from "@/lib/dashboard/getDashboardData";

const BRANCH_LABELS: Record<Branch, string> = {
  ramat_gan: "רמת גן",
  rishon: "ראשון לציון",
  jerusalem: "ירושלים",
  haifa: "חיפה",
};

const DIVISION_LABELS: Record<RapidRepDivision, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
  products: "מוצרים",
  other: "אחר",
};

const DIVISION_COLORS: Record<RapidRepDivision, string> = {
  ymax: "var(--series-ymax)",
  body: "var(--series-body)",
  tech: "var(--series-tech)",
  mira_dry: "var(--series-mira_dry)",
  doctor: "var(--series-doctor)",
  products: "var(--muted)",
  other: "var(--border)",
};

type ZohoMetric = "closings" | "arrivals" | "revenue";

const METRIC_LABELS: Record<ZohoMetric, string> = {
  closings: "סגירות",
  arrivals: "הגעות",
  revenue: "הכנסות CRM",
};

const RAPID_COLUMNS: RapidRepDivision[] = [...DIVISIONS, "products", "other"];

function RepInitial({ rep }: { rep: string }) {
  return <span className="rep-avatar">{rep.trim().charAt(0)}</span>;
}

function DivisionHead({ division }: { division: RapidRepDivision }) {
  return (
    <span className="rep-matrix-divhead">
      <span className="branch-div-dot" style={{ background: DIVISION_COLORS[division] }} />
      {DIVISION_LABELS[division]}
    </span>
  );
}

export function RepsTab({
  repDivisionMetrics,
  rapidRepDivisionRevenue,
  branchMetrics,
}: {
  repDivisionMetrics: RepDivisionMetricRow[];
  rapidRepDivisionRevenue: RapidRepDivisionRow[];
  branchMetrics: Record<Branch, BranchMetrics>;
}) {
  const [branchFilter, setBranchFilter] = useState<Branch | "all">("all");
  const [metric, setMetric] = useState<ZohoMetric>("closings");

  // Only branches that actually have rep data this month (same idea as
  // BranchTab hiding an all-zero חיפה card).
  const activeBranches = BRANCHES.filter(
    (b) => repDivisionMetrics.some((r) => r.branch === b) || rapidRepDivisionRevenue.some((r) => r.branch === b)
  );
  const inFilter = (b: Branch) => branchFilter === "all" || b === branchFilter;

  // ---- Zoho: rep x division, summed over the selected branch(es) ----
  type ZohoRep = { rep: string; byDivision: Record<Division, Record<ZohoMetric, number>> };
  const emptyDivisions = () =>
    Object.fromEntries(DIVISIONS.map((d) => [d, { closings: 0, arrivals: 0, revenue: 0 }])) as ZohoRep["byDivision"];
  const zohoByRep = new Map<string, ZohoRep>();
  for (const row of repDivisionMetrics) {
    if (!inFilter(row.branch)) continue;
    if (row.metric !== "closings" && row.metric !== "arrivals" && row.metric !== "revenue") continue;
    let entry = zohoByRep.get(row.rep);
    if (!entry) {
      entry = { rep: row.rep, byDivision: emptyDivisions() };
      zohoByRep.set(row.rep, entry);
    }
    entry.byDivision[row.division][row.metric] += row.value;
  }
  const repTotal = (r: ZohoRep, m: ZohoMetric) => DIVISIONS.reduce((s, d) => s + r.byDivision[d][m], 0);
  const zohoRows = [...zohoByRep.values()].sort((a, b) => repTotal(b, metric) - repTotal(a, metric));
  const zohoDivisionTotals = Object.fromEntries(
    DIVISIONS.map((d) => [d, zohoRows.reduce((s, r) => s + r.byDivision[d][metric], 0)])
  ) as Record<Division, number>;
  const zohoGrandTotal = DIVISIONS.reduce((s, d) => s + zohoDivisionTotals[d], 0);
  const zohoGrandClosings = zohoRows.reduce((s, r) => s + repTotal(r, "closings"), 0);
  const zohoGrandArrivals = zohoRows.reduce((s, r) => s + repTotal(r, "arrivals"), 0);

  // Residual: branch-wide totals (any rep / any type) minus what's attributed
  // above -- leads with no rep set, or a type that doesn't map to a division.
  const branchTotal = BRANCHES.filter(inFilter).reduce((s, b) => s + branchMetrics[b][metric], 0);
  const unattributed = Math.max(0, branchTotal - zohoGrandTotal);

  const fmtZoho = (v: number) => (metric === "revenue" ? formatCurrency(v) : formatNumber(v));
  const showRate = metric === "closings";
  const zohoCols = `minmax(130px, 1.6fr) repeat(${DIVISIONS.length}, minmax(64px, 1fr)) minmax(76px, 1fr)${
    showRate ? " minmax(64px, 0.8fr)" : ""
  }`;

  // ---- Rapid: rep x division revenue, summed over the selected branch(es) ----
  const rapidByRep = new Map<string, Record<RapidRepDivision, number>>();
  for (const row of rapidRepDivisionRevenue) {
    if (!inFilter(row.branch)) continue;
    let entry = rapidByRep.get(row.rep);
    if (!entry) {
      entry = Object.fromEntries(RAPID_COLUMNS.map((d) => [d, 0])) as Record<RapidRepDivision, number>;
      rapidByRep.set(row.rep, entry);
    }
    entry[row.division] += row.amount;
  }
  const rapidRowTotal = (r: Record<RapidRepDivision, number>) => RAPID_COLUMNS.reduce((s, d) => s + r[d], 0);
  const rapidRows = [...rapidByRep]
    .map(([rep, byDivision]) => ({ rep, byDivision, total: rapidRowTotal(byDivision) }))
    .sort((a, b) => b.total - a.total);
  const rapidColumnTotals = Object.fromEntries(
    RAPID_COLUMNS.map((d) => [d, rapidRows.reduce((s, r) => s + r.byDivision[d], 0)])
  ) as Record<RapidRepDivision, number>;
  // "אחר" only shows up if the report ever has a category outside the map.
  const rapidColumns = RAPID_COLUMNS.filter((d) => d !== "other" || rapidColumnTotals.other !== 0);
  const rapidGrandTotal = rapidRows.reduce((s, r) => s + r.total, 0);
  const rapidCols = `minmax(130px, 1.6fr) repeat(${rapidColumns.length}, minmax(76px, 1fr)) minmax(86px, 1fr)`;

  const filterLabel = branchFilter === "all" ? "כל הסניפים" : BRANCH_LABELS[branchFilter];

  return (
    <div className="tabpanel">
      <div className="scope-note">
        <span className="scope-note-icon">ⓘ</span>
        <p>
          פירוט לפי <strong>יועצת × חטיבה</strong>. בזוהו החטיבה נקבעת לפי שדה <strong>TYPE</strong> והיועצת לפי שדה
          היועצת בליד; ברפיד החטיבה נקבעת לפי <strong>קטגוריית המכירה</strong> והיועצת לפי עמודת &quot;צוות מכירות&quot;.
          שמות היועצות בשתי המערכות לא תמיד זהים (שם פרטי מול שם מלא), ולכן שתי הטבלאות מוצגות בנפרד. הסכום ברפיד
          בד״כ גבוה יותר כי הוא כולל גם ספה, מוצרים ושדרוגים שלא עוברים דרך ליד בזוהו.
        </p>
      </div>

      <div className="reps-filters">
        <div className="range-toggle" role="tablist" aria-label="סינון לפי סניף">
          <button
            type="button"
            className={branchFilter === "all" ? "active" : undefined}
            onClick={() => setBranchFilter("all")}
          >
            כל הסניפים
          </button>
          {activeBranches.map((b) => (
            <button
              key={b}
              type="button"
              className={branchFilter === b ? "active" : undefined}
              onClick={() => setBranchFilter(b)}
            >
              {BRANCH_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      <section className="real-card">
        <div className="real-head reps-head">
          <div className="real-title">
            <h2>יועצות לפי חטיבה — זוהו</h2>
            <span className="real-badge">{filterLabel}</span>
          </div>
          <div className="range-toggle" role="tablist" aria-label="מדד">
            {(Object.keys(METRIC_LABELS) as ZohoMetric[]).map((m) => (
              <button
                key={m}
                type="button"
                className={metric === m ? "active" : undefined}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {zohoRows.length === 0 ? (
          <p className="real-note">אין עדיין נתוני יועצות מזוהו לחודש הזה — יופיעו אחרי הסנכרון הבא.</p>
        ) : (
          <div className="rep-matrix-scroll">
            <div className="rep-matrix" style={{ ["--rep-cols" as string]: zohoCols }}>
              <div className="rep-matrix-row rep-matrix-header">
                <span>יועצת</span>
                {DIVISIONS.map((d) => (
                  <DivisionHead key={d} division={d} />
                ))}
                <span>סה״כ {METRIC_LABELS[metric]}</span>
                {showRate && <span>אחוז סגירה</span>}
              </div>
              {zohoRows.map((r) => {
                const total = repTotal(r, metric);
                const arrivals = repTotal(r, "arrivals");
                return (
                  <div className="rep-matrix-row" key={r.rep}>
                    <span className="branch-rep-name">
                      <RepInitial rep={r.rep} />
                      {r.rep}
                    </span>
                    {DIVISIONS.map((d) => {
                      const v = r.byDivision[d][metric];
                      return (
                        <span key={d} className={v === 0 ? "rep-matrix-zero" : undefined}>
                          {v === 0 ? "—" : fmtZoho(v)}
                        </span>
                      );
                    })}
                    <span className="rep-matrix-total">{fmtZoho(total)}</span>
                    {showRate && (
                      <span className="rep-rate">{arrivals > 0 ? `${Math.round((total / arrivals) * 100)}%` : "—"}</span>
                    )}
                  </div>
                );
              })}
              <div className="rep-matrix-row rep-matrix-footer">
                <span>סה״כ</span>
                {DIVISIONS.map((d) => (
                  <span key={d}>{fmtZoho(zohoDivisionTotals[d])}</span>
                ))}
                <span>{fmtZoho(zohoGrandTotal)}</span>
                {showRate && (
                  <span>
                    {zohoGrandArrivals > 0 ? `${Math.round((zohoGrandClosings / zohoGrandArrivals) * 100)}%` : "—"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {unattributed > 0 && (
          <div className="unassigned-row">
            + {fmtZoho(unattributed)} {METRIC_LABELS[metric]} ללא יועצת משויכת או ללא TYPE
          </div>
        )}
      </section>

      <section className="real-card">
        <div className="real-head reps-head">
          <div className="real-title">
            <h2>יועצות לפי חטיבה — כסף ראפיד</h2>
            <span className="real-badge">{filterLabel}</span>
          </div>
        </div>

        {rapidRows.length === 0 ? (
          <p className="real-note">
            אין עדיין פירוט ראפיד לפי יועצת וחטיבה לחודש הזה — יופיע אחרי הייבוא הבא של דוח SalesReport.
          </p>
        ) : (
          <div className="rep-matrix-scroll">
            <div className="rep-matrix" style={{ ["--rep-cols" as string]: rapidCols }}>
              <div className="rep-matrix-row rep-matrix-header">
                <span>יועצת (רפיד)</span>
                {rapidColumns.map((d) => (
                  <DivisionHead key={d} division={d} />
                ))}
                <span>סה״כ</span>
              </div>
              {rapidRows.map((r) => (
                <div className="rep-matrix-row" key={r.rep}>
                  <span className="branch-rep-name">
                    <RepInitial rep={r.rep} />
                    {r.rep}
                  </span>
                  {rapidColumns.map((d) => {
                    const v = r.byDivision[d];
                    return (
                      <span key={d} className={v === 0 ? "rep-matrix-zero" : undefined}>
                        {v === 0 ? "—" : formatCurrency(v)}
                      </span>
                    );
                  })}
                  <span className="rep-matrix-total">{formatCurrency(r.total)}</span>
                </div>
              ))}
              <div className="rep-matrix-row rep-matrix-footer">
                <span>סה״כ</span>
                {rapidColumns.map((d) => (
                  <span key={d}>{formatCurrency(rapidColumnTotals[d])}</span>
                ))}
                <span>{formatCurrency(rapidGrandTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
