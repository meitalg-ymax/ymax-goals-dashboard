"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabbar, type TabDef } from "@/components/tabs/Tabbar";
import { SignOutButton } from "@/components/SignOutButton";

const TABS: TabDef[] = [
  { id: "overview", label: "כללי" },
  { id: "ymax", label: "ymax" },
  { id: "body", label: "body" },
  { id: "tech", label: "tech" },
  { id: "doctor", label: "doctor" },
];

const DIVISION_SEGMENT: Record<string, string> = {
  ymax: "הסרת שיער פנים",
  body: "הסרת שיער בגוף",
  tech: "אנטי אייג׳ינג, מירה דריי, פיגמנטציה ועוד",
  doctor: "הזרקות",
};

export function DashboardShell() {
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

      {activeTab === "overview" && (
        <div className="tabpanel">
          <div className="missing-card">
            <div className="mc-text">
              <span className="mc-title">הדשבורד החי בהקמה</span>
              <span className="mc-sub">
                השלד באוויר. חיבור ה-Zoho החי, מסך היעדים ומסך הראפיד מתווספים בשלבים הבאים.
              </span>
            </div>
            <span className="missing-badge">⏳ בבנייה</span>
          </div>
        </div>
      )}

      {Object.keys(DIVISION_SEGMENT).map(
        (division) =>
          activeTab === division && (
            <div className="tabpanel" key={division}>
              <div className="div-head">
                <div className="name-row">
                  <h2>{division}</h2>
                </div>
                <span className="segment">{DIVISION_SEGMENT[division]} — כל המקורות יחד</span>
              </div>
              <div className="missing-card">
                <div className="mc-text">
                  <span className="mc-title">חסר נתון — טרם חובר לדשבורד החי</span>
                  <span className="mc-sub">
                    נתוני Zoho, יעדים וקד&quot;ב לחטיבה זו יתווספו בשלבים הבאים של הבנייה.
                  </span>
                </div>
                <span className="missing-badge">⏳ בבנייה</span>
              </div>
            </div>
          )
      )}

      <footer>YAFA MAXIMOV — מעקב יעדים</footer>
    </div>
  );
}
