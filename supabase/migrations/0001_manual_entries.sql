-- Manual entries: monthly targets AND manually-entered Rapid actuals (ספה/שדרוגים/ירוקים).
-- Same shape for both -- 'kind' is the only discriminator -- so the same input-form
-- component and save logic serve both the /targets and /rapid screens.
create table manual_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('target', 'rapid_actual')),
  month date not null,
  division text not null check (division in ('ymax', 'body', 'tech', 'doctor')),
  metric text not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) default auth.uid(),
  unique (kind, month, division, metric)
);

create index manual_entries_month_division_idx on manual_entries (month, division);
