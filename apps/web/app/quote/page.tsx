import Link from "next/link";
import { PageIntro } from "@/components/shell";
import { RunDemo } from "@/components/run-demo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceButton } from "@/components/price-button";
import { kindLabel, money } from "@/lib/labels";
import { getReadyDb, latestQuote } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const params = await searchParams;
  const requestId = params.request;
  if (!requestId) {
    return (
      <>
        <PageIntro kicker="Quote" title="No quote yet">
          Open a message from the inbox, or run the demo. The price comes from past bookings, and it says why.
        </PageIntro>
        <RunDemo primary />
      </>
    );
  }
  const db = getReadyDb();
  const request = db.get<{ organisation: string | null; requester_kind: string | null; headcount: number | null; event_date: string | null }>(
    "SELECT * FROM requests WHERE id = ?",
    [requestId],
  );
  const quote = latestQuote(db, requestId) as unknown as QuoteRow | undefined;

  return (
    <>
      <PageIntro kicker="Quote" title={request?.organisation || "Quote"}>
        {request ? `${kindLabel(request.requester_kind)} · ${request.headcount || "?"} people${request.event_date ? ` · ${request.event_date}` : ""}` : "This message is not in the inbox."}
      </PageIntro>
      {!quote ? (
        <Card>
          <CardHeader>
            <CardTitle>Price this booking</CardTitle>
            <CardDescription>We compare it with past community evenings and past company bookings.</CardDescription>
          </CardHeader>
          <CardFooter>
            <PriceButton requestId={requestId} />
          </CardFooter>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{kindLabel(quote.requester_kind)}</Badge>
                <Badge tone="neutral">{quote.source === "pricing-module" ? "Pricing module" : "Past bookings"}</Badge>
              </div>
              <p className="font-sans text-[58px] leading-[64px] font-medium tracking-[-0.025em]">{money(quote.price)}</p>
              <CardDescription>Pounds. Room plus food for the people we expect to come.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {quote.explanation.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-[18px] leading-[29px]">{paragraph}</p>
              ))}
            </CardContent>
          </Card>
          <Contrast lines={quote.lines_json} />
          <div className="flex flex-col gap-3">
            <h2 className="font-sans text-[24px] leading-[30px] font-medium">Closest past bookings</h2>
            {parseComparables(quote.comparables_json).map((row) => (
              <Card key={row.id} className="bg-surface">
                <CardHeader>
                  <CardTitle className="text-[18px] leading-6">{row.title}</CardTitle>
                  <CardDescription>{money(row.price)} · {row.note}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Link className="text-primary" href={`/sponsors?request=${requestId}`}>Find sponsors for this booking</Link>
        </>
      )}
    </>
  );
}

function Contrast({ lines }: { lines: string | null }) {
  const parsed = parseLines(lines);
  if (!parsed?.contrast) return null;
  return (
    <Card className="bg-surface">
      <CardHeader>
        <CardTitle>Community and company</CardTitle>
        <CardDescription>Same evening. Two rates. The lower rate is for communities.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">Community</p>
          <p className="text-[24px] leading-[30px] font-medium">{parsed.contrast.community_per_head ? `${money(parsed.contrast.community_per_head)} / person` : "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">Company</p>
          <p className="text-[24px] leading-[30px] font-medium">{parsed.contrast.company_per_head ? `${money(parsed.contrast.company_per_head)} / person` : "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function parseComparables(value: string | null) {
  try {
    return JSON.parse(value || "[]") as Array<{ id: string; title: string; price: number; note: string }>;
  } catch {
    return [];
  }
}

function parseLines(value: string | null): { contrast?: { community_per_head: number | null; company_per_head: number | null } } | null {
  try {
    return JSON.parse(value || "null");
  } catch {
    return null;
  }
}

type QuoteRow = {
  price: number;
  explanation: string;
  comparables_json: string | null;
  requester_kind: string | null;
  lines_json: string | null;
  source: string;
};
