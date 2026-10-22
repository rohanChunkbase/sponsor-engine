import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<string>();

const SCOPED = new Set(["requests", "tasks", "quotes", "outbox", "approvals", "agent_runs", "failures"]);

const KEYWORDS = new Set([
  "where", "set", "order", "group", "limit", "left", "right", "inner", "outer", "cross", "full",
  "join", "on", "and", "or", "as", "select", "from", "union", "having", "offset", "returning",
]);

export function currentWorkspace(): string | null {
  return storage.getStore() ?? null;
}

export function runWithWorkspace<T>(workspaceId: string, fn: () => T): T {
  return storage.run(workspaceId, fn);
}

export function enterWorkspace(workspaceId: string): void {
  storage.enterWith(workspaceId);
}

/** Limit visitor rows when a workspace is active. Shared reference tables stay global. */
export function scopeSql(sql: string, params: unknown[] = []): { sql: string; params: unknown[] } {
  const workspaceId = currentWorkspace();
  if (!workspaceId) return { sql, params: [...params] };
  if (/\bworkspace_id\b/i.test(sql)) return { sql, params: [...params] };
  const trimmed = sql.trim();
  if (/^insert\s+into\s+/i.test(trimmed)) return scopeInsert(trimmed, params, workspaceId);
  if (/^(select|update|delete)\b/i.test(trimmed)) return scopeRead(trimmed, params, workspaceId);
  return { sql, params: [...params] };
}

function scopeInsert(sql: string, params: unknown[], workspaceId: string): { sql: string; params: unknown[] } {
  const match = sql.match(/^insert\s+into\s+(\w+)\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*)\)\s*$/i);
  if (!match) return { sql, params: [...params] };
  const table = match[1].toLowerCase();
  if (!SCOPED.has(table)) return { sql, params: [...params] };
  const columns = match[2];
  const values = match[3];
  const next = sql.replace(columns, `${columns}, workspace_id`).replace(values, `${values}, ?`);
  return { sql: next, params: [...params, workspaceId] };
}

function scopeRead(sql: string, params: unknown[], workspaceId: string): { sql: string; params: unknown[] } {
  const re = /\b((?:left|right|inner|cross|full)\s+)?(?:outer\s+)?(from|join|update)\s+([a-zA-Z_][\w]*)\b(?:\s+(?:as\s+)?([a-zA-Z_][\w]*))?/gi;
  const conditions: string[] = [];
  const extra: string[] = [];
  for (const match of sql.matchAll(re)) {
    const table = match[3].toLowerCase();
    if (!SCOPED.has(table)) continue;
    const aliasWord = match[4]?.toLowerCase();
    const alias = aliasWord && !KEYWORDS.has(aliasWord) ? match[4] : match[3];
    const outer = (match[1] ?? "").toLowerCase();
    if (outer.startsWith("left") || outer.startsWith("right")) {
      conditions.push(`(${alias}.workspace_id = ? OR ${alias}.workspace_id IS NULL)`);
    } else {
      conditions.push(`${alias}.workspace_id = ?`);
    }
    extra.push(workspaceId);
  }
  if (conditions.length === 0) return { sql, params: [...params] };
  const clause = conditions.join(" AND ");
  const split = sql.search(/\border\s+by\b|\bgroup\s+by\b|\blimit\b/i);
  const at = split === -1 ? sql.length : split;
  const head = sql.slice(0, at);
  const tail = sql.slice(at);
  const glued = /\bwhere\b/i.test(head) ? `${head} AND ${clause} ${tail}` : `${head} WHERE ${clause} ${tail}`;
  const marks = (head.match(/\?/g) ?? []).length;
  const nextParams = [...params.slice(0, marks), ...extra, ...params.slice(marks)];
  return { sql: glued, params: nextParams };
}
