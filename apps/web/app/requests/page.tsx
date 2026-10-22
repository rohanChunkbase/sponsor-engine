"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";

type Row = {
  id: string;
  organisation: string | null;
  sender_name: string | null;
  headcount: number | null;
  event_date: string | null;
  raw_message: string;
};

export default function RequestsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/requests", { cache: "no-store" });
    const data = (await response.json()) as { requests: Row[] };
    setRows(data.requests ?? []);
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("raft:refresh", load);
    return () => window.removeEventListener("raft:refresh", load);
  }, [load]);

  return (
    <>
      <h1 className="text-[28px] font-medium tracking-[-0.025em]">Requests</h1>
      {!rows?.length ? (
        <p className="text-[16px] text-raft-muted">No requests yet. Ask Raft from the bar below.</p>
      ) : (
        <ul className="flex max-w-[720px] flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpen(row)}
                className="flex w-full items-center justify-between rounded-2xl border border-raft-line bg-white/90 px-4 py-3 text-left"
              >
                <span className="truncate font-medium">{row.organisation || row.sender_name || "Unknown sender"}</span>
                <span className="text-[13px] text-raft-muted">
                  {[row.headcount ? `${row.headcount} people` : null, row.event_date].filter(Boolean).join(" · ") || "Open"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <Sheet title={open.organisation || "Request"} onClose={() => setOpen(null)}>
          <p className="whitespace-pre-wrap text-[15px] leading-6">{open.raw_message}</p>
          <Link href="/" className="mt-4 inline-block text-[13px] text-raft-chocolate underline">
            Back to Needs you
          </Link>
        </Sheet>
      ) : null}
    </>
  );
}
