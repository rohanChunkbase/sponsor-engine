import Link from "next/link";
import { Composer } from "@/components/composer";
import { Decisions } from "@/components/decisions";
import { PageIntro } from "@/components/shell";
import { RunDemo } from "@/components/run-demo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { kindLabel, kindOfMessage, priorityLabel, waitingLabel } from "@/lib/labels";
import { inbox } from "@sponsor-engine/core";
import { getReadyDb } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const data = inbox(getReadyDb());
  const empty = data.requests.length === 0;

  return (
    <>
      <PageIntro kicker="Inbox" title="Messages">
        A booking message becomes a task with an owner. You approve anything that would leave the building.
      </PageIntro>

      {empty ? (
        <Card className="bg-surface">
          <CardHeader>
            <CardTitle>No messages yet</CardTitle>
            <CardDescription>
              London events and sponsors are already loaded. {data.counts.sponsors} sponsors, {data.counts.events} events, and {data.counts.bookings} past bookings are on this computer. Nothing is sent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RunDemo primary label="Run demo" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{empty ? "Or paste a message" : "New message"}</CardTitle>
          <CardDescription>Paste a note from WhatsApp, email, or a form. We read it and wait for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <Composer />
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_336px]">
        <section className="flex flex-col gap-3">
          {data.requests.map((row) => {
            const request = row as unknown as RequestCard;
            const waiting = (request.outbox || []).filter((item) => item.status === "awaiting_approval" || item.status === "draft");
            return (
              <Card key={String(request.id)}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={request.priority === "p0" ? "open" : request.priority === "p1" ? "info" : "neutral"} dot>
                      {priorityLabel(request.priority)}
                    </Badge>
                    <Badge tone="neutral">{kindLabel(request.requester_kind)}</Badge>
                    {String(request.raw_message || "").includes("SAMPLE") || String(request.organisation || "").includes("SAMPLE") ? <Badge tone="open">Sample</Badge> : null}
                    <span className="text-[16px] leading-6 text-muted-foreground">{request.owner || "Front desk"}</span>
                  </div>
                  <CardTitle className="text-[24px]">{request.task_title || "Message"}</CardTitle>
                  <CardDescription>{request.organisation || "Unknown sender"}{request.headcount ? ` · ${request.headcount} people` : ""}{request.event_date ? ` · ${request.event_date}` : ""}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-[16px] leading-6">{request.raw_message}</p>
                  {request.suggested_reply ? <p className="text-[16px] leading-6 text-muted-foreground">{request.suggested_reply}</p> : null}
                  <div className="flex flex-wrap gap-4 text-[16px] leading-6">
                    <Link className="text-primary" href={`/quote?request=${request.id}`}>See the quote</Link>
                    <Link className="text-primary" href={`/sponsors?request=${request.id}`}>See sponsors</Link>
                  </div>
                  {waiting.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-[12px] bg-surface p-4">
                      <p className="font-medium">{kindOfMessage(item.kind)} · {waitingLabel(item.status, item.blocked_reason)}</p>
                      <Decisions id={item.id} body={item.body} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </section>
        <aside className="flex flex-col gap-3">
          <h2 className="font-sans text-[24px] leading-[30px] font-medium tracking-[-0.025em]">Could not read</h2>
          {data.failures.length === 0 ? (
            <p className="text-[16px] leading-6 text-muted-foreground">Nothing failed. If a message cannot be read, it shows up here.</p>
          ) : (
            data.failures.map((failure) => {
              const row = failure as { id: string; message: string; raw_input: string | null };
              return (
                <Card key={row.id} className="bg-open-wash">
                  <CardHeader>
                    <CardTitle className="text-[18px] leading-6">{row.message}</CardTitle>
                    <CardDescription className="text-open-text">{row.raw_input}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </aside>
      </div>
    </>
  );
}

type RequestCard = {
  id: string;
  raw_message: string;
  organisation: string | null;
  requester_kind: string | null;
  headcount: number | null;
  event_date: string | null;
  suggested_reply: string | null;
  task_title: string | null;
  owner: string | null;
  priority: string | null;
  outbox: Array<{ id: string; kind: string; status: string; body: string; blocked_reason: string | null }>;
};
