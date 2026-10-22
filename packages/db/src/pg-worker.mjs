import { parentPort } from "node:worker_threads";
import fs from "node:fs";
import pg from "pg";

const { Pool, types } = pg.default ?? pg;
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

let pool;

function toPostgres(sql) {
  let index = 0;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      const start = i;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") break;
        i += 1;
      }
      out += sql.slice(start, i + 1);
      continue;
    }
    if (ch === "?") {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  return out.replace(/\bLIKE\b/g, "ILIKE");
}

function reply(msg, body) {
  msg.port.postMessage(body);
  const flag = new Int32Array(msg.sab);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
}

function sslFor(url) {
  if (/localhost|127\.0\.0\.1/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

parentPort.on("message", async (msg) => {
  try {
    if (msg.type === "init") {
      pool = new Pool({
        connectionString: msg.url,
        max: 3,
        ssl: sslFor(msg.url),
        application_name: "sponsor-engine",
      });
      const schema = fs.readFileSync(msg.schemaPath, "utf8");
      await pool.query(schema);
      reply(msg, { ok: true });
      return;
    }
    if (!pool) {
      reply(msg, { error: "The Postgres worker is not connected." });
      return;
    }
    if (msg.type === "exec") {
      await pool.query(msg.sql);
      reply(msg, { ok: true });
      return;
    }
    if (msg.type === "query") {
      const result = await pool.query(toPostgres(msg.sql), msg.params ?? []);
      reply(msg, { rows: result.rows, changes: result.rowCount ?? 0 });
      return;
    }
    if (msg.type === "close") {
      await pool.end();
      pool = null;
      reply(msg, { ok: true });
      return;
    }
    reply(msg, { error: "Unknown database request." });
  } catch (error) {
    reply(msg, { error: error instanceof Error ? error.message : String(error) });
  }
});
