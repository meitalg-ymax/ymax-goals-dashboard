import { FunnelShape } from "@/components/dashboard/FunnelShape";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { BRANCHES, DIVISIONS, type Branch, type Division } from "@/lib/zoho/transform";
import type { BranchMetrics, BranchDivisionMetrics } from "@/lib/dashboard/getDashboardData";

const BRANCH_LABELS: Record<Branch, string> = {
  ramat_gan: "רמת גן",
  rishon: "ראשון לציון",
  jerusalem: "ירושלים",
  haifa: "חיפה",
};

const BRANCH_ADDRESS: Record<Branch, string> = {
  ramat_gan: "קניון איילון",
  rishon: "לישנסקי 1",
  jerusalem: "כנפי נשרים 35",
  haifa: "",
};

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

function BranchCard({
  branch,
  metrics,
  divisionBreakdown,
  rapidRevenue,
}: {
  branch: Branch;
  metrics: BranchMetrics;
  divisionBreakdown: Record<Division, BranchDivisionMetrics>;
  rapidRevenue: number;
}) {
  const avgDeal = metrics.closings > 0 ? metrics.revenue / metrics.closings : 0;
  const activeDivisions = DIVISIONS.filter(
    (d) => divisionBreakdown[d].arrivals > 0 || divisionBreakdown[d].closings > 0
  );

  return (
    <article className="branch-card">
      <header className="branch-head">
        <span className="branch-dot" style={{ background: "var(--gold)" }} />
        <h2>{BRANCH_LABELS[branch]}</h2>
        {BRANCH_ADDRESS[branch] && <span className="branch-badge">{BRANCH_ADDRESS[branch]}</span>}
      </header>

      <FunnelShape
        leads={metrics.meetings}
        arrivals={metrics.arrivals}
        closings={metrics.closings}
        firstLabel="פגישות מתואמות"
        firstPctCap="מהפגישות"
      />

      <div className="branch-money">
        <div className="money-cell">
          <span className="mc-label">הכנסות CRM</span>
          <span className="mc-val">{formatCurrency(metrics.revenue)}</span>
        </div>
        <div className="money-cell">
          <span className="mc-label">שווי עסקה ממוצע</span>
          <span className="mc-val">{avgDeal > 0 ? formatCurrency(avgDeal) : "—"}</span>
        </div>
        <div className="money-cell">
          <span className="mc-label">כסף ראפיד (הכל)</span>
          <span className="mc-val">{rapidRevenue > 0 ? formatCurrency(rapidRevenue) : "—"}</span>
        </div>
      </div>

      {activeDivisions.length > 0 && (
        <div className="branch-div-table">
          <div className="branch-div-header">
            <span>חטיבה</span>
            <span>הגעות</span>
            <span>סגירות</span>
            <span>הכנסות</span>
          </div>
          {activeDivisions.map((d) => (
            <div className="branch-div-row" key={d}>
              <span className="branch-div-name">
                <span className="branch-div-dot" style={{ background: DIVISION_COLORS[d] }} />
                {DIVISION_LABELS[d]}
              </span>
              <span>{formatNumber(divisionBreakdown[d].arrivals)}</span>
              <span>{formatNumber(divisionBreakdown[d].closings)}</span>
              <span>{formatCurrency(divisionBreakdown[d].revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function BranchTab({
  branchMetrics,
  branchDivisionMetrics,
  rapidRevenueByBranch,
}: {
  branchMetrics: Record<Branch, BranchMetrics>;
  branchDivisionMetrics: Record<Branch, Record<Division, BranchDivisionMetrics>>;
  rapidRevenueByBranch: Record<Branch, number>;
}) {
  // Only branches with real activity this month -- so a branch that never
  // shows up in the field (e.g. חיפה, present in Zoho's picklist but unused
  // so far) doesn't render an all-zero card, and appears automatically the
  // moment it does get used.
  const activeBranches = BRANCHES.filter((b) => branchMetrics[b].meetings > 0);

  const totals = activeBranches.reduce(
    (acc, b) => ({
      meetings: acc.meetings + branchMetrics[b].meetings,
      arrivals: acc.arrivals + branchMetrics[b].arrivals,
      closings: acc.closings + branchMetrics[b].closings,
      revenue: acc.revenue + branchMetrics[b].revenue,
      rapidRevenue: acc.rapidRevenue + rapidRevenueByBranch[b],
    }),
    { meetings: 0, arrivals: 0, closings: 0, revenue: 0, rapidRevenue: 0 }
  );
  const arrivalsPct = totals.meetings > 0 ? `${((totals.arrivals / totals.meetings) * 100).toFixed(1)}% מהפגישות` : null;
  const closingsPct = totals.arrivals > 0 ? `${((totals.closings / totals.arrivals) * 100).toFixed(1)}% מהמגיעות` : null;

  if (activeBranches.length === 0) {
    return (
      <div className="tabpanel">
        <div className="missing-card">
          <div className="mc-text">
            <span className="mc-title">חסר נתון — אין עדיין פגישות מתויגות לסניף החודש</span>
            <span className="mc-sub">שדה הסניף מתמלא רק כשנקבעת פגישה — ברגע שיש כאלה, הכרטיסים יופיעו כאן.</span>
          </div>
          <span className="missing-badge">⏳ חסר נתון</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tabpanel">
      <div className="scope-note">
        <span className="scope-note-icon">ⓘ</span>
        <p>
          שדה הסניף מתמלא רק כשנקבעת פגישה — לכן המשפך כאן מתחיל ב<strong>פגישות מתואמות</strong>, לא בכלל הלידים.
          חלק גדול מהלידים לעולם לא מגיע לשלב הזה, ולכן אין להם סניף בכלל. <strong>לידים לא תקינים</strong> ונתוני{" "}
          <strong>ספה ושדרוגים / ירוקים / תקציב</strong> אינם מחולקים לפי סניף כרגע. <strong>כסף ראפיד</strong> כן
          מחולק לפי סניף (מדוח SalesReport), אך זה הסה״כ הכללי של הסניף — לא מפוצל לפי חטיבה.
        </p>
      </div>

      <section className="totals-strip">
        <p className="section-label">סה״כ כל הסניפים</p>
        <div className="totals-grid">
          <div className="total-tile">
            <span className="tt-label">פגישות מתואמות</span>
            <span className="tt-value">{formatNumber(totals.meetings)}</span>
          </div>
          <div className="total-tile">
            <span className="tt-label">הגעות</span>
            <span className="tt-value">{formatNumber(totals.arrivals)}</span>
            {arrivalsPct && <span className="tt-sub">{arrivalsPct}</span>}
          </div>
          <div className="total-tile">
            <span className="tt-label">סגירות</span>
            <span className="tt-value">{formatNumber(totals.closings)}</span>
            {closingsPct && <span className="tt-sub">{closingsPct}</span>}
          </div>
          <div className="total-tile total-tile-money">
            <span className="tt-label">הכנסות CRM</span>
            <span className="tt-value">{formatCurrency(totals.revenue)}</span>
          </div>
          <div className="total-tile total-tile-money">
            <span className="tt-label">כסף ראפיד (הכל)</span>
            <span className="tt-value">{formatCurrency(totals.rapidRevenue)}</span>
          </div>
        </div>
      </section>

      <section className="branch-grid">
        {activeBranches.map((branch) => (
          <BranchCard
            key={branch}
            branch={branch}
            metrics={branchMetrics[branch]}
            divisionBreakdown={branchDivisionMetrics[branch]}
            rapidRevenue={rapidRevenueByBranch[branch]}
          />
        ))}
      </section>
    </div>
  );
}
