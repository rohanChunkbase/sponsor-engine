"use client";

import { ArrowUp, Check, ChevronDown, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/labels";
import { CardShell, DraftCard, QuoteCard, SponsorCard, SummaryCard, btn, type OutboxItem, type Qualified, type Quote, type Sponsor } from "./cards";

type RunResult = {
  request_id?: string;
  triage: { ok: boolean; qualified?: Qualified; outbox?: OutboxItem | null; failure?: { message: string } };
  quote?: Quote | null;
  sponsors?: { matches: Sponsor[]; live_note?: string };
  draft?: { outbox?: OutboxItem; ask_gbp?: number; error?: string } | null;
  repeat?: { outbox?: OutboxItem } | null;
};

type StepState = "pending" | "running" | "done";
type Step = { label: string; detail?: string; state: StepState };

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "run"; steps: Step[]; result?: RunResult; error?: string; retry?: () => void }
  | { id: string; role: "assistant"; kind: "drafts"; text: string; items: OutboxItem[] }
  | { id: string; role: "assistant"; kind: "sponsors"; text: string; sponsors: Sponsor[] }
  | { id: string; role: "assistant"; kind: "loading" };

const STEP_LABELS = ["Reading request", "Checking for spam", "Pricing", "Matching sponsors", "Drafting"];
const SUGGESTIONS = ["Run the Unicorn Mafia demo", "What food sponsors fit this hackathon?", "Show drafts waiting for me"];
const CAPABILITIES =
  "I can read a booking message from WhatsApp, email or Slack, price the room, match London sponsors with sources, and draft emails that wait for your approval. I cannot answer that question yet. Paste a booking message, or try the Unicorn Mafia demo.";

let counter = 0;
const nextId = () => `m${++counter}`;

export function Chat({ testMode }: { testMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const requestId = params.get("request");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const lastSponsors = useRef<Sponsor[] | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const reset = () => {
      setMessages([]);
      lastSponsors.current = null;
    };
    window.addEventListener("raft:new-chat", reset);
    return () => window.removeEventListener("raft:new-chat", reset);
  }, []);

  const patch = useCallback((id: string, update: (message: Message) => Message) => {
    setMessages((list) => list.map((message) => (message.id === id ? update(message) : message)));
  }, []);

  useEffect(() => {
    if (!requestId) return;
    const id = nextId();
    setMessages([{ id, role: "assistant", kind: "loading" }]);
    fetch("/api/requests", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { requests: Array<Record<string, unknown>> }) => {
        const row = data.requests.find((item) => item.id === requestId);
        if (!row) {
          setMessages([{ id, role: "assistant", kind: "text", text: "I could not find that request. It may have been cleared." }]);
          return;
        }
        const q: Qualified = {
          sender_name: (row.sender_name as string) ?? null,
          organisation: (row.organisation as string) ?? null,
          requester_kind: (row.requester_kind as string) ?? null,
          event_date: (row.event_date as string) ?? null,
          headcount: (row.headcount as number) ?? null,
          needs: (row.needs as string[]) ?? [],
          venue_hint: (row.venue_hint as string) ?? null,
        };
        const outbox = (row.outbox as OutboxItem[]) ?? [];
        setMessages([
          { id: nextId(), role: "user", text: String(row.raw_message ?? "") },
          {
            id,
            role: "assistant",
            kind: "run",
            steps: STEP_LABELS.map((label) => ({ label, state: "done" as const })),
            result: {
              request_id: requestId,
              triage: { ok: true, qualified: q, outbox: outbox.find((item) => item.kind === "chat_reply") ?? null },
              draft: { outbox: outbox.find((item) => item.kind === "sponsor_email") },
            },
          },
        ]);
      })
      .catch(() => setMessages([{ id, role: "assistant", kind: "text", text: "I could not load that request. Check your connection and try again." }]));
  }, [requestId]);

  async function run(text: string, endpoint: "/api/demo" | "/api/chat") {
    const id = nextId();
    const steps: Step[] = STEP_LABELS.map((label, index) => ({ label, state: index === 0 ? "running" : "pending" }));
    const attempt = () => run(text, endpoint);
    setMessages((list) => [...list, { id, role: "assistant", kind: "run", steps }]);

    let shown = 1;
    const ticker = setInterval(() => {
      shown = Math.min(shown + 1, STEP_LABELS.length);
      patch(id, (message) =>
        message.role === "assistant" && message.kind === "run" && !message.result && !message.error
          ? { ...message, steps: message.steps.map((step, index) => ({ ...step, state: index < shown - 1 ? "done" : index === shown - 1 ? "running" : "pending" })) }
          : message,
      );
    }, 520);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: endpoint === "/api/chat" ? JSON.stringify({ message: text }) : "{}",
      });
      const data = (await response.json()) as RunResult & { error?: string };
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, (STEP_LABELS.length - shown) * 520)));
      clearInterval(ticker);
      if (!response.ok || data.error) throw new Error(data.error || "Raft could not finish this message.");
      if (data.sponsors?.matches?.length) lastSponsors.current = data.sponsors.matches;
      patch(id, () => ({ id, role: "assistant", kind: "run", steps: describeSteps(data), result: data }));
      window.dispatchEvent(new Event("raft:refresh"));
      router.refresh();
    } catch (error) {
      clearInterval(ticker);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      patch(id, (message) => ({
        id,
        role: "assistant",
        kind: "run",
        steps: message.role === "assistant" && message.kind === "run" ? message.steps.map((step) => (step.state === "done" ? step : { ...step, state: "pending" })) : [],
        error: offline ? "You are offline. Nothing was saved." : error instanceof Error ? error.message : "Something went wrong.",
        retry: () => {
          setMessages((list) => list.filter((item) => item.id !== id));
          void attempt();
        },
      }));
    }
  }

  async function showDrafts() {
    const id = nextId();
    setMessages((list) => [...list, { id, role: "assistant", kind: "loading" }]);
    try {
      const response = await fetch("/api/requests", { cache: "no-store" });
      const data = (await response.json()) as { outbox: OutboxItem[] };
      const items = (data.outbox ?? []).filter((item) => item.status === "awaiting_approval" || item.status === "needs_contact" || item.status === "draft");
      patch(id, () =>
        items.length
          ? { id, role: "assistant", kind: "drafts", text: `${items.length} ${items.length === 1 ? "draft is" : "drafts are"} waiting for you. Nothing leaves without your approval.`, items: items.slice(0, 6) }
          : { id, role: "assistant", kind: "text", text: "Nothing is waiting for you. Paste a booking message and I will draft the replies." },
      );
    } catch {
      patch(id, () => ({ id, role: "assistant", kind: "text", text: "I could not load your drafts. Check your connection and try again." }));
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (requestId) router.replace("/");
    setInput("");
    setBusy(true);
    setMessages((list) => [...list, { id: nextId(), role: "user", text }]);
    try {
      if (text === SUGGESTIONS[0]) await run(text, "/api/demo");
      else if (text === SUGGESTIONS[2]) await showDrafts();
      else if (text === SUGGESTIONS[1]) {
        const sponsors = lastSponsors.current;
        setMessages((list) => [
          ...list,
          sponsors
            ? { id: nextId(), role: "assistant", kind: "sponsors", text: "These sponsors fit the last request. Each one links to the public page I used.", sponsors }
            : { id: nextId(), role: "assistant", kind: "text", text: "I need a request first. Run the Unicorn Mafia demo or paste the hackathon's message, and I will match food sponsors with sources." },
        ]);
      } else if (looksLikeQuestion(text)) {
        setMessages((list) => [...list, { id: nextId(), role: "assistant", kind: "text", text: CAPABILITIES }]);
      } else await run(text, "/api/chat");
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-[720px] flex-col items-center justify-center px-6 pb-10 text-center">
            <img src="/brand/raft-wave.webp" alt="Raft the otter waves." width={404} height={504} className="raft-rise h-28 w-auto drop-shadow-sm" />
            <h1 className="raft-rise mt-5 text-[26px] font-semibold tracking-[-0.02em] text-raft-ink">Hi, I am Raft.</h1>
            <p className="raft-rise mt-1.5 text-[16px] text-raft-muted">Paste a message from WhatsApp, email or Slack</p>
            <div className="raft-rise mt-7 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-raft-line bg-white/80 px-4 py-2 text-[13.5px] text-raft-ink shadow-sm transition hover:-translate-y-0.5 hover:border-raft-lavender hover:shadow"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-6 py-8">
            {messages.map((message) => (
              <MessageView key={message.id} message={message} testMode={testMode} />
            ))}
            <div ref={bottom} />
          </div>
        )}
      </div>
      <div className="shrink-0 px-6 pb-5">
        <form
          className="mx-auto flex max-w-[760px] items-end gap-2 rounded-2xl border border-raft-line bg-white p-2 pl-4 shadow-[0_8px_30px_-12px_rgba(60,40,20,0.18)] focus-within:border-raft-lavender"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Paste a booking message, or ask Raft…"
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] text-raft-ink outline-none placeholder:text-raft-muted/70"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-raft-chocolate text-raft-cream transition hover:bg-[#5a3d2a] disabled:bg-raft-line disabled:text-raft-muted"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-[760px] text-center text-[11.5px] text-raft-muted">Raft drafts. You approve. {testMode ? "Test mode, nothing is sent." : "Sends still need the allow list."}</p>
      </div>
    </div>
  );
}

function MessageView({ message, testMode }: { message: Message; testMode: boolean }) {
  if (message.role === "user") {
    return (
      <div className="raft-rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-raft-chocolate px-4 py-2.5 text-[14.5px] leading-6 whitespace-pre-line text-raft-cream shadow-sm">{message.text}</p>
      </div>
    );
  }
  return (
    <div className="raft-rise flex gap-3">
      <img src="/brand/raft-mark.webp" alt="" width={32} height={32} className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white ring-1 ring-raft-line" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">{assistantBody(message, testMode)}</div>
    </div>
  );
}

function assistantBody(message: Exclude<Message, { role: "user" }>, testMode: boolean) {
  if (message.kind === "loading") return <Skeleton />;
  if (message.kind === "text") return <p className="pt-1 text-[15px] leading-6 text-raft-ink">{message.text}</p>;
  if (message.kind === "drafts")
    return (
      <>
        <p className="pt-1 text-[15px] leading-6 text-raft-ink">{message.text}</p>
        {message.items.map((item) => (
          <DraftCard key={item.id} item={item} testMode={testMode} />
        ))}
      </>
    );
  if (message.kind === "sponsors")
    return (
      <>
        <p className="pt-1 text-[15px] leading-6 text-raft-ink">{message.text}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {message.sponsors.map((sponsor) => (
            <SponsorCard key={sponsor.sponsor_id} sponsor={sponsor} />
          ))}
        </div>
      </>
    );
  return <RunView message={message} testMode={testMode} />;
}

function RunView({ message, testMode }: { message: Extract<Message, { kind: "run" }>; testMode: boolean }) {
  const result = message.result;
  const working = !result && !message.error;
  const failed = result && !result.triage.ok;
  const drafts = result ? uniqueDrafts([result.triage.outbox, result.draft?.outbox, result.repeat?.outbox]) : [];
  return (
    <>
      <Steps steps={message.steps} working={working} />
      {working ? <Skeleton /> : null}
      {message.error ? (
        <CardShell className="border-[#f3caca] bg-[#fff8f7]">
          <p className="text-[14.5px] font-medium text-[#9b2c2c]">{message.error}</p>
          {message.retry ? (
            <button type="button" onClick={message.retry} className={cn(btn("secondary"), "mt-3")}>
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
          ) : null}
        </CardShell>
      ) : null}
      {failed ? (
        <p className="text-[15px] leading-6 text-raft-ink">
          I could not read this as a booking. {result.triage.failure?.message} I saved it under Could not read. Paste a message with a date and a headcount.
        </p>
      ) : null}
      {result && result.triage.ok && result.triage.qualified ? (
        <>
          <p className="text-[15px] leading-6 text-raft-ink">{intro(result)}</p>
          <SummaryCard q={result.triage.qualified} hours={result.quote?.lines?.hours} />
          {result.quote && !result.quote.error ? <QuoteCard quote={result.quote} /> : null}
          {result.quote?.error ? <p className="text-[14px] text-raft-muted">I could not price this yet: {result.quote.error}</p> : null}
          {result.sponsors?.matches?.length ? (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[11px] tracking-[0.08em] text-raft-muted uppercase">Sponsors</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {result.sponsors.matches.slice(0, 3).map((sponsor) => (
                  <SponsorCard key={sponsor.sponsor_id} sponsor={sponsor} />
                ))}
              </div>
            </div>
          ) : null}
          {drafts.map((item) => (
            <DraftCard key={item.id} item={item} testMode={testMode} />
          ))}
        </>
      ) : null}
    </>
  );
}

function Steps({ steps, working }: { steps: Step[]; working: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-raft-line/80 bg-white/60 p-1.5">
      {steps.map((step, index) => (
        <div key={step.label}>
          <button
            type="button"
            disabled={!step.detail}
            onClick={() => setOpen((value) => (value === index ? null : index))}
            className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13.5px] transition", step.detail && "hover:bg-raft-cream", step.state === "pending" && "opacity-45")}
          >
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", step.state === "done" ? "bg-raft-lavender/30 text-[#4b3a78]" : "bg-raft-line/60 text-raft-muted")}>
              {step.state === "done" ? <Check className="h-3 w-3" /> : step.state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            </span>
            <span className={cn("text-raft-ink", step.state === "running" && working && "animate-pulse")}>{step.label}</span>
            {step.detail ? (
              <>
                <span className="ml-1 truncate text-[12.5px] text-raft-muted">{open === index ? "" : step.detail}</span>
                <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-raft-muted transition", open === index && "rotate-180")} />
              </>
            ) : null}
          </button>
          {open === index && step.detail ? <p className="px-10 pb-2 text-[12.5px] leading-5 text-raft-muted">{step.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-raft-line/70 bg-white/60 p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-raft-line/70" />
      <div className="h-6 w-40 animate-pulse rounded bg-raft-line/70" />
      <div className="h-3 w-full animate-pulse rounded bg-raft-line/50" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-raft-line/50" />
    </div>
  );
}

function describeSteps(result: RunResult): Step[] {
  const q = result.triage.qualified;
  const ok = result.triage.ok;
  const matches = result.sponsors?.matches ?? [];
  const drafts = uniqueDrafts([result.triage.outbox, result.draft?.outbox, result.repeat?.outbox]);
  const blocked = drafts.filter((item) => item.status === "blocked").length;
  const details = [
    ok && q ? `${q.organisation ?? "Unknown sender"}, ${q.headcount ?? "?"} people, ${q.event_date ?? "no date"}` : result.triage.failure?.message,
    ok ? "Looks like a real booking request." : "Stopped here.",
    result.quote && !result.quote.error ? `${money(result.quote.price)} for the room` : ok ? "No price yet" : undefined,
    matches.length ? matches.map((match) => match.company).join(", ") : ok ? "No close matches" : undefined,
    drafts.length ? `${drafts.length} drafts${blocked ? `, ${blocked} blocked` : ""}, waiting for you` : ok ? "Nothing to draft" : undefined,
  ];
  return STEP_LABELS.map((label, index) => ({ label, detail: details[index], state: ok || index < 2 ? "done" : "pending" }));
}

function intro(result: RunResult) {
  const q = result.triage.qualified;
  const name = q?.organisation ?? "this sender";
  const price = result.quote && !result.quote.error ? ` The room is ${money(result.quote.price)}.` : "";
  return `I read the message from ${name}.${price} Here is what I found. Drafts wait for you, nothing is sent.`;
}

function uniqueDrafts(items: Array<OutboxItem | null | undefined>) {
  const seen = new Set<string>();
  return items.filter((item): item is OutboxItem => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function looksLikeQuestion(text: string) {
  const bookingWords = /\b(book|booking|people|guests|attendees|room|venue|hackathon|meetup|event|night)\b/i;
  const hasNumber = /\d/.test(text);
  return text.length < 140 && (!bookingWords.test(text) || !hasNumber);
}
