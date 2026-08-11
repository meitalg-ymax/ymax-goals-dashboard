"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabbar, type TabDef } from "@/components/tabs/Tabbar";
import { SignOutButton } from "@/components/SignOutButton";
import { DivisionRealCard } from "@/components/dashboard/DivisionRealCard";
import { OverviewRealCard } from "@/components/dashboard/OverviewRealCard";
import type { DashboardData } from "@/lib/dashboard/getDashboardData";
import type { Division } from "@/lib/zoho/transform";

const TABS: TabDef[] = [
  { id: "overview", label: "כללי" },
  { id: "ymax", label: "ymax" },
  { id: "body", label: "body" },
  { id: "tech", label: "tech" },
  { id: "doctor", label: "doctor" },
];

const DIVISION_SEGMENT: Record<Division, string> = {
  ymax: "הסרת שיער פנים",
  body: "הסרת שיער בגוף",
  tech: "אנטי אייג׳ינג, מירה דריי, פיגמנטציה ועוד",
  doctor: "הזרקות",
};

const DIVISIONS: Division[] = ["ymax", "body", "tech", "doctor"];

export function DashboardShell({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="wrap">
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      <header className="page-head">
        <div>
          <p className="eyebrow">YAFA MAXIMOV</p>
          <h1>מעקב יעדים שבועי</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link className="source-chip" href="/targets">
            הזנת יעדים
          </Link>
          <Link className="source-chip" href="/rapid">
            הזנת ראפיד
          </Link>
          <SignOutButton />
        </div>
      </header>

      <Tabbar tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {!data.hasSyncedData && (
        <div className="missing-card">
          <div className="mc-text">
            <span className="mc-title">חסר נתון — הסנכרון הראשון עוד לא רץ</span>
            <span className="mc-sub">
              הסנכרון מ-Zoho רץ פעם ביום אוטומטית. אם זה חדש, תני לו רגע ורעננו את הדף.
            </span>
          </div>
          <span className="missing-badge">⏳ ממתין לסנכרון</span>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="tabpanel">
          <OverviewRealCard divisions={data.divisions} asOf={data.asOf} monthLabel={data.monthLabel} />
        </div>
      )}

      {DIVISIONS.map(
        (division) =>
          activeTab === division && (
            <div className="tabpanel" key={division}>
              <div className="div-head">
                <div className="name-row">
                  <h2>{division}</h2>
                </div>
                <span className="segment">{DIVISION_SEGMENT[division]} — כל המקורות יחד</span>
              </div>
              <DivisionRealCard
                division={division}
                metrics={data.divisions[division]}
                reasons={data.invalidReasons[division]}
                asOf={data.asOf}
              />
            </div>
          )
      )}

      <footer>YAFA MAXIMOV — מעקב יעדים</footer>
    </div>
  );
}
