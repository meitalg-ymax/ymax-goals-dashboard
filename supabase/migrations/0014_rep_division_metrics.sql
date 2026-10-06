-- Sales rep (יועצת) x division (type) x branch -- feeds the "יועצות" tab,
-- answering "how much did each advisor close in ymax / doctor / body..."
-- with an optional branch filter. Branch stays a column (not pre-summed away)
-- so the UI can filter to one branch or sum across all of them.
--
-- Zoho side: same lead rows as zoho_branch_rep_metrics, additionally split
-- by `type` (classifyDivisionFromType). Rows with no rep, or a type that
-- doesn't map to a division, aren't stored -- the UI derives those as a
-- residual against zoho_branch_rep_metrics / zoho_branch_metrics.
create table zoho_branch_rep_division_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  rep text not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor', 'mira_dry')),
  metric text not null, -- arrivals | closings | revenue
  value numeric not null,
  as_of date not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, rep, division, metric)
);

create index zoho_branch_rep_division_metrics_month_idx on zoho_branch_rep_division_metrics (month);

alter table zoho_branch_rep_division_metrics enable row level security;

create policy "authenticated read zoho_branch_rep_division_metrics" on zoho_branch_rep_division_metrics
  for select to authenticated using (true);

-- Rapid side: SalesReport rows by branch + "צוות מכירות" + קטגוריה, with the
-- category rolled up to division via the same CATEGORY_TO_DIVISION map as
-- rapid_sales_categories. Product sales -> 'products', any category not in
-- the map -> 'other', so the per-rep total here still equals
-- rapid_sales_by_branch_rep for the same branch+rep.
create table rapid_sales_by_branch_rep_division (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  rep text not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor', 'mira_dry', 'products', 'other')),
  amount numeric not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, rep, division)
);

create index rapid_sales_by_branch_rep_division_month_idx on rapid_sales_by_branch_rep_division (month);

alter table rapid_sales_by_branch_rep_division enable row level security;

create policy "authenticated read rapid_sales_by_branch_rep_division" on rapid_sales_by_branch_rep_division
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side sync job / import route
-- using the service-role key, which bypasses RLS -- no write policies for
-- the authenticated role, matching the other branch tables.
