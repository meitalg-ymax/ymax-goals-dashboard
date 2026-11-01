import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseRapidDynamicSalesReport, applyRapidSalesImport } from "@/lib/imports/rapidSales";

// Automatic כסף ראפיד import: Rapid emails "דו"ח מכירות אווטומאטי"
// (DynamicReport_*.xlsx, ~10:00, month-to-date through yesterday) to
// meitalg@ymax.co.il, and the Gmail Apps Script (scripts/rapid-email-import.gs)
// POSTs the raw attachment here. Under /api/sync so proxy.ts skips cookie
// auth -- CRON_SECRET bearer instead, same as the Zoho sync.
//
// The month comes from the rows' DocDate, so the report sent on the 1st
// (the previous month's full figures) lands in the previous month. Per-rep
// tables are left untouched -- see parseRapidDynamicSalesReport.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    const parsed = parseRapidDynamicSalesReport(buffer);

    const supabase = createServiceClient();
    const result = await applyRapidSalesImport(supabase, parsed);

    return NextResponse.json({
      status: "ok",
      month: result.month,
      rowCount: parsed.rowCount,
      categoriesWritten: result.categoriesWritten,
      divisionsUpdated: result.divisionsUpdated,
      branchesWritten: result.branchesWritten,
      unmapped: parsed.unmapped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
