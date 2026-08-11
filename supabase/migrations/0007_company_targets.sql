-- Company-wide-only targets: metrics that don't belong to any single
-- division (e.g. "מוצרים" -- general product sales), confirmed against
-- Meital's Excel (her "סה"כ מכל התחומים" tab includes a 90,000 מוצרים
-- target that feeds into "סה"כ כסף ראפיד"). Kept separate from
-- manual_entries because that table requires a real division per row.
create table company_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  metric text not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) default auth.uid(),
  unique (month, metric)
);

alter table company_targets enable row level security;

create policy "authenticated read company_targets" on company_targets
  for select to authenticated using (true);

create policy "authenticated write company_targets" on company_targets
  for insert to authenticated with check (true);

create policy "authenticated update company_targets" on company_targets
  for update to authenticated using (true) with check (true);

create policy "authenticated delete company_targets" on company_targets
  for delete to authenticated using (true);
