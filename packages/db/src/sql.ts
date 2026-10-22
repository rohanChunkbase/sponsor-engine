/** Turn SQLite `?` placeholders into Postgres `$1` placeholders. Quoted text stays as written. */
export function toPostgres(sql: string): string {
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
