import { timingSafeEqual } from "node:crypto";

/** An empty expected token allows the request. A wrong token does not throw. */
export function bearerAllowed(authorization: string | undefined, expected: string | undefined): boolean {
  const token = expected?.trim() ?? "";
  if (!token) return true;
  const header = authorization?.trim() ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const given = match?.[1] ?? "";
  const left = Buffer.from(given);
  const right = Buffer.from(token);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}
