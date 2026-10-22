import { inbox, isDryRun, listOutbox } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readyDb();
    const data = inbox(db);
    return Response.json({
      requests: data.requests,
      failures: data.failures,
      outbox: listOutbox(db),
      queue: data.queue,
      test_mode: isDryRun(),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load requests." }, { status: 500 });
  }
}
