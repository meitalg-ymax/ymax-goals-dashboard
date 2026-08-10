import Link from "next/link";

export default function RapidPage() {
  return (
    <div className="wrap">
      <header className="page-head">
        <div>
          <p className="eyebrow">YAFA MAXIMOV</p>
          <h1>הזנת נתוני ראפיד (ספה / שדרוגים / ירוקים)</h1>
        </div>
        <Link className="source-chip" href="/">
          חזרה לדשבורד
        </Link>
      </header>
      <div className="missing-card">
        <div className="mc-text">
          <span className="mc-title">מסך הזנת ראפיד בבנייה</span>
          <span className="mc-sub">
            הכנסות שלא עוברות דרך ליד ב-CRM (ספה, שדרוגים, ירוקים) — הזנה ידנית לפי מה שראפיד מציג, מתווספת בשלב הבא.
          </span>
        </div>
        <span className="missing-badge">⏳ בבנייה</span>
      </div>
    </div>
  );
}
