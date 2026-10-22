import { parentPort } from "node:worker_threads";
import fs from "node:fs";
import postgres from "postgres";
import { postgresOptions } from "./pg-options.mjs";
import { splitSql, toPostgres } from "./sql.mjs";

let sql;

function bind(params) {
  return (params ?? []).map((value) => (value === undefined ? null : value));
}

function reply(msg, body) {
  msg.port.postMessage(body);
  const flag = new Int32Array(msg.sab);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
}

parentPort.on("message", async (msg) => {
  try {
    if (msg.type === "init") {
      sql = postgres(msg.url, postgresOptions(msg.url));
      const schema = fs.readFileSync(msg.schemaPath, "utf8");
      for (const statement of splitSql(schema)) {
        await sql.unsafe(statement);
      }
      reply(msg, { ok: true });
      return;
    }
    if (!sql) {
      reply(msg, { error: "The Postgres worker is not connected." });
      return;
    }
    if (msg.type === "exec") {
      for (const statement of splitSql(msg.sql)) {
        await sql.unsafe(toPostgres(statement));
      }
      reply(msg, { ok: true });
      return;
    }
    if (msg.type === "query") {
      const rows = await sql.unsafe(toPostgres(msg.sql), bind(msg.params));
      reply(msg, { rows: Array.from(rows), changes: rows.count ?? 0 });
      return;
    }
    if (msg.type === "close") {
      await sql.end({ timeout: 5 });
      sql = null;
      reply(msg, { ok: true });
      return;
    }
    reply(msg, { error: "Unknown database request." });
  } catch (error) {
    reply(msg, { error: error instanceof Error ? error.message : String(error) });
  }
});
