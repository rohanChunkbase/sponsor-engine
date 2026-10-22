import type { Db } from "@sponsor-engine/db";
import { makeId, nowIso } from "./util.js";

export function recordRun(
  db: Db,
  input: {
    tool: string;
    inputSummary: string;
    outputSummary: string;
    status?: "ok" | "error";
    requestId?: string | null;
  },
): string {
  const id = makeId("run");
  const at = nowIso();
  db.run(
    `INSERT INTO agent_runs
      (id, tool, input_summary, output_summary, status, started_at, finished_at, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.tool, input.inputSummary, input.outputSummary, input.status ?? "ok", at, at, input.requestId ?? null],
  );
  return id;
}

export function recordFailure(
  db: Db,
  input: { tool: string; message: string; rawInput?: string | null; requestId?: string | null },
): string {
  const id = makeId("fail");
  db.run(
    `INSERT INTO failures (id, tool, request_id, message, raw_input, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.tool, input.requestId ?? null, input.message, input.rawInput ?? null, nowIso()],
  );
  return id;
}
