"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HistoryDrop() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(file: File) {
    setPending(true);
    setError(null);
    setNote(null);
    const csv = await file.text();
    const response = await fetch("/api/pricing/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = (await response.json()) as { error?: string; count?: number };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not read that file.");
      return;
    }
    setNote(`Loaded ${data.count ?? 0} bookings. The check has run again.`);
    router.refresh();
  }

  return (
    <label
      className="flex cursor-pointer flex-col gap-2 rounded-[12px] border border-dashed border-border px-4 py-6"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void send(file);
      }}
    >
      <span className="text-[18px] leading-7 font-medium">Drop a venue CSV</span>
      <span className="text-muted-foreground">
        Use the same columns as the sample file. A redacted venue export is enough. New quotes use this file.
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-[14px]"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
      {pending ? <span>Checking the file…</span> : null}
      {note ? <span>{note}</span> : null}
      {error ? <span className="text-open-text">{error}</span> : null}
    </label>
  );
}
