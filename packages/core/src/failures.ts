import type { Db } from "@sponsor-engine/db";

export function listFailures(db: Db, limit = 20) {
  return db.all("SELECT * FROM failures ORDER BY created_at DESC LIMIT ?", [limit]);
}
