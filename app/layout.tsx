import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מעקב יעדים — YAFA MAXIMOV",
  description: "דשבורד יעדים חי, מחובר ל-Zoho CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
