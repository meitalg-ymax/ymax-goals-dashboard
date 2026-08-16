import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseRapidSalesReport, applyRapidSalesImport } from "@/lib/imports/rapidSales";

// Backs the "עדכון כסף ראפיד" upload button -- protected by proxy.ts (cookie
// session), same as every other non-/api/sync route. Runs the exact same
// parsing/write logic as scripts/import-rapid-sales.mjs, just from an
// uploaded file instead of a local path.
export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseRapidSalesReport(buffer);

    const supabase = createServiceClient();
    const result = await applyRapidSalesImport(supabase, parsed);

    return NextResponse.json({
      status: "ok",
      month: result.month,
      rowCount: parsed.rowCount,
      categoriesWritten: result.categoriesWritten,
      divisionsUpdated: result.divisionsUpdated,
      unmapped: parsed.unmapped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
