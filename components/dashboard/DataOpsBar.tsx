"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LastUpdated } from "@/lib/dashboard/getDashboardData";

function formatWhen(iso: string | null): string {
  if (!iso) return "מעולם לא";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const datePart = sameDay ? "היום" : d.toLocaleDateString("he-IL");
  const timePart = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function UploadButton({
  label,
  endpoint,
  busy,
  onStart,
  onDone,
}: {
  label: string;
  endpoint: string;
  busy: boolean;
  onStart: () => void;
  onDone: (result: { ok: boolean; text: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    onStart();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "שגיאה לא ידועה");
      onDone({ ok: true, text: `${label}: עודכן בהצלחה` });
    } catch (err) {
      onDone({ ok: false, text: `${label}: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="source-chip"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        📎 {label}
      </button>
    </>
  );
}

function ActionButton({
  label,
  busyLabel,
  endpoint,
  busy,
  onStart,
  onDone,
}: {
  label: string;
  busyLabel: string;
  endpoint: string;
  busy: boolean;
  onStart: () => void;
  onDone: (result: { ok: boolean; text: string }) => void;
}) {
  async function handleClick() {
    onStart();
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json();
      if (!res.ok || body.status === "error") throw new Error(body.error ?? "שגיאה לא ידועה");
      onDone({ ok: true, text: `${label}: עודכן בהצלחה` });
    } catch (err) {
      onDone({ ok: false, text: `${label}: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return (
    <button type="button" className="source-chip" disabled={busy} onClick={handleClick}>
      {busy ? busyLabel : label}
    </button>
  );
}

export function DataOpsBar({ lastUpdated }: { lastUpdated: LastUpdated }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleDone(result: { ok: boolean; text: string }) {
    setBusy(false);
    setMessage(result);
    if (result.ok) router.refresh();
  }

  return (
    <div className="data-ops-bar">
      <div className="data-ops-buttons">
        <UploadButton label="עדכון כסף ראפיד" endpoint="/api/import/rapid-sales" busy={busy} onStart={() => setBusy(true)} onDone={handleDone} />
        <UploadButton label="עדכון ירוקים" endpoint="/api/import/referrals" busy={busy} onStart={() => setBusy(true)} onDone={handleDone} />
        <ActionButton
          label="💰 עדכון תקציב שנוצל"
          busyLabel="מעדכן..."
          endpoint="/api/import/budget"
          busy={busy}
          onStart={() => setBusy(true)}
          onDone={handleDone}
        />
        <ActionButton
          label="🔄 רענון נתונים מ-Zoho"
          busyLabel="מעדכן..."
          endpoint="/api/zoho-refresh"
          busy={busy}
          onStart={() => setBusy(true)}
          onDone={handleDone}
        />
      </div>
      <div className="data-ops-status">
        <span>כסף ראפיד: {formatWhen(lastUpdated.rapidSales)}</span>
        <span>ירוקים: {formatWhen(lastUpdated.referrals)}</span>
        <span>תקציב: {formatWhen(lastUpdated.budget)}</span>
        <span>Zoho: {formatWhen(lastUpdated.zohoSync)}</span>
      </div>
      {message && (
        <p className={`data-ops-message ${message.ok ? "ok" : "error"}`}>{message.ok ? "✓" : "⚠"} {message.text}</p>
      )}
    </div>
  );
}
