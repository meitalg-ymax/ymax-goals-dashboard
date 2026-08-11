export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₪${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `₪${(n / 1_000).toFixed(1)}K`;
  return `₪${formatNumber(n)}`;
}
