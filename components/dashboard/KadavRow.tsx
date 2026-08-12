import type { KadavResult } from "@/lib/metrics/pacing";
import { formatCurrency, formatNumber } from "@/lib/metrics/format";

// The "כסף" outcome at the end of a funnel isn't a further-filtered count
// like leads/arrivals/closings, so it gets its own card (with a subtle gold
// ring, not a taper) instead of extending the funnel shape a 4th stage.
export function MoneyOutcome({
  title,
  result,
  avgDealActual,
  avgDealTarget,
  breakdown,
}: {
  title: string;
  result: KadavResult;
  avgDealActual: number;
  avgDealTarget: number;
  breakdown?: string;
}) {
  return (
    <div className="money-outcome">
      <div className="money-head">
        <span className="m-label">{title}</span>
        <span className="m-value">{formatCurrency(result.actual)}</span>
      </div>
      <KadavRow result={result} isCurrency />
      {breakdown && <p className="money-avg">מתוך זה: {breakdown}</p>}
      {avgDealActual > 0 && (
        <p className="money-avg">
          שווי עסקה ממוצע: <strong>{formatCurrency(avgDealActual)}</strong>
          {avgDealTarget > 0 && <> (יעד {formatCurrency(avgDealTarget)})</>}
        </p>
      )}
    </div>
  );
}

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
