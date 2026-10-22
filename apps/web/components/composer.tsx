"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RunDemo } from "@/components/run-demo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setNote(null);
    const response = await fetch("/api/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, channel: "web" }),
    });
    const data = (await response.json()) as { ok?: boolean; suggested_reply?: string; error?: string };
    setPending(false);
    setNote(data.suggested_reply || data.error || "Saved.");
    setMessage("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={message}
        placeholder="Paste a WhatsApp message about a booking."
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || message.trim().length === 0} onClick={submit}>
          {pending ? "Reading…" : "Read this message"}
        </Button>
        <RunDemo />
      </div>
      {note ? <p className="text-[16px] leading-6 text-muted-foreground">{note}</p> : null}
    </div>
  );
}
