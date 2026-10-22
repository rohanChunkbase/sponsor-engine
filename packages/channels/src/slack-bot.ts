import { pathToFileURL } from "node:url";
import { startSlackBot } from "./adapters/slack.js";

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invoked === import.meta.url || process.argv[1]?.endsWith("slack-bot.ts")) {
  const result = await startSlackBot();
  console.log(result.reason);
  if (!result.started) process.exit(0);
}
