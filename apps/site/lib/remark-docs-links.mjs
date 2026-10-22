const pages = new Set([
  "quickstart",
  "connect",
  "tools",
  "channels",
  "bring-your-own",
  "safety",
  "self-host",
  "pricing",
  "data",
]);

/** Mintlify links are root paths. The public site serves the same pages under /docs. */
export function rewriteDocUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/docs")) return url;
  const hashAt = url.indexOf("#");
  const path = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const slug = path.replace(/^\//, "");
  if (slug === "" || slug === "quickstart") return `/docs${hash}`;
  if (!pages.has(slug)) return url;
  return `/docs/${slug}${hash}`;
}

export default function remarkDocsLinks() {
  return (tree) => {
    walk(tree);
  };
}

function walk(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "link" && typeof node.url === "string") node.url = rewriteDocUrl(node.url);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}
