import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const data = await getDashboardData(month);
  return <DashboardShell data={data} month={month} />;
}
