import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardShell data={data} />;
}
