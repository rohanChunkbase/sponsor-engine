"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toolLabel } from "@/lib/labels";

type Run = {
  id: string;
  tool: string;
  output_summary: string | null;
  status: string;
  started_at: string;
};

export function ActivityFeed({ initial }: { initial: Run[] }) {
  const [runs, setRuns] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch("/api/activity");
      if (!response.ok) return;
      setRuns((await response.json()) as Run[]);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  if (runs.length === 0) {
    return <p className="text-[18px] leading-[29px] text-muted-foreground">Nothing has happened yet. Run the demo from the inbox.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={run.status === "error" ? "open" : "review"} dot>
              {run.status === "error" ? "Needs a look" : "Done"}
            </Badge>
            <span className="font-sans text-[16px] leading-6 font-medium">{toolLabel(run.tool)}</span>
            <time className="ml-auto font-mono text-[12px] text-muted-foreground">{run.started_at.slice(11, 19)}</time>
          </div>
          <p className="text-[16px] leading-6 text-muted-foreground">{run.output_summary}</p>
        </li>
      ))}
    </ol>
  );
}
