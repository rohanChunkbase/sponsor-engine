import Link from "next/link";
import { AskRaft } from "@/components/ask-raft";
import { MainFrame } from "@/components/main-frame";
import { OfflineBanner } from "@/components/offline-banner";
import { Sidebar } from "@/components/sidebar";
import { isDemoMode, isDryRun } from "@sponsor-engine/core";

export function Shell({ children }: { children: React.ReactNode }) {
  const testMode = isDemoMode() || isDryRun();
  return (
    <div className="raft-bg flex h-screen flex-col overflow-hidden text-raft-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-raft-line/70 bg-raft-cream/80 px-5 backdrop-blur">
        <Link href="/" className="flex items-center gap-2.5 font-ui text-[15px] font-semibold tracking-[-0.01em] text-raft-ink">
          <img src="/raft/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full bg-white ring-1 ring-raft-line" />
          Raft
          <span className="font-normal text-raft-muted">Sponsor Engine</span>
        </Link>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-raft-orange/40 bg-raft-orange/10 px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.06em] text-[#9a5512]">
            <span className="h-1.5 w-1.5 rounded-full bg-raft-orange" />
            {testMode ? "TEST MODE" : "LIVE"}
          </span>
        </div>
      </header>
      <OfflineBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <MainFrame>{children}</MainFrame>
          </main>
          <AskRaft testMode={testMode} />
        </div>
      </div>
    </div>
  );
}

export function PageIntro({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[12px] leading-4 tracking-[0.08em] text-muted-foreground uppercase">{kicker}</p>
      <h1 className="font-sans text-[36px] leading-[42px] font-medium tracking-[-0.025em]">{title}</h1>
      {children ? <div className="max-w-[720px] text-[18px] leading-[29px] text-muted-foreground">{children}</div> : null}
    </div>
  );
}