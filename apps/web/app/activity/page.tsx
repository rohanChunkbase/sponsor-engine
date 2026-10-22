import { ActivityFeed } from "@/components/activity-feed";
import { PageIntro } from "@/components/shell";
import { getReadyDb, listRuns } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default function ActivityPage() {
  const runs = listRuns(getReadyDb(), 40) as Array<{
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
