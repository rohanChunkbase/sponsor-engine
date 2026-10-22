import assert from "node:assert/strict";
import { test } from "node:test";
import { toPostgres } from "../src/sql.ts";

test("question marks become postgres placeholders", () => {
  assert.equal(toPostgres("SELECT * FROM requests WHERE id = ?"), "SELECT * FROM requests WHERE id = $1");
  assert.equal(toPostgres("SELECT * FROM events WHERE title LIKE ? OR venue LIKE ?"), "SELECT * FROM events WHERE title ILIKE $1 OR venue ILIKE $2");
});

test("a question mark inside quotes stays in the text", () => {
  assert.equal(toPostgres("SELECT '?' AS q WHERE id = ?"), "SELECT '?' AS q WHERE id = $1");
});
