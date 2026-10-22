/** Tiptap document. Zero stores note bodies in this shape. */
export function tiptap(paragraphs: string[]): {
  type: "doc";
  content: Array<{ type: "paragraph"; content: Array<{ type: "text"; text: string }> }>;
} {
  const content = paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map((text) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text }],
    }));
  return { type: "doc", content };
}

export const DRAFT_BANNER = "Draft only. Do not send this text as email.";

/** Resources this adapter may create. Email and sequence routes are refused. */
export const ZERO_RECORD_RESOURCES = ["companies", "contacts", "deals", "notes"] as const;

export function assertZeroRecordPath(resourcePath: string): void {
  const parts = resourcePath.split("?")[0].split("/").filter(Boolean);
  const resource = parts[1];
  if (parts[0] !== "api" || !ZERO_RECORD_RESOURCES.includes(resource as (typeof ZERO_RECORD_RESOURCES)[number])) {
    throw new Error(
      `Refusing Zero path ${resourcePath}. This adapter creates records and drafts only.`,
    );
  }
}
