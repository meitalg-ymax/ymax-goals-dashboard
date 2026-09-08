-- Rapid POS revenue cross-tabbed by branch + sales rep (SalesReport's own
-- "צוות מכירות" column, confirmed 2026-09-01) -- lets the "לפי סניף" tab show
-- Rapid revenue per advisor next to the existing Zoho arrivals/closings per
-- advisor (zoho_branch_rep_metrics), so the two sources can be compared side
-- by side. A separate table from rapid_sales_by_branch (branch totals only)
-- rather than a replacement for it, same reasoning as that table vs
-- rapid_sales_categories.
create table rapid_sales_by_branch_rep (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  rep text not null,
  amount numeric not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, rep)
);

create index rapid_sales_by_branch_rep_month_branch_idx on rapid_sales_by_branch_rep (month, branch);

alter table rapid_sales_by_branch_rep enable row level security;

create policy "authenticated read rapid_sales_by_branch_rep" on rapid_sales_by_branch_rep
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side import route using the
-- service-role key, which bypasses RLS -- no insert/update/delete policy
-- for the authenticated role, matching rapid_sales_by_branch.
