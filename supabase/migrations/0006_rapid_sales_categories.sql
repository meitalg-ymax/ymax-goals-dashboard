-- Full category breakdown from the Rapid POS "SalesReport" export (the real
-- source behind revenue_spa_upgrades). Kept as its own table, separate from
-- manual_entries, because it has a category granularity manual_entries
-- doesn't model (e.g. "מוצרים יפה" straddles no single division) and because
-- the dashboard overview wants to show every raw category, not just the
-- 5-division rollup. division is null for company-wide categories (products)
-- that don't belong to any funnel division.
create table rapid_sales_categories (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  category text not null, -- display label (raw קטגוריה, or the merged "מוצרים יפה" label)
  division text check (division in ('ymax', 'body', 'tech', 'doctor', 'mira_dry')),
  amount numeric not null,
  synced_at timestamptz not null default now(),
  unique (month, category)
);

create index rapid_sales_categories_month_idx on rapid_sales_categories (month);

alter table rapid_sales_categories enable row level security;

create policy "authenticated read rapid_sales_categories" on rapid_sales_categories
  for select to authenticated using (true);
