import { useState } from "react";
import { FunnelShape } from "@/components/dashboard/FunnelShape";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import { BRANCHES, CHANNELS, DIVISIONS, type Branch, type Channel, type Division } from "@/lib/zoho/transform";
import type {
  BranchMetrics,
  BranchDivisionMetrics,
  BranchRepMetrics,
  BranchChannelMetrics,
} from "@/lib/dashboard/getDashboardData";

// Source filter -- "funded_organic" is ממומן + אורגני together (everything
// that isn't a mailing), the same cohort the division reports call
// "ממומן+אורגני".
type ChannelFilter = "all" | "funded_organic" | Channel;

const CHANNEL_FILTERS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "כל המקורות" },
  { id: "funded_organic", label: "ממומן + אורגני" },
  { id: "paid", label: "ממומן" },
  { id: "organic", label: "אורגני" },
  { id: "mailing", label: "דיוורים" },
];

const CHANNEL_LABELS: Record<Channel, string> = { paid: "ממומן", organic: "אורגני", mailing: "דיוורים" };

const sumBranchMetrics = (a: BranchMetrics, b: BranchMetrics): BranchMetrics => ({
  meetings: a.meetings + b.meetings,
  coordinations: a.coordinations + b.coordinations,
  arrivals: a.arrivals + b.arrivals,
  closings: a.closings + b.closings,
  revenue: a.revenue + b.revenue,
});

const sumDivisionMetrics = (a: BranchDivisionMetrics, b: BranchDivisionMetrics): BranchDivisionMetrics => ({
  coordinations: a.coordinations + b.coordinations,
  arrivals: a.arrivals + b.arrivals,
  closings: a.closings + b.closings,
  revenue: a.revenue + b.revenue,
});

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

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

function RepInitial({ rep }: { rep: string }) {
  return <span className="rep-avatar">{rep.trim().charAt(0)}</span>;
}

function BranchCard({
  branch,
  metrics,
  divisionBreakdown,
  repBreakdown,
  rapidRevenue,
  rapidRepBreakdown,
  filtered,
}: {
  branch: Branch;
  metrics: BranchMetrics;
  divisionBreakdown: Record<Division, BranchDivisionMetrics>;
  repBreakdown: Record<string, BranchRepMetrics>;
  rapidRevenue: number;
  rapidRepBreakdown: Record<string, number>;
  // A source filter is on -- reps and Rapid money aren't split by source, so
  // they're hidden rather than shown as all-sources numbers next to filtered
  // ones.
  filtered: boolean;
}) {
  const avgDeal = metrics.closings > 0 ? metrics.revenue / metrics.closings : 0;
  const activeDivisions = DIVISIONS.filter(
    (d) => divisionBreakdown[d].coordinations > 0 || divisionBreakdown[d].arrivals > 0 || divisionBreakdown[d].closings > 0
  );

  // Sorted by arrivals (busiest rep first) -- reps are an open picklist, not
  // a fixed list, so this is computed here rather than iterated from a
  // constant like DIVISIONS/BRANCHES.
  const repRows = Object.entries(repBreakdown)
    .map(([rep, m]) => ({ rep, ...m }))
    .sort((a, b) => b.arrivals - a.arrivals);
  const repArrivalsSum = repRows.reduce((s, r) => s + r.arrivals, 0);
  const repClosingsSum = repRows.reduce((s, r) => s + r.closings, 0);
  const unassignedArrivals = Math.max(0, metrics.arrivals - repArrivalsSum);
  const unassignedClosings = Math.max(0, metrics.closings - repClosingsSum);

  // Rapid's "צוות מכירות" column is a different open-text field than Zoho's
  // rep picklist (full name vs. first name, different spellings) -- shown as
  // its own list rather than merged/matched into repRows above, so the two
  // sources can be compared side by side without guessing at name matches.
  const rapidRepRows = Object.entries(rapidRepBreakdown)
    .map(([rep, amount]) => ({ rep, amount }))
    .sort((a, b) => b.amount - a.amount);

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
          <span className="mc-label">תיאומים</span>
          <span className="mc-val">{formatNumber(metrics.coordinations)}</span>
        </div>
        <div className="money-cell">
          <span className="mc-label">הכנסות CRM</span>
          <span className="mc-val">{formatCurrency(metrics.revenue)}</span>
        </div>
        <div className="money-cell">
          <span className="mc-label">שווי עסקה ממוצע</span>
          <span className="mc-val">{avgDeal > 0 ? formatCurrency(avgDeal) : "—"}</span>
        </div>
        {!filtered && (
          <div className="money-cell">
            <span className="mc-label">כסף ראפיד (הכל)</span>
            <span className="mc-val">{rapidRevenue > 0 ? formatCurrency(rapidRevenue) : "—"}</span>
          </div>
        )}
      </div>

      {activeDivisions.length > 0 && (
        <div className="branch-div-table">
          <div className="branch-div-header">
            <span>חטיבה</span>
            <span>תיאומים</span>
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
              <span>{formatNumber(divisionBreakdown[d].coordinations)}</span>
              <span>{formatNumber(divisionBreakdown[d].arrivals)}</span>
              <span>{formatNumber(divisionBreakdown[d].closings)}</span>
              <span>{formatCurrency(divisionBreakdown[d].revenue)}</span>
            </div>
          ))}
        </div>
      )}

      {!filtered && repRows.length > 0 && (
        <div className="branch-rep-table">
          <div className="branch-rep-header">
            <span>נציגה</span>
            <span>פגישות</span>
            <span>סגירות</span>
            <span>אחוז סגירה</span>
          </div>
          {repRows.map((r) => (
            <div className="branch-rep-row" key={r.rep}>
              <span className="branch-rep-name">
                <RepInitial rep={r.rep} />
                {r.rep}
              </span>
              <span>{formatNumber(r.arrivals)}</span>
              <span>{formatNumber(r.closings)}</span>
              <span className="rep-rate">{r.arrivals > 0 ? `${Math.round((r.closings / r.arrivals) * 100)}%` : "—"}</span>
            </div>
          ))}
          {(unassignedArrivals > 0 || unassignedClosings > 0) && (
            <div className="unassigned-row">
              + {formatNumber(unassignedArrivals)} פגישות / {formatNumber(unassignedClosings)} סגירות ללא נציגה משויכת
            </div>
          )}
        </div>
      )}

      {!filtered && rapidRepRows.length > 0 && (
        <div className="branch-rep-table branch-rep-table-rapid">
          <div className="branch-rep-header">
            <span>יועצת (רפיד)</span>
            <span>כסף ראפיד</span>
          </div>
          {rapidRepRows.map((r) => (
            <div className="branch-rep-row" key={r.rep}>
              <span className="branch-rep-name">
                <RepInitial rep={r.rep} />
                {r.rep}
              </span>
              <span>{formatCurrency(r.amount)}</span>
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
  branchChannelMetrics,
  branchRepMetrics,
  rapidRevenueByBranch,
  rapidRepRevenueByBranch,
}: {
  branchMetrics: Record<Branch, BranchMetrics>;
  branchDivisionMetrics: Record<Branch, Record<Division, BranchDivisionMetrics>>;
  branchChannelMetrics: Record<Channel, BranchChannelMetrics> | null;
  branchRepMetrics: Record<Branch, Record<string, BranchRepMetrics>>;
  rapidRevenueByBranch: Record<Branch, number>;
  rapidRepRevenueByBranch: Record<Branch, Record<string, number>>;
}) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const channelLabel = CHANNEL_FILTERS.find((f) => f.id === channelFilter)?.label;

  // Numbers for the selected source: "all" is the existing unsplit data;
  // "funded_organic" sums the paid and organic channels.
  const channelsInFilter: Channel[] =
    channelFilter === "funded_organic" ? ["paid", "organic"] : channelFilter === "all" ? [] : [channelFilter];
  const filtered = branchChannelMetrics !== null && channelsInFilter.length > 0;
  const metricsFor = (b: Branch): BranchMetrics =>
    filtered
      ? channelsInFilter.map((c) => branchChannelMetrics[c].branch[b]).reduce(sumBranchMetrics)
      : branchMetrics[b];
  const divisionsFor = (b: Branch): Record<Division, BranchDivisionMetrics> =>
    filtered
      ? (Object.fromEntries(
          DIVISIONS.map((d) => [
            d,
            channelsInFilter.map((c) => branchChannelMetrics[c].division[b][d]).reduce(sumDivisionMetrics),
          ])
        ) as Record<Division, BranchDivisionMetrics>)
      : branchDivisionMetrics[b];

  // Only branches with real activity this month -- so a branch that never
  // shows up in the field (e.g. חיפה, present in Zoho's picklist but unused
  // so far) doesn't render an all-zero card, and appears automatically the
  // moment it does get used.
  const activeBranches = BRANCHES.filter((b) => branchMetrics[b].meetings > 0);

  const totals = activeBranches.reduce(
    (acc, b) => ({
      meetings: acc.meetings + metricsFor(b).meetings,
      coordinations: acc.coordinations + metricsFor(b).coordinations,
      arrivals: acc.arrivals + metricsFor(b).arrivals,
      closings: acc.closings + metricsFor(b).closings,
      revenue: acc.revenue + metricsFor(b).revenue,
      rapidRevenue: acc.rapidRevenue + rapidRevenueByBranch[b],
    }),
    { meetings: 0, coordinations: 0, arrivals: 0, closings: 0, revenue: 0, rapidRevenue: 0 }
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
          חלק גדול מהלידים לעולם לא מגיע לשלב הזה, ולכן אין להם סניף בכלל. שימו לב:{" "}
          <strong>פגישות מתואמות</strong> ו<strong>תיאומים</strong> הם שני מדדים שונים למרות השמות הדומים —{" "}
          <strong>פגישות מתואמות</strong> סופר לפי מתי הליד נוצר, ו<strong>תיאומים</strong> סופר לפי תאריך התיאום עצמו
          (אותה הגדרה כמו בכל שאר הדוחות). <strong>לידים לא תקינים</strong> ונתוני{" "}
          <strong>ספה ושדרוגים / ירוקים / תקציב</strong> אינם מחולקים לפי סניף כרגע. <strong>כסף ראפיד</strong> כן
          מחולק לפי סניף (מדוח SalesReport), אך זה הסה״כ הכללי של הסניף — לא מפוצל לפי חטיבה. פירוט{" "}
          <strong>לפי נציגה</strong> מבוסס על הגעות בפועל (לא על פגישות מתואמות), כי לרוב עדיין אין נציגה משויכת לליד
          בשלב היצירה — שורה בסוף הטבלה מציגה כמה הגעות/סגירות עדיין ללא נציגה משויכת. מתחת לזה מופיע גם פירוט{" "}
          <strong>כסף ראפיד לפי יועצת</strong> (מעמודת &quot;צוות מכירות&quot; בדוח SalesReport) — שם היועצת בזוהו
          ובראפיד מגיע משני שדות טקסט חופשי שונים (שם פרטי מול שם מלא, לפעמים איות שונה), אז הרשימות מוצגות זו לצד זו
          בלי ניסיון להתאים ביניהן אוטומטית, ובד״כ הסכום ברפיד גבוה יותר כי הוא כולל גם ספה/מוצרים/שדרוגים שלא עוברים
          דרך ליד בזוהו.
        </p>
      </div>

      <div className="reps-filters">
        <div className="range-toggle" role="tablist" aria-label="סינון לפי מקור">
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={channelFilter === f.id ? "active" : undefined}
              disabled={f.id !== "all" && branchChannelMetrics === null}
              onClick={() => setChannelFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {branchChannelMetrics === null && (
        <p className="channel-note">הפילוח לפי מקור יופיע אחרי הסנכרון הבא מזוהו (כפתור &quot;רענון&quot;).</p>
      )}
      {filtered && (
        <p className="channel-note">
          מסונן לפי מקור הליד ({channelLabel}). פירוט הנציגות וכסף ראפיד מוסתרים, כי הם לא מפוצלים לפי מקור.
        </p>
      )}

      {branchChannelMetrics !== null && (
        <section className="channel-split">
          <p className="section-label">הגעות לפי מקור — השוואת סניפים</p>
          <div className="channel-split-table">
            <div className="channel-split-header">
              <span>סניף</span>
              {CHANNELS.map((c) => (
                <span key={c}>{CHANNEL_LABELS[c]}</span>
              ))}
              <span>סה״כ</span>
            </div>
            {activeBranches.map((b) => {
              const total = branchMetrics[b].arrivals;
              return (
                <div className="channel-split-row" key={b}>
                  <span className="channel-split-name">{BRANCH_LABELS[b]}</span>
                  {CHANNELS.map((c) => {
                    const n = branchChannelMetrics[c].branch[b].arrivals;
                    return (
                      <span key={c}>
                        {formatNumber(n)} <small>{pct(n, total)}</small>
                      </span>
                    );
                  })}
                  <span>{formatNumber(total)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="totals-strip">
        <p className="section-label">
          סה״כ כל הסניפים{filtered && ` · ${channelLabel}`}
        </p>
        <div className="totals-grid">
          <div className="total-tile">
            <span className="tt-label">פגישות מתואמות</span>
            <span className="tt-value">{formatNumber(totals.meetings)}</span>
          </div>
          <div className="total-tile">
            <span className="tt-label">תיאומים</span>
            <span className="tt-value">{formatNumber(totals.coordinations)}</span>
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
          {!filtered && (
            <div className="total-tile total-tile-money">
              <span className="tt-label">כסף ראפיד (הכל)</span>
              <span className="tt-value">{formatCurrency(totals.rapidRevenue)}</span>
            </div>
          )}
        </div>
      </section>

      <section className="branch-grid">
        {activeBranches.map((branch) => (
          <BranchCard
            key={branch}
            branch={branch}
            metrics={metricsFor(branch)}
            divisionBreakdown={divisionsFor(branch)}
            repBreakdown={branchRepMetrics[branch]}
            rapidRevenue={rapidRevenueByBranch[branch]}
            rapidRepBreakdown={rapidRepRevenueByBranch[branch]}
            filtered={filtered}
          />
        ))}
      </section>
    </div>
  );
}
