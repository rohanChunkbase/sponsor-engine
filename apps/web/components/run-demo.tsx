"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/labels";

type DemoResult = {
  request_id: string;
  quote: { price: number };
  sponsors: { matches: Array<{ company: string }> };
  error?: string;
};

export function RunDemo({ primary = false, label = "Run demo" }: { primary?: boolean; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/demo", { method: "POST" });
    const data = (await response.json()) as DemoResult;
    setPending(false);
    if (!response.ok || data.error) {
      setError(data.error || "The demo could not run.");
      return;
    }
    setResult(data);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <Button variant={primary ? "default" : "secondary"} disabled={pending} onClick={run}>
        {pending ? "Working…" : label}
      </Button>
      {error ? <p className="text-[16px] leading-6 text-open-text">{error}</p> : null}
      {result ? (
        <div className="flex flex-col gap-2 text-[16px] leading-6">
          <p>The quote is {money(result.quote.price)}.</p>
          <p>Sponsor matches: {result.sponsors.matches.map((match) => match.company).join(", ")}.</p>
          <p>The email is waiting for you. Nothing was sent.</p>
          <a className="text-primary" href={`/sponsors?request=${result.request_id}`}>
            See the sponsors
          </a>
        </div>
      ) : null}
    </div>
  );
}
