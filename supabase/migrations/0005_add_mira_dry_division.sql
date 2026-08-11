alter table manual_entries drop constraint manual_entries_division_check;
alter table manual_entries add constraint manual_entries_division_check
  check (division in ('ymax','body','tech','doctor','mira_dry'));

alter table zoho_metrics drop constraint zoho_metrics_division_check;
alter table zoho_metrics add constraint zoho_metrics_division_check
  check (division in ('ymax','body','tech','doctor','mira_dry'));

alter table zoho_invalid_lead_reasons drop constraint zoho_invalid_lead_reasons_division_check;
alter table zoho_invalid_lead_reasons add constraint zoho_invalid_lead_reasons_division_check
  check (division in ('ymax','body','tech','doctor','mira_dry'));
