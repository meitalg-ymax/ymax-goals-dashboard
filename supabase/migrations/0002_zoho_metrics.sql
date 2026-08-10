-- Live metrics synced from Zoho CRM. Uses the SAME metric-key namespace as the
-- 'target' rows in manual_entries (e.g. leads_funded, arrivals_mailing,
-- revenue_funded_organic) so a יעד-vs-ביצוע lookup anywhere in the app is a
-- single key match across two tables, never a mapping table.
create table zoho_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor')),
  metric text not null,
  value numeric not null,
  as_of date not null, -- last calendar day actually included (yesterday, for the current month)
  synced_at timestamptz not null default now(),
  unique (month, division, metric)
);

create index zoho_metrics_month_division_idx on zoho_metrics (month, division);

-- Free-form breakdown (field90 disposition reasons on invalid leads) -- not a
-- fixed metric key, so it gets its own table instead of overloading zoho_metrics.
create table zoho_invalid_lead_reasons (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor')),
  reason text not null, -- verbatim field90 picklist value from Zoho
  count integer not null,
  synced_at timestamptz not null default now(),
  unique (month, division, reason)
);

create index zoho_invalid_lead_reasons_month_division_idx on zoho_invalid_lead_reasons (month, division);
