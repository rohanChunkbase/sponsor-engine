import { Decisions } from "@/components/decisions";
import { PageIntro } from "@/components/shell";
import { RunDemo } from "@/components/run-demo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { kindOfMessage, money, waitingLabel } from "@/lib/labels";
import { getReadyDb, isDryRun, listOutbox } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default function OutboxPage() {
  const items = listOutbox(getReadyDb());
  const testMode = isDryRun();

  return (
    <>
      <PageIntro kicker="To send" title="Waiting for you">
        Every message that would go out waits here. Approve, edit, or skip it. Test mode does not send.
      </PageIntro>
      <Alert>
        <span className="font-medium">{testMode ? "Test mode." : "Live mode."} </span>
        {testMode ? "Nothing is sent, even after you approve." : "A send still needs this address on the allow list."}
      </Alert>
      {items.length === 0 ? (
        <Card className="bg-surface">
          <CardHeader>
            <CardTitle>Nothing is waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <RunDemo primary />
          </CardContent>
        </Card>
      ) : (
        items.map((item) => {
          const waiting = item.status === "awaiting_approval" || item.status === "draft" || item.status === "needs_contact";
          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.status === "awaiting_approval" || item.status === "needs_contact" ? "open" : item.status === "approved" || item.status === "sent" ? "review" : "neutral"} dot>
                    {waitingLabel(item.status, item.blocked_reason)}
                  </Badge>
                  <Badge tone="test" dot>Test mode</Badge>
                  <span className="text-muted-foreground">{kindOfMessage(item.kind)}</span>
                  {item.ask_gbp ? <span>{money(item.ask_gbp)}</span> : null}
                </div>
                <CardTitle>{item.subject}</CardTitle>
                <p className="text-[16px] leading-6 text-muted-foreground">{item.recipient ? `To ${item.recipient}` : "Find a contact"}{item.sponsor_name ? ` · ${item.sponsor_name}` : ""}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="whitespace-pre-wrap text-[16px] leading-6">{item.body}</p>
                {waiting ? <Decisions id={item.id} body={item.body} status={item.status} /> : <p className="text-muted-foreground">{item.blocked_reason || waitingLabel(item.status)}. Nothing was sent from this screen.</p>}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
