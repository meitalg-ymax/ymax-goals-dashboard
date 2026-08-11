import type { KadavResult } from "@/lib/metrics/pacing";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";

export function StageBlock({
  title,
  note,
  result,
  isCurrency,
}: {
  title: string;
  note?: string;
  result: KadavResult;
  isCurrency?: boolean;
}) {
  return (
    <div className="stage-block">
      <p className="stage-title">
        {title}
        {note && (
          <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11.5 }}> {note}</span>
        )}
      </p>
      <KadavRow result={result} isCurrency={isCurrency} />
    </div>
  );
}

export function KadavRow({ result, isCurrency }: { result: KadavResult; isCurrency?: boolean }) {
  const fmt = isCurrency ? formatCurrency : formatNumber;

  if (result.pct === null) {
    return (
      <div className="missing-row">
        <span className="missing-badge">⏳ חסר יעד — הזיני בהזנת יעדים</span>
      </div>
    );
  }

  return (
    <div className="stat-row">
      <div className="stat-box">
        <span className="stat-label">יעד</span>
        <span className="stat-val">{fmt(result.target)}</span>
      </div>
      <div className="stat-box">
        <span className="stat-label">ביצוע</span>
        <span className="stat-val">{fmt(result.actual)}</span>
      </div>
      <div className="stat-box">
        <span className="stat-label">קד&quot;ב</span>
        <span className="stat-val">{fmt(result.kadav)}</span>
      </div>
      <div className={`stat-box pct ${result.status}`}>
        <span className="stat-label">אחוז קד&quot;ב</span>
        <span className="stat-val">{Math.round(result.pct)}%</span>
      </div>
    </div>
  );
}
