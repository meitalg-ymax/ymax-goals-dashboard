import { formatNumber } from "@/lib/metrics/format";

// Tapers the funnel width at each stage to the real conversion ratio so far
// (width = % of the stage above that converted through), centered at 50%.
// A minimum sliver keeps a stage visible even at very low/zero volume rather
// than collapsing to an invisible line.
export function FunnelShape({
  leads,
  arrivals,
  closings,
  firstLabel = "לידים",
  firstPctCap = "מהלידים",
}: {
  leads: number;
  arrivals: number;
  closings: number;
  /** Override for the top-stage label -- e.g. "פגישות מתואמות" on the branch
   * funnel, which starts one stage later than the division funnel (see
   * BranchTab). */
  firstLabel?: string;
  firstPctCap?: string;
}) {
  const conv1 = leads > 0 ? Math.min(1, arrivals / leads) : 0;
  const width1 = Math.max(conv1 * 100, 3);
  const conv2 = arrivals > 0 ? Math.min(1, closings / arrivals) : 0;
  const width2 = closings > 0 ? Math.max(width1 * conv2, 2) : width1 * conv2;

  const half1 = width1 / 2;
  const half2 = width2 / 2;

  // Real (uncapped) conversion rates for the on-funnel labels -- conv1/conv2
  // above are capped at 100% only to keep the trapezoid shape from
  // inverting, the label should show the true rate.
  const pct1 = leads > 0 ? `${((arrivals / leads) * 100).toFixed(1)}%` : "—";
  const pct2 = arrivals > 0 ? `${((closings / arrivals) * 100).toFixed(1)}%` : "—";

  return (
    <div className="funnel-shape">
      <div className="ftag-row first">
        <span className="ftag">
          {firstLabel} <span className="n">{formatNumber(leads)}</span>
        </span>
      </div>
      <div className="fseg-wrap">
        <div
          className="fseg fseg-1"
          style={{ clipPath: `polygon(0% 0%, 100% 0%, ${50 + half1}% 100%, ${50 - half1}% 100%)` }}
        />
      </div>
      <div className="fseg-pct-side fseg-pct-side-1">
        <span className="fseg-pct-val">{pct1}</span>
        <span className="fseg-pct-cap">{firstPctCap}</span>
      </div>
      <div className="ftag-row">
        <span className="ftag">
          הגעות <span className="n">{formatNumber(arrivals)}</span>
        </span>
      </div>
      <div className="fseg-wrap">
        <div
          className="fseg fseg-2"
          style={{
            clipPath: `polygon(${50 - half1}% 0%, ${50 + half1}% 0%, ${50 + half2}% 100%, ${50 - half2}% 100%)`,
          }}
        />
      </div>
      <div className="fseg-pct-side fseg-pct-side-2">
        <span className="fseg-pct-val">{pct2}</span>
        <span className="fseg-pct-cap">מהמגיעות</span>
      </div>
      <div className="ftag-row">
        <span className="ftag">
          סגירות <span className="n">{formatNumber(closings)}</span>
        </span>
      </div>
    </div>
  );
}
