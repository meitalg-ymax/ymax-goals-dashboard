import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseReferralsReport, applyReferralsImport } from "@/lib/imports/rapidReferrals";

// Backs the "עדכון ירוקים" upload button -- protected by proxy.ts (cookie
// session), same as every other non-/api/sync route. Runs the exact same
// parsing/write logic as scripts/import-rapid-referrals.mjs, just from an
// uploaded file instead of a local path.
export const maxDuration = 60;

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const targetMonth = (formData.get("month") as string | null) || currentYearMonth();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: "פורמט חודש לא תקין (צפוי YYYY-MM)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseReferralsReport(buffer, targetMonth);

    const supabase = createServiceClient();
    const result = await applyReferralsImport(supabase, parsed);

    return NextResponse.json({
      status: "ok",
      month: result.month,
      amount: result.amount,
      totalRows: parsed.totalRows,
      includedCount: parsed.includedCount,
      excluded: parsed.excluded,
      amountSource: parsed.amountSource,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
