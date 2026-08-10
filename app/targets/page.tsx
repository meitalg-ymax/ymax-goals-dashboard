import Link from "next/link";

export default function TargetsPage() {
  return (
    <div className="wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">YAFA MAXIMOV</p>
          <h1>הזנת יעדים חודשיים</h1>
        </div>
        <Link className="source-chip" href="/">
          חזרה לדשבורד
        </Link>
      </header>
      <div className="missing-card">
        <div className="mc-text">
          <span className="mc-title">מסך הזנת היעדים בבנייה</span>
          <span className="mc-sub">
            טופס לפי חטיבה ובורר חודש, שיחליף את קובץ &quot;יעדים - טופס הזנה חודשי.xlsx&quot; — מתווסף בשלב הבא.
          </span>
        </div>
        <span className="missing-badge">⏳ בבנייה</span>
      </div>
    </div>
  );
}
