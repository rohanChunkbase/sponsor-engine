import { resetVenueHistory, saveVenueCsv } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  try {
    const db = await readyDb();
    const body = (await request.json()) as { csv?: unknown; reset?: unknown };
    if (body.reset === true) {
      const source = resetVenueHistory(db);
      return Response.json({ reset: true, source: source.source, label: source.label });
    }
    if (typeof body.csv !== "string") {
      return Response.json({ error: "Send the CSV text." }, { status: 400 });
    }
    const saved = saveVenueCsv(body.csv, db);
    return Response.json({
      count: saved.count,
      source: saved.source.source,
      label: saved.source.label,
      winner: saved.report.winner,
      historyCount: saved.report.historyCount,
      testCount: saved.report.testCount,
      scores: saved.report.scores,
      baselineMedian: saved.report.baselineMedian,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not read that file." },
      { status: 400 },
    );
  }
}
