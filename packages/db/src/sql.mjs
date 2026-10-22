/** Turn SQLite `?` placeholders into Postgres `$1` placeholders. Quoted text stays as written. */
export function toPostgres(sql) {
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

/** Split a SQL script on semicolons. Quotes, comments, and dollar quotes stay intact. */
export function splitSql(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  let dollar = null;
  let inSingle = false;

  while (i < sql.length) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        current += dollar;
        i += dollar.length;
        dollar = null;
      } else {
        current += sql[i];
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      current += sql[i];
      if (sql[i] === "'" && sql[i + 1] === "'") {
        current += sql[i + 1];
        i += 2;
        continue;
      }
      if (sql[i] === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 1);
      current += chunk;
      i += chunk.length;
      continue;
    }

    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
      current += chunk;
      i += chunk.length;
      continue;
    }

    if (sql[i] === "'") {
      inSingle = true;
      current += "'";
      i += 1;
      continue;
    }

    if (sql[i] === "$") {
      const match = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (match) {
        dollar = match[0];
        current += dollar;
        i += dollar.length;
        continue;
      }
    }

    if (sql[i] === ";") {
      push(current);
      current = "";
      i += 1;
      continue;
    }

    current += sql[i];
    i += 1;
  }

  push(current);
  return statements;

  function push(value) {
    const statement = value.trim();
    if (!statement) return;
    const code = statement.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").trim();
    if (code) statements.push(statement);
  }
}
