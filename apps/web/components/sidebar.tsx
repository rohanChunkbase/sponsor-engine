"use client";

import { Bot, Calendar, Inbox, Plug, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="hidden w-[220px] shrink-0 border-r border-raft-line/70 md:block" />}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const [needs, setNeeds] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/requests", { cache: "no-store" });
      const data = (await response.json()) as { queue?: { items: unknown[] } };
      setNeeds(data.queue?.items.length ?? 0);
    } catch {
      setNeeds(0);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("raft:refresh", load);
    return () => window.removeEventListener("raft:refresh", load);
  }, [load]);

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-raft-line/70 bg-white/40 md:flex">
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 p-3 text-[13.5px]">
        <NavLink href="/" icon={<Inbox className="h-4 w-4" />} label="Needs you" count={needs} active={pathname === "/"} />
        <NavLink href="/requests" icon={<Calendar className="h-4 w-4" />} label="Requests" active={pathname === "/requests"} />
        <NavLink href="/sponsors" icon={<Users className="h-4 w-4" />} label="Sponsors" active={pathname === "/sponsors"} />
        <NavLink href="/bots" icon={<Bot className="h-4 w-4" />} label="Bots" active={pathname === "/bots"} />
        <NavLink href="/recap" icon={<Calendar className="h-4 w-4" />} label="Recap" active={pathname.startsWith("/recap")} />
        <NavLink href="/connections" icon={<Plug className="h-4 w-4" />} label="Connections" active={pathname === "/connections"} />
        <div className="mt-auto">
          <NavLink href="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" active={pathname === "/settings"} />
        </div>
      </nav>
    </aside>
  );
}

function NavLink({ href, icon, label, count, active }: { href: string; icon: React.ReactNode; label: string; count?: number; active?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-raft-ink transition hover:bg-white", active && "bg-white shadow-sm ring-1 ring-raft-line")}>
      <span className="text-raft-chocolate">{icon}</span>
      {label}
      {count ? <span className="ml-auto rounded-full bg-raft-cream px-1.5 text-[11px] font-medium text-raft-chocolate">{count}</span> : null}
    </Link>
  );
}
