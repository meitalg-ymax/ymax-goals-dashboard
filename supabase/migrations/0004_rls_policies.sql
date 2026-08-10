-- manual_entries: any authenticated user (Meital, and any staff added later)
-- can read/write. There is effectively one tenant, so no per-row ownership
-- logic is needed -- just gate out anonymous/public access entirely.
alter table manual_entries enable row level security;

create policy "authenticated read manual_entries" on manual_entries
  for select to authenticated using (true);

create policy "authenticated write manual_entries" on manual_entries
  for insert to authenticated with check (true);

create policy "authenticated update manual_entries" on manual_entries
  for update to authenticated using (true) with check (true);

create policy "authenticated delete manual_entries" on manual_entries
  for delete to authenticated using (true);

-- zoho_metrics / zoho_invalid_lead_reasons / sync_runs: authenticated users can
-- only READ. All writes happen exclusively from the server-side sync job using
-- the Supabase service-role key, which bypasses RLS entirely -- so there is
-- deliberately no insert/update/delete policy here for the authenticated role.
alter table zoho_metrics enable row level security;

create policy "authenticated read zoho_metrics" on zoho_metrics
  for select to authenticated using (true);

alter table zoho_invalid_lead_reasons enable row level security;

create policy "authenticated read zoho_invalid_lead_reasons" on zoho_invalid_lead_reasons
  for select to authenticated using (true);

alter table sync_runs enable row level security;

create policy "authenticated read sync_runs" on sync_runs
  for select to authenticated using (true);
