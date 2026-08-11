import type { Division } from "@/lib/zoho/transform";
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
          <span className="mc-sub">מייבאים דוח מכירות מראפיד כדי לראות פירוט לפי קטגוריה.</span>
        </div>
        <span className="missing-badge">⏳ חסר נתון</span>
      </div>
    );
  }

  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <p className="section-label" style={{ marginBottom: 8 }}>
        כסף ראפיד לפי קטגוריה
      </p>
      <div className="real-table">
        <div className="real-row head" style={{ gridTemplateColumns: "1fr 100px 100px" }}>
          <span>קטגוריה</span>
          <span>חטיבה</span>
          <span>סה״כ</span>
        </div>
        {categories.map((c) => (
          <div className="real-row" key={c.category} style={{ gridTemplateColumns: "1fr 100px 100px" }}>
            <span className="rname">{c.category}</span>
            <span>{c.division ? DIVISION_LABELS[c.division] : "—"}</span>
            <span>{formatCurrency(c.amount)}</span>
          </div>
        ))}
        <div className="real-row" style={{ gridTemplateColumns: "1fr 100px 100px", fontWeight: 700 }}>
          <span className="rname">סה״כ</span>
          <span></span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      <p className="note-text">
        מקור: דוח מכירות מראפיד (POS). קטגוריות &quot;מוצרים יפה מקסימוב&quot; ו&quot;מוצרים ותכשירים&quot; מאוחדות
        ל&quot;מוצרים יפה&quot; ולא משויכות לחטיבה — הן מכירות מוצרים כלליות בסניף.
      </p>
    </div>
  );
}
