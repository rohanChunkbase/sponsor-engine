import { ActivityFeed } from "@/components/activity-feed";
import { PageIntro } from "@/components/shell";
import { listRuns } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const runs = listRuns(await readyDb(), 40) as Array<{
    id: string;
    tool: string;
    output_summary: string | null;
    status: string;
    started_at: string;
  }>;
  return (
    <>
      <PageIntro kicker="Activity" title="What just happened">
        This list updates on its own. It shows each step, including the ones that failed.
      </PageIntro>
      <ActivityFeed initial={runs} />
    </>
  );
}
