"use client";

import { docsNav } from "@/lib/snippets";
import { usePathname } from "next/navigation";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {docsNav.map((item) => (
        <a key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
