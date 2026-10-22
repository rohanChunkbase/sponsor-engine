import { Badge } from "@/components/ui/badge";
import { raftAssets } from "@sponsor-engine/brand";
import { isDryRun } from "@sponsor-engine/core";
import Link from "next/link";

const links = [
  ["/", "Inbox"],
  ["/quote", "Quote"],
  ["/sponsors", "Sponsors"],
  ["/outbox", "To send"],
  ["/activity", "Activity"],
  ["/map", "Map"],
  ["/connections", "Connections"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const testMode = isDryRun();
  return (
    <div className="min-h-screen">
      <header className="bg-discovery text-hero-copy">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-8 gap-y-3 px-8 py-4">
          <Link href="/" className="flex items-center gap-2 font-sans text-[22px] leading-8 tracking-[-0.025em] text-hero-copy">
            <img src={`/brand/${raftAssets.mark}`} alt="" width={36} height={36} className="h-9 w-9 rounded-full bg-raft-cream" />
            Sponsor Engine
          </Link>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-ui text-[16px] leading-6">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="text-hero-copy">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <Badge tone="test" dot>
              {testMode ? "Test mode" : "Live"}
            </Badge>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1120px] flex-col gap-8 px-8 py-12">{children}</main>
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
