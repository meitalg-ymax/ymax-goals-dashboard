-- daily_budget_actuals was created outside the migrations (via the SQL editor)
-- and never had RLS enabled, so the anon key could read/write/delete it.
-- Match the other server-synced tables: authenticated users read only; writes
-- go through the service-role key, which bypasses RLS.
alter table daily_budget_actuals enable row level security;

create policy "authenticated read daily_budget_actuals" on daily_budget_actuals
  for select to authenticated using (true);
