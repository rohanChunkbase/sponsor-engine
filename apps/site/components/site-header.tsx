import { githubUrl } from "@/lib/snippets";

export function SiteHeader({ tone = "paper" }: { tone?: "paper" | "sky" }) {
  const onSky = tone === "sky";
  return (
    <div className={onSky ? undefined : "site-header-paper"}>
      <div className="wrap">
        <header className="site-nav">
          <a className="wordmark" href="/">
            Sponsor Engine
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
