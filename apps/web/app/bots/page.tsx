import { PageIntro } from "@/components/shell";

export default function BotsPage() {
  return (
    <>
      <PageIntro kicker="Bots" title="Same tools, thinner channels">
        WhatsApp, Slack, and Cursor all call the same Ask Raft functions. There is no separate bot brain.
      </PageIntro>
      <ul className="max-w-[560px] space-y-3 text-[16px] leading-6 text-raft-ink">
        <li>WhatsApp and email land as inbound messages.</li>
        <li>Cursor MCP uses the catalog on this machine.</li>
        <li>Approve stays on this dashboard. Bots never send.</li>
      </ul>
    </>
  );
}
