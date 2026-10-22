"use client";

import { useCallback, useEffect, useState } from "react";
import { btn } from "@/components/chat/cards";
import { Sheet } from "@/components/sheet";

type QueueItem = {
  id: string;
  action: "Approve" | "Answer" | "Fix";
  title: string;
  reason: string;
  outbox_id?: string;
  request_id?: string;
};

type Queue = { items: QueueItem[]; handling: number };

export function NeedsYou() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [open, setOpen] = useState<QueueItem | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/requests", { cache: "no-store" });
    const data = (await response.json()) as { queue?: Queue };
    setQueue(data.queue ?? { items: [], handling: 0 });
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("raft:refresh", load);
    return () => window.removeEventListener("raft:refresh", load);
  }, [load]);

  async function act(item: QueueItem) {
    setNote(null);
    if (item.action === "Approve" && item.outbox_id) {
      await fetch(`/api/outbox/${item.outbox_id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: "dashboard" }),
      });
      window.dispatchEvent(new Event("raft:refresh"));
      return;
    }
    setOpen(item);
  }

  if (!queue) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-6 py-10">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-16 animate-pulse rounded-2xl bg-white/70" />
        ))}
      </div>
    );
  }

  if (!queue.items.length) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[22px] font-medium tracking-[-0.02em] text-raft-ink">Nothing needs you.</p>
        <p className="mt-2 text-[16px] text-raft-muted">Raft is handling {queue.handling} request{queue.handling === 1 ? "" : "s"}.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-6 py-10">
      <h1 className="text-[28px] font-medium tracking-[-0.025em]">Needs you</h1>
      <ul className="flex flex-col gap-2">
        {queue.items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 rounded-2xl border border-raft-line bg-white/90 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-raft-ink">{item.title}</p>
              <p className="truncate text-[13px] text-raft-muted">{item.reason}</p>
            </div>
            <button type="button" onClick={() => void act(item)} className={btn("primary")}>
              {item.action}
            </button>
          </li>
        ))}
      </ul>
      {note ? <p className="text-[13px] text-raft-muted">{note}</p> : null}
      {open ? (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <p className="text-[15px] leading-6 text-raft-ink">{open.reason}</p>
          <p className="mt-4 text-[13px] text-raft-muted">Answer in Ask Raft at the bottom, or press ⌘K.</p>
        </Sheet>
      ) : null}
    </div>
  );
}
