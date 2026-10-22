import Link from "next/link";
import { PageIntro } from "@/components/shell";
import { RunDemo } from "@/components/run-demo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AccuracyPanel } from "@/components/accuracy-panel";
import { PriceButton } from "@/components/price-button";
import { kindLabel, money } from "@/lib/labels";
import { historySource, latestQuote } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const params = await searchParams;
  const requestId = params.request;
  if (!requestId) {
    return (
      <>
        <PageIntro kicker="Quote" title="No quote yet">
          Open a message from the inbox, or run the demo. The room price comes from past bookings. Food is a separate cost.
        </PageIntro>
        <RunDemo primary />
        <AccuracyPanel />
      </>
    );
  }
  const db = await readyDb();
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Price this booking</CardTitle>
              <CardDescription>The room price comes from past bookings of the same kind. Food is passed through.</CardDescription>
            </CardHeader>
            <CardFooter>
              <PriceButton requestId={requestId} />
            </CardFooter>
          </Card>
          <AccuracyPanel />
        </>
      ) : (
        <QuoteView requestId={requestId} quote={quote} />
      )}
    </>
  );
}

function QuoteView({ requestId, quote }: { requestId: string; quote: QuoteRow }) {
  const lines = parseLines(quote.lines_json);
  const comparables = parseComparables(quote.comparables_json);
  const range = lines?.range;
  const history = historySource();
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{kindLabel(quote.requester_kind)}</Badge>
            <Badge tone="neutral">Room</Badge>
            {history.source === "sample" ? <Badge tone="open">SAMPLE</Badge> : null}
            {lines && lines.room_gbp === 0 ? <Badge tone="review">Community slot</Badge> : null}
          </div>
          <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
            {lines?.day_total_gbp != null ? "Full day" : "Room"}
          </p>
          <p className="font-sans text-[58px] leading-[64px] font-medium tracking-[-0.025em]">
            {money(lines?.day_total_gbp ?? quote.price)}
          </p>
          <CardDescription>
            {lines?.day_total_gbp != null
              ? `Room ${money(lines.room_gbp)} for the whole ${lines.hours}-hour booking, plus food ${money(lines.food_gbp)}. The room figure is not a price per hour.`
              : range
                ? `Room range ${money(range.low)} to ${money(range.high)}. Food is not in this figure.`
                : "Room price. Food is not in this figure."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {lines?.market_median_gbp != null ? (
            <div className="rounded-[12px] bg-surface px-4 py-3">
              <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">London market check</p>
              <p className="text-[20px] leading-7 font-medium">
                {money(lines.market_low_gbp)} to {money(lines.market_high_gbp)} for about 4 evening hours
              </p>
              <p className="text-muted-foreground">
                Evening median {money(lines.market_median_gbp)}. Published band {money(lines.market_band_low_gbp)} to {money(lines.market_band_high_gbp)}. This quote is a {lines.hours}-hour day, so the market figures are shorter than the booking.
              </p>
            </div>
          ) : null}
          {quote.explanation.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-[18px] leading-[29px]">{paragraph}</p>
          ))}
        </CardContent>
        <CardFooter>
          <PriceButton requestId={requestId} label="Price again" />
        </CardFooter>
      </Card>
      {lines ? <Breakdown lines={lines} /> : null}
      {lines ? <Rates lines={lines} /> : null}
      <div className="flex flex-col gap-3">
        <h2 className="font-sans text-[24px] leading-[30px] font-medium">Comparable past bookings</h2>
        {comparables.length === 0 ? (
          <p className="text-muted-foreground">This quote has no past booking to show.</p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left text-[16px] leading-6">
              <thead className="bg-surface font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Booker</th>
                  <th className="px-4 py-3 font-normal">People</th>
                  <th className="px-4 py-3 font-normal">Hours</th>
                  <th className="px-4 py-3 font-normal">Paid</th>
                  <th className="px-4 py-3 font-normal">Slot</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((row) => (
                  <tr key={row.bookingId} className="border-t border-border">
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3">{kindLabel(row.bookerType)}</td>
                    <td className="px-4 py-3">{row.headcount}</td>
                    <td className="px-4 py-3">{row.hours}</td>
                    <td className="px-4 py-3">{money(row.pricePaidGbp)}</td>
                    <td className="px-4 py-3">{row.freeCommunitySlot ? "Free community" : "Paid"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AccuracyPanel />
      <Link className="text-primary" href={`/sponsors?request=${requestId}`}>Find sponsors for this booking</Link>
    </>
  );
}

function Breakdown({ lines }: { lines: QuoteLines }) {
  const rows = [
    ["Room", lines.room_gbp === 0 ? `${money(0)} · community slot` : money(lines.room_gbp)],
    ["Food and drinks", `${money(lines.food_gbp)} · passed through`],
    ["Sponsor ask", `${money(lines.sponsor_ask_gbp)} · this covers the food`],
  ];
  return (
    <Card className="bg-surface">
      <CardHeader>
        <CardTitle>What the quote is made of</CardTitle>
          <CardDescription>
            {lines.expected_heads} people expected. Food is £5.50 for each person.
          </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
            <p className="text-[20px] leading-7 font-medium">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Rates({ lines }: { lines: QuoteLines }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community and company</CardTitle>
        <CardDescription>Same booking. The community room can be free. A company pays for the room.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">Community room</p>
          <p className="font-sans text-[40px] leading-[48px] font-medium tracking-[-0.025em]">{money(lines.community_room_gbp)}</p>
          <p className="text-muted-foreground">{money(lines.community_range.low)} to {money(lines.community_range.high)}</p>
        </div>
        <div>
          <p className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">Company room</p>
          <p className="font-sans text-[40px] leading-[48px] font-medium tracking-[-0.025em]">{money(lines.company_room_gbp)}</p>
          <p className="text-muted-foreground">{money(lines.company_range.low)} to {money(lines.company_range.high)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function parseComparables(value: string | null): RoomComparable[] {
  try {
    const rows = JSON.parse(value || "[]") as Array<Record<string, unknown>>;
    return rows.flatMap((row) => {
      if (typeof row.bookingId === "string") {
        return [{
          bookingId: row.bookingId,
          date: String(row.date ?? ""),
          bookerType: String(row.bookerType ?? ""),
          headcount: Number(row.headcount ?? 0),
          hours: Number(row.hours ?? 0),
          pricePaidGbp: Number(row.pricePaidGbp ?? 0),
          freeCommunitySlot: Boolean(row.freeCommunitySlot),
        }];
      }
      if (typeof row.id === "string") {
        return [{
          bookingId: row.id,
          date: String(row.date ?? ""),
          bookerType: String(row.requester_kind ?? ""),
          headcount: Number(row.headcount ?? 0),
          hours: 0,
          pricePaidGbp: Number(row.price ?? 0),
          freeCommunitySlot: false,
        }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function parseLines(value: string | null): QuoteLines | null {
  try {
    const lines = JSON.parse(value || "null") as QuoteLines | null;
    if (!lines || typeof lines.room_gbp !== "number" || typeof lines.food_gbp !== "number") return null;
    if (!lines.community_range || !lines.company_range || !lines.range) return null;
    return lines;
  } catch {
    return null;
  }
}

type RoomComparable = {
  bookingId: string;
  date: string;
  bookerType: string;
  headcount: number;
  hours: number;
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
};

type QuoteLines = {
  room_gbp: number;
  food_gbp: number;
  expected_heads: number;
  show_up_rate: number;
  food_per_head: number;
  sponsor_ask_gbp: number;
  range: { low: number; high: number };
  community_room_gbp: number;
  community_range: { low: number; high: number };
  company_room_gbp: number;
  company_range: { low: number; high: number };
  hours?: number;
  day_total_gbp?: number;
  market_low_gbp?: number;
  market_high_gbp?: number;
  market_median_gbp?: number;
  market_band_low_gbp?: number;
  market_band_high_gbp?: number;
};

type QuoteRow = {
  price: number;
  explanation: string;
  comparables_json: string | null;
  requester_kind: string | null;
  lines_json: string | null;
  source: string;
};
