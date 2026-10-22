"use client";

import { usePathname } from "next/navigation";

export function MainFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-8 py-10">{children}</div>;
}
