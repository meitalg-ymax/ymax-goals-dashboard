-- Branch metrics cross-tabulated by sales rep (יועצת, Zoho field1234) --
-- mirrors zoho_branch_division_metrics, but rep is an open Zoho picklist
-- (not a fixed enum like division/branch), so no check constraint on it.
-- Rows with no rep set on the lead are not stored here at all -- the UI
-- derives an "unassigned" count as (zoho_branch_metrics total - sum of rep
-- rows here) rather than this table needing a NULL/sentinel rep value.
create table zoho_branch_rep_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  rep text not null,
  metric text not null, -- arrivals | closings
  value numeric not null,
  as_of date not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, rep, metric)
);

create index zoho_branch_rep_metrics_month_branch_idx on zoho_branch_rep_metrics (month, branch);

alter table zoho_branch_rep_metrics enable row level security;

create policy "authenticated read zoho_branch_rep_metrics" on zoho_branch_rep_metrics
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side sync job using the
-- service-role key, which bypasses RLS -- no insert/update/delete policy
-- for the authenticated role, matching zoho_branch_metrics.
