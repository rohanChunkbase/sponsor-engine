import Link from "next/link";
import { PageIntro } from "@/components/shell";

export default function SettingsPage() {
  return (
    <>
      <PageIntro kicker="Settings" title="How this desk runs">
        Connections, test mode, and the tools Raft uses. Keep this page for setup, not for daily work.
      </PageIntro>
      <ul className="max-w-[480px] space-y-3 text-[16px]">
        <li>
          <Link href="/connections" className="text-raft-chocolate underline">
            Connections
          </Link>
          <span className="text-raft-muted"> — WhatsApp, email, CRM, memory</span>
        </li>
        <li className="text-raft-muted">TEST MODE stays in the header. Nothing is sent while it is on.</li>
      </ul>
    </>
  );
}
