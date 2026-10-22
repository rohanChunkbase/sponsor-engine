import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[8px] border border-border bg-background px-3 text-[16px] leading-6 outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
