import type { ReactNode } from "react";

export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="warning" role="note">
      {children}
    </p>
  );
}
