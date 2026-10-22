import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConnections, type ConnectionCard } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

const groups = ["CRM", "Memory", "Data", "Messaging"] as const;

const groupCopy: Record<(typeof groups)[number], string> = {
  CRM: "Use the built-in sponsor list, or connect a CRM you already use.",
  Memory: "Use the notes on this computer, or connect a memory tool.",
  Data: "The London list is already here. Live feeds are optional.",
  Messaging: "Messages wait for you. Real email is optional.",
};

export default async function ConnectionsPage() {
  const status = await getConnections();
  return (
    <>
      <PageIntro kicker="Connections" title="Bring your own tools, or just use ours">
        Everything works with the built-in tools. Connect another tool only if you already use it. No key is required to start.
      </PageIntro>
      {groups.map((group) => {
        const cards = status.cards.filter((card) => card.group === group);
        const main = cards[0];
        const rest = cards.slice(1);
        return (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="font-sans text-[24px] leading-[30px] font-medium tracking-[-0.025em]">{group}</h2>
            <p className="text-[18px] leading-[29px] text-muted-foreground">{groupCopy[group]}</p>
            {main ? <Connection main card={main} /> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {rest.map((card) => <Connection key={card.id} card={card} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Connection({ card, main = false }: { card: ConnectionCard; main?: boolean }) {
  return (
    <Card className={main ? "bg-foreground text-background" : "bg-surface"}>
      <CardHeader>
        <Badge tone={toneFor(card.state)} dot>{labelFor(card.state)}</Badge>
        <CardTitle className={main ? "text-background" : undefined}>{card.name}</CardTitle>
        <CardDescription className={main ? "text-hero-copy" : undefined}>{card.plain}</CardDescription>
      </CardHeader>
      {card.step ? (
        <CardContent>
          <p className={main ? "text-hero-copy" : "text-[16px] leading-6"}>{card.step}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function labelFor(state: ConnectionCard["state"]): string {
  if (state === "connected") return "Connected";
  if (state === "missing") return "Not connected yet";
  if (state === "coming-soon") return "Coming soon";
  return "Using built-in";
}

function toneFor(state: ConnectionCard["state"]): "review" | "open" | "info" | "neutral" {
  if (state === "connected") return "review";
  if (state === "missing") return "open";
  if (state === "coming-soon") return "neutral";
  return "info";
}
