import { getReadyDb, runDemo } from "@sponsor-engine/core";

const db = getReadyDb();
const result = await runDemo(db);
const lines = [
  "Demo",
  "",
  `Message from ${result.triage.qualified?.organisation || result.triage.qualified?.sender_name}.`,
  `Kind: ${result.triage.qualified?.requester_kind}. People: ${result.triage.qualified?.headcount}. Date: ${result.triage.qualified?.event_date}.`,
  `Task owner: ${result.triage.task?.owner}. Priority: ${result.triage.task?.priority}.`,
  "",
  `Quote: £${result.quote.price}.`,
  result.quote.explanation,
  "",
  "Sponsors:",
  ...result.sponsors.matches.map((match, index) => {
    const source = match.sources[0];
    return `${index + 1}. ${match.company} — ${match.reasons[0] || ""} ${source?.url || ""}`;
  }),
  "",
  `Ask: £${result.draft.ask_gbp} for food.`,
  `Email status: ${result.draft.outbox.status}. Nothing was sent.`,
  `Outbox id: ${result.outbox_id}`,
];
console.log(lines.join("\n"));
