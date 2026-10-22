import { githubUrl, licenseUrl } from "@/lib/snippets";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p className="footer-meta">Sponsor Engine</p>
        <nav aria-label="Footer">
          <a href="/docs">Docs</a>
          <a href="/docs/safety">Safety</a>
          <a href={githubUrl}>GitHub</a>
          <a href={licenseUrl}>MIT License</a>
        </nav>
      </div>
    </footer>
  );
}
