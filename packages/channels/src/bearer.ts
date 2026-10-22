import { timingSafeEqual } from "node:crypto";

/**
 * Check an Authorization header.
 * An empty expected token allows the request. A wrong token does not throw.
 */
export function bearerAllowed(authorization: string | undefined, expected: string | undefined): boolean {
  const token = expected?.trim() ?? "";
  if (!token) return true;
  const header = authorization?.trim() ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return false;
  const left = Buffer.from(match[1]);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
