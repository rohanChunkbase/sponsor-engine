import { pathToFileURL } from "node:url";
import { startDiscordBot } from "./adapters/discord.js";

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invoked === import.meta.url || process.argv[1]?.endsWith("discord-bot.ts")) {
  const result = await startDiscordBot();
  console.log(result.reason);
  if (!result.started) process.exit(0);
}
