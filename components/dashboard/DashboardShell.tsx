"use client";

import { useState } from "react";
import { Tabbar, type TabDef } from "@/components/tabs/Tabbar";
import { SignOutButton } from "@/components/SignOutButton";
import { DivisionRealCard } from "@/components/dashboard/DivisionRealCard";
import { DivisionDetailTable } from "@/components/dashboard/DivisionDetailTable";
import { OverviewKadavTable } from "@/components/dashboard/OverviewKadavTable";
import { RevenueTypePie } from "@/components/dashboard/RevenueTypePie";
import { RevenueByDivisionPie } from "@/components/dashboard/RevenueByDivisionPie";
import { RapidCategoryBreakdown } from "@/components/dashboard/RapidCategoryBreakdown";
import { LeadsByDateTab } from "@/components/dashboard/LeadsByDateTab";
import { DataOpsBar } from "@/components/dashboard/DataOpsBar";
import type { DashboardData } from "@/lib/dashboard/getDashboardData";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";

const GROUPS: TabDef[] = [
  { id: "kadav", label: "דוח קד״ב" },
  { id: "leads", label: "מעקב לידים" },
];

const TABS: TabDef[] = [
  { id: "overview", label: "כללי" },
  { id: "ymax", label: "ymax" },
  { id: "body", label: "body" },
  { id: "tech", label: "tech" },
  { id: "mira_dry", label: "mira dry" },
  { id: "doctor", label: "doctor" },
];

const DIVISION_LABELS: Record<Division, string> = {
  ymax: "ymax",
  body: "body",
  tech: "tech",
  mira_dry: "mira dry",
  doctor: "doctor",
};

const DIVISION_SEGMENT: Record<Division, string> = {
  ymax: "הסרת שיער פנים",
  body: "הסרת שיער בגוף",
  tech: "אנטי אייג׳ינג, פיגמנטציה ועוד",
  mira_dry: "מירה דריי",
  doctor: "הזרקות",
};

export function DashboardShell({ data }: { data: DashboardData }) {
  const [activeGroup, setActiveGroup] = useState("kadav");
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
          <SignOutButton />
        </div>
      </header>

      <DataOpsBar lastUpdated={data.lastUpdated} />

      <Tabbar tabs={GROUPS} activeId={activeGroup} onChange={setActiveGroup} />

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

      {activeGroup === "kadav" && <Tabbar tabs={TABS} activeId={activeTab} onChange={setActiveTab} />}

      {activeGroup === "kadav" && activeTab === "overview" && (
        <div className="tabpanel">
          <div className="pie-row">
            <div className="real-card">
              <p className="section-label" style={{ margin: "0 0 4px" }}>
                הכנסה לפי חטיבה
              </p>
              <RevenueByDivisionPie divisions={data.divisions} spaUpgradesActual={data.spaUpgradesActual} />
            </div>
            <div className="real-card">
              <p className="section-label" style={{ margin: "0 0 4px" }}>
                הכנסה לפי סוג
              </p>
              <RevenueTypePie
                divisions={data.divisions}
                rapidCategories={data.rapidCategories}
                spaUpgradesActual={data.spaUpgradesActual}
              />
            </div>
          </div>

          <OverviewKadavTable
            divisions={data.divisions}
            targets={data.targets}
            rapidCategories={data.rapidCategories}
            spaUpgradesActual={data.spaUpgradesActual}
            companyTargets={data.companyTargets}
            daysElapsed={data.daysElapsed}
            daysInMonth={data.daysInMonth}
            workDaysElapsed={data.workDaysElapsed}
            workDaysInMonth={data.workDaysInMonth}
          />
          <RapidCategoryBreakdown categories={data.rapidCategories} />
        </div>
      )}

      {activeGroup === "kadav" &&
        DIVISIONS.map(
          (division) =>
            activeTab === division && (
              <div className="tabpanel" key={division}>
                <div className="div-head">
                  <div className="name-row">
                    <h2>{DIVISION_LABELS[division]}</h2>
                  </div>
                  <span className="segment">{DIVISION_SEGMENT[division]} — כל המקורות יחד</span>
                </div>
                <DivisionRealCard
                  metrics={data.divisions[division]}
                  reasons={data.invalidReasons[division]}
                  asOf={data.asOf}
                  targets={data.targets[division]}
                  rapidActuals={data.rapidActuals[division]}
                  spaUpgradesActual={data.spaUpgradesActual[division]}
                  daysElapsed={data.daysElapsed}
                  daysInMonth={data.daysInMonth}
                  workDaysElapsed={data.workDaysElapsed}
                  workDaysInMonth={data.workDaysInMonth}
                />

                <div className="real-card">
                  <div className="real-head">
                    <div className="real-title">
                      <h2>טבלה מפורטת — כמו באקסל</h2>
                      <span className="real-badge">✓ נתון חי</span>
                    </div>
                  </div>
                  <DivisionDetailTable
                    metrics={data.divisions[division]}
                    targets={data.targets[division]}
                    rapidActuals={data.rapidActuals[division]}
                    spaUpgradesActual={data.spaUpgradesActual[division]}
                    daysElapsed={data.daysElapsed}
                    daysInMonth={data.daysInMonth}
                    workDaysElapsed={data.workDaysElapsed}
                    workDaysInMonth={data.workDaysInMonth}
                  />
                  <p className="real-note">
                    מתחשב הכל אוטומטית מ-Zoho וראפיד, חוץ מ<strong style={{ color: "var(--ink)" }}>תקציב ממומן בפועל</strong>{" "}
                    (מוזן ישירות). <strong style={{ color: "var(--ink)" }}>ירוקים (הפניות)</strong> מיובאים אוטומטית
                    מדוח ראפיד, אך כלל-חברתי בלבד (לא מחולק לפי חטיבה) — ר&apos; מבט כללי.
                  </p>
                </div>
              </div>
            )
        )}

      {activeGroup === "leads" && <LeadsByDateTab />}

      <footer>YAFA MAXIMOV — מעקב יעדים</footer>
    </div>
  );
}
