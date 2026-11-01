import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseReferralsReport, applyReferralsImport } from "@/lib/imports/rapidReferrals";

// Automatic ירוקים import: Rapid emails the same "Treatment Plans Report"
// (subject "ירוקים2", 08:00, attachment DynamicReport_*.xlsx) to
// meitalg@ymax.co.il every morning, and a Google Apps Script running under
// her Gmail (scripts/rapid-email-import.gs) POSTs the raw attachment
// here. Lives under /api/sync so proxy.ts skips cookie auth -- CRON_SECRET
// bearer instead, same as the Zoho sync.
//
// Body: the raw .xlsx bytes. Query: ?reportDate=YYYY-MM-DD (the email's
// date in Israel time). Each report is a rolling month-to-date snapshot,
// so it normally writes to reportDate's month. Exception: the snapshot sent
// on the 1st can still be the previous month's final one -- if no row was
// created in reportDate's month but some were in the previous month, it's
// written to the previous month instead. An empty report writes nothing,
// so a quiet morning never zeroes out a month.
export const maxDuration = 60;

function monthStart(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportDate = new URL(request.url).searchParams.get("reportDate") ?? "";
  const dm = /^(\d{4})-(\d{2})-\d{2}$/.exec(reportDate);
  if (!dm) {
    return NextResponse.json({ error: "reportDate=YYYY-MM-DD חסר" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    const parsed = parseReferralsReport(buffer);

    if (parsed.totalRows === 0) {
      return NextResponse.json({ status: "skipped", reason: "empty report", reportDate });
    }

    const y = Number(dm[1]);
    const m = Number(dm[2]);
    const thisMonth = monthStart(y, m);
    const prevMonth = monthStart(y, m - 1);
    const month =
      !parsed.rowsByCreatedMonth[thisMonth] && parsed.rowsByCreatedMonth[prevMonth] ? prevMonth : thisMonth;

    const supabase = createServiceClient();
    const result = await applyReferralsImport(supabase, month, parsed);

    return NextResponse.json({
      status: "ok",
      reportDate,
      month: result.month,
      amount: result.amount,
      totalRows: parsed.totalRows,
      includedCount: parsed.includedCount,
      excludedNotClosed: parsed.excludedNotClosed,
      amountSource: parsed.amountSource,
      rowsByCreatedMonth: parsed.rowsByCreatedMonth,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
