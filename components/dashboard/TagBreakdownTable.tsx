import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import type { MailingTagBreakdown } from "@/lib/dashboard/getDashboardData";

export function TagBreakdownTable({ rows }: { rows: MailingTagBreakdown[] }) {
  if (rows.length === 0) {
    return <p className="real-note">אין נתוני דיוור לפי תגית לחודש זה.</p>;
  }

  const totals = rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      coordinations: acc.coordinations + r.coordinations,
      arrivals: acc.arrivals + r.arrivals,
      closings: acc.closings + r.closings,
      revenue: acc.revenue + r.revenue,
    }),
    { leads: 0, coordinations: 0, arrivals: 0, closings: 0, revenue: 0 }
  );

  return (
    <div className="tag-breakdown-table">
      <div className="tag-breakdown-header">
        <span>תגית</span>
        <span>לידים</span>
        <span>תיאומים</span>
        <span>הגעות</span>
        <span>סגירות</span>
        <span>הכנסה</span>
      </div>
      {rows.map((r) => (
        <div className="tag-breakdown-row" key={r.tag}>
          <span className="tag-breakdown-name">{r.tag}</span>
          <span>{formatNumber(r.leads)}</span>
          <span>{formatNumber(r.coordinations)}</span>
          <span>{formatNumber(r.arrivals)}</span>
          <span>{formatNumber(r.closings)}</span>
          <span>{formatCurrency(r.revenue)}</span>
        </div>
      ))}
      <div className="tag-breakdown-row tag-breakdown-total">
        <span className="tag-breakdown-name">סה&quot;כ</span>
        <span>{formatNumber(totals.leads)}</span>
        <span>{formatNumber(totals.coordinations)}</span>
        <span>{formatNumber(totals.arrivals)}</span>
        <span>{formatNumber(totals.closings)}</span>
        <span>{formatCurrency(totals.revenue)}</span>
      </div>
    </div>
  );
}
