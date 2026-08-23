-- Branch-level metrics from Zoho (field123456, "סניף"). Populated only when a
-- lead reaches the meeting-scheduling stage, so this funnel starts one stage
-- later than zoho_metrics ("meetings" instead of "leads") -- see BranchTab.
create table zoho_branch_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  metric text not null, -- meetings | arrivals | closings | revenue
  value numeric not null,
  as_of date not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, metric)
);

create index zoho_branch_metrics_month_branch_idx on zoho_branch_metrics (month, branch);

-- Same data, cross-tabulated by division within each branch (e.g. "how many
-- doctor closings happened at the Rishon branch") -- a separate table rather
-- than a nullable division column on zoho_branch_metrics, so the unique
-- constraint stays airtight (Postgres treats NULL as never equal to itself in
-- a unique index, which would silently let branch-wide-total rows duplicate).
create table zoho_branch_division_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  branch text not null check (branch in ('ramat_gan', 'rishon', 'jerusalem', 'haifa')),
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor', 'mira_dry')),
  metric text not null, -- arrivals | closings | revenue (no "meetings" here -- see BranchTab)
  value numeric not null,
  as_of date not null,
  synced_at timestamptz not null default now(),
  unique (month, branch, division, metric)
);

create index zoho_branch_division_metrics_month_branch_idx on zoho_branch_division_metrics (month, branch);

alter table zoho_branch_metrics enable row level security;

create policy "authenticated read zoho_branch_metrics" on zoho_branch_metrics
  for select to authenticated using (true);

alter table zoho_branch_division_metrics enable row level security;

create policy "authenticated read zoho_branch_division_metrics" on zoho_branch_division_metrics
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side sync job using the
-- service-role key, which bypasses RLS -- no insert/update/delete policy
-- for the authenticated role, matching zoho_metrics.
