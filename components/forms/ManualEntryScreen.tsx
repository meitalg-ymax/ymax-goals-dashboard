"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabbar, type TabDef } from "@/components/tabs/Tabbar";
import { MonthPicker } from "@/components/forms/MonthPicker";
import { MetricForm } from "@/components/forms/MetricForm";
import type { MetricDef } from "@/lib/metrics/catalog";
import type { Division } from "@/lib/zoho/transform";
import type { ManualEntriesByDivision } from "@/lib/dashboard/manualEntries";

const DIVISION_TABS: TabDef[] = [
  { id: "ymax", label: "ymax" },
  { id: "body", label: "body" },
  { id: "tech", label: "tech" },
  { id: "mira_dry", label: "mira dry" },
  { id: "doctor", label: "doctor" },
];

export function ManualEntryScreen({
  title,
  basePath,
  month,
  initialDivision,
  metrics,
  groups,
  data,
  onSave,
}: {
  title: string;
  basePath: string;
  month: string;
  initialDivision?: Division;
  metrics: MetricDef[];
  groups: string[];
  data: ManualEntriesByDivision;
  onSave: (division: Division, values: Record<string, number>) => Promise<void>;
}) {
  const [activeDivision, setActiveDivision] = useState<Division>(initialDivision ?? "ymax");

  return (
    <div className="wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">YAFA MAXIMOV</p>
          <h1>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <MonthPicker month={month} basePath={basePath} />
          <Link className="source-chip" href="/">
            חזרה לדשבורד
          </Link>
        </div>
      </header>

      <Tabbar
        tabs={DIVISION_TABS}
        activeId={activeDivision}
        onChange={(id) => setActiveDivision(id as Division)}
      />

      <MetricForm
        key={`${activeDivision}-${month}`}
        division={activeDivision}
        metrics={metrics}
        groups={groups}
        initialValues={data[activeDivision] ?? {}}
        onSave={onSave}
      />

      <footer>YAFA MAXIMOV — מעקב יעדים</footer>
    </div>
  );
}
