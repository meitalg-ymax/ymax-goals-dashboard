"use client";

import { useState } from "react";
import type { MetricDef } from "@/lib/metrics/catalog";
import type { Division } from "@/lib/zoho/transform";

export function MetricForm({
  division,
  metrics,
  groups,
  initialValues,
  onSave,
}: {
  division: Division;
  metrics: MetricDef[];
  groups: string[];
  initialValues: Record<string, number>;
  onSave: (division: Division, values: Record<string, number>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function setField(key: string, raw: string) {
    const num = raw === "" ? 0 : Number(raw);
    setValues((prev) => ({ ...prev, [key]: Number.isNaN(num) ? 0 : num }));
  }

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      await onSave(division, values);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {groups.map((group) => (
        <div key={group}>
          <p className="section-label" style={{ marginBottom: 10 }}>
            {group}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {metrics
              .filter((m) => m.group === group)
              .map((m) => (
                <div className="field" key={m.key}>
                  <label htmlFor={`${division}-${m.key}`}>
                    {m.label}
                    {m.valueType === "percent" ? " (%)" : m.valueType === "currency" ? " (₪)" : ""}
                  </label>
                  <input
                    id={`${division}-${m.key}`}
                    type="number"
                    inputMode="decimal"
                    value={values[m.key] ?? 0}
                    onChange={(e) => setField(m.key, e.target.value)}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </button>
        {savedAt && <span style={{ fontSize: 12.5, color: "var(--good)" }}>נשמר ✓</span>}
      </div>
    </div>
  );
}
