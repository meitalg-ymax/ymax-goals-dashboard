-- Observability for the Zoho sync job. A silently-expired refresh token or a
-- Zoho-side outage must surface loudly (a dashboard banner) rather than just
-- leaving zoho_metrics stale with no visible signal.
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  error_message text,
  triggered_by text not null check (triggered_by in ('cron', 'on_demand'))
);

create index sync_runs_started_at_idx on sync_runs (started_at desc);
