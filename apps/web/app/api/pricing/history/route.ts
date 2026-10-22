import { saveVenueCsv } from "@sponsor-engine/core";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { csv?: unknown };
    if (typeof body.csv !== "string") {
      return Response.json({ error: "Send the CSV text." }, { status: 400 });
    }
    const saved = saveVenueCsv(body.csv);
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
