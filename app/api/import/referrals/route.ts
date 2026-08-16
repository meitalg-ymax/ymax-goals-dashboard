import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseReferralsReport, applyReferralsImport } from "@/lib/imports/rapidReferrals";

// Backs the "עדכון ירוקים" upload button -- protected by proxy.ts (cookie
// session), same as every other non-/api/sync route. Always writes to the
// current month: the report is a rolling snapshot summed in full (see
// lib/imports/rapidReferrals.ts), not something that needs a target month
// to filter rows by.
export const maxDuration = 60;

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseReferralsReport(buffer);

    const supabase = createServiceClient();
    const result = await applyReferralsImport(supabase, currentMonthStart(), parsed);

    return NextResponse.json({
      status: "ok",
      month: result.month,
      amount: result.amount,
      totalRows: parsed.totalRows,
      includedCount: parsed.includedCount,
      excludedNotClosed: parsed.excludedNotClosed,
      amountSource: parsed.amountSource,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
