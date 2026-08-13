"use client";

import { useState } from "react";
import { type Division } from "@/lib/zoho/transform";
import { formatNumber } from "@/lib/metrics/format";

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

type SourceCount = { source: string; count: number };
type DivisionGroup = { division: Division | null; total: number; sources: SourceCount[] };
type TypeGroup = { total: number; divisions: DivisionGroup[] };
type ApiResponse = { from: string; to: string; total: number; funded: TypeGroup; organic: TypeGroup };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function DivisionCard({ group }: { group: DivisionGroup }) {
  const label = group.division ? DIVISION_LABELS[group.division] : "לא משויך לחטיבה";
  const color = group.division ? DIVISION_COLORS[group.division] : "var(--muted)";
  return (
    <div className="division-card">
      <div className="division-head">
        <span className="division-dot" style={{ background: color }} />
        <span className="division-name">{label}</span>
        <span className="division-total">{formatNumber(group.total)}</span>
      </div>
      {group.sources.length === 0 ? (
        <div className="source-row">
          <span className="s-name" style={{ color: "var(--muted)", fontStyle: "italic" }}>
            אין לידים בטווח זה
          </span>
          <span className="s-count">—</span>
        </div>
      ) : (
        group.sources.map((s) => (
          <div className="source-row" key={s.source}>
            <span className="s-name">{s.source}</span>
            <span className="s-count">{formatNumber(s.count)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function TypeSection({ title, badgeClass, group, note }: { title: string; badgeClass: string; group: TypeGroup; note: string }) {
  return (
    <div className="type-section">
      <div className="type-head">
        <span className={`type-badge ${badgeClass}`}>{title}</span>
        <span className="type-total">
          {formatNumber(group.total)} לידים · {note}
        </span>
      </div>
      <div className="division-grid">
        {group.divisions.map((g) => (
          <DivisionCard group={g} key={g.division ?? "unclassified"} />
        ))}
      </div>
    </div>
  );
}

export function LeadsByDateTab() {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [singleDay, setSingleDay] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  function handleFromChange(value: string) {
    setFrom(value);
    if (singleDay) setTo(value);
  }

  function handleSingleDayToggle(next: boolean) {
    setSingleDay(next);
    if (next) setTo(from);
  }

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads-by-date?from=${from}&to=${to}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "שגיאה לא ידועה");
      setData(body);
      setFetchedAt(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tabpanel">
      <div className="real-card range-card">
        <div className="range-field">
          <label>מתאריך</label>
          <input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} />
        </div>
        <div className="range-field">
          <label>עד תאריך</label>
          <input type="date" value={to} disabled={singleDay} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="range-toggle">
          <button className={!singleDay ? "active" : ""} onClick={() => handleSingleDayToggle(false)} type="button">
            טווח
          </button>
          <button className={singleDay ? "active" : ""} onClick={() => handleSingleDayToggle(true)} type="button">
            יום בודד
          </button>
        </div>
        <button className="btn-primary" onClick={handleFetch} disabled={loading} type="button">
          {loading ? "שולף..." : "משוך מ-Zoho"}
        </button>
        {fetchedAt && <span className="last-fetch">נשלף לאחרונה: היום {fetchedAt}</span>}
      </div>

      {error && (
        <div className="missing-card">
          <div className="mc-text">
            <span className="mc-title">השליפה נכשלה</span>
            <span className="mc-sub">{error}</span>
          </div>
          <span className="missing-badge">⏳ שגיאה</span>
        </div>
      )}

      {!data && !error && (
        <div className="missing-card">
          <div className="mc-text">
            <span className="mc-title">בחרי טווח ולחצי &quot;משוך מ-Zoho&quot;</span>
            <span className="mc-sub">הנתונים נשלפים חי מ-Zoho לטווח המדויק שתבחרי, לא מהסנכרון היומי.</span>
          </div>
        </div>
      )}

      {data && (
        <>
          <div>
            <p className="section-label" style={{ marginBottom: 10 }}>
              סיכום כללי לטווח <span style={{ fontWeight: 400, color: "var(--muted)" }}>{data.from} – {data.to}</span>
            </p>
            <div className="extra-grid">
              <div className="extra-tile total">
                <span className="et-label">סה״כ לידים</span>
                <span className="et-value">{formatNumber(data.total)}</span>
              </div>
              <div className="extra-tile">
                <span className="et-label">ממומן</span>
                <span className="et-value">{formatNumber(data.funded.total)}</span>
                <span className="et-note">{data.total > 0 ? `${((data.funded.total / data.total) * 100).toFixed(1)}% מהסה״כ` : ""}</span>
              </div>
              <div className="extra-tile">
                <span className="et-label">אורגני</span>
                <span className="et-value" style={{ color: "var(--pink-deep)" }}>
                  {formatNumber(data.organic.total)}
                </span>
                <span className="et-note">{data.total > 0 ? `${((data.organic.total / data.total) * 100).toFixed(1)}% מהסה״כ` : ""}</span>
              </div>
            </div>
          </div>

          <TypeSection
            title="ממומן"
            badgeClass="funded"
            group={data.funded}
            note="שיוך תמיד לפי טקסט מקור הליד"
          />
          <TypeSection
            title="אורגני"
            badgeClass="organic"
            group={data.organic}
            note="שיוך לפי type (המקור עצמו כמעט אף פעם לא מזכיר חטיבה)"
          />

          <p className="real-note">
            <strong style={{ color: "var(--ink)" }}>שיטת השיוך:</strong> ממומן/אורגני תמיד לפי טקסט מקור הליד (מכיל
            &quot;marketism&quot; = ממומן, חוץ מ-&quot;ig_linktree&quot; שגובר וחוזר לאורגני).{" "}
            <strong style={{ color: "var(--ink)" }}>חטיבה:</strong> קודם מטקסט מקור הליד עצמו, ואם לא נמצא — נופל
            אחורה לשדה type. <strong style={{ color: "var(--ink)" }}>הסינון</strong> תואם את מסך הפילטר ב-Zoho: type
            לא ריק, והחרגת מקורות הדיוור הידועים.
          </p>
        </>
      )}
    </div>
  );
}
