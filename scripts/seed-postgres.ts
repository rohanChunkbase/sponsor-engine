import { loadEnv } from "../packages/core/src/env.ts";
import { getDb, seed } from "@sponsor-engine/db";

loadEnv();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Set DATABASE_URL to your Postgres or Supabase URL.");
  process.exit(1);
}

const db = getDb();
const counts = seed(db);
console.log(JSON.stringify(counts, null, 2));
db.close();
