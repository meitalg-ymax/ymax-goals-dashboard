import { formatNumber } from "@/lib/metrics/format";

// Tapers the funnel width at each stage to the real conversion ratio so far
// (width = % of the stage above that converted through), centered at 50%.
// A minimum sliver keeps a stage visible even at very low/zero volume rather
// than collapsing to an invisible line.
export function FunnelShape({ leads, arrivals, closings }: { leads: number; arrivals: number; closings: number }) {
  const conv1 = leads > 0 ? Math.min(1, arrivals / leads) : 0;
  const width1 = Math.max(conv1 * 100, 3);
  const conv2 = arrivals > 0 ? Math.min(1, closings / arrivals) : 0;
  const width2 = closings > 0 ? Math.max(width1 * conv2, 2) : width1 * conv2;

  const half1 = width1 / 2;
  const half2 = width2 / 2;

  return (
    <div className="funnel-shape">
      <div className="ftag-row first">
        <span className="ftag">
          לידים <span className="n">{formatNumber(leads)}</span>
        </span>
      </div>
      <div
        className="fseg fseg-1"
        style={{ clipPath: `polygon(0% 0%, 100% 0%, ${50 + half1}% 100%, ${50 - half1}% 100%)` }}
      />
      <div className="ftag-row">
        <span className="ftag">
          הגעות <span className="n">{formatNumber(arrivals)}</span>
        </span>
      </div>
      <div
        className="fseg fseg-2"
        style={{
          clipPath: `polygon(${50 - half1}% 0%, ${50 + half1}% 0%, ${50 + half2}% 100%, ${50 - half2}% 100%)`,
        }}
      />
      <div className="ftag-row">
        <span className="ftag">
          סגירות <span className="n">{formatNumber(closings)}</span>
        </span>
      </div>
    </div>
  );
}
