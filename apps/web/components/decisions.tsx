"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Decisions({ id, body }: { id: string; body: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function post(action: "approve" | "skip" | "edit", payload?: object) {
    setPending(true);
    setNote(null);
    const response = await fetch(`/api/outbox/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? { actor: "dashboard" }),
    });
    const data = (await response.json()) as { reason?: string; error?: string };
    setNote(data.reason || data.error || "Done.");
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} onClick={() => post("approve")}>
          <Check data-icon="inline-start" />
          Approve
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => setEditing((open) => !open)}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => post("skip")}>
          <X data-icon="inline-start" />
          Skip
        </Button>
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div>
            <Button variant="secondary" disabled={pending} onClick={() => post("edit", { body: draft, actor: "dashboard" })}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
      {note ? <p className="text-[16px] leading-6 text-muted-foreground">{note}</p> : null}
    </div>
  );
}
