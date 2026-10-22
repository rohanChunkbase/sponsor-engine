"use client";

import { ArrowUp, Command, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BeforeAfterCard, CardShell, DraftCard, QuoteCard, SponsorCard, SummaryCard, btn, type DemoTiming, type OutboxItem, type Qualified, type Quote, type Sponsor } from "@/components/chat/cards";
import { cn } from "@/lib/utils";

type PlanStep = { tool: string; title: string };

type AskResult = {
  plan?: { steps: PlanStep[] };
  request_id?: string;
  triage?: { ok: boolean; qualified?: Qualified; outbox?: OutboxItem | null; failure?: { message: string } };
  quote?: Quote | null;
  sponsors?: { matches: Sponsor[] };
  draft?: { outbox?: OutboxItem; error?: string } | null;
  failures?: Array<{ id: string; message: string; raw_input?: string | null }>;
  recall?: unknown;
  undo?: { outbox_ids: string[] };
  error?: string;
  timing?: DemoTiming;
};

export function AskRaft({ testMode }: { testMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [undone, setUndone] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        queueMicrotask(() => field.current?.focus());
      }
      if (event.key === "Escape") close();
    };
    const openAsk = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("raft:ask", openAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("raft:ask", openAsk);
    };
  }, [close]);

  async function submit(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    setOpen(true);
    setUndone(false);
    setResult(null);
    setPlan([]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as AskResult;
      setPlan(data.plan?.steps ?? []);
      setResult(data);
      setInput("");
      window.dispatchEvent(new Event("raft:refresh"));
    } catch {
      setResult({ error: "You may be offline. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const ids = result?.undo?.outbox_ids ?? [];
    if (!ids.length) return;
    await fetch("/api/ask/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outbox_ids: ids }),
    });
    setUndone(true);
    window.dispatchEvent(new Event("raft:refresh"));
  }

  return (
    <>
      <div className="shrink-0 border-t border-raft-line/70 bg-raft-cream/90 px-4 py-3 backdrop-blur">
        <form
          className="mx-auto flex max-w-[720px] items-end gap-2 rounded-2xl border border-raft-line bg-white px-3 py-2 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            placeholder="Ask Raft…"
            className="min-h-[28px] flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-raft-muted"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] text-raft-muted sm:inline-flex"
          >
            <Command className="h-3 w-3" />K
          </button>
          <button type="submit" disabled={busy || !input.trim()} className={btn("primary")}>
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-raft-ink/20 p-4 sm:items-center" onClick={close}>
          <div
            className="flex max-h-[85vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-raft-line bg-raft-cream shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-raft-line/70 px-4 py-3">
              <p className="text-[15px] font-semibold">Ask Raft</p>
              <button type="button" onClick={close} className="rounded-lg p-1 text-raft-muted hover:bg-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {plan.length ? (
                <CardShell className="p-4">
                  <p className="font-mono text-[11px] tracking-[0.08em] text-raft-muted uppercase">Plan</p>
                  <ol className="mt-2 space-y-1 text-[14px]">
                    {plan.map((step, index) => (
                      <li key={`${step.tool}-${index}`}>
                        {index + 1}. {step.title}
                      </li>
                    ))}
                  </ol>
                </CardShell>
              ) : null}
              {busy ? <p className="text-[14px] text-raft-muted">Working…</p> : null}
              {result?.error ? <p className="text-[14px] text-[#9b2c2c]">{result.error}</p> : null}
              {result?.triage && !result.triage.ok ? (
                <p className="text-[14px] text-raft-ink">{result.triage.failure?.message ?? "Could not read that message."}</p>
              ) : null}
              {result?.timing ? <BeforeAfterCard timing={result.timing} /> : null}
              {result?.triage?.qualified ? <SummaryCard q={result.triage.qualified} /> : null}
              {result?.quote && !("error" in result.quote && result.quote.error) ? <QuoteCard quote={result.quote} /> : null}
              {result?.sponsors?.matches?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.sponsors.matches.slice(0, 3).map((sponsor) => (
                    <SponsorCard key={sponsor.sponsor_id} sponsor={sponsor} />
                  ))}
                </div>
              ) : null}
              {result?.draft?.outbox ? <DraftCard item={result.draft.outbox} testMode={testMode} /> : null}
              {result?.triage?.outbox ? <DraftCard item={result.triage.outbox} testMode={testMode} /> : null}
              {result?.failures?.length ? (
                <ul className="space-y-2 text-[14px] text-raft-muted">
                  {result.failures.map((failure) => (
                    <li key={failure.id}>{failure.raw_input || failure.message}</li>
                  ))}
                </ul>
              ) : null}
              {result && !busy ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={undone || !result.undo?.outbox_ids?.length}
                    onClick={() => void undo()}
                    className={btn("secondary")}
                  >
                    <Undo2 className="h-4 w-4" /> {undone ? "Undone" : "Undo"}
                  </button>
                  <span className="text-[12.5px] text-raft-muted">Undo skips drafts from this run. Nothing is sent.</span>
                </div>
              ) : null}
            </div>
            <form
              className="flex items-end gap-2 border-t border-raft-line/70 bg-white px-3 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <textarea
                ref={field}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                rows={2}
                placeholder="Paste a booking message, or ask in a sentence"
                className="flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none"
              />
              <button type="submit" disabled={busy || !input.trim()} className={cn(btn("primary"), "mb-1")}>
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
