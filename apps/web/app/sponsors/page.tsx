import Link from "next/link";
import { Decisions } from "@/components/decisions";
import { DraftButton } from "@/components/draft-button";
import { PageIntro } from "@/components/shell";
import { RunDemo } from "@/components/run-demo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { kindOfMessage, money, waitingLabel } from "@/lib/labels";
import { findSponsors } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const params = await searchParams;
  const requestId = params.request;
  if (!requestId) {
    return (
      <>
        <PageIntro kicker="Sponsors" title="No booking selected">
          Open a message first. We match sponsors from public London events and show the page we read.
        </PageIntro>
        <RunDemo primary />
      </>
    );
  }

  const db = await readyDb();
  const found = await findSponsors(db, { request_id: requestId, limit: 3, log: false });
  const emails = db.all<{ id: string; subject: string; body: string; status: string; sponsor_name: string | null; ask_gbp: number | null; blocked_reason: string | null; kind: string }>(
    "SELECT * FROM outbox WHERE request_id = ? AND kind = 'sponsor_email' ORDER BY created_at DESC",
    [requestId],
  );
  const [top, ...rest] = found.matches;

  return (
    <>
      <PageIntro kicker="Sponsors" title="Who might pay for food">
        {found.live_note} Each match has a reason and a link to the public page.
      </PageIntro>
      {!top ? <p className="text-[18px] leading-[29px]">No sponsor matched this booking.</p> : null}
      {found.similar_evidence.length > 0 ? (
        <Card className="bg-surface">
          <CardHeader>
            <CardTitle>Similar public events</CardTitle>
            <CardDescription>These names come from public sponsor claims on events like this one. Each line has the source page.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-[16px] leading-6">
            {found.similar_evidence.map((item) => (
              <p key={item.company}>
                {item.company}
                {item.similar_events.length ? ` — ${item.similar_events.slice(0, 2).join(", ")}` : ""}
                {item.source_urls[0] ? (
                  <>
                    {" "}
                    <a className="text-primary" href={item.source_urls[0]} target="_blank" rel="noreferrer">{item.source_urls[0]}</a>
                  </>
                ) : null}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {top ? (
        <Card className="border-transparent bg-foreground text-background">
          <CardHeader>
            <Badge tone="review" dot>Best match</Badge>
            <CardTitle className="text-background">{top.company}</CardTitle>
            <CardDescription className="text-hero-copy">{top.category}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-[18px] leading-[29px]">
            {top.company_size?.note ? <p>{top.company_size.note}</p> : null}
            {top.reasons.map((reason) => <p key={reason}>{reason}</p>)}
            {top.sources.map((source) => (
              <a key={source.url} className="text-hero-copy underline" href={source.url} target="_blank" rel="noreferrer">
                {source.event_name || "Source"} — {source.confidence}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {rest.map((match) => (
          <Card key={match.sponsor_id} className="bg-surface">
            <CardHeader>
              <CardTitle>{match.company}</CardTitle>
              <CardDescription>{match.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-[16px] leading-6">
              {match.company_size?.note ? <p>{match.company_size.note}</p> : null}
              {match.reasons.map((reason) => <p key={reason}>{reason}</p>)}
              {match.sources.map((source) => (
                <a key={source.url} className="text-primary" href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
              ))}
              <DraftButton requestId={requestId} sponsorId={match.sponsor_id} label={`Write to ${match.company}`} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>The ask is about £5.50 for each person we expect. It waits here until you approve it. Find a contact when the page has none.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {emails.length === 0 ? <DraftButton requestId={requestId} sponsorId={top?.sponsor_id} label="Write the email" /> : null}
          {emails.map((email) => (
            <div key={email.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={email.status === "awaiting_approval" || email.status === "needs_contact" ? "open" : email.status === "approved" ? "review" : "neutral"} dot>
                  {waitingLabel(email.status, email.blocked_reason)}
                </Badge>
                <span>{kindOfMessage(email.kind)}</span>
                {email.ask_gbp ? <span>{money(email.ask_gbp)}</span> : null}
              </div>
              {email.status === "blocked" && email.blocked_reason ? <Alert>{email.blocked_reason}</Alert> : null}
              <h3 className="text-[18px] leading-6 font-medium">{email.subject}</h3>
              <p className="whitespace-pre-wrap text-[16px] leading-6">{email.body}</p>
              {email.status === "awaiting_approval" || email.status === "draft" || email.status === "needs_contact" ? <Decisions id={email.id} body={email.body} status={email.status} /> : <p className="text-muted-foreground">{waitingLabel(email.status, email.blocked_reason)}. Nothing else happens until you say so.</p>}
            </div>
          ))}
          <Link className="text-primary" href="/outbox">Open everything waiting to send</Link>
        </CardContent>
      </Card>
    </>
  );
}
