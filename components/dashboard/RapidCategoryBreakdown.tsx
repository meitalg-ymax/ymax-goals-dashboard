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

export function RapidCategoryBreakdown({ categories }: { categories: RapidCategory[] }) {
  if (categories.length === 0) {
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

  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  // Group the raw report categories by division -- several categories can
  // belong to the same division (e.g. "YMAX PRO הסרת שיער" + "YMAX הסרת שיער
  // פנים" are both ymax) and should show as one combined line, not one row
  // per raw category. Unassigned (division=null) categories are different
  // revenue streams that happen to share "no division" (general products,
  // referrals) -- they stay as separate rows rather than merging into one
  // generic "products" bucket.
  const divisionGroups = DIVISIONS.map((division) => {
    const rows = categories.filter((c) => c.division === division);
    const amount = rows.reduce((sum, c) => sum + c.amount, 0);
    return { key: division as string, label: DIVISION_LABELS[division], rows, amount };
  }).filter((g) => g.rows.length > 0);

  const unassignedGroups = categories
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
        מקור: דוח מכירות מראפיד (POS) לחטיבות, מקובץ לפי חטיבה. &quot;מוצרים יפה&quot; ו&quot;ירוקים (הפניות)&quot;
        הן קטגוריות כלל-חברתיות שלא ניתן לשייך לחטיבה ספציפית (דוח ראפיד לא כולל עמודת חטיבה עבורן).
      </p>
    </div>
  );
}
