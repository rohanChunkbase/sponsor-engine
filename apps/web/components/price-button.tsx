"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PriceButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function price() {
    setPending(true);
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: requestId }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not price this booking.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Button disabled={pending} onClick={price}>{pending ? "Pricing…" : "Make the quote"}</Button>
      {error ? <p className="text-open-text">{error}</p> : null}
    </div>
  );
}
