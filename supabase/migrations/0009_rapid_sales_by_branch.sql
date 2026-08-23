-- Rapid POS revenue totals by branch (SalesReport's own "סניף" column,
-- confirmed 2026-08-23) -- a separate table from rapid_sales_categories
-- (which is by category/division) since this is a different cross-section of
-- the same report, not a replacement for it.
create table rapid_sales_by_branch (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  amount numeric not null,
  synced_at timestamptz not null default now(),
  unique (month, branch)
);

create index rapid_sales_by_branch_month_idx on rapid_sales_by_branch (month);

alter table rapid_sales_by_branch enable row level security;

create policy "authenticated read rapid_sales_by_branch" on rapid_sales_by_branch
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side import route using the
-- service-role key, which bypasses RLS -- no insert/update/delete policy
-- for the authenticated role, matching rapid_sales_categories.
