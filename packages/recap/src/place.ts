const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function placeLabel(place: string): string {
  const trimmed = place.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const value = Number(trimmed);
  const teen = value % 100;
  const digit = value % 10;
  const suffix = teen >= 11 && teen <= 13 ? "th" : digit === 1 ? "st" : digit === 2 ? "nd" : digit === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

export function formatRecapDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const name = MONTHS[month - 1];
  if (!name) return iso;
  return `${day} ${name} ${year}`;
}

export function recapSlug(eventName: string, date: string): string {
  const base = eventName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "event"}-${date}`;
}
