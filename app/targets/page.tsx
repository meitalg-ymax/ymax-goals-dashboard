import { ManualEntryScreen } from "@/components/forms/ManualEntryScreen";
import { CompanyTargetForm } from "@/components/forms/CompanyTargetForm";
import { getManualEntries } from "@/lib/dashboard/manualEntries";
import { getCompanyTargets } from "@/lib/dashboard/companyTargets";
import { metricsForKind, groupsForKind, COMPANY_TARGET_METRICS } from "@/lib/metrics/catalog";
import { saveTargets, saveCompanyTargets } from "./actions";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const monthDate = `${month}-01`;

  const data = await getManualEntries("target", monthDate);
  const companyData = await getCompanyTargets(monthDate);

  async function save(division: Parameters<typeof saveTargets>[1], values: Record<string, number>) {
    "use server";
    await saveTargets(monthDate, division, values);
  }

  async function saveCompany(values: Record<string, number>) {
    "use server";
    await saveCompanyTargets(monthDate, values);
  }

  return (
    <ManualEntryScreen
      title="הזנת יעדים חודשיים"
      basePath="/targets"
      month={month}
      metrics={metricsForKind("target")}
      groups={groupsForKind("target")}
      data={data}
      onSave={save}
      extra={<CompanyTargetForm metrics={COMPANY_TARGET_METRICS} initialValues={companyData} onSave={saveCompany} />}
    />
  );
}
