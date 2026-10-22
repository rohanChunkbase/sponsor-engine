import { getDb, seed, type Db } from "@sponsor-engine/db";
import { loadEnv } from "./env.js";

let ready = false;

/** Open the database and load the bundled London data the first time. */
export function getReadyDb(): Db {
  loadEnv();
  const db = getDb();
  if (!ready) {
    const row = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sponsors");
    if (!row?.n) seed(db);
    ready = true;
  }
  return db;
}
