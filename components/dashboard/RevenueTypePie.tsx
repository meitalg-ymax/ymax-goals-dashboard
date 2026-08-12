import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { DivisionMetrics, RapidCategory } from "@/lib/dashboard/getDashboardData";
import { formatCurrency } from "@/lib/metrics/format";

const REFERRALS_CATEGORY = "ירוקים (הפניות)";

// Fixed categorical order + colors, validated for CVD separation
// (scripts/validate_palette.js "#5e4a8a,#c9548c,#c9a55c,#3f8f5f,#3468a8" --mode light -> all pass).
// Never reuse status colors (good/warn/critical) here -- this is identity, not state.
const SLICES = [
  { key: "fo", label: "ממומן + אורגני", color: "#5e4a8a" },
  { key: "mailing", label: "דיוור", color: "#c9548c" },
  { key: "spa", label: "ספה ושדרוגים", color: "#c9a55c" },
  { key: "referrals", label: "ירוקים (הפניות)", color: "#3f8f5f" },
  { key: "products", label: "מוצרים", color: "#3468a8" },
] as const;

export function RevenueTypePie({
  divisions,
  rapidCategories,
}: {
  divisions: Record<Division, DivisionMetrics>;
  rapidCategories: RapidCategory[];
}) {
  const fo = DIVISIONS.reduce((s, d) => s + divisions[d].revenue_funded_organic, 0);
  const foFunded = DIVISIONS.reduce((s, d) => s + divisions[d].revenue_funded, 0);
  const foOrganic = DIVISIONS.reduce((s, d) => s + divisions[d].revenue_organic, 0);
  const mailing = DIVISIONS.reduce((s, d) => s + divisions[d].revenue_mailing, 0);
  const spa = DIVISIONS.reduce(
    (s, d) => s + rapidCategories.filter((c) => c.division === d).reduce((a, c) => a + c.amount, 0),
    0
  );
  const referrals = rapidCategories
    .filter((c) => c.division === null && c.category === REFERRALS_CATEGORY)
    .reduce((s, c) => s + c.amount, 0);
  const products = rapidCategories
    .filter((c) => c.division === null && c.category !== REFERRALS_CATEGORY)
    .reduce((s, c) => s + c.amount, 0);

  const values: Record<(typeof SLICES)[number]["key"], number> = { fo, mailing, spa, referrals, products };
  const total = fo + mailing + spa + referrals + products;

  if (total <= 0) {
    return (
      <div className="missing-card">
        <div className="mc-text">
          <span className="mc-title">אין עדיין נתוני הכנסה החודש</span>
          <span className="mc-sub">הפילוח יופיע ברגע שיהיו נתוני CRM ו/או ראפיד לחודש הנוכחי.</span>
        </div>
        <span className="missing-badge">⏳ חסר נתון</span>
      </div>
    );
  }

  let acc = 0;
  const stops = SLICES.map((s) => {
    const value = values[s.key];
    const pct = (value / total) * 100;
    const from = acc;
    acc += pct;
    return `${s.color} ${from}% ${acc}%`;
  }).join(", ");

  return (
    <div className="pie-wrap">
      <div className="pie-donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="pie-hole">
          <span className="pie-hole-val">{formatCurrency(total)}</span>
          <span className="pie-hole-label">סה״כ הכנסה</span>
        </div>
      </div>
      <div className="pie-legend">
        {SLICES.map((s) => {
          const value = values[s.key];
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={s.key}>
              <div className="pie-legend-row">
                <span className="pie-dot" style={{ background: s.color }} />
                <span className="pie-legend-label">{s.label}</span>
                <span className="pie-legend-val">{formatCurrency(value)}</span>
                <span className="pie-legend-pct">{pct.toFixed(1)}%</span>
              </div>
              {s.key === "fo" && (
                <p className="note-text" style={{ margin: "2px 0 0 19px" }}>
                  מתוך זה: {formatCurrency(foFunded)} ממומן · {formatCurrency(foOrganic)} אורגני
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
