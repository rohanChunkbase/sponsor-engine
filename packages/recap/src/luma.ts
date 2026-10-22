/**
 * Read a headcount from a Luma-shaped event.
 * Only numeric aggregate fields are used. Names, emails, and guest rows are ignored.
 */
export function attendeeCountFromLuma(event: unknown): number | undefined {
  if (!event || typeof event !== "object") return undefined;
  const record = event as Record<string, unknown>;
  const direct = positiveInt(record.guest_count) ?? positiveInt(record.attendee_count) ?? positiveInt(record.num_guests);
  if (direct !== undefined) return direct;

  const counts = record.guest_counts;
  if (!counts || typeof counts !== "object") return undefined;
  const approved = (counts as Record<string, unknown>).approved;
  if (!approved || typeof approved !== "object") return undefined;
  return positiveInt((approved as Record<string, unknown>).guests);
}

function positiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}
