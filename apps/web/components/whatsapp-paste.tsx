"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function WhatsAppPaste() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setNote(null);
    const response = await fetch("/api/inbound/whatsapp", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: text,
    });
    const data = (await response.json()) as { count?: number; error?: string; sent?: boolean };
    setPending(false);
    if (!response.ok || data.error) {
      setNote(data.error || "The chat could not be read.");
      return;
    }
    const count = data.count ?? 0;
    setNote(count === 1 ? "Saved 1 message. Nothing was sent." : `Saved ${count} messages. Nothing was sent.`);
    setText("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={text}
        placeholder={"[26/11/2026, 18:04] Ada Fernwood: Can we book the room for 80 people?"}
        onChange={(event) => setText(event.target.value)}
      />
      <Button disabled={pending || text.trim().length === 0} onClick={submit}>
        {pending ? "Reading…" : "Read this chat"}
      </Button>
      {note ? <p className="text-[16px] leading-6 text-muted-foreground">{note}</p> : null}
    </div>
  );
}
