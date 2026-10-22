"use client";

import { ChevronRight, FileText, Map, MessageSquarePlus, Plug, Activity, Calculator, Users, Server } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { loadConversations, type StoredConversation } from "@/lib/conversations";
import { cn } from "@/lib/utils";

export type SidebarRequest = {
  id: string;
  organisation: string | null;
  task_title: string | null;
  headcount: number | null;
  event_date: string | null;
  raw_message: string;
  created_at?: string;
};

type Failure = { id: string; message: string; raw_input: string | null };

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="hidden w-[264px] shrink-0 border-r border-raft-line/70 md:block" />}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("c");
  const [requests, setRequests] = useState<StoredConversation[] | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [drafts, setDrafts] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/requests", { cache: "no-store" });
      const data = (await response.json()) as { failures: Failure[]; outbox: Array<{ status: string }> };
      setFailures(data.failures ?? []);
      setDrafts((data.outbox ?? []).filter((item) => item.status === "awaiting_approval" || item.status === "needs_contact").length);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const local = () => setRequests(loadConversations());
    local();
    void load();
    window.addEventListener("raft:refresh", load);
    window.addEventListener("raft:conversations", local);
    window.addEventListener("storage", local);
    return () => {
      window.removeEventListener("raft:refresh", load);
      window.removeEventListener("raft:conversations", local);
      window.removeEventListener("storage", local);
    };
  }, [load]);

  const readable = requests ?? [];

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-raft-line/70 bg-white/40 md:flex">
      <div className="p-3">
        <Link
          href="/"
          onClick={() => window.dispatchEvent(new Event("raft:new-chat"))}
          className="flex items-center gap-2 rounded-xl border border-raft-line bg-white px-3 py-2 text-[14px] font-medium text-raft-ink shadow-sm transition hover:border-raft-lavender"
        >
          <MessageSquarePlus className="h-4 w-4 text-raft-chocolate" />
          New chat
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="px-2 pt-2 pb-1.5 font-mono text-[11px] tracking-[0.08em] text-raft-muted uppercase">Requests</p>
        {requests === null ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-9 animate-pulse rounded-lg bg-raft-line/50" />
            ))}
          </div>
        ) : readable.length === 0 ? (
          <p className="px-2 py-1 text-[13px] text-raft-muted">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {readable.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/?c=${row.id}`}
                  className={cn(
                    "block rounded-lg px-2 py-1.5 transition hover:bg-white",
                    active === row.id && pathname === "/" && "bg-white shadow-sm ring-1 ring-raft-line",
                  )}
                >
                  <span className="block truncate text-[13.5px] font-medium text-raft-ink">{row.title}</span>
                  <span className="block truncate text-[12px] text-raft-muted">{row.subtitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {failures.length > 0 ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-raft-muted hover:bg-white"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition", open && "rotate-90")} />
              Could not read ({failures.length})
            </button>
            {open ? (
              <ul className="mt-1 flex flex-col gap-1 pl-6">
                {failures.map((failure) => (
                  <li key={failure.id} className="text-[12px] leading-5 text-raft-muted">
                    <span className="block truncate">{failure.raw_input || "Empty message"}</span>
                    <span className="block truncate text-[11.5px] opacity-80">{failure.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <nav className="flex flex-col gap-0.5 border-t border-raft-line/70 p-3 text-[13.5px]">
        <NavLink href="/outbox" icon={<FileText className="h-4 w-4" />} label="Drafts" count={drafts} active={pathname === "/outbox"} />
        <NavLink href="/connections" icon={<Plug className="h-4 w-4" />} label="Connections" active={pathname === "/connections"} />
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-raft-muted hover:bg-white">
            <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
            More
          </summary>
          <div className="flex flex-col gap-0.5 pl-2">
            <NavLink href="/quote" icon={<Calculator className="h-4 w-4" />} label="Quote" active={pathname === "/quote"} />
            <NavLink href="/sponsors" icon={<Users className="h-4 w-4" />} label="Sponsors" active={pathname === "/sponsors"} />
            <NavLink href="/activity" icon={<Activity className="h-4 w-4" />} label="Activity" active={pathname === "/activity"} />
            <NavLink href="/map" icon={<Map className="h-4 w-4" />} label="Map" active={pathname === "/map"} />
            <NavLink href="/mcp" icon={<Server className="h-4 w-4" />} label="MCP" active={pathname === "/mcp"} />
          </div>
        </details>
      </nav>
    </aside>
  );
}

function NavLink({ href, icon, label, count, active }: { href: string; icon: React.ReactNode; label: string; count?: number; active?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-raft-ink transition hover:bg-white", active && "bg-white shadow-sm ring-1 ring-raft-line")}>
      <span className="text-raft-chocolate">{icon}</span>
      {label}
      {count ? <span className="ml-auto rounded-full bg-raft-lavender/30 px-1.5 text-[11px] font-medium text-[#4b3a78]">{count}</span> : null}
    </Link>
  );
}
