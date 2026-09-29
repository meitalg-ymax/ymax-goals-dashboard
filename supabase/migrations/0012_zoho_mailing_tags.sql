-- Per-tag breakdown of mailing (דיוור) leads -- Tag is Zoho's native
-- multiselect field on Leads holding the numbered WhatsApp send-batch name
-- + month (e.g. "8 התפספסנו ספטמבר 26"), a finer dimension than the
-- division-level leads_mailing/coordinations_mailing/arrivals_mailing/
-- closings_mailing/revenue_mailing rows already in zoho_metrics. Same
-- cron-only fetch caveat as leads_mailing itself (see sync.ts): Tag has no
-- date scoping in Zoho, so this reflects tag state as of the nightly cron
-- run, not a true point-in-time ledger.
create table zoho_mailing_tags (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor', 'mira_dry')),
  tag text not null, -- verbatim Zoho Tag value, e.g. "8 התפספסנו ספטמבר 26"
  metric text not null, -- leads | coordinations | arrivals | closings | revenue
  value numeric not null,
  synced_at timestamptz not null default now(),
  unique (month, division, tag, metric)
);

create index zoho_mailing_tags_month_division_idx on zoho_mailing_tags (month, division);

alter table zoho_mailing_tags enable row level security;

create policy "authenticated read zoho_mailing_tags" on zoho_mailing_tags
  for select to authenticated using (true);
-- Writes happen exclusively from the server-side sync job using the
-- service-role key, which bypasses RLS -- no insert/update/delete policy
-- for the authenticated role, matching zoho_metrics / zoho_invalid_lead_reasons.
