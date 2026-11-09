"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";
import type { Division } from "@/lib/zoho/transform";
import type { TypeFunnelRow } from "@/lib/zoho/typeBreakdown";

type ApiResponse = { month: string; division: Division; from: string; to: string | null; rows: TypeFunnelRow[] };

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(0)}%` : "—";
}

const COLUMNS = ["TYPE", "לידים ממומן", "לידים אורגני", "לא תקינים", "תיאומים", "הגעות", "סגירות", "% סגירה", "הכנסה", "עסקה ממוצעת"];

function Row({ r, className }: { r: TypeFunnelRow; className?: string }) {
  return (
    <div className={`type-funnel-row ${className ?? ""}`}>
      <span className="type-funnel-name">{r.type}</span>
      <span>{formatNumber(r.leadsFunded)}</span>
      <span>{formatNumber(r.leadsOrganic)}</span>
      <span>{formatNumber(r.invalidFunded)}</span>
      <span>{formatNumber(r.coordinations)}</span>
      <span>{formatNumber(r.arrivals)}</span>
      <span>{formatNumber(r.closings)}</span>
      <span>{pct(r.closings, r.arrivals)}</span>
      <span>{formatCurrency(r.revenue)}</span>
      <span>{r.closings > 0 ? formatCurrency(r.revenue / r.closings) : "—"}</span>
    </div>
  );
}

export function TypeBreakdownCard({ division, month }: { division: Division; month: string }) {
  // `reload` bumps the request key; the result is tagged with the key it
  // answers, so "loading" is simply "latest result is for an older key"
  // (keeps setState out of the effect body itself).
  const [reload, setReload] = useState(0);
  const requestKey = `${division}|${month}|${reload}`;
  const [result, setResult] = useState<{ key: string; data: ApiResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/type-breakdown?month=${month}&division=${division}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "שגיאה לא ידועה");
        if (!cancelled) setResult({ key: requestKey, data: body, error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [division, month, requestKey]);

  const loading = result?.key !== requestKey;
  const data = result?.data ?? null;
  const error = loading ? null : (result?.error ?? null);
  const load = () => setReload((n) => n + 1);

  const totals: TypeFunnelRow | null = data
    ? data.rows.reduce(
        (a, r) => ({
          type: "סה״כ",
          leadsFunded: a.leadsFunded + r.leadsFunded,
          leadsOrganic: a.leadsOrganic + r.leadsOrganic,
          invalidFunded: a.invalidFunded + r.invalidFunded,
          coordinations: a.coordinations + r.coordinations,
          arrivals: a.arrivals + r.arrivals,
          closings: a.closings + r.closings,
          revenue: a.revenue + r.revenue,
        }),
        { type: "סה״כ", leadsFunded: 0, leadsOrganic: 0, invalidFunded: 0, coordinations: 0, arrivals: 0, closings: 0, revenue: 0 }
      )
    : null;

  return (
    <div className="real-card">
      <div className="real-head">
        <div className="real-title">
          <h2>פירוט לפי TYPE</h2>
          <span className="real-badge">✓ נשלף חי מ-Zoho</span>
        </div>
        <button className="btn-primary" onClick={load} disabled={loading} type="button">
          {loading ? "שולף..." : "רענון"}
        </button>
      </div>

      {error && <p className="real-note">השליפה נכשלה: {error}</p>}
      {!data && loading && <p className="real-note">שולף נתונים מ-Zoho...</p>}

      {data && data.rows.length === 0 && <p className="real-note">אין נתונים לחודש זה עדיין.</p>}

      {data && data.rows.length > 0 && totals && (
        <div className="type-funnel-scroll">
          <div className="type-funnel-table">
            <div className="type-funnel-header">
              {COLUMNS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {data.rows.map((r) => (
              <Row r={r} key={r.type} />
            ))}
            <Row r={totals} className="type-funnel-total" />
          </div>
        </div>
      )}

      <p className="real-note">
        {data?.to ? `טווח: ${data.from} עד ${data.to}. ` : ""}
        <strong style={{ color: "var(--ink)" }}>לידים</strong> משויכים לחטיבה לפי מקור הליד ומפוצלים לפי ה-type
        שלהם; <strong style={{ color: "var(--ink)" }}>שאר העמודות</strong> לפי type — אותם כללים כמו בקד״ב, כך שהסה״כ
        תואם למספרי החטיבה. זו תמונת חודש (כמו הקד״ב), לא מעקב קבוצה: הגעות וסגירות החודש יכולות להיות של לידים
        מחודשים קודמים. לא תקינים = ממומן בלבד. הכנסה = סכום עסקה ב-Zoho (בלי ספא/שדרוגים/ירוקים).
      </p>
    </div>
  );
}
