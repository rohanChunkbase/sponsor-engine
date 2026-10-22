const WORKSPACE_ID = /^[A-Za-z0-9_-]{8,80}$/;

/** Keep a visitor id from the cookie, then from the header. Mint one when both are missing. */
export function chooseWorkspaceId(cookie: string | undefined, header: string | undefined): string {
  if (cookie && WORKSPACE_ID.test(cookie)) return cookie;
  const incoming = header?.trim() ?? "";
  if (WORKSPACE_ID.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function isWorkspaceId(value: string | null | undefined): value is string {
  return Boolean(value && WORKSPACE_ID.test(value));
}
