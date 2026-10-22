import { DocsNav } from "@/components/docs-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <div className="wrap docs-shell">
          <DocsNav />
          <article className="docs-prose">{children}</article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
