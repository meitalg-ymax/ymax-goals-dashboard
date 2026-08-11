"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabbar, type TabDef } from "@/components/tabs/Tabbar";
import { SignOutButton } from "@/components/SignOutButton";
import { DivisionRealCard } from "@/components/dashboard/DivisionRealCard";
import { DivisionDetailTable } from "@/components/dashboard/DivisionDetailTable";
import { OverviewKadavTable } from "@/components/dashboard/OverviewKadavTable";
import { RapidCategoryBreakdown } from "@/components/dashboard/RapidCategoryBreakdown";
import type { DashboardData } from "@/lib/dashboard/getDashboardData";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";

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
            הזנת נתונים ידניים
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
          <OverviewKadavTable
            divisions={data.divisions}
            targets={data.targets}
            rapidCategories={data.rapidCategories}
            daysElapsed={data.daysElapsed}
            daysInMonth={data.daysInMonth}
            workDaysElapsed={data.workDaysElapsed}
            workDaysInMonth={data.workDaysInMonth}
          />
          <RapidCategoryBreakdown categories={data.rapidCategories} />
        </div>
      )}

      {DIVISIONS.map(
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
                division={division}
                metrics={data.divisions[division]}
                reasons={data.invalidReasons[division]}
                asOf={data.asOf}
                targets={data.targets[division]}
                rapidActuals={data.rapidActuals[division]}
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
                  division={division}
                  metrics={data.divisions[division]}
                  targets={data.targets[division]}
                  rapidActuals={data.rapidActuals[division]}
                  rapidCategories={data.rapidCategories}
                  daysElapsed={data.daysElapsed}
                  daysInMonth={data.daysInMonth}
                  workDaysElapsed={data.workDaysElapsed}
                  workDaysInMonth={data.workDaysInMonth}
                />
                <p className="real-note">
                  מתחשב הכל אוטומטית מ-Zoho וראפיד, חוץ מ<strong style={{ color: "var(--ink)" }}>תקציב ממומן בפועל</strong>{" "}
                  שמוזן ידנית ב&quot;הזנת נתונים ידניים&quot;. <strong style={{ color: "var(--ink)" }}>ירוקים (הפניות)</strong>{" "}
                  מיובאים אוטומטית מדוח ראפיד, אך כלל-חברתי בלבד (לא מחולק לפי חטיבה) — ר&apos; מבט כללי.
                </p>
              </div>
            </div>
          )
      )}

      <footer>YAFA MAXIMOV — מעקב יעדים</footer>
    </div>
  );
}
