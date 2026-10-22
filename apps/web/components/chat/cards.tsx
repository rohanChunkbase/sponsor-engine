"use client";

import { Check, ExternalLink, Pencil, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { money } from "@/lib/labels";

export type Qualified = {
  sender_name: string | null;
  organisation: string | null;
  requester_kind: string | null;
  event_date: string | null;
  headcount: number | null;
  needs: string[];
  venue_hint: string | null;
};

export type QuoteLines = {
  room_gbp: number;
  food_gbp?: number;
  expected_heads?: number;
  show_up_rate?: number;
  sponsor_ask_gbp?: number;
  hours?: number;
  company_room_gbp?: number;
  market_low_gbp?: number;
  market_high_gbp?: number;
  market_median_gbp?: number;
  market_band_low_gbp?: number;
  market_band_high_gbp?: number;
};

export type Quote = { price: number; range?: { low: number; high: number }; lines?: QuoteLines; requester_kind?: string; error?: string };

export type Sponsor = {
  sponsor_id: string;
  company: string;
  category: string | null;
  reasons: string[];
  sources: Array<{ url: string; event_name: string }>;
};

export type OutboxItem = {
  id: string;
  kind: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: string;
  sponsor_name?: string | null;
  ask_gbp?: number | null;
  blocked_reason: string | null;
};

export function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("raft-rise rounded-2xl border border-raft-line bg-white/90 p-5 shadow-[0_1px_2px_rgba(60,40,20,0.04),0_8px_24px_-12px_rgba(60,40,20,0.12)]", className)}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.08em] text-raft-muted uppercase">{children}</p>;
}

export function SummaryCard({ q, hours }: { q: Qualified; hours?: number }) {
  const rows: Array<[string, string]> = [
    ["Who", [q.organisation, q.sender_name].filter(Boolean).join(" · ") || "Not stated"],
    ["Size", q.headcount ? `${q.headcount} people` : "Not stated"],
    ["Date", q.event_date ? formatDate(q.event_date) : "Not stated"],
    ["Hours", hours ? `${hours} hours` : "Not stated"],
    ["Needs", q.needs.length ? q.needs.join(", ") : "Not stated"],
  ];
  return (
    <CardShell>
      <div className="flex items-center justify-between">
        <Label>Request</Label>
        {q.requester_kind ? <span className="rounded-full bg-raft-lavender/25 px-2 py-0.5 text-[12px] font-medium text-[#4b3a78] capitalize">{q.requester_kind}</span> : null}
      </div>
      <dl className="mt-3 grid grid-cols-[72px_1fr] gap-x-4 gap-y-2 text-[14px]">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-raft-muted">{key}</dt>
            <dd className="font-medium text-raft-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </CardShell>
  );
}

export function QuoteCard({ quote }: { quote: Quote }) {
  const lines = quote.lines;
  const low = lines?.market_band_low_gbp ?? 0;
  const high = lines?.market_band_high_gbp ?? Math.max(quote.price, 1);
  const span = Math.max(high - low, 1);
  const pos = (value: number) => `${Math.min(100, Math.max(0, ((value - low) / span) * 100))}%`;
  return (
    <CardShell>
      <Label>Quote</Label>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[34px] leading-none font-semibold tracking-[-0.03em] text-raft-ink">{money(quote.price)}</span>
        <span className="text-[14px] text-raft-muted">for the room</span>
      </div>
      {quote.range && quote.range.high > 0 ? (
        <p className="mt-1 text-[13px] text-raft-muted">
          {quote.range.low > 0 ? `Fair range from past bookings: ${money(quote.range.low)} to ${money(quote.range.high)}` : `Past bookings like this go up to ${money(quote.range.high)}`}
        </p>
      ) : null}
      {lines ? (
        <ul className="mt-4 divide-y divide-raft-line/70 text-[14px]">
          <Line label={`Room${lines.hours ? `, ${lines.hours} hours` : ""}`} value={money(lines.room_gbp)} />
          {lines.food_gbp != null ? <Line label={`Food for ${lines.expected_heads ?? "?"} expected people`} value={money(lines.food_gbp)} /> : null}
          {lines.sponsor_ask_gbp != null ? <Line label="Asked from a sponsor" value={`− ${money(lines.sponsor_ask_gbp)}`} muted /> : null}
          {lines.company_room_gbp != null ? <Line label="A company would pay" value={money(lines.company_room_gbp)} muted /> : null}
        </ul>
      ) : null}
      {lines?.market_low_gbp != null && lines.market_high_gbp != null ? (
        <div className="mt-5">
          <div className="flex justify-between text-[12px] text-raft-muted">
            <span>London market</span>
            <span>{money(lines.market_low_gbp)} to {money(lines.market_high_gbp)}</span>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-raft-line/60">
            <div
              className="absolute inset-y-0 rounded-full bg-raft-lavender/70"
              style={{ left: pos(lines.market_low_gbp), width: `calc(${pos(lines.market_high_gbp)} - ${pos(lines.market_low_gbp)})` }}
            />
            <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-raft-orange shadow" style={{ left: pos(quote.price) }} title={`This quote: ${money(quote.price)}`} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-raft-muted">
            <span>{money(low)}</span>
            <span className="text-raft-ink">● this quote</span>
            <span>{money(high)}</span>
          </div>
        </div>
      ) : null}
    </CardShell>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <li className={cn("flex justify-between py-2", muted && "text-raft-muted")}>
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const source = sponsor.sources[0];
  return (
    <CardShell className="p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-raft-cream text-[14px] font-semibold text-raft-chocolate ring-1 ring-raft-line">{sponsor.company.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-raft-ink">{sponsor.company}</p>
          {sponsor.category ? <p className="truncate text-[12px] text-raft-muted">{sponsor.category}</p> : null}
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-[13.5px] leading-5 text-raft-ink/90">{sponsor.reasons[0] ?? "Backs London events."}</p>
      {source?.url ? (
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-[12.5px] text-[#5b45a0] hover:underline">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{source.event_name || hostOf(source.url)}</span>
        </a>
      ) : (
        <p className="mt-3 text-[12.5px] text-raft-muted">No public source yet.</p>
      )}
    </CardShell>
  );
}

export function DraftCard({ item: initial, testMode }: { item: OutboxItem; testMode: boolean }) {
  const [item, setItem] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initial.body);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2800);
  };
  const blocked = item.status === "blocked" || item.status === "failed";
  const waiting = item.status === "awaiting_approval" || item.status === "draft" || item.status === "needs_contact";

  async function post(action: "approve" | "skip" | "edit", payload?: object) {
    setPending(true);
    setNote(null);
    try {
      const response = await fetch(`/api/outbox/${item.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload ?? { actor: "dashboard" }),
      });
      const data = (await response.json()) as { reason?: string; error?: string; status?: string; item?: OutboxItem };
      if (!response.ok && /no outbox item|not found/i.test(data.error ?? "")) {
        const local = action === "approve" ? "approved" : action === "skip" ? "blocked" : item.status;
        setItem({ ...item, status: local, body: action === "edit" ? body : item.body, blocked_reason: action === "skip" ? "Skipped." : item.blocked_reason });
        setEditing(false);
        showToast(action === "approve" ? (testMode ? "Approved (test mode, nothing is sent)" : "Approved") : action === "skip" ? "Skipped" : "Saved");
        return;
      }
      if (data.item) setItem(data.item);
      else if (response.ok && action === "skip") setItem({ ...item, status: "blocked", blocked_reason: "Skipped." });
      else if (response.ok && action === "approve") setItem({ ...item, status: data.status ?? "approved" });
      else if (response.ok && action === "edit") setItem({ ...item, body });
      setNote(data.error || data.reason || (response.ok ? "Done." : "Could not do that."));
      setEditing(false);
      window.dispatchEvent(new Event("raft:refresh"));
    } catch {
      setNote("You may be offline. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <CardShell>
      <div className="flex flex-wrap items-center gap-2">
        <Label>{item.kind === "chat_reply" ? "Reply draft" : item.kind === "sponsor_email" ? "Sponsor email" : "Draft"}</Label>
        <StatusPill status={item.status} />
        {item.ask_gbp ? <span className="text-[12px] text-raft-muted">{money(item.ask_gbp)}</span> : null}
      </div>
      <p className="mt-2 text-[15px] font-semibold text-raft-ink">{item.subject}</p>
      <p className="text-[12.5px] text-raft-muted">{item.recipient ? `To ${item.recipient}` : "No contact yet"}</p>
      {editing ? (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-3 min-h-40 w-full rounded-xl border border-raft-line bg-raft-cream/40 p-3 text-[13.5px] leading-5 outline-none focus:border-raft-lavender"
        />
      ) : (
        <p className="mt-3 line-clamp-4 rounded-xl bg-raft-cream/60 p-3 text-[13.5px] leading-5 whitespace-pre-line text-raft-ink/90">{item.body}</p>
      )}
      {blocked && item.blocked_reason ? (
        <p className="mt-3 inline-flex items-start gap-1.5 rounded-full bg-[#fdecec] px-3 py-1 text-[12.5px] text-[#9b2c2c]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {item.blocked_reason}
        </p>
      ) : null}
      {waiting ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {editing ? (
            <button type="button" disabled={pending} onClick={() => post("edit", { body, actor: "dashboard" })} className={btn("primary")}>
              <Check className="h-4 w-4" /> Save
            </button>
          ) : item.status === "needs_contact" ? (
            <span className="text-[13px] text-raft-muted">Find a contact before you approve.</span>
          ) : (
            <button type="button" disabled={pending} onClick={() => post("approve")} className={btn("primary")}>
              <Check className="h-4 w-4" /> Approve
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => setEditing((open) => !open)} className={btn("secondary")}>
            <Pencil className="h-4 w-4" /> {editing ? "Cancel" : "Edit"}
          </button>
          <button type="button" disabled={pending} onClick={() => post("skip")} className={btn("ghost")}>
            <X className="h-4 w-4" /> Skip
          </button>
          {testMode ? <span className="ml-auto text-[12px] text-raft-muted">Test mode, nothing is sent</span> : null}
        </div>
      ) : null}
      {note ? <p className="mt-3 text-[13px] text-raft-muted">{note}</p> : null}
      {toast && typeof document !== "undefined" ? createPortal(
        <div role="status" className="raft-rise fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-raft-chocolate px-4 py-2 text-[13.5px] text-raft-cream shadow-lg">
          {toast}
        </div>,
        document.body,
      ) : null}
    </CardShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    awaiting_approval: ["Waiting for you", "bg-raft-orange/15 text-[#9a5512]"],
    draft: ["Waiting for you", "bg-raft-orange/15 text-[#9a5512]"],
    needs_contact: ["Needs a contact", "bg-raft-orange/15 text-[#9a5512]"],
    approved: ["Approved", "bg-[#e7f3ec] text-[#2b6b4f]"],
    sent: ["Sent", "bg-[#e7f3ec] text-[#2b6b4f]"],
    blocked: ["Blocked", "bg-[#fdecec] text-[#9b2c2c]"],
    failed: ["Needs a person", "bg-[#fdecec] text-[#9b2c2c]"],
  };
  const [label, tone] = map[status] ?? [status, "bg-raft-line/60 text-raft-muted"];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-medium", tone)}>{label}</span>;
}

export function btn(kind: "primary" | "secondary" | "ghost") {
  return cn(
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13.5px] font-medium transition disabled:opacity-50",
    kind === "primary" && "bg-raft-chocolate text-raft-cream shadow-sm hover:bg-[#5a3d2a]",
    kind === "secondary" && "border border-raft-line bg-white text-raft-ink hover:border-raft-lavender",
    kind === "ghost" && "text-raft-muted hover:bg-raft-cream",
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
