"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DraftButton({ requestId, sponsorId, label }: { requestId: string; sponsorId?: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setPending(true);
    const response = await fetch("/api/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: requestId, sponsor_id: sponsorId }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not write the email.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" disabled={pending || !sponsorId} onClick={draft}>{pending ? "Writing…" : label}</Button>
      {error ? <p className="text-open-text">{error}</p> : null}
    </div>
  );
}
