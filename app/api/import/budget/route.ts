import { NextResponse } from "next/server";

// Backs the "עדכון תקציב שנוצל" upload button. Not wired to real parsing
// logic yet -- there's no confirmed Excel format for budget-utilization
// reports to build against (unlike rapid-sales/referrals, which came from
// real sample files). Meital needs to share a sample export before this can
// actually parse anything; until then it fails loudly instead of silently
// accepting a file and doing nothing.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "עדכון תקציב עדיין לא מחובר -- אין עדיין קובץ לדוגמה של דוח ניצול תקציב לבנות לפיו את הפרסור. תשלחי קובץ אקסל לדוגמה ואבנה את זה.",
    },
    { status: 501 }
  );
}
