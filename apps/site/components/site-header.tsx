import { githubUrl } from "@/lib/snippets";
import { raftAssets } from "@sponsor-engine/brand";

export function SiteHeader({ tone = "paper" }: { tone?: "paper" | "sky" }) {
  const onSky = tone === "sky";
  return (
    <div className={onSky ? undefined : "site-header-paper"}>
      <div className="wrap">
        <header className="site-nav">
          <a className="wordmark" href="/">
            <img src={`/brand/${raftAssets.wordmark}`} alt="" width={782} height={278} />
            <span className="sr-only">Raft. Sponsor Engine</span>
          </a>
          <nav aria-label="Site">
            <a href="/docs">Docs</a>
            <a href={githubUrl}>GitHub</a>
            {onSky ? (
              <a className="btn-paper" href="/#run">
                Run it tonight
              </a>
            ) : (
              <a className="btn-primary" href="/#run">
                Run it tonight
              </a>
            )}
          </nav>
        </header>
      </div>
    </div>
  );
}
