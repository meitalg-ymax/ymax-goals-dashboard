import {
  classifyDivisionFromSource,
  classifyDivisionFromType,
  classifyPaidOrganic,
  type Division,
} from "./transform";
import type { LeadRow, InvalidLeadRow, CoordinationRow, ArrivalRow, ClosingRow } from "./queries";

// Per-`type` funnel inside one division (e.g. tech = acne / post acne /
// pigmentation / anti aging / tech / body tech). Same classification rules
// as the קד"ב division numbers, so each column's type rows sum exactly to
// that division's total:
//  - leads: division by Lead_Source text (type fallback), then grouped by the
//    lead's own `type` value -- "רק לידים לפי מקור ליד, השאר לפי TYPE".
//  - invalid / תיאומים / הגעות / סגירות / הכנסה: division by `type`.
export type TypeFunnelRow = {
  type: string;
  leadsFunded: number;
  leadsOrganic: number;
  invalidFunded: number;
  coordinations: number;
  arrivals: number;
  closings: number;
  revenue: number;
};

const NO_TYPE = "(ללא type)";

function typeKey(type: string | undefined): string {
  const t = (type ?? "").toLowerCase().trim();
  return t || NO_TYPE;
}

export function aggregateTypeFunnel(
  division: Division,
  rows: {
    leads: LeadRow[];
    invalid: InvalidLeadRow[];
    coordinations: CoordinationRow[];
    arrivals: ArrivalRow[];
    closings: ClosingRow[];
  }
): TypeFunnelRow[] {
  const acc = new Map<string, TypeFunnelRow>();
  const get = (type: string | undefined) => {
    const key = typeKey(type);
    let row = acc.get(key);
    if (!row) {
      row = {
        type: key,
        leadsFunded: 0,
        leadsOrganic: 0,
        invalidFunded: 0,
        coordinations: 0,
        arrivals: 0,
        closings: 0,
        revenue: 0,
      };
      acc.set(key, row);
    }
    return row;
  };

  for (const r of rows.leads) {
    if (classifyDivisionFromSource(r.Lead_Source, r.type) !== division) continue;
    if (classifyPaidOrganic(r.Lead_Source) === "paid") get(r.type).leadsFunded++;
    else get(r.type).leadsOrganic++;
  }
  for (const r of rows.invalid) {
    if (classifyDivisionFromType(r.type) === division) get(r.type).invalidFunded++;
  }
  for (const r of rows.coordinations) {
    if (classifyDivisionFromType(r.type) === division) get(r.type).coordinations++;
  }
  for (const r of rows.arrivals) {
    if (classifyDivisionFromType(r.type) === division) get(r.type).arrivals++;
  }
  for (const r of rows.closings) {
    if (classifyDivisionFromType(r.type) !== division) continue;
    const row = get(r.type);
    row.closings++;
    row.revenue += r.field1234567 ?? 0;
  }

  return [...acc.values()].sort(
    (a, b) => b.leadsFunded + b.leadsOrganic - (a.leadsFunded + a.leadsOrganic) || b.revenue - a.revenue
  );
}

// Count rows by `type` -- for the "מעקב לידים" tab's per-division cards.
export function countByType<T extends { type?: string }>(rows: T[]): { type: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(typeKey(r.type), (m.get(typeKey(r.type)) ?? 0) + 1);
  return [...m.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}
