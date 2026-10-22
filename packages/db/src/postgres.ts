import { MessageChannel, Worker, receiveMessageOnPort } from "node:worker_threads";
import path from "node:path";
import "pg";
import { repoRoot } from "./db.js";
import type { Db } from "./db.js";
import { scopeSql } from "./scope.js";

function workerFile(): string {
  return path.join(repoRoot(), "packages/db/src/pg-worker.mjs");
}

function schemaFile(): string {
  return path.join(repoRoot(), "packages/db/src/schema.postgres.sql");
}

type Reply = { ok?: boolean; rows?: unknown[]; changes?: number; error?: string };

export function openPostgres(url: string, schemaPath = schemaFile()): Db {
  const worker = new Worker(workerFile());
  let crashed: Error | null = null;
  let pending: Int32Array | null = null;
  worker.on("error", (error) => {
    crashed = error;
    if (pending) {
      Atomics.store(pending, 0, 1);
      Atomics.notify(pending, 0);
    }
  });

  function call(payload: Record<string, unknown>, timeoutMs = 120_000): Reply {
    if (crashed) throw crashed;
    const { port1, port2 } = new MessageChannel();
    const sab = new SharedArrayBuffer(4);
    const flag = new Int32Array(sab);
    Atomics.store(flag, 0, 0);
    pending = flag;
    worker.postMessage({ ...payload, port: port2, sab }, [port2]);
    const status = Atomics.wait(flag, 0, 0, timeoutMs);
    pending = null;
    if (crashed) throw crashed;
    if (status === "timed-out") throw new Error("The database timed out.");
    const received = receiveMessageOnPort(port1);
    port1.close();
    if (!received) throw new Error("The database returned no result.");
    const body = received.message as Reply;
    if (body.error) throw new Error(body.error);
    return body;
  }

  call({ type: "init", url, schemaPath });

  return {
    kind: "postgres",
    exec(sql) {
      call({ type: "exec", sql });
    },
    all<T>(sql: string, params: unknown[] = []) {
      const query = scopeSql(sql, params);
      const body = call({ type: "query", sql: query.sql, params: query.params });
      return (body.rows ?? []) as T[];
    },
    get<T>(sql: string, params: unknown[] = []) {
      const query = scopeSql(sql, params);
      const body = call({ type: "query", sql: query.sql, params: query.params });
      return (body.rows?.[0] as T | undefined) ?? undefined;
    },
    run(sql, params = []) {
      const query = scopeSql(sql, params);
      const body = call({ type: "query", sql: query.sql, params: query.params });
      return { changes: body.changes ?? 0 };
    },
    close() {
      try {
        call({ type: "close" }, 10_000);
      } finally {
        void worker.terminate();
      }
    },
  };
}
