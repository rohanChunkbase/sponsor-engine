"use client";

import { usePathname } from "next/navigation";

export type DocsNavGroup = {
  label: string;
  pages: { href: string; label: string }[];
};

export function DocsNav({ groups }: { groups: DocsNavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {groups.map((group) => {
        const single = group.pages.length === 1 && group.pages[0]?.label === group.label;
        return (
          <div className="docs-nav-group" key={group.label}>
            {single ? null : <p className="docs-nav-label">{group.label}</p>}
            {group.pages.map((item) => (
              <a key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                {item.label}
              </a>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
