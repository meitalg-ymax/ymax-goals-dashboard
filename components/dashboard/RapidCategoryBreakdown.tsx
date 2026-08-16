import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { RapidCategory } from "@/lib/dashboard/getDashboardData";
import { formatCurrency } from "@/lib/metrics/format";

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

// ירוקים comes from a completely different report (Treatment Plans, the
// referrals coordinator's export) than everything else here (the Rapid POS
// SalesReport) -- folding it into this table's own סה"כ made that total not
// match the SalesReport Excel Meital checks it against (confirmed
// 2026-08-16: her Excel column-sum was ₪1,538,007, this table showed
// ₪1,653,167 -- exactly ₪115,160 higher, which is precisely the ירוקים
// figure). Kept out of this table/total entirely, shown as its own callout.
const REFERRALS_CATEGORY = "ירוקים (הפניות)";

export function RapidCategoryBreakdown({ categories }: { categories: RapidCategory[] }) {
  const posCategories = categories.filter((c) => c.category !== REFERRALS_CATEGORY);
  const referralsAmount = categories.find((c) => c.category === REFERRALS_CATEGORY)?.amount ?? 0;

  if (posCategories.length === 0) {
    return (
      <div className="missing-card">
        <div className="mc-text">
          <span className="mc-title">אין נתוני ראפיד לחודש הנוכחי</span>
          <span className="mc-sub">מייבאים דוח מכירות מראפיד כדי לראות פירוט לפי חטיבה.</span>
        </div>
        <span className="missing-badge">⏳ חסר נתון</span>
      </div>
    );
  }

  const total = posCategories.reduce((sum, c) => sum + c.amount, 0);

  // Group the raw report categories by division -- several categories can
  // belong to the same division (e.g. "YMAX PRO הסרת שיער" + "YMAX הסרת שיער
  // פנים" are both ymax) and should show as one combined line, not one row
  // per raw category. "מוצרים יפה" (division=null) is a general product-sales
  // category from the SAME SalesReport, so it stays here as its own row.
  const divisionGroups = DIVISIONS.map((division) => {
    const rows = posCategories.filter((c) => c.division === division);
    const amount = rows.reduce((sum, c) => sum + c.amount, 0);
    return { key: division as string, label: DIVISION_LABELS[division], rows, amount };
  }).filter((g) => g.rows.length > 0);

  const unassignedGroups = posCategories
    .filter((c) => c.division === null)
    .map((c) => ({ key: c.category, label: c.category, rows: [c], amount: c.amount }));

  const groups = [...divisionGroups, ...unassignedGroups];

  return (
    <div>
      <p className="section-label" style={{ marginBottom: 8 }}>
        כסף ראפיד לפי חטיבה
      </p>
      <div className="real-table">
        <div className="real-row head" style={{ gridTemplateColumns: "1fr 100px" }}>
          <span>חטיבה</span>
          <span>סה״כ</span>
        </div>
        {groups.map((g) => (
          <div key={g.key} className="real-row" style={{ gridTemplateColumns: "1fr 100px", alignItems: "start" }}>
            <span>
              <span className="rname">{g.label}</span>
              {g.rows.length > 1 && (
                <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {g.rows.map((r) => r.category).join(" + ")}
                </span>
              )}
            </span>
            <span>{formatCurrency(g.amount)}</span>
          </div>
        ))}
        <div className="real-row" style={{ gridTemplateColumns: "1fr 100px", fontWeight: 700 }}>
          <span className="rname">סה״כ</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      <p className="note-text">
        מקור: דוח מכירות מראפיד (POS), מקובץ לפי חטיבה. &quot;מוצרים יפה&quot; היא קטגוריה כלל-חברתית שלא ניתן
        לשייך לחטיבה ספציפית (הדוח לא כולל עמודת חטיבה עבורה).
      </p>
      {referralsAmount > 0 && (
        <div className="real-row" style={{ gridTemplateColumns: "1fr 100px", marginTop: 10 }}>
          <span>
            <span className="rname">ירוקים (הפניות)</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              ממקור נפרד (דוח Treatment Plans) — לא חלק מדוח המכירות של ראפיד, ולכן לא ב-סה״כ שלמעלה
            </span>
          </span>
          <span>{formatCurrency(referralsAmount)}</span>
        </div>
      )}
    </div>
  );
}
